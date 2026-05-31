import { randomUUID } from "node:crypto";
import type {
  Draft,
  ExtractedSignal,
  Flag,
  Hook,
  Identity,
  Prospect,
  RawResult,
  RunRecord,
  ScoreResult,
  SelfCheckOutcome,
  SelfCheckResult,
  SellerContext,
  Signal,
  StageEvent,
  StageName,
  Verdict,
} from "@/lib/types";
import { config } from "@/lib/config";
import { resolve as resolveStage } from "@/lib/pipeline/resolve";
import { gather as gatherStage, passesGate2 } from "@/lib/pipeline/gather";
import { extract as extractStage } from "@/lib/pipeline/extract";
import { score as scoreStage } from "@/lib/pipeline/score";
import { draft as draftStage, type DraftArgs } from "@/lib/pipeline/draft";
import { selfCheck as selfCheckStage, type SelfCheckArgs } from "@/lib/pipeline/selfcheck";

// The five workers the orchestrator drives. Defaults are the real stages; tests
// hand in fakes to rehearse specific situations (e.g. "no signals come back"),
// which is how we test the gate branches without calling Claude or Tavily.
export interface StageFns {
  resolve: (p: Prospect, s: SellerContext) => Promise<Identity>;
  gather: (i: Identity, s: SellerContext) => Promise<RawResult[]>;
  extract: (
    r: RawResult[],
    i: Identity,
    s: SellerContext,
  ) => Promise<ExtractedSignal[]>;
  score: (
    sig: ExtractedSignal[],
    s: SellerContext,
  ) => ScoreResult | Promise<ScoreResult>;
  draft: (args: DraftArgs) => Promise<Draft | null>;
  selfcheck: (args: SelfCheckArgs) => Promise<SelfCheckResult>;
}

export const defaultStages: StageFns = {
  resolve: resolveStage,
  gather: gatherStage,
  extract: extractStage,
  score: scoreStage,
  draft: draftStage,
  selfcheck: selfCheckStage,
};

