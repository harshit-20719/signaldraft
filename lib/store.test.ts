import { describe, it, expect } from "vitest";
import { createMemoryBackend } from "@/lib/kv";
import { saveRun, listRuns, getRun } from "@/lib/store";
import type { RunRecord } from "@/lib/types";

// These run against a fresh in-memory backend per test — no network, no mocks.
// Because the in-memory backend implements the same KvBackend contract as the
// real Upstash one, this exercises the actual saveRun/listRuns/getRun logic
// (atomic id list + record-by-id), not a stand-in for it.

function makeRecord(id: string, name: string): RunRecord {
  const startedAt = Date.parse("2026-05-28T12:00:00Z");
  return {
    id,
    createdAt: new Date(startedAt).toISOString(),
    prospect: { name, company: "Acme" },
    seller: {
      company: "Zamp",
      product: "finance-ops automation",
      valueProps: ["faster close"],
      targetBuyer: "finance leaders",
    },
    verdict: "HIGH",
    hook: { what: "did a thing", url: "https://example.com/x", why: "recent" },
    signals: [],
    draft: { subject: "Hi", body: "..." },
    flags: [],
    timings: { startedAt, finishedAt: startedAt + 1000, durationMs: 1000 },
  };
}

describe("run store", () => {
  it("saves a run and reads it back newest-first", async () => {
    const kv = createMemoryBackend();
    await saveRun(makeRecord("a", "First"), kv);
    await saveRun(makeRecord("b", "Second"), kv);
    await saveRun(makeRecord("c", "Third"), kv);

    const runs = await listRuns(kv);
    expect(runs.map((r) => r.id)).toEqual(["c", "b", "a"]); // newest-first
    expect(runs[0].prospect.name).toBe("Third");
  });

  it("getRun returns the full record by id", async () => {
    const kv = createMemoryBackend();
    await saveRun(makeRecord("a", "Jane"), kv);
    const run = await getRun("a", kv);
    expect(run).not.toBeNull();
    expect(run?.prospect.name).toBe("Jane");
    expect(run?.verdict).toBe("HIGH");
  });

  it("listRuns on an empty store returns an empty list (no crash)", async () => {
    const kv = createMemoryBackend();
    expect(await listRuns(kv)).toEqual([]);
  });

  it("getRun with an unknown id returns null", async () => {
    const kv = createMemoryBackend();
    expect(await getRun("nope", kv)).toBeNull();
  });

  it("caps the list so it cannot grow unbounded", async () => {
    const kv = createMemoryBackend();
    // Save more than the cap; only the most recent config.store.listCap survive.
    for (let i = 0; i < 60; i++) {
      await saveRun(makeRecord(`id-${i}`, `P${i}`), kv);
    }
    const runs = await listRuns(kv);
    expect(runs.length).toBeLessThanOrEqual(50);
    expect(runs[0].id).toBe("id-59"); // newest still first
  });
});
