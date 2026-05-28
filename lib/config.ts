// Central knobs for SignalDraft, kept in one place so they are easy to find and
// tune. This object grows over the build:
//   U2 (now): Claude model ids.
//   U5:       Tavily query set + count cap.
//   U6:       scoring weights + gate thresholds.
//   U8:       run-history list cap + per-IP rate-limit numbers.
//   U9:       seller-context defaults.

export const config = {
  // Exact Anthropic API model ids — the *id strings*, not the display names
  // (KTD6). A wrong/stale id returns a "model not found" (404), which reads
  // differently from a bad-key (401) error — useful to tell apart on Day 1.
  claude: {
    // Default model used across every pipeline stage.
    model: "claude-sonnet-4-6",
    // Swap option for the drafting step only, if Sonnet's writing needs a bump.
    // Decided after seeing real drafts (U7); defaults to the same model for now.
    draftModel: "claude-sonnet-4-6",
  },

  // Web-search gathering knobs (U5). Capped for cost, speed, and to keep a run
  // inside the function time budget (KTD3).
  gather: {
    // Gate 2 floor: a run with fewer than this many usable results is routed to
    // an honest SKIP (insufficient signal).
    minResults: 2,
    // Max results to request per individual Tavily query.
    maxResultsPerQuery: 5,
  },

  // Scoring + Gate-3 knobs (U6). The verdict is decided by CODE, not Claude
  // (KTD5): Claude extracts and gives a relevance read, this config + score.ts
  // turn that into numbers and a HIGH/MEDIUM/SKIP verdict. These values are the
  // tuning surface — change them here, re-run score.test.ts, and the behaviour
  // shifts without touching logic.
  score: {
    // Composite weights. Each signal's `total` = recency*w.recency +
    // specificity*w.specificity + relevance*w.relevance. Must sum to 1 so
    // `total` stays on a 0..1 scale. Specificity is weighted highest because a
    // signal being about the PERSON (not just their company) is the heart of
    // real personalisation.
    weights: { recency: 0.3, specificity: 0.4, relevance: 0.3 },

    // Recency score from a signal's age in days. First matching bucket wins;
    // anything older than the last bucket gets `recencyFloor`. A signal with no
    // usable date gets `recencyNoDate` (treated as probably-stale, not zero).
    recencyBuckets: [
      { maxAgeDays: 30, value: 1.0 },
      { maxAgeDays: 90, value: 0.8 },
      { maxAgeDays: 180, value: 0.6 },
      { maxAgeDays: 365, value: 0.4 },
    ],
    recencyFloor: 0.2,
    recencyNoDate: 0.3,

    // Specificity score from what the signal is about (person > company).
    specificityMap: { person: 1.0, company: 0.5 },

    // Relevance score from Claude's qualitative read (KTD5).
    relevanceMap: { high: 1.0, medium: 0.6, low: 0.3 },

    // Gate 3 thresholds (the verdict decision):
    //  - HIGH needs a PERSON-level signal that is recent AND scores well overall.
    //  - Anything safe and usable but not clearing the HIGH bar is MEDIUM.
    //  - Below the MEDIUM floor, nothing is usable -> SKIP.
    gate3: {
      highRecencyMin: 0.8, // "recent enough" for HIGH (≈ within ~90 days)
      highTotalMin: 0.7, // composite floor for HIGH
      mediumTotalMin: 0.45, // below this, the top signal is too weak -> SKIP
    },
  },
} as const;
