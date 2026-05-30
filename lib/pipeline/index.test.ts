import { describe, it, expect } from "vitest";
import { runPipeline, type StageFns } from "@/lib/pipeline/index";
import type {
  ExtractedSignal,
  Prospect,
  RawResult,
  RunRecord,
  SellerContext,
  Signal,
  StageEvent,
} from "@/lib/types";

const prospect: Prospect = { name: "Jane Finance", company: "Acme Corp" };

const seller: SellerContext = {
  company: "Zamp",
  product: "finance-ops automation",
  valueProps: ["faster close", "fewer manual reconciliations"],
  targetBuyer: "finance leaders, CFO to Head of AP",
};

// Deterministic fake stages. These keep the orchestrator tests offline and
// repeatable — we're testing the orchestration logic (ordering, gates), NOT the
// real Claude/Tavily stages, so none of these touch the network.
// Two results so the run clears Gate 2's floor (config.gather.minResults).
const fakeRaw: RawResult[] = [
  {
    title: "Jane on the close process",
    snippet: "Jane discussed automating the monthly close.",
    url: "https://example.com/1",
    publishedDate: "2026-05-10",
    sourceType: "news",
  },
  {
    title: "Acme Corp expands finance team",
    snippet: "Acme announced finance-ops hiring.",
    url: "https://example.com/2",
    publishedDate: "2026-04-20",
    sourceType: "press",
  },
];

// extract's output: judged but not yet scored (carries Claude's relevance read).
const fakeExtracted: ExtractedSignal[] = [
  {
    what: "Spoke about automating the monthly close",
    when: "2026-05-10",
    source: "example.com",
    url: "https://example.com/1",
    subject: "person",
    type: "talk",
    negative: false,
    relevance: "high",
  },
];

// score's output: the same signal with the code-computed scores attached.
const fakeScored: Signal[] = [
  {
    what: "Spoke about automating the monthly close",
    when: "2026-05-10",
    source: "example.com",
    url: "https://example.com/1",
    subject: "person",
    type: "talk",
    negative: false,
    scores: { recency: 0.9, specificity: 0.9, relevance: 0.8, total: 0.87 },
  },
];

const fakeStages: StageFns = {
  resolve: async (p) => ({
    name: p.name,
    company: p.company,
    confidence: "high",
  }),
  gather: async () => fakeRaw,
  extract: async () => fakeExtracted,
  score: () => ({
    verdict: "HIGH",
    signals: fakeScored,
    hook: {
      what: fakeScored[0].what,
      url: fakeScored[0].url,
      why: "highest-scoring signal",
    },
    flags: [],
  }),
  draft: async ({ verdict, hook }) =>
    verdict === "SKIP" || !hook
      ? null
      : { subject: "Quick thought", body: "..." },
  selfcheck: async ({ draft }) => ({
    revised: false,
    note: "Meets the bar — no changes.",
    draft,
  }),
};

// Drive the async generator to completion, collecting every emitted event and
// the final returned RunRecord.
async function runToCompletion(
  gen: AsyncGenerator<StageEvent, RunRecord, void>,
): Promise<{ events: StageEvent[]; record: RunRecord }> {
  const events: StageEvent[] = [];
  let res = await gen.next();
  while (!res.done) {
    events.push(res.value);
    res = await gen.next();
  }
  return { events, record: res.value };
}

// Compact "stage:status" trail, handy for asserting ordering.
function trail(events: StageEvent[]): string[] {
  return events.map((e) => `${e.stage}:${e.status}`);
}

describe("runPipeline (orchestrator)", () => {
  it("happy path: emits stages in order and returns a complete RunRecord", async () => {
    const { events, record } = await runToCompletion(
      runPipeline(prospect, seller, fakeStages),
    );

    expect(trail(events)).toEqual([
      "resolve:running",
      "resolve:done",
      "gather:running",
      "gather:done",
      "extract:running",
      "extract:done",
      "score:running",
      "score:done",
      "draft:running",
      "draft:done",
      "selfcheck:running",
      "selfcheck:done",
    ]);

    expect(record.verdict).toBe("HIGH");
    expect(record.draft).not.toBeNull();
    expect(record.selfCheck).toEqual({
      revised: false,
      note: "Meets the bar — no changes.",
    });
    expect(record.signals.length).toBeGreaterThan(0);
    expect(record.hook).toBeDefined();
    expect(record.identity?.name).toBe("Jane Finance");
    expect(typeof record.id).toBe("string");
    expect(record.id.length).toBeGreaterThan(0);
    expect(record.timings.durationMs).toBeGreaterThanOrEqual(0);
    expect(record.prospect).toEqual(prospect);
  });

  it("Gate 2 fail: no signals short-circuits later stages into SKIP, no crash", async () => {
    const stages: StageFns = { ...fakeStages, gather: async () => [] };
    const { events, record } = await runToCompletion(
      runPipeline(prospect, seller, stages),
    );

    // Downstream stages are explicitly marked skipped (not silently dropped).
    expect(trail(events)).toEqual([
      "resolve:running",
      "resolve:done",
      "gather:running",
      "gather:done",
      "extract:skipped",
      "score:skipped",
      "draft:skipped",
      "selfcheck:skipped",
    ]);

    expect(record.verdict).toBe("SKIP");
    expect(record.draft).toBeNull();
    expect(record.recommendation).toBeTruthy();
    expect(record.flags.some((f) => f.type === "insufficient_signal")).toBe(true);
  });

  it("Gate 1 low confidence is non-blocking: run still completes, flag attached", async () => {
    const stages: StageFns = {
      ...fakeStages,
      resolve: async (p) => ({
        name: p.name,
        company: p.company,
        confidence: "low",
        note: "Common name — could be several people.",
      }),
    };
    const { record } = await runToCompletion(runPipeline(prospect, seller, stages));

    expect(record.verdict).toBe("HIGH"); // did not stop the run
    expect(record.flags.some((f) => f.type === "low_confidence_identity")).toBe(true);
  });

  it("Gate 3 SKIP verdict: drafting is skipped and no draft is produced", async () => {
    const stages: StageFns = {
      ...fakeStages,
      score: () => ({
        verdict: "SKIP" as const,
        signals: [],
        flags: [{ type: "no_safe_hook" as const, message: "No safe hook." }],
        recommendation: "Use a generic template.",
      }),
    };
    const { events, record } = await runToCompletion(
      runPipeline(prospect, seller, stages),
    );

    expect(trail(events)).toContain("draft:skipped");
    expect(trail(events)).toContain("selfcheck:skipped");
    expect(trail(events)).not.toContain("draft:done");
    expect(record.verdict).toBe("SKIP");
    expect(record.draft).toBeNull();
    expect(record.recommendation).toBe("Use a generic template.");
  });

  it("self-check revises the draft: the revised text is what gets saved", async () => {
    const stages: StageFns = {
      ...fakeStages,
      selfcheck: async () => ({
        revised: true,
        note: "Tightened the opener and removed a tell.",
        draft: { subject: "Revised subject", body: "Revised body" },
      }),
    };
    const { events, record } = await runToCompletion(
      runPipeline(prospect, seller, stages),
    );

    expect(trail(events)).toContain("selfcheck:done");
    expect(record.draft).toEqual({ subject: "Revised subject", body: "Revised body" });
    expect(record.selfCheck).toEqual({
      revised: true,
      note: "Tightened the opener and removed a tell.",
    });
  });
});
