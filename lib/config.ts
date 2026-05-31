import type { SellerContext } from "@/lib/types";

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

  // Stage 6 draft self-check (R11). When on, after drafting Claude reviews and
  // may revise its own email (one extra call), shown as its own pipeline stage.
  // On by default; set false to skip the stage entirely.
  selfCheck: {
    enabled: true,
  },

  // CSV batch input (R3). The browser runs the uploaded prospects one at a time
  // through the normal run route, so each lands in the dashboard. Capped to stay
  // within the per-IP rate limit (ratelimit.maxPerWindow) on the public app.
  batch: {
    maxRows: 5,
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
    // Composite weights (must sum to 1). A signal's BASE total =
    // recency*w.recency + specificity*w.specificity + relevance*w.relevance, then
    // multiplied by its archetype tier (below) and clamped to 0..1. Relevance
    // leads because, for a finance-specific pitch, fit to what the seller sells is
    // the primary filter; specificity (person > company) is a close second and
    // still structurally gates HIGH.
    weights: { recency: 0.25, specificity: 0.35, relevance: 0.4 },

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

    // Per-archetype "signal strength" multiplier applied to the base composite,
    // then clamped to 0..1. This is the dimension trigger-event research weights
    // most heavily: a funding round or a new-exec move is a far stronger buying
    // signal than a podcast clip, even at equal recency/specificity/relevance
    // (UserGems, Salesmotion, Autobound). 'other' stays neutral (1.0) so an
    // uncategorised-but-strong signal is never penalised. This changes RANK and
    // the MEDIUM/SKIP boundary; the HIGH gate still requires a person-level
    // signal, so AE1 (HIGH) / AE2 (MEDIUM) semantics are preserved.
    archetypeTiers: {
      funding: 1.25, // explicit budget event
      leadership: 1.25, // new/changed exec (esp. the buyer) — highest intent
      hiring: 1.1, // hiring for finance/AP roles = active spend
      product: 1.0, // company-level news
      press: 1.0, // company-level news
      other: 1.0, // neutral default
      talk: 0.85, // strong personal hook, low buying intent
      post: 0.8, // LinkedIn / podcast — personalisation peg only
    },

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

  // Run-history store knobs (U8). The store is the shared "filing cabinet" of
  // past runs (KTD4): a Redis list of run ids, newest-first, plus each full
  // record stored by id. Records carry a TTL so public personal data isn't kept
  // forever (KTD10).
  store: {
    listKey: "signaldraft:runs", // the Redis list holding run ids, newest-first
    recordPrefix: "signaldraft:run:", // each record stored at recordPrefix + id
    listCap: 50, // dashboard shows at most this many recent runs
    ttlDays: 30, // run records expire after this many days
  },

  // Public-demo rate limit (U8, KTD10). A per-IP cap on POST /api/run so an
  // automated loop can't drain the API credits. This is in-app *soft* defense;
  // the hard ceiling is the spend cap set in the Anthropic/Tavily dashboards.
  ratelimit: {
    keyPrefix: "signaldraft:rl:", // per-IP counter key
    maxPerWindow: 5, // allowed runs per IP per window
    windowSeconds: 3600, // the window length (1 hour)
  },
} as const;

// Seller-context defaults (U9, KTD8): who the rep is selling, pre-filled in the
// form and passed into the pipeline so relevance scoring (and the draft) stay
// grounded. Rewritten to match Zamp's REAL public positioning (zamp.ai — Amit
// Jain's AI finance/ops automation company), with value props drawn from its own
// published claims and the AWS case study — no invented customer numbers. The
// user can edit it in the UI before a run. Exported as a plain (mutable, typed)
// object so the form can copy it into editable state without readonly friction.
export const defaultSeller: SellerContext = {
  company: "Zamp",
  product:
    "an AI 'digital employee' that automates finance and accounting operations end-to-end — invoice and AP processing, vendor onboarding, payment and compliance screening, and real-time treasury visibility — on top of existing ERPs",
  valueProps: [
    "End-to-end invoice and AP processing, with the team stepping in only on exceptions",
    "Vendor onboarding from weeks to days, with roughly 90% less verification effort",
    "Dispute and chargeback resolution from months down to about a day",
    "Real-time visibility into cash, balances, and spend across entities",
    "Bank-grade controls: SOC 1/2 Type II, ISO 27001, and SOX-ready audit trails",
  ],
  targetBuyer: "Finance leaders — CFO, VP Finance, Controller, Head of AP",
};
