# Session 6 — Day 6 (Ship + buffer features) (2026-05-30)

Guided build of SignalDraft. Working model unchanged: Claude implements
everything; Harshit writes no code and runs no commands except his own
account/secret setup (GitHub, Vercel, Upstash, API keys). Goal is conceptual
understanding for a case study, so each milestone is explained in plain language.

Plan: `docs/plans/2026-05-28-001-feat-signaldraft-build-plan.md`.
Prior: `docs/sessions/2026-05-30-session-5-day5-build.md` (U10–U12, full UX + dashboard).

## What this session accomplished

Two things: (1) shipped the app to a public URL (U13), and (2) used the schedule
buffer to add five features Harshit requested — a landing cleanup, a dashboard
filter/sort, a light/dark toggle, the draft self-check stretch goal, and the CSV
batch stretch goal. The product is now **feature-complete and live**.

**Live at https://signaldraft.vercel.app** — deployed from
`github.com/harshit-20719/signaldraft` via Vercel, with Upstash Redis (Marketplace)
as the shared store. Both stretch goals (R3 CSV batch, R11 draft self-check) are
now DONE, not just queued.

## U13 — deploy + live smoke test

- Pushed the repo to GitHub (public, full 8-commit history) via the authenticated
  `gh` CLI; imported into Vercel; provisioned **Upstash for Redis** (injects
  `KV_REST_API_*`); set `ANTHROPIC_API_KEY` + `TAVILY_API_KEY`. `lib/kv.ts`
  auto-selected the real store with **zero code change**.
- **Smoke test — all five checks passed:**
  - Streaming flushes **incrementally** on Vercel (KTD3) — proven with a `curl`
    POST that timestamped each event: they arrived ~2–19s apart, NOT all-at-end.
    No fallback needed.
  - A run saves and an independent GET reads it back — on serverless that proves
    the shared Upstash store, not in-process memory.
  - The run shows in the dashboard from a different browser (private Safari).
- Pre-flight before any of this: confirmed `.gitignore` excludes `.env*` (no secret
  leak to a public repo), `next build` is green, 26 tests pass, the health route is
  gone.

## The five buffer features (each committed + deployed separately)

### P1 — landing cleanup + real README (`bf4c769`)
Removed the "v1 · in progress" badge so the app reads as shipped. Replaced the
create-next-app README with a real one (the problem, the three verdicts, the
pipeline + gates, key decisions, run/deploy instructions).

### P2 — dashboard filter + sort (`be37c84`)
Filter past runs by tier (HIGH/MEDIUM/SKIP), by drafted-vs-skipped status, and by a
name/company search; click any column header to sort. The filter/sort logic is a
pure, tested function (`lib/runQuery.ts`, 13 tests) — the same "tested pure fn"
discipline as `stats.ts` and `score.ts`. The stats strip stays computed over all
runs; the table filters independently.

### P3 — light/dark toggle (`930b409`)
The components already carried both palettes; the app was just following the OS.
Made it user-controlled: switched Tailwind's `dark:` variant from the
`prefers-color-scheme` media query to a `.dark` class on `<html>` (Tailwind 4
`@custom-variant`). A sun/moon toggle (`components/ThemeToggle.tsx`) flips and
persists the choice; an inline script applies the saved-or-system choice before
first paint (no flash). The icon swap is pure CSS, so there is no React state and
no hydration mismatch.

