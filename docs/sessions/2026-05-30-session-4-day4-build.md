# Session 4 — Build Day 4 (2026-05-30)

Guided build of SignalDraft. Working model unchanged: Claude implements
everything; Harshit writes no code and runs no commands except his own API keys.
Goal is conceptual understanding for a case study, so each milestone is explained
in plain language (what / how it fits / why).

Plan: `docs/plans/2026-05-28-001-feat-signaldraft-build-plan.md`.
Prior: `docs/sessions/2026-05-28-session-3-day3-build.md` (U1–U7, engine complete).

## What this session accomplished

Wrapped the finished engine in a web backend and built the input surface
(U8 + U9). The app now runs **end-to-end locally**: type a prospect, watch the
run stream stage-by-stage over HTTP, and see it saved and re-readable. Day-4
milestone met: run store + history API work, the run route streams correctly
with pinned runtime config, and the prospect form submits a run.

Persistence decision (Harshit chose): use a **temporary in-memory store** now so
everything runs locally with zero setup; wire the real Upstash Redis (the shared
"filing cabinet") before deploy on Day 6 — a ~5-minute signup + two env vars,
**no code change**.

## AGENTS.md compliance (this is NOT the Next.js you know)

U8 is the first unit touching Next.js route handlers/streaming, so per AGENTS.md
the bundled docs (`node_modules/next/dist/docs/`) were read **before** writing any
route code. That caught real breaking changes my training-data defaults would
have gotten wrong (see Findings).

## What was built, unit by unit

### U8 — Run store + streaming run API + history API

- **`lib/kv.ts` — the low-level "filing cabinet".** A tiny `KvBackend` interface
  (list ops + get/set/mget) with two implementations: **Upstash Redis** (real
  shared store, used when the env vars exist) and an **in-memory** fallback (dev
  only — not shared, lost on restart; warns once). Selected automatically by env
  presence. Supports BOTH `KV_REST_API_*` (Vercel Marketplace) and
  `UPSTASH_REDIS_REST_*` (direct Upstash) names to avoid a deploy-day surprise.
- **`lib/store.ts` — run records (KTD4).** `saveRun` (SET the record by id with a
  TTL, LPUSH its id onto a list, LTRIM to a cap), `listRuns` (read ids
  newest-first, MGET the records, drop any expired), `getRun(id)`. Atomic list ops,
  never a read-modify-write of one JSON array (the race KTD4 avoids). Each fn takes
  an optional backend so tests inject an isolated in-memory one.
- **`lib/store.test.ts`** — 5 tests against the in-memory backend (real public
  logic, no mocks): save→list newest-first, getRun, empty list, unknown id → null,
  list cap.
- **`lib/ratelimit.ts` + `.test.ts` (KTD10).** Per-IP soft cap as a `{count,
  windowStartMs}` record with TTL; `nowMs` injectable for deterministic tests.
  3 tests: allow-to-cap-then-block, reset after window, per-IP isolation.
- **`lib/types.ts` — `RunStreamMessage`.** The NDJSON envelope the run API
  streams: `{type:"event"|"record"|"error"}` so the client (U10) can discriminate
  stage events from the final saved record or an error.
- **`app/api/run/route.ts` — the streaming entry point.** Runtime config pinned
  per KTD3 (`runtime="nodejs"`, `dynamic="force-dynamic"`, `maxDuration=60`) +
  anti-buffer headers (`Content-Type: application/x-ndjson`, `Cache-Control:
  no-store, no-transform`, `X-Accel-Buffering: no`). Zod-validates the body (400),
  rate-limits by IP (429), then drives the orchestrator generator **by hand with
  `.next()`** (a for-await loop would discard the generator's *return* value, which
  is the finished RunRecord), streaming each StageEvent as it happens. Saves the
  record best-effort (a store hiccup never turns a completed run into an error) and
  streams the final record; on a thrown error, streams an error envelope.
- **`app/api/runs/route.ts`** (list) and **`app/api/runs/[id]/route.ts`** (one by
  id, 404 if missing). Both `dynamic="force-dynamic"` so history is always live.

### U9 — Prospect form + seller-context panel

- **`lib/config.ts` — `defaultSeller`** (KTD8): the finance-ops pitch, typed as a
  mutable `SellerContext` so the form can copy it into editable state.
