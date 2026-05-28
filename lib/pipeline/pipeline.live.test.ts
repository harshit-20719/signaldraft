import { describe, it, expect } from "vitest";
import { runPipeline } from "@/lib/pipeline/index";
import type {
  Prospect,
  RunRecord,
  SellerContext,
  StageEvent,
} from "@/lib/types";

// LIVE end-to-end test — the Day-3 milestone: the full pipeline runs from a
// terminal against real Claude + Tavily, all five stages, real verdict, real
// draft. Skipped during normal `npm test`. Run:
//   set -a && . ./.env.local && set +a && LIVE=1 npx vitest run lib/pipeline/pipeline.live.test.ts
// Live AI/search is non-deterministic, so we assert SHAPE and completion and log
// the whole run for eyeballing the verdict + draft quality.
const live = process.env.LIVE === "1";

const seller: SellerContext = {
  company: "Zamp",
  product: "finance-ops automation that speeds up the monthly close",
  valueProps: ["faster close", "fewer manual reconciliations"],
  targetBuyer: "finance leaders, CFO to Head of AP",
};

async function runToCompletion(
  gen: AsyncGenerator<StageEvent, RunRecord, void>,
): Promise<{ events: StageEvent[]; record: RunRecord }> {
  const events: StageEvent[] = [];
  let res = await gen.next();
  while (!res.done) {
    console.log(
      `  · ${res.value.stage}:${res.value.status}${res.value.summary ? " — " + res.value.summary : ""}`,
    );
    events.push(res.value);
    res = await gen.next();
  }
  return { events, record: res.value };
}

function report(label: string, record: RunRecord) {
  console.log(`\n=== ${label}: ${record.verdict} (${record.timings.durationMs}ms) ===`);
  if (record.hook) console.log(`HOOK: ${record.hook.what}\n  why: ${record.hook.why}`);
  if (record.flags.length)
    console.log("FLAGS: " + record.flags.map((f) => f.type).join(", "));
  console.log(`SIGNALS (${record.signals.length}):`);
  for (const s of record.signals.slice(0, 6)) {
    console.log(
      `  [${s.subject}/${s.type}${s.negative ? "/NEG" : ""}] total=${s.scores.total} (r=${s.scores.recency} sp=${s.scores.specificity} rel=${s.scores.relevance}) ${s.what}`,
    );
  }
  if (record.draft) {
    console.log(`\nDRAFT subject: ${record.draft.subject}`);
    console.log(record.draft.body);
  } else {
    console.log(`NO DRAFT. Recommendation: ${record.recommendation}`);
  }
}

describe.skipIf(!live)("full pipeline (LIVE — Day-3 milestone)", () => {
  it("runs end-to-end for a real finance leader and produces a verdict (+ draft if usable)", async () => {
    const prospect: Prospect = { name: "Amy Hood", company: "Microsoft", role: "CFO" };
    const { events, record } = await runToCompletion(runPipeline(prospect, seller));
    report("KNOWN LEADER", record);

    expect(["HIGH", "MEDIUM", "SKIP"]).toContain(record.verdict);
    expect(record.timings.durationMs).toBeGreaterThan(0);
    expect(events[0].stage).toBe("resolve");
    // A non-SKIP run must produce a grounded draft; a SKIP run must not.
    if (record.verdict === "SKIP") {
      expect(record.draft).toBeNull();
      expect(record.recommendation).toBeTruthy();
    } else {
      expect(record.draft).not.toBeNull();
      expect(record.draft?.body).not.toContain("—"); // no em-dash AI tell
      expect(record.hook).toBeDefined();
    }
  }, 120000);

  it("honestly SKIPs a no-footprint prospect (thin signal, AE3)", async () => {
    const prospect: Prospect = {
      name: "Zzqx Vanterpoolington",
      company: "Nonexistent Holdings LLC 99821",
    };
    const { record } = await runToCompletion(runPipeline(prospect, seller));
    report("OBSCURE", record);

    // Either Gate 2 trips (rare) or — more likely — extract filters everything
    // out and Gate 3 SKIPs. Either way: an honest SKIP, no fabricated draft.
    expect(record.verdict).toBe("SKIP");
    expect(record.draft).toBeNull();
    expect(record.recommendation).toBeTruthy();
  }, 120000);
});
