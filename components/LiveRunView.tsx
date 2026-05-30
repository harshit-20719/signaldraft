"use client";

import type {
  Identity,
  RawResult,
  RunRecord,
  ScoreResult,
  StageEvent,
  StageName,
} from "@/lib/types";
import { StageCard, type CardStatus, type GateBadge } from "@/components/StageCard";

// U10 — the live run timeline. As the run streams in, app/page.tsx hands this
// component the events-so-far (one per stage) plus the lifecycle state, and this
// component turns that into the five-card timeline with the gates drawn as
// decision points. It owns all the "what does this stage's state mean" logic so
// StageCard can stay purely presentational.
//
// The gates are not separate stream messages — they are *derived* from the stage
// events we already have. That keeps the engine and the stream simple: the
// pipeline just reports what each stage did, and the UI reads the decision out of
// that. Gate 1 from the resolved identity's confidence; Gate 2 from whether the
// downstream stages were skipped for insufficient signal; Gate 3 from the score
// stage's verdict.

const STAGE_ORDER: StageName[] = [
  "resolve",
  "gather",
  "extract",
  "score",
  "draft",
  "selfcheck",
];

const STAGE_LABELS: Record<StageName, string> = {
  resolve: "Resolve identity",
  gather: "Gather signals",
  extract: "Extract & filter",
  score: "Score & verdict",
  draft: "Draft / abstain",
  selfcheck: "Self-check draft",
};

interface LiveRunViewProps {
  events: Partial<Record<StageName, StageEvent>>;
  failedStage: StageName | null;
  errorMsg: string | null;
  running: boolean;
  record: RunRecord | null;
  onRetry: () => void;
}

// Small, defensive readers for the loosely-typed `data` each event carries (it
// is `unknown` on StageEvent because it differs per stage; the strongly-typed
// copy lives on the final RunRecord).
function asIdentity(ev?: StageEvent): Identity | undefined {
  const d = ev?.data;
  return d && typeof d === "object" && "confidence" in d ? (d as Identity) : undefined;
}

function rawCount(ev?: StageEvent): number | null {
  return Array.isArray(ev?.data) ? (ev.data as RawResult[]).length : null;
}

function asScore(ev?: StageEvent): ScoreResult | undefined {
  const d = ev?.data;
  return d && typeof d === "object" && "verdict" in d ? (d as ScoreResult) : undefined;
}

export function LiveRunView({
  events,
  failedStage,
  errorMsg,
  running,
  record,
  onRetry,
}: LiveRunViewProps) {
  // The display status for a stage: a client-side failure wins, otherwise it is
  // whatever the stream last told us, otherwise it has not been reached yet.
  const statusOf = (stage: StageName): CardStatus => {
    if (failedStage === stage) return "error";
    return (events[stage]?.status as CardStatus) ?? "pending";
  };

  // ----- Gate derivations -----

  // Gate 1 follows resolve: low confidence shows a warning banner + amber chip
  // but never stops the run (v1 is non-blocking, R4).
  const identity = asIdentity(events.resolve);
  const resolveDone = events.resolve?.status === "done";
  const lowConfidence = identity?.confidence === "low";

  const gate1: GateBadge | undefined = resolveDone
    ? lowConfidence
      ? { label: "Gate 1 · low confidence, proceeding", tone: "warn" }
      : { label: "Gate 1 · identity confirmed", tone: "pass" }
    : undefined;

  // Gate 2 follows gather: the insufficient-signal branch skips extract, so if
  // extract was skipped the gate stopped the run; otherwise it passed.
  const gate2Failed = events.extract?.status === "skipped";
  const gatherDone = events.gather?.status === "done";
  const count = rawCount(events.gather);
  const gate2: GateBadge | undefined = gate2Failed
    ? { label: "Gate 2 · insufficient signal", tone: "stop" }
    : gatherDone && (events.extract !== undefined || record !== null)
      ? {
          label: count !== null ? `Gate 2 · ${count} results found` : "Gate 2 · results found",
          tone: "pass",
        }
      : undefined;

  // Gate 3 follows score: the verdict itself is the decision. SKIP is neutral
  // (honest abstain), MEDIUM is a caveat, HIGH is a clean pass.
  const verdict = asScore(events.score)?.verdict ?? record?.verdict;
  const scoreDone = events.score?.status === "done";
  const gate3: GateBadge | undefined =
    scoreDone && verdict
      ? verdict === "HIGH"
        ? { label: "Gate 3 · HIGH", tone: "pass" }
        : verdict === "MEDIUM"
          ? { label: "Gate 3 · MEDIUM", tone: "warn" }
          : { label: "Gate 3 · SKIP", tone: "stop" }
      : undefined;

  const gateFor = (stage: StageName): GateBadge | undefined =>
    stage === "resolve" ? gate1 : stage === "gather" ? gate2 : stage === "score" ? gate3 : undefined;

  // The Gate-1 low-confidence banner, rendered inside the resolve card.
  const resolveBanner =
    resolveDone && lowConfidence ? (
      <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs leading-5 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
        {identity?.note ??
          "This name was hard to pin down — the run continues, but double-check it is the right person."}
      </p>
    ) : undefined;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {running ? "Run in progress" : record ? "Run complete" : "Run"}
        </h2>
        {running && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">streaming live…</span>
        )}
      </div>

      <ol className="flex flex-col">
        {STAGE_ORDER.map((stage, i) => (
          <StageCard
            key={stage}
            label={STAGE_LABELS[stage]}
            status={statusOf(stage)}
            summary={events[stage]?.summary}
            banner={stage === "resolve" ? resolveBanner : undefined}
            gate={gateFor(stage)}
            isLast={i === STAGE_ORDER.length - 1}
          />
        ))}
      </ol>

      {/* Error / timeout state: keep the timeline above visible (so the rep can
          see how far it got), surface the reason, and offer a retry. */}
      {errorMsg && (
        <div className="flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900/50 dark:bg-rose-950/40">
          <p className="text-sm text-rose-700 dark:text-rose-300">{errorMsg}</p>
          <button
            type="button"
            onClick={onRetry}
            disabled={running}
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Retry run
          </button>
        </div>
      )}
    </section>
  );
}
