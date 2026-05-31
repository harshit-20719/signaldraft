---
title: "Research & Decisions: tuning SignalDraft's judgment"
type: decision-record
date: 2026-05-30
related: docs/plans/2026-05-28-001-feat-signaldraft-build-plan.md
---

# Research & Decisions: tuning SignalDraft's judgment

## Why this doc

After SignalDraft v1 was built and shipped, five product questions surfaced about
the heart of the system — how it scores signals, which signal types should win, how
it drafts the email, and whether the seller context was accurate. Each answer is
grounded in two things: **the actual code** (what the engine really did) and
**sourced web research** (not training-data guesses). This record captures the
findings, the decisions made, the evidence quality behind each, and what is
deliberately left to tune. It is the "why" behind commits `6623904`, `df659a4`, and
`2eec2d5`.

The questions:

1. What is the exact scoring metric, and how should it be refined for B2B outreach?
2. Which signal archetype (new hire, funding, etc.) should rank first?
3. Does the draft always reference the strongest signal? (Yes — confirmed in code.)
4. Can the seller context use real, specific Zamp metrics?
5. Apply Josh Braun's 4T framework to the drafting.
6. (Follow-up) Should the Tavily search queries match the archetype tiers?

---

## 1. Signal scoring and archetype ranking

### What the code did

Every signal that survives extraction is scored 0–1 on three dimensions and ranked
by a weighted composite; the top **safe** (non-negative) signal becomes the hook.

```
total = recency×0.30 + specificity×0.40 + relevance×0.30   (the original weights)
```

The verdict gates (HIGH needs a person-level signal, recent, scoring well; SKIP if
the best safe signal is too weak) are decided by code, not the model (KTD5).

**The gap:** the engine captured a signal *type* (funding, hiring, product,
leadership, press, talk, post, other) but **did not use it in ranking at all**. A
funding round and a podcast clip with identical recency/specificity/relevance scored
*identically*.

### What the research found

