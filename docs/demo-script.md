---
title: "SignalDraft — 5-minute demo script"
type: demo-guide
date: 2026-06-01
audience: Zamp case-study reviewers
app: https://signaldraft.vercel.app
repo: https://github.com/harshit-20719/signaldraft
---

# SignalDraft — 5-minute demo script

A narration guide for a **single-take screen recording, 5 minutes MAX** (no editing,
no slides — just the screen and the process running). Written to be read aloud or
paraphrased while you click. **SAY** = the spoken line; *(do)* = the action.

## What the deliverable requires (and how this script meets it)

| Requirement | How we hit it |
|---|---|
| Happy path running **live** | The HIGH run in Beat 1 — a real run, narrated stage by stage. |
| **Run at least one edge case live** | The **SKIP** in Beat 2 — a real live run. It's fast (~10s) and deterministic, so it can't break on camera. |
| Narrate what / why / the decisions | Every beat narrates the stage and the judgment being made. |
| **How you built it** | Beat 4 is a dedicated "how it's built" beat (verdict by code, self-check, structured outputs). |
| 5 minutes max, one take, no edits | The re-cut below runs ~4.5 min, leaving buffer. |

The one idea to open and close on:

> **The hard part of outreach was never finding signals. It's the *judgment* of
> which signal is worth using — and whether to send at all. SignalDraft does that
> judgment, live, and shows its work.**

---

## Before you hit record (the 5-minute checklist)

Because this is **one continuous take**, you cannot wait out the rate limit mid-recording.
The trick: **reopening a saved run is free** — it's just a page load, it does NOT count
against the 5-runs-per-hour limit. Only *new* runs count. So capture the saved runs
*before* you record, and the recording itself needs only **2 live runs** (happy + SKIP).

1. **In the hour before recording, make sure these saved runs exist** on
   `https://signaldraft.vercel.app/dashboard` (run any that are missing — each is one
   of your 5/hour, so space them out):
   - **safety-veto** — Hilary Maxson / Oracle, showing "negative news found and excluded".
     This is the most variance-prone case, so capture it ahead of time and rely on the
     saved one. *(Look for the amber "negative news avoided" flag and a layoffs signal
     marked "found but not used".)*
   - *(Optional extra fallbacks)* a clean **HIGH** and a **MEDIUM**, in case your live
     happy-path run varies and you'd rather reopen a saved one.
2. **Leave yourself at least 2 live runs** in the rate-limit window for the recording
   (the happy path + the SKIP). If unsure, wait for a fresh hour before you hit record.
3. **The SKIP prospect is your safe live edge case** — `Devon Ashcroft / Larkfield
   Instruments / Head of Finance`. It's an obscure (synthetic) prospect with no public
   signal, so it *always* returns SKIP in ~10 seconds. Zero live risk.
4. **Set the theme** (toggle, top-left) to whatever looks best on screen.
5. **Tidy the dashboard** — if old test runs are visible, use the dashboard filter to
   show only your demo prospects, or clear them via the Upstash console.
6. **Rehearse once end-to-end.** The interviewer is explicitly judging whether the demo
   runs smoothly. Know the order cold.

---

## The recording, beat by beat (~4.5 min)

### Beat 0 — Open on the problem (~25s)

*(Start on `https://signaldraft.vercel.app`, the single-run form visible.)*

> **SAY:** "This is SignalDraft. The premise: when a rep is under deadline, real
> personalised research collapses into generic copy-paste. But finding facts about a
> prospect was never the hard part — the hard part is judging which fact is recent,
> specific, and *safe* enough to build an email on, and whether to send at all.
> SignalDraft makes that judgment live, and shows its reasoning. Here's a run end to
> end."

---

### Beat 1 — Happy path, LIVE (~1:50)

*(Enter the happy-path prospect — **Carey Hendrickson / PACS Group / Chief Financial
Officer**. Before submitting, gesture at the seller panel.)*

> **SAY:** "It already knows who it's selling — Zamp's real positioning: AI that
> automates finance operations, with its actual published value props. That's what
> 'relevant' gets judged against. Submitting now."

*(Submit. As the stages stream, slow down — this is the core of the demo.)*

> **SAY:** "Watch it think. **Resolve** — it pins down who this person is. **Gather**
> — several targeted web searches fire in parallel, weighted toward the highest-intent
> signals like leadership changes and funding. **Extract** — Claude filters the raw
> hits down to the ones really about this person and on-topic, dropping the noise.
> **Score** — and this is the key design choice: the verdict isn't decided by a human,
> and it isn't decided by Claude. *Code* scores every signal on recency, specificity,
> and relevance, weights it by how strong that signal *type* is, and applies the gates.
> Then **Draft**, and a sixth stage, **Self-check**, where the draft reviews its own
> work and tightens it."

*(When the card renders: point at the verdict badge → the "why this hook" line → the
email body.)*

> **SAY:** "A drafted verdict, and here's the 'shows its work' part — it names the exact
> signal it built on and why, with the source link. The email follows Josh Braun's
> four-sentence structure: a trigger about them, a real question, one proof point from
> Zamp's value props, a low-pressure close. No 'hope this finds you well', no buzzwords,
> no em-dashes — those are banned in code. Every claim traces to that one signal. It
> invented nothing."

*(Scroll to the ranked signal list, briefly.)*

> **SAY:** "And it shows everything else it considered, ranked, each with its score.
> Nothing hidden."

