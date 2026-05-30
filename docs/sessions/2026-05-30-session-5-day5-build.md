# Session 5 — Build Day 5 (2026-05-30)

Guided build of SignalDraft. Working model unchanged: Claude implements
everything; Harshit writes no code and runs no commands except his own API keys.
Goal is conceptual understanding for a case study, so each milestone is explained
in plain language (what / how it fits / why).

Plan: `docs/plans/2026-05-28-001-feat-signaldraft-build-plan.md`.
Prior: `docs/sessions/2026-05-30-session-4-day4-build.md` (U8–U9, backend + first UI).

## What this session accomplished

Built the whole single-prospect experience and the dashboard (U10 + U11 + U12).
The app now works **end-to-end locally as a product**, not just as a stream: type
a prospect, watch a real stage-by-stage timeline with the gates drawn as decision
points, get an editable grounded draft (or an honest SKIP) in a reusable output
card, and see every run — with summary stats — on a shared dashboard that
reopens any run by URL. Day-5 milestone met.

Verified with one real end-to-end run (Amy Hood / Microsoft): streamed
Gate 1 confirmed → Gate 2 · 34 results → Gate 3 · **MEDIUM**, 34 raw results
filtered to 4 signals, **negative news found-and-excluded live (AE4)**, a clean
grounded draft (no AI tells), saved → listed on the dashboard with correct stats
→ reopened by URL into the identical card.

## What was built, unit by unit

### U10 — Live run view (StageCard timeline with gates + graceful failure)

- **`components/StageCard.tsx`** — one presentational card per stage with five
  visible states: pending / running (spinner) / done (✓ + summary) / skipped
  (gate routed past it) / error. It knows nothing about the pipeline; it just
  renders state + text. A gate "decision point" chip renders beneath the card,
  tone-coloured: pass = green, warn (low-confidence / MEDIUM) = amber, stop
  (routes to SKIP) = neutral gray (**not red — SKIP is judgment, not failure**).
- **`components/LiveRunView.tsx`** — the timeline owner. It **derives the gate
  outcomes from the stage events it already has** (no separate gate messages):
  Gate 1 from the resolved identity's confidence (+ an amber banner inside the
  resolve card when low), Gate 2 from whether extract was skipped for
  insufficient signal, Gate 3 from the score stage's verdict. Defensive readers
  (`asIdentity`/`rawCount`/`asScore`) narrow the loosely-typed event `data`.
- **`app/page.tsx`** — the inline NDJSON stream reader (kept inline: single
  consumer) was **enriched, not rebuilt**. Added an inactivity timeout (90s of
  *silence*, re-armed on every chunk so a slow-but-progressing run is never
  killed) backed by an `AbortController`, failed-stage tracking (so a stall paints
  the right card red), and a Retry action. The minimal result block was replaced
  by the OutputCard. The completed timeline stays visible above the card (the
  "watch it think" path is the demo's core).

### U11 — Output card (one component, every verdict tier)

- **`components/VerdictBadge.tsx`** — the pinned-colour verdict pill (HIGH green /
  MEDIUM amber / SKIP gray), reused on the card, the reopen page, and the table.
- **`components/SignalList.tsx`** — the ranked "show its work" list. Each signal:
  its three scores as percentages + an overall, a person/company tag, a type tag,
  a new-tab source link, and a plain note explaining its role (chosen as the hook
  / negative news found-but-excluded / considered-but-too-weak on a SKIP).
- **`components/OutputCard.tsx`** — the result surface, reused live and from the
  store. Draft tiers show "why this hook" (with source link) + editable subject
  and body (plain textareas) + a Copy button ("Copied!" ~2s, falls back to
  selecting the text if the clipboard API is blocked). The draft is re-seeded on a
  new run via a **render-time reset** (React's recommended alternative to a
  setState-in-effect) so a fresh run replaces the old draft while edits to the
  same run survive. SKIP (and any draftless record) shows the recommendation +
  reason but **still** renders the considered signals with "why not used".
- **`app/runs/[id]/page.tsx`** — reopen a saved run by URL. A client page that
  reads the route id via React's `use(params)` (the Next 16 Promise-params
  pattern), fetches `/api/runs/[id]` with loading / not-found states, and renders
  the same OutputCard.

### U12 — Dashboard (history + tested summary stats + clean empty state)

- **`lib/stats.ts` + `lib/stats.test.ts`** — the four metrics as a pure,
  unit-tested function (same "Claude judges / code computes" discipline as
  scoring). Rates are `number | null`; null ("—") when there's no denominator yet,
  never a misleading 0% or NaN%. 5 new tests.
