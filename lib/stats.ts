import type { RunRecord } from "@/lib/types";

// U12 — the dashboard summary metrics, computed read-side from the saved runs
// (R15). Kept as a pure function (no React, no fetch) so it is unit-testable and
// the four numbers are trustworthy — the same "Claude judges / code computes"
// discipline the scoring engine uses, applied to the product metrics.
//
// Each rate is `number | null`: null means "no denominator yet" (e.g. hook
// specificity before any draft exists), which the UI renders as "—" rather than
// a misleading 0% or NaN%.

export interface DashboardStats {
  totalRuns: number;
  draftedRuns: number;
  skipRuns: number;
  // Of the runs that produced a draft, the share whose hook is a PERSON-level
  // signal (the heart of real personalisation — person beats company).
  hookSpecificity: number | null;
  // Of the runs that produced a draft, the share whose hook traces to a real
  // cited source URL. By design this is the grounding guarantee in action; a
  // value below 100% would mean a draft escaped without a citation (a bug).
  grounding: number | null;
  // Of ALL runs, the share the system honestly declined (SKIP) instead of
  // forcing a draft on thin signal.
  honestAbstention: number;
  // Mean time-to-draft, in milliseconds, over the runs that produced a draft.
  avgTimeToDraftMs: number | null;
}

export function computeStats(runs: RunRecord[]): DashboardStats {
  const total = runs.length;
  const drafted = runs.filter((r) => r.draft !== null);
  const skips = runs.filter((r) => r.verdict === "SKIP");

  // A hook is "person-level" if the signal it was built on is about the person.
  const personHooks = drafted.filter((r) => {
    const hookUrl = r.hook?.url;
    if (!hookUrl) return false;
    return r.signals.find((s) => s.url === hookUrl)?.subject === "person";
  });

  // A draft is "grounded" if its hook points at a real source.
  const grounded = drafted.filter((r) => !!r.hook?.url);

  const avgMs =
    drafted.length > 0
      ? drafted.reduce((sum, r) => sum + r.timings.durationMs, 0) / drafted.length
      : null;

  return {
    totalRuns: total,
    draftedRuns: drafted.length,
    skipRuns: skips.length,
    hookSpecificity: drafted.length > 0 ? personHooks.length / drafted.length : null,
    grounding: drafted.length > 0 ? grounded.length / drafted.length : null,
    honestAbstention: total > 0 ? skips.length / total : 0,
    avgTimeToDraftMs: avgMs,
  };
}
