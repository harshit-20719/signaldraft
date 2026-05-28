import type { ScoreResult, Signal } from "@/lib/types";

// STUB (U3) — replaced by the real scoring math, safety veto, and Gate 3 in U6
// (the verdict is decided by code, not by Claude — KTD5). For now it ranks by
// the sample `total` score and calls the top one a HIGH. (The real version also
// uses seller context for the relevance score.)
export function score(signals: Signal[]): ScoreResult {
  const ranked = [...signals].sort((a, b) => b.scores.total - a.scores.total);
  const top = ranked[0];

  if (!top) {
    return {
      verdict: "SKIP",
      signals: ranked,
      flags: [
        { type: "insufficient_signal", message: "No signals available to score." },
      ],
      recommendation: "Skip this prospect or use a generic template.",
    };
  }

  return {
    verdict: "HIGH",
    signals: ranked,
    hook: {
      what: top.what,
      url: top.url,
      why: "Highest-scoring recent, person-specific signal.",
    },
    flags: [],
  };
}
