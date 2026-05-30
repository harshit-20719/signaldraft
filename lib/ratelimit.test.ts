import { describe, it, expect } from "vitest";
import { createMemoryBackend } from "@/lib/kv";
import { checkRateLimit } from "@/lib/ratelimit";
import { config } from "@/lib/config";

// Deterministic: time is passed in via `nowMs`, so the window + reset behaviour
// is tested without any real waiting. Runs against a fresh in-memory backend.

const { maxPerWindow, windowSeconds } = config.ratelimit;
const T0 = Date.parse("2026-05-28T12:00:00Z");

describe("checkRateLimit", () => {
  it("allows up to the cap, then blocks within the window", async () => {
    const kv = createMemoryBackend();
    // The first `maxPerWindow` runs are allowed.
    for (let i = 0; i < maxPerWindow; i++) {
      const r = await checkRateLimit("1.1.1.1", kv, T0);
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(maxPerWindow - (i + 1));
    }
    // The next one within the same window is blocked.
    const blocked = await checkRateLimit("1.1.1.1", kv, T0 + 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets after the window elapses", async () => {
    const kv = createMemoryBackend();
    for (let i = 0; i < maxPerWindow; i++) {
      await checkRateLimit("2.2.2.2", kv, T0);
    }
    expect((await checkRateLimit("2.2.2.2", kv, T0)).allowed).toBe(false);

    // Jump just past the window — the counter resets and runs are allowed again.
    const afterWindow = T0 + windowSeconds * 1000 + 1;
    const r = await checkRateLimit("2.2.2.2", kv, afterWindow);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(maxPerWindow - 1);
  });

  it("tracks each IP independently", async () => {
    const kv = createMemoryBackend();
    for (let i = 0; i < maxPerWindow; i++) {
      await checkRateLimit("3.3.3.3", kv, T0);
    }
    expect((await checkRateLimit("3.3.3.3", kv, T0)).allowed).toBe(false);
    // A different IP is unaffected.
    expect((await checkRateLimit("4.4.4.4", kv, T0)).allowed).toBe(true);
  });
});
