# Session 2 — Build Day 1 & Day 2 (2026-05-28)

Guided build of SignalDraft. Working model: Claude implements everything;
Harshit writes no code and runs no commands except setting up his own API keys.
Goal is conceptual understanding for a case study, so each milestone was
explained in plain language (what / how it fits / why).

Plan: `docs/plans/2026-05-28-001-feat-signaldraft-build-plan.md`.

## What this session accomplished

Built and verified the foundation (U1–U2) and the front half of the judgment
engine (U3–U5). Two git checkpoints:

- `c18e3d2` — Day 1: scaffold + verified API clients (U1, U2)
- `5ccf8a2` — Day 2: engine spine + real resolve & gather (U3–U5)

## Stack as actually scaffolded

`create-next-app@latest` produced **Next.js 16.2.6, React 19.2.4, Tailwind v4**
(CSS-based config, no `tailwind.config.js`), App Router, no `src/` dir, import
alias `@/*`, Turbopack dev bundler. Node 25 / npm 11. The plan said generic
"Next.js" — these are just the current defaults. **Vitest 4** is the test
runner (`npm test` → `vitest run`); `vitest.config.ts` has a regex `@/` alias
mirroring tsconfig.

## What was built, unit by unit

- **U1 — App shell.** Scaffolded into a temp folder then merged to repo root
  (so `STRATEGY.md`/`docs/` survived). `app/page.tsx` is a clean centered
  "SignalDraft" page. Vitest set up Day 1 on purpose. Git initialised on `main`.
- **U2 — Keys + clients.** `lib/config.ts` (Claude model id `claude-sonnet-4-6`),
  `lib/anthropic.ts`, `lib/tavily.ts` — thin server-side wrappers that read keys
  from env and fail with a clear message if missing. A temporary
  `app/api/health` route confirmed both keys live, then was **deleted** per
  KTD10. `.env.example` committed; `.env.local` gitignored.
- **U3 — Engine spine.** `lib/types.ts` is the shared vocabulary
  (Prospect → Identity → RawResult → Signal → Verdict/Hook/Draft → RunRecord,
  plus StageEvent, Flag, ScoreResult). `lib/pipeline/index.ts` is the
  orchestrator: an **async generator** that runs the five stages in order,
  applies Gates 1–3, and returns a `RunRecord`. Stages are **injectable**
  (`StageFns` param, default = real stages) so the orchestrator tests run
  offline against fakes. `index.test.ts`: 4 tests (ordering + each gate branch).
- **U4 — Resolve (real Claude).** Turns form input into one canonical identity +
  honest high/low confidence. Gate 1 is **non-blocking**: low confidence
  attaches a flag, the run continues. Live-verified: Tim Cook/Apple → high (+
  role "CEO"); John Smith/vague firm → low (+ disambiguation note). Covers AE5.
- **U5 — Gather (real Tavily).** 7 parallel searches across source types
  (news/press/podcast/talk/job/blog/`site:linkedin.com`), deduped by URL,
  fault-tolerant via `Promise.allSettled`. Live-verified: Amy Hood/Microsoft →
  32 deduped results.

Stages `extract`, `score`, `draft` are still **stubs** (Day 3 work).

## Key decisions made this session

1. **Accept the latest create-next-app defaults** (Next 16 / React 19 /
   Tailwind 4) — the plan said "Next.js" generically.
2. **Structured outputs + Zod** for all Claude structured data
   (`claudeStructured()` in `lib/anthropic.ts`, using `messages.parse` +
   `zodOutputFormat`, Zod v4). This *constrains* Claude to return schema-valid
   data, replacing the plan's weaker "ask for JSON, parse loosely, retry on
   failure" mitigation. **Harshit approved this** (it adds the Zod dependency).
3. **Prompt caching is NOT worth it here** — Sonnet's cache floor (~2048 tokens)
   is above our short, per-stage prompts, and stages don't share a prefix. Cost
   control instead = the spend cap + tight prompts + batching extraction into
   one call (Day 3).
4. **Spend cap (KTD10) is satisfied** by Harshit's setup: Anthropic $20 prepaid
   + auto-reload OFF (hard ceiling), Tavily 1000 prepaid credits.

## Findings worth carrying forward

- **A stray Unicode char (U+2028) was pasted into the Anthropic key.** Next.js
  trimmed it silently, but raw use broke the HTTP header. Fix: wrappers now
  `.trim()` keys; the stray char was cleaned from `.env.local`. Lesson: sanitise
  at trust boundaries — even an API key paste can carry invisible junk.
- **Gate 2 (raw result count) almost never trips.** Tavily returned ~30 results
  even for a nonsense prospect. So the honest "thin signal → SKIP" (AE3) must
  come from **Gate 3, after `extract` filters out wrong-person/off-topic/stale
  results** — not from raw count. **This makes U6's extract a STRICT filter, not
  a passive structurer.** Most important input to Day 3.

## How to run things

- Dev server: `npm run dev` (port 3000). `.claude/launch.json` registers it for
  the preview tool.
- Offline tests: `npm test` (engine logic only — no network).
- Live tests (hit real Claude/Tavily): gated `*.live.test.ts` files. Run with:
  `set -a && . ./.env.local && set +a && LIVE=1 npx vitest run <file>`
  (Note: `node --env-file` did NOT propagate env to vitest workers; sourcing does.)

## Next: Day 3

- **U6** — the heart of the engine: `extract` (Claude → structured signals,
  dropping noise/wrong-person/stale), code-driven **scoring** (recency,
  specificity person>company>generic, relevance) + **safety veto** (negative
  news disqualified but kept-and-flagged), and **Gate 3** verdict
  (HIGH/MEDIUM/SKIP). `score.test.ts` covers AE1/AE2/AE4 + edges. Scoring
  weights and the Gate-3 threshold are tuned here (plan Open Questions).
- **U7** — `draft` (grounded email for HIGH/MEDIUM, cite only real signals, no
  AI tells) / honest abstain (SKIP → recommendation + reason, no draft).
- **Day-3 milestone:** the full pipeline runs end-to-end from a terminal.
