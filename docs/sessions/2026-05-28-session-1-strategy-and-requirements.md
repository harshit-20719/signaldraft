# Session 1 — Strategy & Requirements (2026-05-28)

## What this session accomplished

Took the Zamp AI Solutions Associate case study from a blank slate to a fully-specified, ready-to-build foundation. No code yet — this was deliberate problem selection, framework mapping, strategy, and requirements.

## Decisions locked

1. **Problem picked: PS-3 (personalised outreach).** Chosen over the safer PS-1 (invoice processing). Reasoning: the AI workflow-design and signal-judgment work is more interesting and more transferable, and "deterministic is only as good as the rules you write." Eyes open on the trade-offs (more moving parts, web variance, judgment is harder to grade than rules).

2. **Product named: SignalDraft.**

3. **Framework: prompt-chaining workflow with routing gates** (per Anthropic's "Building Effective Agents"), deliberately NOT an autonomous agent. The restraint is itself a defensible design choice.

4. **Process mapped end-to-end:** Input → Resolve identity (Gate 1) → Gather signals via Tavily (Gate 2) → Extract/structure → Score & rank → Hook-quality gate (Gate 3) → Draft → Output. Optional Stage 6 self-check is a stretch.

5. **Seller context:** Zamp-style finance-ops automation, sold TO finance leaders (CFO → Head of AP) at growth-stage B2B companies. Chosen because the most *findable* public signal (funding, new finance hires, expansion) is also the most *pitch-relevant* — signal and pitch point the same way. Narrative: "the outreach tool Zamp's own GTM team would use."

6. **LinkedIn:** no direct scraping (ToS/reliability). Public snippets via a `site:linkedin.com` Tavily query. Clay enrichment is a possible later lever, not v1.

7. **Scoring:** 4 dimensions — recency, specificity, relevance, safety (veto) → balanced 3-tier verdict: HIGH / MEDIUM / SKIP.

8. **Edge cases to build/demo:** thin signal → SKIP; negative news → safety veto; common name → disambiguation.

9. **UI (first-class scope):** input form, live run view (full-transparency target, progress+summary fallback), output card, dashboard.

10. **Input:** single-prospect form is primary; CSV batch is a stretch.

11. **Demo prospects:** 7 slots defined (3 HIGH, 1 MEDIUM, 1 SKIP, 1 negative-news, 1 common-name); real names picked & verified live on Day 1 (to stay grounded).

12. **Demo reliability:** run live searches every time; re-record the video if a search disappoints (video is the primary, re-recordable deliverable).

13. **Tech stack:** Next.js + TypeScript + Tailwind + Claude API + Tavily, deploy on Vercel. Building together in Claude Code (the agent writes/runs code; the user directs and decides).

## Four success metrics

Hook specificity rate · grounding fidelity · honest abstention rate · time-to-draft. (North star, not yet measurable: reply rate.)

## Artifacts created

- `STRATEGY.md` (repo root) — the durable strategy anchor.
- `docs/brainstorms/2026-05-28-signaldraft-requirements.md` — the full requirements spec (R1–R15, acceptance examples, scope boundaries, dependencies).

## User context (carry forward)

- Novice: zero coding/engineering experience. Avoid jargon, explain trade-offs plainly, ask before any major decision.
- Wants clean foundations, simple solution-oriented build, nothing over-ambitious.
- Timeline: Day 1 = 2026-05-28 · soft deadline 2026-06-02 · hard deadline 2026-06-03.

## Next step

Start a fresh session and run `/ce-plan` to produce a sequenced, day-by-day build plan. The next-session prompt is below.

---

## Next-session prompt (copy this)

> I'm building **SignalDraft** — a personalised-outreach AI workflow — as my Zamp AI Solutions Associate case study (problem PS-3). Strategy and requirements are already done and saved in this repo:
> - `STRATEGY.md` (repo root)
> - `docs/brainstorms/2026-05-28-signaldraft-requirements.md`
>
> Please read both first, then run `/ce-plan` to create a sequenced, day-by-day build plan for my remaining timeline (soft deadline 2 June, hard deadline 3 June). We're building together here in Claude Code. Stack is locked: Next.js + TypeScript + Tailwind + Claude API + Tavily, deploying to Vercel.
>
> Important: I'm a novice with zero coding/engineering experience — avoid jargon, explain trade-offs plainly, and ask me before any major decision. Keep it simple and solution-oriented, nothing over-ambitious.
