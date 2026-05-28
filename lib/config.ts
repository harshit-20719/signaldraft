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
} as const;
