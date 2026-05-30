// The shared "vocabulary" of SignalDraft. Every stage, the orchestrator, the
// API, and the UI all speak in these shapes, so this file is the single source
// of truth for what the data looks like as it flows through the pipeline:
//
//   Prospect + SellerContext  ->  Identity  ->  RawResult[]  ->  Signal[]
//     ->  Verdict (+ ranked signals, hook, flags)  ->  Draft  ->  RunRecord
//
// Stages emit StageEvents as they run (the live view renders these); the whole
// run is captured in one RunRecord that gets saved to the dashboard.

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

// What the rep types into the form (R1). Name + Company are required; the rest
// are optional hints. The hint (LinkedIn URL / email) is used ONLY to help
// identify the right person — it is never scraped (STRATEGY: compliant sources).
export interface Prospect {
  name: string;
  company: string;
  role?: string;
  hint?: string;
}

// Who the rep is selling, used to keep relevance scoring grounded (R2, KTD8).
// Defaults to the finance-ops pitch; editable in the UI.
export interface SellerContext {
  company: string; // the seller's own company (e.g. "Zamp")
  product: string; // what they sell, in one line
  valueProps: string[]; // the few benefits that make a signal "relevant"
  targetBuyer: string; // who they sell to (e.g. "finance leaders, CFO to Head of AP")
}

// ---------------------------------------------------------------------------
// Stage 1 output — Identity (resolve)
// ---------------------------------------------------------------------------

// Claude's single best-guess of WHO this prospect is, before any searching.
// confidence drives Gate 1: "low" attaches a flag but does NOT stop the run.
export interface Identity {
  name: string; // canonical full name
  company: string;
  role?: string;
  confidence: "high" | "low";
  note?: string; // disambiguation note when the name is ambiguous
}

// ---------------------------------------------------------------------------
// Stage 2 output — RawResult (gather)
// ---------------------------------------------------------------------------

// The kind of search a result came from. Lets us spread queries across sources
// and later reason about specificity (a LinkedIn post about the person beats a
// generic company mention).
export type SourceType =
  | "news"
  | "press"
  | "podcast"
  | "talk"
  | "job"
  | "blog"
  | "linkedin"
  | "general";

// A raw web-search hit from Tavily, before Claude has judged it.
export interface RawResult {
  title: string;
  snippet: string;
  url: string;
  publishedDate?: string;
  sourceType: SourceType; // which query produced it
}

// ---------------------------------------------------------------------------
// Stage 3/4 output — Signal (extract + score)
// ---------------------------------------------------------------------------

// What a signal is "about" — the heart of specificity scoring
// (person > company > generic).
export type SignalSubject = "person" | "company";

export type SignalType =
  | "funding"
  | "hiring"
  | "product"
  | "leadership"
  | "press"
  | "talk"
  | "post"
  | "other";

// The three code-computed scores plus the weighted composite (KTD5). Each is
// 0..1; `total` is what ranking and the gates use.
export interface SignalScores {
  recency: number;
  specificity: number;
  relevance: number;
  total: number;
}

// Claude's qualitative read of how relevant a signal is to the seller's pitch.
// Code maps this to the numeric `relevance` score (KTD5) — Claude judges,
// code computes.
export type RelevanceRead = "high" | "medium" | "low";

// The descriptive facts about a signal, shared by the extract output (judged
// but not yet scored) and the final scored Signal. `negative` is the safety
// veto input: layoffs/lawsuits are kept (so we can show "found but not used")
// but disqualified from being the hook (R7, AE4).
export interface SignalCore {
  what: string; // what happened, in one plain sentence
  when?: string; // date string if known
  source: string; // source name or domain
  url: string;
  subject: SignalSubject;
  type: SignalType;
  negative: boolean;
}

