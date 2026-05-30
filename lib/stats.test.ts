import { describe, expect, it } from "vitest";
import { computeStats } from "@/lib/stats";
import type {
  Draft,
  Hook,
  RunRecord,
  Signal,
  SignalSubject,
  Verdict,
} from "@/lib/types";

// U12 — the dashboard metrics are computed by code, so they get the same
// deterministic test treatment as the scoring engine. These fixtures exercise
// the denominators that matter: drafted-vs-skip splits, person-vs-company hooks,
// and the empty store.

function makeSignal(url: string, subject: SignalSubject): Signal {
  return {
    what: `signal at ${url}`,
    source: "example.com",
    url,
    subject,
    type: "leadership",
    negative: false,
    scores: { recency: 1, specificity: subject === "person" ? 1 : 0.5, relevance: 1, total: 0.9 },
  };
}

// Build a RunRecord with sensible defaults; override only what a test cares about.
function makeRun(opts: {
  verdict: Verdict;
  durationMs: number;
  hook?: Hook;
  signals?: Signal[];
  draft?: Draft | null;
}): RunRecord {
  const drafted = opts.verdict !== "SKIP";
  return {
    id: `run-${Math.round(opts.durationMs)}-${opts.verdict}`,
    createdAt: "2026-05-30T00:00:00.000Z",
    prospect: { name: "Test Person", company: "TestCo" },
    seller: { company: "Zamp", product: "x", valueProps: [], targetBuyer: "y" },
    verdict: opts.verdict,
    hook: opts.hook,
    signals: opts.signals ?? [],
    draft: opts.draft !== undefined ? opts.draft : drafted ? { subject: "s", body: "b" } : null,
    flags: [],
    timings: { startedAt: 0, finishedAt: opts.durationMs, durationMs: opts.durationMs },
  };
}

describe("computeStats", () => {
  it("returns nulls (not NaN) for an empty store", () => {
    const s = computeStats([]);
    expect(s.totalRuns).toBe(0);
    expect(s.draftedRuns).toBe(0);
    expect(s.skipRuns).toBe(0);
    expect(s.hookSpecificity).toBeNull();
    expect(s.grounding).toBeNull();
    expect(s.avgTimeToDraftMs).toBeNull();
    expect(s.honestAbstention).toBe(0);
  });

  it("scores a single HIGH person-hook run at 100% specificity and grounding", () => {
    const url = "https://news.example.com/a";
    const s = computeStats([
      makeRun({
        verdict: "HIGH",
        durationMs: 8000,
        hook: { what: "spoke at a conf", url, why: "recent + personal" },
        signals: [makeSignal(url, "person")],
      }),
    ]);
    expect(s.draftedRuns).toBe(1);
    expect(s.hookSpecificity).toBe(1);
    expect(s.grounding).toBe(1);
    expect(s.honestAbstention).toBe(0);
    expect(s.avgTimeToDraftMs).toBe(8000);
  });

  it("computes mixed rates over a HIGH(person) + MEDIUM(company) + SKIP set", () => {
    const personUrl = "https://p.example.com";
    const companyUrl = "https://c.example.com";
    const s = computeStats([
      makeRun({
        verdict: "HIGH",
        durationMs: 10000,
        hook: { what: "p", url: personUrl, why: "" },
        signals: [makeSignal(personUrl, "person")],
      }),
      makeRun({
        verdict: "MEDIUM",
        durationMs: 20000,
        hook: { what: "c", url: companyUrl, why: "" },
        signals: [makeSignal(companyUrl, "company")],
      }),
      makeRun({ verdict: "SKIP", durationMs: 5000 }),
    ]);
    expect(s.totalRuns).toBe(3);
    expect(s.draftedRuns).toBe(2);
    expect(s.skipRuns).toBe(1);
    expect(s.hookSpecificity).toBe(0.5); // 1 of 2 drafts is person-level
    expect(s.grounding).toBe(1); // both drafts cite a real source
    expect(s.honestAbstention).toBeCloseTo(1 / 3);
    expect(s.avgTimeToDraftMs).toBe(15000); // mean of 10000 and 20000, SKIP excluded
  });

  it("reports 100% honest abstention and null draft-metrics when every run SKIPs", () => {
    const s = computeStats([
      makeRun({ verdict: "SKIP", durationMs: 4000 }),
      makeRun({ verdict: "SKIP", durationMs: 6000 }),
    ]);
    expect(s.honestAbstention).toBe(1);
    expect(s.hookSpecificity).toBeNull();
    expect(s.grounding).toBeNull();
    expect(s.avgTimeToDraftMs).toBeNull();
  });

  it("counts a grounded company-hook as specificity 0, grounding 1", () => {
    const url = "https://c2.example.com";
    const s = computeStats([
      makeRun({
        verdict: "MEDIUM",
        durationMs: 12000,
        hook: { what: "company raised", url, why: "" },
        signals: [makeSignal(url, "company")],
      }),
    ]);
    expect(s.hookSpecificity).toBe(0);
    expect(s.grounding).toBe(1);
  });
});
