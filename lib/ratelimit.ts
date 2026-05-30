import { config } from "@/lib/config";
import { getKv, type KvBackend } from "@/lib/kv";

// Per-IP run cap for POST /api/run (U8, KTD10). The deployed app is public and
// every run spends real money, so we cap how many runs one IP can start in a
// rolling window. This is *soft* in-app defense — the hard ceiling is the spend
// cap set in the Anthropic/Tavily dashboards. Because it's soft, the small
// read-modify-write race under bursts (two concurrent requests both reading the
// same count) is acceptable: worst case an IP gets one extra run, never a
// runaway bill.
//
// The window is tracked as a small record { count, windowStartMs } stored under
// the IP's key with a TTL. `nowMs` is injectable so the reset behaviour is
// deterministic in tests (same pattern as scoring's `now`).

interface RateWindow {
  count: number;
  windowStartMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number; // runs left in the current window after this check
  retryAfterSeconds: number; // when blocked, seconds until the window resets
}

const { keyPrefix, maxPerWindow, windowSeconds } = config.ratelimit;
const windowMs = windowSeconds * 1000;

export async function checkRateLimit(
  ip: string,
  kv: KvBackend = getKv(),
  nowMs: number = Date.now(),
): Promise<RateLimitResult> {
  const key = `${keyPrefix}${ip}`;
  const existing = await kv.get<RateWindow>(key);

  // No window yet, or the previous one has fully elapsed -> start a fresh one.
  const windowExpired =
    !existing || nowMs - existing.windowStartMs >= windowMs;
  const window: RateWindow = windowExpired
    ? { count: 0, windowStartMs: nowMs }
    : existing;

  if (window.count >= maxPerWindow) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((window.windowStartMs + windowMs - nowMs) / 1000),
    );
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  // Count this run and persist the window with a TTL so the key self-cleans.
  window.count += 1;
  await kv.set(key, window, { ttlSeconds: windowSeconds });
  return {
    allowed: true,
    remaining: maxPerWindow - window.count,
    retryAfterSeconds: 0,
  };
}