> *(If this run lands MEDIUM instead of HIGH, don't flinch — say:)* "Note it's flagged
> 'verify before sending' — the signal's a touch older or company-level, so it drafts
> but tells you to confirm. It knows the difference between confident and tentative."

---

### Beat 2 — Edge case, LIVE: the honest SKIP (~40s)

*(Back to the form. Enter **Devon Ashcroft / Larkfield Instruments / Head of Finance**.
Submit. It returns SKIP in ~10s.)*

> **SAY:** "Now an edge case, live. This is an obscure prospect with no real public
> signal. Watch — it gathers, finds nothing usable, and instead of inventing something
> to say, it does the honest thing: **SKIP**. No email, just the reason. A tool that
> knows when *not* to send is the one a rep can actually trust. The skip is a feature,
> not a failure."

---

### Beat 3 — The showpiece edge case: the safety veto (saved run) (~50s)

*(Go to **Dashboard**, open the saved **Hilary Maxson / Oracle** run. Point at the flag,
then the ranked signals.)*

> **SAY:** "One more edge case — my favourite — from a run I captured earlier. Oracle's
> been in the news for layoffs, and the system *found* that. But look: it refused to
> build the email on negative news. It's flagged 'found and excluded', kept visible in
> the ranked list so you see it was considered — but the email is built on a clean,
> positive signal instead. That safety judgment is hard-coded, not left to the model's
> mood. This is the difference between a tool that *retrieves* and one that *judges*."

> *(While you're on the dashboard:)* "And everything's here on one shared dashboard —
> anyone with the link sees it, no login — with summary metrics: how often the hook is
> person-specific, how many drafts are grounded in a real source, the honest-skip rate."

---

### Beat 4 — How it's built (~30s)

*(Stay on a result card, or have the repo / README visible if you prefer.)*

> **SAY:** "A few words on how it's built, because the architecture *is* the point.
> One: the verdict is computed by deterministic code, not the model — so it's
> explainable and reproducible, and I can tune a weight without touching logic. Two:
> every piece of JSON from Claude is constrained to a strict schema, so there's no
> fragile parsing. Three: that self-check stage is best-effort — if it ever fails, the
> original draft is kept, so a quality feature can never cost you the result. The whole
> judgment engine is plain TypeScript I can run and test from a terminal — sixty-one
> tests, no web server needed. The UI is a thin layer over it."

---

### Beat 5 — Close (~15s)

> **SAY:** "So SignalDraft doesn't just find signals — it makes the judgment a good rep
> makes: is this worth using, is it safe, should I send at all. And it shows that
> reasoning at every step. Verdict by code, drafting by Claude, every claim grounded,
> the unsafe ones vetoed. That's the whole idea."

> *(Optional 15s flash if under time — go to `/batch`, click "Use an example", toggle
> dark mode:)* "It also runs in batch from a CSV, and has a light/dark theme. Thanks for
> watching."

---

## The five demo prospects (reference)

Four real, recent US-listed CFO appointments plus one deliberately obscure (synthetic)
prospect for SKIP. **Live search varies**, so a verdict may differ on the day — the
narration above holds up either way, and saved runs are the safety net.

| Case | Prospect | Company | In the video |
|---|---|---|---|
| **HIGH** (happy path) | Carey Hendrickson | PACS Group | Beat 1, **live** |
| **SKIP** (edge case) | Devon Ashcroft | Larkfield Instruments | Beat 2, **live** |
| **safety-veto** (edge case) | Hilary Maxson | Oracle | Beat 3, **saved run** |
| MEDIUM | Shimon Steinmetz | Arq, Inc. | optional fallback |
| disambiguation | Sid Thacker | Peloton | optional fallback |

> HIGH vs MEDIUM: Hendrickson and Steinmetz are both strong appointment signals and can
> each land HIGH **or** MEDIUM depending on the day's search. Use whichever is cleanly
> HIGH for the happy path; the other is a fallback. The point is the *distinction*, not
> the name.

---

## Headline numbers (for the close or narration)

- **Six-stage pipeline**, verdict decided by **code** (not the model) — deterministic and explainable.
- **61 offline tests** pass; type-check, lint, and production build all clean.
- **Live and shared** — `https://signaldraft.vercel.app`, one Upstash-backed dashboard.
- **Five judgment cases** demonstrable: HIGH, MEDIUM, SKIP, safety-veto, disambiguation.
- Built lean: **Next.js 16 + TypeScript + Tailwind + Claude + Tavily**, no agent framework.

---

## If something goes wrong on the day (fallbacks)

| Problem | Fallback |
|---|---|
| The live happy-path run varies (HIGH ↔ MEDIUM, or a weak hook) | Narrate it honestly (both draft an email), or reopen a saved HIGH run. |
| `429 / rate limit reached` mid-recording | You've used 5 runs this hour. Stop running new ones — do the rest from **saved runs** (reopening is free). Next time, leave more headroom before recording. |
| A live run stalls or errors | The UI shows a clear error + **Retry**, or reopen a saved run and keep moving. |
| The SKIP somehow drafts (it won't — no signal exists) | Reopen the saved Ashcroft SKIP run. |
| Old/irrelevant runs clutter the dashboard | Use the dashboard **filter** to show only the demo prospects. |
| You're running long | Cut Beat 5's optional flash and the dashboard-metrics aside; the core (happy + SKIP + veto + build) is the deliverable. |

> Golden rule: **the saved dashboard is your safety net, and reopening saved runs is
> free.** Anything you can do live, you can show from a saved run that looks identical.
> Never let live variance stall the recording.