// Stage 3 output (extract): a raw result Claude has judged worth keeping and
// structured into a fact, plus its relevance read — but NOT yet scored. Code
// turns these into Signals in the score stage, so the "Claude judges / code
// computes the numbers" split (KTD5) is honest in the types.
export interface ExtractedSignal extends SignalCore {
  relevance: RelevanceRead;
}

// Stage 4 output (score): the same fact, now with the three code-computed
// scores and their weighted composite. This is what ranking and the gates use.
export interface Signal extends SignalCore {
  scores: SignalScores;
}

// ---------------------------------------------------------------------------
// Verdict, hook, draft, flags
// ---------------------------------------------------------------------------

// The one confidence verdict per run (R8, Gate 3).
//   HIGH   = strong, recent, person-specific signal
//   MEDIUM = company-level or older signal (draft, but "verify before sending")
//   SKIP   = nothing usable — honest abstain, no draft
export type Verdict = "HIGH" | "MEDIUM" | "SKIP";

// The chosen signal the draft is built around, plus the plain-language reason
// it was picked (powers "the hook used and why" on the output card, R12).
export interface Hook {
  what: string;
  url: string;
  why: string;
}

// The generated email (R9). Null for SKIP runs.
export interface Draft {
  subject: string;
  body: string;
}

// Surfaced on the output card so the judgment is visible (R12). Each flag is a
// machine-readable type plus a human-readable message.
export type FlagType =
  | "low_confidence_identity" // Gate 1: ambiguous prospect
  | "negative_news_avoided" // safety veto fired (AE4)
  | "company_level_verify" // MEDIUM: hook is company-level, verify before sending
  | "insufficient_signal" // Gate 2: nothing came back
  | "no_safe_hook"; // signals found but none safe/usable

export interface Flag {
  type: FlagType;
  message: string;
}

// The output of Stage 4 (score): the code-decided verdict (Gate 3), the ranked
// signals (negatives included but flagged), the chosen hook, any flags, and a
// recommendation string when the verdict is SKIP.
export interface ScoreResult {
  verdict: Verdict;
  signals: Signal[]; // ranked best-first
  hook?: Hook; // absent on SKIP
  flags: Flag[];
  recommendation?: string;
}

// ---------------------------------------------------------------------------
// Live events + the saved run record
// ---------------------------------------------------------------------------

export type StageName = "resolve" | "gather" | "extract" | "score" | "draft";

// running = stage started; done = finished with data; skipped = a gate routed
// past it; error = it failed.
export type StageStatus = "running" | "done" | "skipped" | "error";

// One progress event emitted as the pipeline runs. The live run view renders a
// card per stage from these. `data` is the stage's result (typed loosely here
// because it differs per stage; the strongly-typed copy lives on RunRecord).
export interface StageEvent {
  stage: StageName;
  status: StageStatus;
  summary?: string; // one-line human description for the UI
  data?: unknown;
}

// The run API streams newline-delimited JSON, one of these per line (U8). The
// `type` discriminator lets the live view (U10) tell the three apart without
// guessing: each stage emits an `event`; the run ends with exactly one `record`
// (the saved RunRecord, success) or one `error` (the run failed mid-flight).
export type RunStreamMessage =
  | { type: "event"; event: StageEvent }
  | { type: "record"; record: RunRecord }
  | { type: "error"; message: string };

// Everything about one completed run — saved to the dashboard and re-rendered
// when a saved run is reopened. Carries enough to compute all four metrics (R15).
export interface RunRecord {
  id: string;
  createdAt: string; // ISO timestamp
  prospect: Prospect;
  seller: SellerContext;
  identity?: Identity;
  verdict: Verdict;
  hook?: Hook;
  signals: Signal[]; // ranked best-first
  draft: Draft | null; // null on SKIP
  recommendation?: string; // SKIP advice + reason (R10)
  flags: Flag[];
  timings: {
    startedAt: number; // ms since epoch
    finishedAt: number;
    durationMs: number; // time-to-draft (R15)
  };
}
