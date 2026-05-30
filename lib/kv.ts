import { Redis } from "@upstash/redis";

// The low-level "filing cabinet" SignalDraft writes runs into (U8, KTD4). We
// keep the interface tiny — only the handful of operations the run store and
// the rate limiter actually need — so it is easy to back two different ways:
//
//   - Upstash Redis (production / once the env vars are set): a real shared
//     key-value store on the internet that every copy of the deployed app can
//     read and write, which is the whole point of a shareable dashboard.
//   - In-memory (local dev when no store is configured): a plain object that
//     lives inside the running process. It lets the app run end-to-end on a
//     laptop with zero setup. It is NOT shared across processes and is wiped on
//     restart — fine for trying things locally, never for production.
//
// Selection is automatic: if the Upstash env vars are present we use Redis;
// otherwise we fall back to memory and warn once so the choice is never silent.

export interface KvBackend {
  // List ops — the run-id index (newest-first via LPUSH at the head).
  lpush(key: string, value: string): Promise<void>;
  ltrim(key: string, start: number, stop: number): Promise<void>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  // Key/value ops — the run records and the rate-limit counters.
  set(key: string, value: unknown, opts?: { ttlSeconds?: number }): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  mget<T>(keys: string[]): Promise<(T | null)[]>;
}

// ---------------------------------------------------------------------------
// Upstash (real Redis) backend
// ---------------------------------------------------------------------------

// The Vercel Upstash integration injects KV_REST_API_* env vars; a direct
// Upstash signup gives UPSTASH_REDIS_REST_* names. Support both so the same
// code works however the store was provisioned (avoids a deploy-day surprise).
function upstashEnv(): { url: string; token: string } | null {
  const url =
    process.env.KV_REST_API_URL?.trim() ||
    process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token =
    process.env.KV_REST_API_TOKEN?.trim() ||
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return { url, token };
}

function createUpstashBackend(url: string, token: string): KvBackend {
  // The Upstash client auto-serializes objects to JSON on write and parses them
  // back on read, so `set`/`get` can take and return real objects directly.
  const redis = new Redis({ url, token });
  return {
    async lpush(key, value) {
      await redis.lpush(key, value);
    },
    async ltrim(key, start, stop) {
      await redis.ltrim(key, start, stop);
    },
    lrange(key, start, stop) {
      return redis.lrange<string>(key, start, stop);
    },
    async set(key, value, opts) {
      if (opts?.ttlSeconds != null) {
        await redis.set(key, value, { ex: opts.ttlSeconds });
      } else {
        await redis.set(key, value);
      }
    },
    get<T>(key: string) {
      return redis.get<T>(key);
    },
    async mget<T>(keys: string[]) {
      if (keys.length === 0) return []; // Redis MGET requires ≥1 key
      return redis.mget<(T | null)[]>(...keys);
    },
  };
}

// ---------------------------------------------------------------------------
// In-memory (dev fallback) backend
// ---------------------------------------------------------------------------

interface MemEntry {
  value: unknown;
  expiresAtMs?: number;
}

// Exported so tests can build a clean, isolated backend and exercise the real
// store/ratelimit logic without any network or mocking.
export function createMemoryBackend(): KvBackend {
  const lists = new Map<string, string[]>();
  const kv = new Map<string, MemEntry>();

  const live = (key: string): MemEntry | undefined => {
    const entry = kv.get(key);
    if (!entry) return undefined;
    if (entry.expiresAtMs != null && Date.now() >= entry.expiresAtMs) {
      kv.delete(key); // lazy expiry — good enough for local dev
      return undefined;
    }
    return entry;
  };

  return {
    async lpush(key, value) {
      const list = lists.get(key) ?? [];
      list.unshift(value); // newest at the head, mirroring Redis LPUSH
      lists.set(key, list);
    },
    async ltrim(key, start, stop) {
      const list = lists.get(key) ?? [];
      // Redis LTRIM keeps [start..stop] inclusive; stop = -1 means "to the end".
      const end = stop < 0 ? list.length : stop + 1;
      lists.set(key, list.slice(start, end));
    },
    async lrange(key, start, stop) {
      const list = lists.get(key) ?? [];
      const end = stop < 0 ? list.length : stop + 1;
      return list.slice(start, end);
    },
    async set(key, value, opts) {
      kv.set(key, {
        value,
        expiresAtMs:
          opts?.ttlSeconds != null
            ? Date.now() + opts.ttlSeconds * 1000
            : undefined,
      });
    },
    async get<T>(key: string) {
      return (live(key)?.value as T) ?? null;
    },
    async mget<T>(keys: string[]) {
      return keys.map((k) => (live(k)?.value as T) ?? null);
    },
  };
}

// ---------------------------------------------------------------------------
// Backend selection (singleton)
// ---------------------------------------------------------------------------

let backend: KvBackend | null = null;
let warned = false;

export function getKv(): KvBackend {
  if (backend) return backend;
  const env = upstashEnv();
  if (env) {
    backend = createUpstashBackend(env.url, env.token);
  } else {
    if (!warned) {
      warned = true;
      console.warn(
        "[signaldraft] No Upstash env vars found — using the in-memory store " +
          "(local dev only; runs are not shared and are lost on restart). Set " +
          "KV_REST_API_URL + KV_REST_API_TOKEN to use the real shared store.",
      );
    }
    backend = createMemoryBackend();
  }
  return backend;
}