- **Signal-based outreach materially outperforms generic.** ~37% win rate vs ~19%;
  reply rates 15–25% vs 1–5%; stacking 2–3 signals on one account gives a 5–10×
  conversion lift. ([Salesmotion](https://salesmotion.io/blog/buying-signals-guide))
- **The strongest archetypes are budget/authority events, not personal content.**
  New executives spend ~70% of budget in their first 100 days; director/VP hires
  convert ~2.5× higher in their first 90 days; a funding round converts ~4× if
  contacted within 48 hours.
  ([UserGems](https://www.usergems.com/blog/new-hire-buying-signal))
- **Practitioner scoring formulas weight signal strength highest.** A production
  formula: `Signal Strength ×0.5 + Recency ×0.3 + Fit ×0.2`.
  ([Landbase](https://www.landbase.com/blog/how-to-prioritize-email-audiences-by-signal-strength-recency-and-tech-stack-fit))
- **Finance-buyer nuance:** CFOs reply better to timeline/numbers hooks (10.2% /
  8.6%) than problem hooks (4.5%), and **VP Finance / Controllers reply *more* than
  CFOs** (11.3% vs 7.6%).
  ([Autobound](https://www.autobound.ai/messaging-frameworks/cfo))
- Intent vendors (Bombora) confirm recency is a legitimate independent dimension —
  signals decay, and the decay rate differs by archetype.

### The resulting archetype ranking

| Tier | Multiplier | Archetypes | Why |
|---|---|---|---|
| T1 | 1.25 | New/changed exec (esp. the buyer), funding round | Explicit budget event / mandated re-evaluation — strongest evidence |
| T2 | 1.10 | M&A, finance/AP hiring | Structural change, active spend |
| T3 | 1.00 | Earnings, product launch, expansion, regulatory, press | Company-level, no personal urgency |
| T4 | 0.85 | Conference talk | Strong personalization hook, low buying intent |
| T5 | 0.80 | Podcast / LinkedIn post | Personalization peg only |

### Decision — R3 (commit `df659a4`)

1. **Rebalanced the weights** to `recency 0.25 / specificity 0.35 / relevance 0.40`.
   Relevance leads because, for a finance-specific pitch, fit to what the seller
   sells is the primary filter; specificity (person > company) is a close second and
   still *structurally* gates HIGH.
2. **Added a per-archetype multiplier** (`config.score.archetypeTiers`) applied to
   the base composite, then clamped to 0–1, so a funding round outranks an equal-base
   podcast clip.
3. **Kept the HIGH gate person-level** so the acceptance examples (AE1 = confident
   personal hook = HIGH, AE2 = company-level = MEDIUM) still hold. The multiplier
   changes *rank* and the MEDIUM/SKIP boundary, not the definition of HIGH.
4. **Kept it transparent** ("show its work"): `SignalList` displays the ×tier next to
   the scores, and the hook explanation names high-intent types.

### Evidence quality

- The *direction* (funding/exec > company news > personal content) rests on multiple
  convergent studies — **strong**.
- The *exact* multipliers (1.25 … 0.80) and the rebalanced weights are calibrated
  estimates — **practitioner consensus, not controlled experiment**. They are
  starting values; tune them once real reply-rate data per archetype exists.

---

## 2. The email draft — Josh Braun's 4T

### What the code did

The draft was grounded (cite only the one chosen signal, invent nothing, no AI
tells) but loosely structured: "open with the signal, one value sentence, a soft
ask." Solid, but not built on a proven cold-email framework.

### The 4T framework (sourced)

Josh Braun's four-sentence cold-email structure, one sentence per T:

1. **Trigger** — an observable fact about *this* prospect that makes the email
   non-generic ("if A, then B is probably true"). *(Braun has labeled this both
   "Trigger" and "Truth" in his own posts — a documented inconsistency; the meaning
   is the same.)*
2. **Think** — a *neutral* "illumination" question ("Poke the Bear") that makes them
   reconsider their status quo. It must **not** be leading.
3. **Third-party credibility** — social proof framed as a contrast with **"without"**
   or **"no"** ("hit quota *without* working 60 hours").
4. **Talk** — a low-pressure, permission-giving close ("feel free to say no, but is
   this interesting?"). **Never a calendar ask.**

His supporting rules, encoded as drafting + self-check checks: a **5:1 you-to-I
ratio**, problem before product, no pleasantries or hype, ≤4 sentences, fear-of-loss
over hope-of-gain, plain text.
([joshbraun.com/8things](https://joshbraun.com/8things/),
[ditch-the-pitch-poke-the-bear](https://joshbraun.com/ditch-the-pitch-poke-the-bear/))

### Decision — R2 (commit `6623904`)

Rewrote both the draft prompt and the self-check prompt around the 4T structure and
Braun's rules. The non-negotiables were preserved: the Trigger is grounded only in
the one chosen signal; proof claims come only from the seller's value props; and the
no-em-dash rule stays enforced in code. The self-check now critiques against the 4T
bar (it has, in testing, caught and fixed an over-confident hook and a "leverage"
variant).

This changes *draft quality*, not verdicts.

---

## 3. The seller context — the real Zamp

### Identifying the right company

Three companies share the "Zamp" name. Based on the case study's description (finance
operations, AP, CFO/controller buyers), this is **zamp.ai** — Amit Jain's (ex-Uber
APAC, ex-Sequoia India) AI finance/ops automation company ("Pace," a digital
employee), ~$43–46M from Peak XV/Sequoia, customers including Uber, DoorDash, Noon,
Mindbody. (Not the US sales-tax `zamp.com`, and not the earlier "Zamp Finance"
treasury product.)
([TechCrunch](https://techcrunch.com/2022/05/23/dara-khosrowshahi-and-marcelo-claure-back-former-sequoia-india-partner-amit-jains-startup/),
[Tracxn](https://tracxn.com/d/companies/zamp/__x459VJgIAvXYJazhC6t9hq8SG3N0WvNVCBCgWp-zb4o))

### Real, sourced wins (used in the seller context)

- Chargeback/dispute resolution **from months to about a day**; KYC/KYB **from days
  to ~5 minutes**.
  ([AWS case study](https://aws.amazon.com/startups/learn/zamp-realizing-an-autonomous-future-for-enterprise-with-aws))
- Vendor onboarding **from 2–4 weeks to 2–5 days**, with ~90% less verification
  effort (Zamp's own published claim).
- End-to-end invoice/AP processing (on record from Mindbody); SOC 1/2 Type II, ISO
  27001, SOX-ready audit trails ([zamp.ai/security](https://www.zamp.ai/security)).

### The honesty caveat

Zamp's public positioning is **AP automation, vendor onboarding, compliance, and
treasury** — *not* "monthly close" or "reconciliation," which is how the seller
context was originally phrased, and for which **no published numbers exist.** We do
not invent figures like "cut close cost by X% for Company Y." The value props use
only real, attributable claims.

### Decision — R1 (commit `6623904`)

Rewrote `defaultSeller` to Zamp's actual positioning with the sourced value props
above. Because relevance scoring *and* the draft both lean on these props, this
sharpened both at once.

---

## 4. The gather queries — search hardest for what scores highest

### The misalignment (the follow-up question)

The Tavily query set was organized by *source* and, it turned out, weighted
**backwards** versus the archetype tiers above: it ran dedicated searches for
low-tier podcasts and talks (×0.80–0.85) but had **no dedicated query for the
top-tier funding rounds or exec moves** (×1.25) — those only surfaced incidentally
via a generic "news" search.

### Decision — R4 (commit `2eec2d5`)

Realigned the queries to match the tiers, keeping the same number of searches (the
cost cap):

- **Added** dedicated T1 queries — a leadership/exec-move query (`appointed OR hired
  OR "new CFO"…`) and a funding/M&A query — each pulling **more** results.
- **Merged** the podcast + talk queries into one personal-voice query with **fewer**
  results, and **dropped** the low-yield company-blog query.
- Per-query result counts now scale with tier (more for T1, fewer for T4/T5).

Archetype *classification* still happens in the extract stage, so this only changes
*what is found*, not how it is scored. Verified live: a `leadership` signal now
surfaces and ranks first for a finance-leader prospect.

---

## What is deliberately left to tune

- The exact multipliers, weights, and per-query result counts are **starting
  values**, not ground truth. With real reply-rate data per archetype they should be
  re-fit.
- These changes shift verdicts, so the **demo prospects must be re-verified against
  the refined engine** before recording (Amy Hood, for example, now lands MEDIUM).
- **Spot-check any specific figure a draft cites** against its source on the day; the
  self-check guards against fabrication but is not infallible.

---

## Sources

**Signal scoring / archetypes**
- Salesmotion — B2B buying signals guide: https://salesmotion.io/blog/buying-signals-guide
- UserGems — new-hire buying signal: https://www.usergems.com/blog/new-hire-buying-signal
- Autobound — signal-based selling & CFO messaging: https://www.autobound.ai/blog/signal-based-selling-complete-guide · https://www.autobound.ai/messaging-frameworks/cfo
- Landbase — prioritizing by signal strength/recency/fit: https://www.landbase.com/blog/how-to-prioritize-email-audiences-by-signal-strength-recency-and-tech-stack-fit
- Bombora — Company Surge scoring: https://bombora.com/core-concepts/how-to-score-prioritize-accounts-leads-b2b/
- Craig Elias — trigger-event selling: https://shiftselling.com/about/craigelias/

**Josh Braun's 4T + cold-email rules**
- 8 things that increase reply rates: https://joshbraun.com/8things/
- Poke the Bear / illumination questions: https://joshbraun.com/ditch-the-pitch-poke-the-bear/
- Educate on the problem, not the solution: https://joshbraun.com/leanforward/
- 4T cold email (LinkedIn): https://www.linkedin.com/posts/josh-braun_lets-write-a-good-cold-email-using-the-4-activity-6969616091417346048-O8LY

**Zamp**
- Company site & security: https://www.zamp.ai/ · https://www.zamp.ai/security
- AWS case study (outcome metrics): https://aws.amazon.com/startups/learn/zamp-realizing-an-autonomous-future-for-enterprise-with-aws
- TechCrunch (founding): https://techcrunch.com/2022/05/23/dara-khosrowshahi-and-marcelo-claure-back-former-sequoia-india-partner-amit-jains-startup/
- Tracxn (company facts): https://tracxn.com/d/companies/zamp/__x459VJgIAvXYJazhC6t9hq8SG3N0WvNVCBCgWp-zb4o
