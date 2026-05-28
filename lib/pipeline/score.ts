import { config } from "@/lib/config";
import type {
  ExtractedSignal,
  Flag,
  Hook,
  RelevanceRead,
  ScoreResult,
  SellerContext,
  Signal,
  SignalSubject,
} from "@/lib/types";

// Stage 4 (U6): the verdict is decided by CODE here, not by Claude (KTD5).
// Claude already extracted and gave a relevance read; this stage turns those
// into three transparent 0..1 scores, applies the safety veto, and runs Gate 3
// to choose HIGH / MEDIUM / SKIP. Keeping the math in code (driven by knobs in
// config.score) is what makes the judgment deterministic, explainable, and
// tunable — the core of the "show its work" pitch.

const DAY_MS = 24 * 60 * 60 * 1000;

// Recency: how fresh the signal is, from its date. First matching bucket wins;
// older than the last bucket -> floor; no usable date -> a low "probably stale"
// value (never 0, because a dateless real signal can still be worth something).
export function scoreRecency(when: string | undefined, now: number): number {
  const c = config.score;
  if (!when) return c.recencyNoDate;
  const t = Date.parse(when);
  if (Number.isNaN(t)) return c.recencyNoDate;
  const ageDays = (now - t) / DAY_MS;
  if (ageDays < 0) return 1.0; // future-dated edge — treat as fresh, don't punish
  for (const bucket of c.recencyBuckets) {
    if (ageDays <= bucket.maxAgeDays) return bucket.value;
  }
  return c.recencyFloor;
}

// Specificity: person-level signal beats company-level (the heart of real
// personalisation, R7).
function scoreSpecificity(subject: SignalSubject): number {
  return config.score.specificityMap[subject];
}

// Relevance: Claude's qualitative read mapped to a number (KTD5).
function scoreRelevance(read: RelevanceRead): number {
  return config.score.relevanceMap[read];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Turn one extracted (judged-but-unscored) signal into a fully scored Signal.
function scoreOne(e: ExtractedSignal, now: number): Signal {
  const recency = scoreRecency(e.when, now);
  const specificity = scoreSpecificity(e.subject);
  const relevance = scoreRelevance(e.relevance);
  const w = config.score.weights;
  const total =
    recency * w.recency + specificity * w.specificity + relevance * w.relevance;

  return {
    what: e.what,
    when: e.when,
    source: e.source,
    url: e.url,
    subject: e.subject,
    type: e.type,
    negative: e.negative,
    scores: {
      recency: round2(recency),
      specificity: round2(specificity),
      relevance: round2(relevance),
      total: round2(total),
    },
  };
}

// Plain-language "why this hook" for the output card (R12).
function explainHook(top: Signal): string {
  const parts: string[] = [
    top.subject === "person"
      ? "it's specifically about the prospect"
      : "it's about the prospect's company",
  ];
  if (top.scores.recency >= 0.8) parts.push("recent");
  else if (top.scores.recency >= 0.4) parts.push("reasonably recent");
  if (top.scores.relevance >= 1.0) parts.push("directly relevant to the pitch");
  else if (top.scores.relevance >= 0.6) parts.push("relevant to the pitch");
  return `Strongest safe signal — ${parts.join(", ")}.`;
}

// `now` is injectable so recency (and therefore the whole verdict) is
// deterministic in tests; defaults to the real clock in production. `seller` is
// accepted to satisfy the stage signature — relevance-to-seller was already
// judged by Claude during extraction, so the code math doesn't re-read it.
export function score(
  signals: ExtractedSignal[],
  _seller?: SellerContext,
  now: number = Date.now(),
): ScoreResult {
  // Empty input -> SKIP (insufficient). This is the honest-SKIP path (AE3): now
  // that Gate 2 rarely trips, a thin prospect arrives here as an empty set
  // because extract's strict filter dropped all the noise.
  if (signals.length === 0) {
    return {
      verdict: "SKIP",
      signals: [],
      flags: [
        {
          type: "insufficient_signal",
          message:
            "No usable signals survived extraction — nothing recent and on-topic about this prospect.",
        },
      ],
      recommendation:
        "Skip this prospect or use a generic template — no usable public signal to personalise around.",
    };
  }

  // Score everything and rank best-first by composite. Negatives are scored and
  // shown too (so the card can say "found but not used"), but the safety veto
  // keeps them out of hook selection.
  const ranked = signals
    .map((s) => scoreOne(s, now))
    .sort((a, b) => b.scores.total - a.scores.total);

  const flags: Flag[] = [];
  if (ranked.some((s) => s.negative)) {
    flags.push({
      type: "negative_news_avoided",
      message:
        "Negative news was found and deliberately excluded from the hook (AE4).",
    });
  }

  const g = config.score.gate3;
  const top = ranked.find((s) => !s.negative); // top SAFE signal — the veto in action

  // Every signal was negative news -> SKIP on safety grounds.
  if (!top) {
    flags.push({
      type: "no_safe_hook",
      message: "Every signal found was negative news — no safe hook to build on.",
    });
    return {
      verdict: "SKIP",
      signals: ranked,
      flags,
      recommendation:
        "Skip or use a generic template — the only recent signals are negative news you should not reference.",
    };
  }

  // The best safe signal is still too weak/generic -> SKIP (nothing usable).
  if (top.scores.total < g.mediumTotalMin) {
    flags.push({
      type: "no_safe_hook",
      message:
        "Signals were found but none is strong, recent, or relevant enough for a credible hook.",
    });
    return {
      verdict: "SKIP",
      signals: ranked,
      flags,
      recommendation:
        "Skip or use a generic template — the available signals are too weak or generic to personalise credibly.",
    };
  }

  const hook: Hook = { what: top.what, url: top.url, why: explainHook(top) };

  // HIGH: a recent, PERSON-level signal that also clears the composite bar.
  // Structural facts (person + recent) gate HIGH, not the score alone — a recent
  // company signal can score well but should still be MEDIUM, not HIGH.
  const isHigh =
    top.subject === "person" &&
    top.scores.recency >= g.highRecencyMin &&
    top.scores.total >= g.highTotalMin;
  if (isHigh) {
    return { verdict: "HIGH", signals: ranked, hook, flags };
  }

  // Otherwise MEDIUM: usable, but company-level or older — flag verify (AE2).
  flags.push({
    type: "company_level_verify",
    message:
      top.subject === "company"
        ? "Hook is company-level, not specific to this person — verify before sending."
        : "Best signal is older or only moderately strong — verify it is still current before sending.",
  });
  return { verdict: "MEDIUM", signals: ranked, hook, flags };
}