### P4 — draft self-check, Stage 6 (`b1320c6`) — R11 stretch
After drafting, Claude reviews its own email against grounding / specificity /
no-AI-tells and either passes or revises it — shown as a sixth live stage and a
"Self-reviewed" note on the card; the revised draft is what gets saved. On by
default (`config.selfCheck.enabled`). Wired through the injectable `StageFns` so it
is unit-tested; emits `selfcheck:skipped` on the no-draft paths so the timeline
stays whole. **Also code-enforced the no-em-dash rule** (`dropEmDashes`): live runs
showed the model slipping em-dashes (the #1 AI tell) past both the draft and
self-check prompts, so the rule is now enforced in code, not merely requested.

Live-verified: a HIGH run's first draft invented an ungrounded pain point ("most
finance teams at Microsoft's scale are still carrying manual reconciliation work");
the self-check caught and removed it.

### P5 — CSV batch (`c7e5041`) — R3 stretch
A new `/batch` page: paste or upload a CSV (`name`, `company`, optional `role`,
`hint`), and the browser runs each row one at a time through the existing run
route, so every result lands in the dashboard. No new backend. Capped at 5 rows
(`config.batch.maxRows`) to fit the per-IP rate limit. CSV parsing is a tested pure
function (`lib/csv.ts`, 8 tests). Linked from the home header.

## Key decisions made this session

1. **Drive GitHub via the authenticated `gh` CLI** (Harshit chose) rather than the
   web UI — repo created and every push done from the CLI.
2. **Self-check ON by default** (Harshit chose) — always runs, visible as a stage,
   so the self-correction shows live. Cost: one extra Claude call per drafted run.
3. **Batch capped at 5** (Harshit chose) — fits the existing 5/hour rate limit, so
   no weakening of the public abuse guardrail.
4. **Enforce no-em-dashes in code, not just the prompt** — consistent with the
   project's "Claude judges, code enforces" philosophy (KTD5).
5. **Dark mode via a class + a no-flash body script**, no theme library — the
   leanest robust option.

## Findings worth carrying forward

- **React 19 forbids a `<script>` as a direct child of `<html>`** — it errors as a
  hydration issue. The no-flash theme script must be the FIRST CHILD OF `<body>`
  (a plain inline `<script dangerouslySetInnerHTML>`), with `suppressHydrationWarning`
  on `<html>`. `next/script` `beforeInteractive` placed as a child of `<html>` did
  not work. (Caught in the browser console during P3 and fixed before shipping.)
- **KTD3 confirmed:** Vercel streams incrementally with the pinned runtime config
  (`runtime=nodejs`, `dynamic=force-dynamic`, anti-buffer headers); no fallback used.
- **The in-memory dev store resets on hot-recompile** — expected (it is per-module
  state) and irrelevant in production (Upstash). Saw it while batch-testing locally.
- **Live-search variance is real and large:** Amy Hood came back HIGH in one run
  this session (a fresh Duke commencement signal) and MEDIUM in others. Re-check
  demo prospects on the day.
- AGENTS.md honored: read the Next 16 scripts/layout docs before touching the root
  layout.

## Environment / how to run

- Live: https://signaldraft.vercel.app · Repo: `github.com/harshit-20719/signaldraft`
- Offline tests: `npm test` → **52 passing** (added runQuery 13, csv 8, em-dash 4,
  self-check 1). `npx tsc --noEmit`, `npm run lint`, and `npm run build` all clean.
- Dev server (Harshit's own terminal): `npm run dev`. From the harness:
  `set -a && . ./.env.local && set +a && unset ANTHROPIC_BASE_URL && npm run dev`.

## Post-ship engine refinements (R1–R4) — research-driven

Harshit asked five product questions about the scoring and the draft, then a sharp
follow-up about the search queries. Three parallel web-research agents (all sourced)
led to four engine changes he approved; each was implemented, tested, and
live-verified. Full rationale + sources live in `docs/research-and-decisions.md`.

**Grounding finding:** the composite was `recency 0.30 / specificity 0.40 /
relevance 0.30`; the top safe signal becomes the hook and the draft references only
it (confirmed). The signal *type* was captured but UNUSED in ranking — the key gap.

### R1 — seller context → the real Zamp (`6623904`)
Rewrote `defaultSeller` to Zamp's actual positioning (zamp.ai — Amit Jain's AI
finance/ops automation: AP/invoice, vendor onboarding, compliance, treasury) with
sourced value props (chargebacks months→day [AWS case study], vendor onboarding
weeks→days / ~90% [Zamp], SOC/ISO/SOX), no invented numbers. The previous "monthly
close / reconciliation" framing is NOT how Zamp publicly positions itself.

### R2 — drafting → Josh Braun's 4T (`6623904`)
Rewrote the draft + self-check prompts around the 4T framework — Trigger, Think
(neutral, non-leading question), Third-party proof (from the value props, "without/no"
framing), Talk (permission yes/no CTA, never a calendar ask) — plus his rules (5:1
you:I ratio, problem-before-product, ≤4 sentences). Grounding + no-em-dash preserved.

### R3 — scoring → archetype tiers + weights (`df659a4`)
Added `config.score.archetypeTiers` (funding/leadership 1.25, hiring 1.10,
product/press/other 1.00, talk 0.85, post 0.80) as a multiplier on the base composite
(clamped 0..1), and rebalanced weights to `recency 0.25 / specificity 0.35 /
relevance 0.40`. A funding round now outranks an equal-base podcast clip. The HIGH
gate STILL requires a person-level signal, so AE1/AE2 semantics hold. `SignalList`
shows the ×tier so the math stays transparent. 3 new tests (55 offline total).

### R4 — gather queries → archetype-weighted (`2eec2d5`)
A follow-up insight from Harshit: the Tavily queries were organised by source and
weighted *backwards* versus the tiers — dedicated searches for low-tier podcasts and
talks (×0.80–0.85) but **none** for the top-tier funding rounds or exec moves
(×1.25), which only surfaced incidentally via the generic "news" query. Realigned the
set, keeping the same search count (the cost cap): added dedicated leadership/exec-move
and funding/M&A queries pulling MORE results, merged the podcast + talk queries into
one personal-voice query pulling FEWER, and dropped the low-yield company-blog query.
The archetype is still classified by extract, so this only changes WHAT is found. R3 +
R4 together close the loop: hunt hardest for the signals that score highest. Verified
live — a `leadership` signal now surfaces and ranks first for a finance-leader prospect.

### Live verification (all three together)
A run on Amy Hood / Microsoft: the fresh-but-irrelevant Duke commencement talk
(talk ×0.85, relevance 0.30) correctly ranked *below* a more-relevant internal memo;
verdict MEDIUM; the draft was a clean 4T email grounded in real Zamp value props; the
self-check revised it, catching a "leverage" variant and an over-confident Trigger for
a company-level signal.

### Implication for the demo
The scoring and gather changes shift verdicts (and what is found), so the 5 demo
prospects must be re-verified against the refined engine when locked (U14). Spot-check
any specific number a draft cites (e.g. a "123% growth" figure) against the actual
source on the day.

## Next: U14 (demo)

The only remaining plan unit. Verify the five acceptance examples on live data **against
the refined engine** (verdicts may have shifted), lock the prospects, build the batch
example from them, refresh the README and other repo docs for the buffer features +
refinements, and write a demo script — then record the video.