- **`components/ProspectForm.tsx`** — controlled; Name + Company required (inline
  validation), Role + identity-hint optional; "Running…" + disabled while a run is
  active; the public-dashboard disclosure line (KTD10).
- **`components/SellerContextPanel.tsx`** — collapsible, editable, prefilled; value
  props edited one-per-line.
- **`app/page.tsx`** — now a client component composing both, with a **minimal
  inline NDJSON stream reader** (the seed of U10's inline reader): shows each
  stage's status as it streams + the final verdict/draft. Auto-collapses the
  seller panel on submit; locks the form during a run. The rich StageCard timeline
  (U10) and OutputCard (U11) replace the minimal view on Day 5.

## Key decisions made this session

1. **In-memory store fallback (Harshit chose).** App runs locally with zero
   external setup; real Upstash wired before deploy. This is graceful degradation,
   not a fragile shortcut — the alternative (refusing to run without an external
   DB) is worse for a first-time builder.
2. **One `KvBackend` abstraction** shared by store + ratelimit, so tests run
   against the in-memory backend with no mocking — consistent with the
   injectable-pipeline-stages testing philosophy from Days 2–3.
3. **Stream envelope protocol** (`RunStreamMessage`) so U10's reader discriminates
   events / final record / error unambiguously.
4. **Built the streaming route directly** (not plain-then-streaming as the plan
   sequenced for a live first-time build) since it is test-driven here; both mental
   models were explained.
5. **Support both KV env-var naming schemes** for deploy-day robustness.

## Findings worth carrying forward

- **Next.js 16 breaking changes (caught by reading the bundled docs):**
  1. Dynamic route **`params` is now a `Promise`** → `const { id } = await params`.
     The old synchronous `params.id` silently breaks.
  2. **`export const dynamic` was dropped from the v16 route-config table** (its
     dedicated doc page is gone) but is **still valid in the legacy model** because
     this project does not enable Cache Components — so KTD3's
     `dynamic="force-dynamic"` + `runtime` + `maxDuration` all hold. Confirmed in
     the "Caching (Previous Model)" guide rather than assumed.
  3. **GET route handlers are uncached by default** now (v15+) — good for live
     history.
  4. **Underscore-prefixed folders are private** (excluded from routing) — caught
     when a `_envcheck` debug route 404'd.
- **dotenv precedence gotcha (real debugging story).** The dev server reported
  `ANTHROPIC_API_KEY` missing even though `.env.local` is correct. Root cause:
  **`.env` files never override a variable already present in the environment**,
  and the harness shell the server was launched from had an *empty*
  `ANTHROPIC_API_KEY` (plus an `ANTHROPIC_BASE_URL` gateway). `TAVILY_API_KEY`
  loaded fine because it wasn't pre-set; Day-3 live tests worked because *sourcing*
  `.env.local` force-overrides. **Implication: Harshit's own terminal loads
  `.env.local` normally — this was purely a sandbox artifact.** When running the
  dev server from inside the harness, source `.env.local` and `unset
  ANTHROPIC_BASE_URL` first.

## How to run things

- Offline tests: `npm test` → **21 passing** (7 live skipped). New: `store.test.ts`
  (5), `ratelimit.test.ts` (3).
- Dev server, Harshit's own terminal: `npm run dev` (`.env.local` loads normally).
- Dev server from inside the agent harness (because of the dotenv gotcha above):
  `set -a && . ./.env.local && set +a && unset ANTHROPIC_BASE_URL && npm run dev`.
- Live verification done this session: a real run through `POST /api/run` streamed
  all stages → HIGH + grounded draft (no AI tells), saved; `GET /api/runs` listed
  it; `GET /api/runs/[id]` reopened it; bad body → 400; unknown id → 404; the form
  renders cleanly with the disclosure visible.

## Next: Day 5 (The experience)

- **U10** — live run view: a `StageCard` timeline with four states (pending /
  running / done / skipped-gated) + gates as decision points, replacing the
  minimal inline reader; error/timeout handling.
- **U11** — output card: verdict badge (HIGH green / MEDIUM amber / SKIP gray),
  editable draft + copy, "why this hook", ranked signals with scores + source
  links, flags, the defined SKIP layout; plus the `app/runs/[id]/page.tsx` reopen
  page reusing the card.
- **U12** — dashboard: history table + summary stats + clean empty state.
- Day-5 milestone: full single-prospect UX + dashboard work locally.