- **`components/DashboardTable.tsx`** — prospect / company / tier / hook / when /
  status; each row reopens its run (whole-row click + a real `<Link>` on the name
  for accessibility).
- **`app/dashboard/page.tsx`** — fetches `/api/runs`; loading / error / empty /
  loaded states. The empty state shows a friendly prompt and **hides the stats
  strip entirely** (no 0/0 or NaN%). A "Dashboard ↔ New run" nav ties the surfaces
  together.

The four stats (confirmed with Harshit): **Hook specificity** (drafted runs whose
hook is person-level), **Grounded drafts** (drafted runs whose hook cites a real
source — ≈100% by design, a no-hallucination health check), **Honest SKIP rate**
(all runs the system declined), **Avg time to draft** (mean run time over drafted
runs).

## Key decisions made this session

1. **Gates are derived, not transmitted.** The pipeline reports what each stage
   did; the UI reads the gate decision out of those events. Keeps the engine and
   the stream simple and the gates a pure presentation concern.
2. **One OutputCard for live + historical runs.** A reopened run looks identical
   to a fresh one because the card is verdict-driven and source-agnostic.
3. **Client-fetch the existing API routes** for the two new pages (matches the
   home page and reuses the U8 routes) rather than server-component direct reads.
4. **Stats as a tested pure function** so the headline dashboard numbers are
   trustworthy and explainable for the case study.
5. **Keep the stream reader inline** (single consumer) and enrich the Day-4 seed
   rather than abstracting a hook.

## Review pass (high-effort, 4 finders + verify) — 3 fixes applied

- **OutputCard null-draft edge:** a HIGH/MEDIUM record arriving with `draft: null`
  would have rendered empty editable fields + a Copy button copying an empty
  email. Now keyed on draft presence, not just verdict → shows the recommendation
  fallback instead.
- **NDJSON trailing line:** the reader broke on stream-close without flushing a
  final line that lacked a trailing newline (masked today because the server
  always appends `\n`, but a proxy could strip it → a false "ended unexpectedly").
  Now flushes the buffer after close.
- **False post-success error:** the inactivity timer / catch could fire a
  "stalled"/"dropped" error *after* a successful terminal message (lingering
  socket, or a malformed trailing line). Now the timer is cleared on the terminal
  message and the catch won't clobber an already-received result (`sawTerminal`).

Two cleanup items left as optional follow-ups: a tiny shared formatting helper
(`pct`/`seconds` duplicated across a few files) and moving the stage-label map
into `lib/` (domain facts). Minor at this scale.

## Findings worth carrying forward

- **Next.js 16 pages (confirmed against the bundled docs per AGENTS.md):** pages
  are Server Components by default; in a **Client Component** the dynamic-route
  `params` is a Promise, read with React's `use()` (a client page can't be
  `async`); `<Link>` from `next/link` for navigation; `useRouter` from
  `next/navigation` for programmatic row clicks.
- **`react-hooks/set-state-in-effect` (React 19 / eslint-config-next):** calling
  `setState` synchronously inside an effect is now a lint error. The fixes:
  render-time reset for "reset state when a prop changes" (OutputCard), and just
  relying on the initial state instead of a synchronous loading-reset in the two
  fetch pages.
- **Live-search variance is real:** Amy Hood came back **HIGH** in session 3 and
  **MEDIUM** today — her freshest signal today was a bio/profile (person-level but
  not a recent *event*), so Gate 3 correctly held it at MEDIUM with "verify before
  sending". Good for the demo (it exercises the middle tier), and a reminder that
  the demo prospects (U14) should be re-checked on the day.

## Environment / how to run

- Offline tests: `npm test` → **26 passing** (7 live skipped). New: `stats.test.ts` (5).
- Typecheck / lint: `npx tsc --noEmit` and `npm run lint` — both clean.
- Dev server, Harshit's own terminal: `npm run dev` (`.env.local` loads normally).
- **`.claude/launch.json` now sources `.env.local`** (resilient — only if present)
  so the preview dev server gets the real API key inside the agent harness, where
  the sandbox shell otherwise blanks `ANTHROPIC_API_KEY`. No effect on a normal
  `npm run dev`.

## Next: Day 6 (Ship)

- **U13** — deploy to Vercel: push to GitHub, import, wire the real Upstash Redis
  (the ~5-min signup + 2 env vars, no code change) and the two API keys, smoke
  test streaming + the shared store from a second browser.
- **U14** — demo prep: verify prospects for all five acceptance examples (HIGH,
  MEDIUM, SKIP, safety veto, disambiguation) on live data, then record the video.
- Day-6 milestone (soft deadline): deployed to a public URL; demo video recorded.
