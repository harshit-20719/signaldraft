# Session 3 — Build Day 3 (2026-05-28)

Guided build of SignalDraft. Working model unchanged: Claude implements
everything; Harshit writes no code and runs no commands except his own API keys.
Goal is conceptual understanding for a case study, so each milestone is explained
in plain language (what / how it fits / why).

Plan: `docs/plans/2026-05-28-001-feat-signaldraft-build-plan.md`.
Prior: `docs/sessions/2026-05-28-session-2-day1-2-build.md` (U1–U5).

## What this session accomplished

Finished the judgment engine (U6 + U7), hitting the **Day-3 milestone: the full
pipeline runs end-to-end from a terminal** — resolve → gather → extract → score →
draft, real Claude + Tavily, a real verdict and a real (or honestly withheld)
draft. `extract`, `score`, and `draft` were stubs at the start of the session;
they are now real.

## What was built, unit by unit

### U6 — Extract (strict filter) + Score (code verdict) + Gate 3

**The split that matters:** Claude *describes and judges* each signal; **code
decides the verdict** (KTD5). To make that honest in the types, a new
`ExtractedSignal` was added (`lib/types.ts`): the descriptive facts + Claude's
relevance read, but *no scores yet*. `Signal` (with scores) is now the score
stage's output. Both share a `SignalCore` base, so there's no field duplication.

- **`lib/pipeline/extract.ts` + `lib/prompts/extract.ts` — the strict filter.**
  One *batched* Claude call: all ~30 raw results in, only the usable ones out.
  Claude is instructed to be ruthless — drop wrong-person (same name, different
  individual), off-topic, boilerplate/navigation, and stale results; "when in
  doubt, drop it; an empty array is the correct answer." For each kept result it
  returns the result's **index** plus judgments (one-sentence summary, person vs.
  company, type, any explicit date, negative-news flag, relevance read). Code then
  rebuilds each signal from the **real** raw result (url, source, date), so a
  hallucinated link can never reach the output. This is the load-bearing fix for
  the Day-2 finding: because Tavily returns ~30 results even for nonsense, honest
  SKIP must come from *here* dropping everything, not from a raw-count gate.

- **`lib/pipeline/score.ts` — the code judge.** Three transparent 0..1 scores per
  signal: **recency** (date → age buckets), **specificity** (person 1.0 > company
  0.5), **relevance** (Claude's read mapped to a number). Weighted composite
  `total`. Then the **safety veto**: negative signals are scored and kept (so the
  card can show "found but not used") but excluded from hook selection. **Gate 3**
  picks the verdict using *structure AND score*, not score alone:
  - **HIGH** = top safe signal is person-level, recent (recency ≥ 0.8), and total
    ≥ 0.7.
  - **MEDIUM** = a usable safe signal that's company-level or older (flag
    `company_level_verify`).
  - **SKIP** = nothing safe clears the floor (all-negative → `no_safe_hook`;
    empty → `insufficient_signal`).
  `now` is an injectable parameter so recency — and the whole verdict — is
  deterministic in tests.

- **`lib/pipeline/score.test.ts` — 8 offline tests, the tuning surface.** Covers
  AE1 (recent person → HIGH), AE2 (recent company → MEDIUM; older person →
  MEDIUM), AE4 (negative + safe → veto drops to safe hook; negative-only → SKIP),
  and edges (empty → SKIP, weak/generic → SKIP, more-recent-person ranks first).
  Change a weight/threshold in `config.score`, re-run, and these tell you whether
  the acceptance examples still hold.

### U7 — Draft / honest abstain

- **`lib/pipeline/draft.ts` + `lib/prompts/draft.ts`.** For HIGH/MEDIUM, a
  grounded Claude call: reference *only* the one chosen signal, invent nothing,
  and obey explicit "no AI tells" rules (no em-dashes, banned openers/buzzwords,
  peer tone, soft CTA, < ~110 words). MEDIUM gets a more tentative framing. SKIP
  (or no hook) returns `null` — the engine writes nothing rather than faking it;
  the recommendation + reason come from the score stage. Uses
  `config.claude.draftModel` so the writer can be swapped to Opus later (KTD6)
  without touching logic.

## Config — the tuning knobs chosen this session

In `lib/config.ts` under `score`: weights `{recency 0.3, specificity 0.4,
relevance 0.3}` (specificity highest — person-level is the heart of
personalisation); recency buckets 30/90/180/365 days → 1.0/0.8/0.6/0.4, floor
0.2, no-date 0.3; relevance high/med/low → 1.0/0.6/0.3; Gate 3 thresholds
highRecencyMin 0.8, highTotalMin 0.7, mediumTotalMin 0.45.

## Live verification (the milestone)

Run on **Amy Hood, CFO, Microsoft**: 32 raw → **8 kept** (strict filter dropped
24), verdict **HIGH** in ~23s. Three negative-news signals (headcount/layoffs
talk) were detected, kept-and-flagged (`negative_news_avoided`), and **not**
chosen as the hook — the safety veto working on live data (AE4). The draft opened
on a safe signal (data-center spending decision), grounded, no em-dashes, with a
soft CTA. A no-footprint prospect (gibberish name/company) returned an honest
**SKIP** with no draft (AE3). So AE1, AE3, AE4 all confirmed live; AE2 (MEDIUM) is
covered by `score.test.ts` and will be eyeballed on the demo set later.

## Key decisions made this session

1. **Folded the separate `relevance` prompt into the single `extract` call** (one
   Claude call instead of two). Relevance is inseparable from understanding the
   signal, and one batched call is cheaper. Deviation from the plan's Files list
   (`lib/prompts/relevance.ts` not created) — leaner, not more fragile.
2. **`ExtractedSignal` intermediate type.** Makes "Claude describes / code scores"
   honest in the types instead of passing around half-filled score objects.
3. **Claude returns kept results by index; code carries the real url/date.**
   Robustness against URL/date hallucination.
4. **Gate 3 uses structural facts (person + recent) AND the composite score**, not
   a single score threshold — so a recent *company* signal is MEDIUM, never HIGH,
   matching AE1/AE2 intent.

## How to run things

- Offline tests (engine logic, no network, free): `npm test` → **13 passing**.
- Live tests (real Claude/Tavily), gated `*.live.test.ts`. Run with:
  `set -a && . ./.env.local && set +a && LIVE=1 npx vitest run <file>`
  - `lib/pipeline/extract.live.test.ts` — the filter on a real haul.
  - `lib/pipeline/pipeline.live.test.ts` — the full end-to-end milestone.

## Next: Day 4 (Persistence + input)

- **U8** — run store (Upstash for Redis via Vercel Marketplace), built
  store-first then streaming: `lib/store.ts` (atomic LPUSH + SET, TTL),
  `lib/ratelimit.ts` (per-IP cap), `app/api/run` (plain POST first, then NDJSON
  streaming with the pinned runtime config from KTD3), `app/api/runs` +
  `app/api/runs/[id]`. **Note (AGENTS.md): U8 is the first unit that touches
  Next.js route handlers / streaming — read `node_modules/next/dist/docs/` before
  writing route code, since this Next version may differ from training data.**
- **U9** — prospect form + seller-context panel (the input surface).
- Day-4 milestone: run store + history API work; the run route streams correctly;
  the form submits a run.