// The orchestrator: walks the stages in a fixed order (resolve -> gather ->
// extract -> score -> draft), checks a gate after the relevant stages, and
// emits a StageEvent at each step. It is an async generator, which means the
// caller receives each event the moment it happens (this is what powers the
// live "watch it think" view) and gets the finished RunRecord as the return
// value when the run completes.
export async function* runPipeline(
  prospect: Prospect,
  seller: SellerContext,
  stages: StageFns = defaultStages,
): AsyncGenerator<StageEvent, RunRecord, void> {
  const startedAt = Date.now();
  const flags: Flag[] = [];

  // Assemble the final saved record. Reads startedAt/prospect/seller/flags from
  // the surrounding scope so each return site stays short.
  const buildRecord = (parts: {
    verdict: Verdict;
    signals: Signal[];
    draft: Draft | null;
    hook?: Hook;
    recommendation?: string;
    selfCheck?: SelfCheckOutcome;
    identity?: Identity;
  }): RunRecord => {
    const finishedAt = Date.now();
    return {
      id: randomUUID(),
      createdAt: new Date(startedAt).toISOString(),
      prospect,
      seller,
      identity: parts.identity,
      verdict: parts.verdict,
      hook: parts.hook,
      signals: parts.signals,
      draft: parts.draft,
      recommendation: parts.recommendation,
      selfCheck: parts.selfCheck,
      flags,
      timings: { startedAt, finishedAt, durationMs: finishedAt - startedAt },
    };
  };

  // ----- Stage 1: Resolve identity + Gate 1 (non-blocking) -----
  yield { stage: "resolve", status: "running" };
  const identity = await stages.resolve(prospect, seller);
  // Gate 1: a low-confidence identity does NOT stop the run in v1 — it just
  // attaches a flag so the uncertainty is visible (R4).
  if (identity.confidence === "low") {
    flags.push({
      type: "low_confidence_identity",
      message:
        identity.note ??
        "Could not confidently pin down this person; proceeding with low confidence.",
    });
  }
  yield {
    stage: "resolve",
    status: "done",
    summary: `Resolved ${identity.name}, ${identity.role ?? "role unknown"} at ${identity.company} (${identity.confidence} confidence)`,
    data: identity,
  };

  // ----- Stage 2: Gather signals + Gate 2 -----
  yield { stage: "gather", status: "running" };
  const raw = await stages.gather(identity, seller);
  if (!passesGate2(raw)) {
    // Gate 2 fails: not enough signal. Mark the remaining stages skipped and
    // return an honest SKIP record.
    yield {
      stage: "gather",
      status: "done",
      summary: `Gate 2: only ${raw.length} result(s) found — insufficient signal`,
      data: raw,
    };
    flags.push({
      type: "insufficient_signal",
      message: "Not enough recent public signal to build a credible hook.",
    });
    for (const skipped of ["extract", "score", "draft", "selfcheck"] as StageName[]) {
      yield {
        stage: skipped,
        status: "skipped",
        summary: "Skipped — Gate 2: insufficient signal",
      };
    }
    return buildRecord({
      verdict: "SKIP",
      signals: [],
      draft: null,
      recommendation:
        "Skip this prospect or use a generic template — no recent public signal to personalise around.",
      identity,
    });
  }
  yield {
    stage: "gather",
    status: "done",
    summary: `Gathered ${raw.length} result(s) across sources`,
    data: raw,
  };

  // ----- Stage 3: Extract & structure signals -----
  yield { stage: "extract", status: "running" };
  const signals = await stages.extract(raw, identity, seller);
  yield {
    stage: "extract",
    status: "done",
    summary: `Structured ${signals.length} signal(s)`,
    data: signals,
  };

  // ----- Stage 4: Score + Gate 3 (verdict decided by code, KTD5) -----
  yield { stage: "score", status: "running" };
  const scored = await stages.score(signals, seller);
  flags.push(...scored.flags);
  yield {
    stage: "score",
    status: "done",
    summary: `Gate 3 verdict: ${scored.verdict}`,
    data: scored,
  };

  // ----- Stage 5: Draft (HIGH/MEDIUM) or honest abstain (SKIP) -----
  if (scored.verdict === "SKIP") {
    yield {
      stage: "draft",
      status: "skipped",
      summary: "Skipped — SKIP verdict means no draft (honest abstain)",
    };
    yield {
      stage: "selfcheck",
      status: "skipped",
      summary: "Skipped — no draft to review",
    };
    return buildRecord({
      verdict: "SKIP",
      signals: scored.signals,
      hook: scored.hook,
      draft: null,
      recommendation:
        scored.recommendation ?? "Skip this prospect or use a generic template.",
      identity,
    });
  }

  yield { stage: "draft", status: "running" };
  const theDraft = await stages.draft({
    verdict: scored.verdict,
    hook: scored.hook,
    identity,
    seller,
  });
  yield {
    stage: "draft",
    status: "done",
    summary: theDraft ? "Draft ready for review" : "No draft produced",
    data: theDraft,
  };

  // ----- Stage 6: Draft self-check (R11) — the draft critiques and may revise
  // itself. Only runs when there is a draft to review (never on SKIP). If
  // disabled via config, the stage shows as skipped so the timeline stays whole.
  let finalDraft = theDraft;
  let selfCheckOutcome: SelfCheckOutcome | undefined;
  if (config.selfCheck.enabled && theDraft && scored.hook) {
    yield { stage: "selfcheck", status: "running" };
    try {
      const reviewed = await stages.selfcheck({
        draft: theDraft,
        hook: scored.hook,
        identity,
        seller,
        verdict: scored.verdict,
      });
      finalDraft = reviewed.draft;
      selfCheckOutcome = { revised: reviewed.revised, note: reviewed.note };
      yield {
        stage: "selfcheck",
        status: "done",
        summary: reviewed.revised
          ? "Draft revised after self-review"
          : "Self-review passed — no changes",
        data: selfCheckOutcome,
      };
    } catch {
      // Best-effort: a self-check failure must never sink an otherwise-good run.
      // Keep the draft we already have, mark the stage skipped, and let the run
      // complete and save normally.
      finalDraft = theDraft;
      yield {
        stage: "selfcheck",
        status: "skipped",
        summary: "Skipped — self-check unavailable, original draft kept",
      };
    }
  } else {
    yield {
      stage: "selfcheck",
      status: "skipped",
      summary: "Skipped — no draft to review",
    };
  }

  return buildRecord({
    verdict: scored.verdict,
    signals: scored.signals,
    hook: scored.hook,
    draft: finalDraft,
    selfCheck: selfCheckOutcome,
    identity,
  });
}
