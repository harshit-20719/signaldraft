---
title: "SignalDraft — demo script"
type: demo-guide
date: 2026-06-01
audience: Zamp case-study reviewers
app: https://signaldraft.vercel.app
repo: https://github.com/harshit-20719/signaldraft
---

# SignalDraft — demo script

A narration guide for a screen recording of roughly **5–7 minutes**. It is written
to be read aloud (or paraphrased) while you click. Everything in **SAY** is the
spoken line; everything in *(do)* is the action.

The whole demo is built around one idea, so open and close on it:

> **The hard part of outreach was never finding signals. It's the *judgment* of
> which signal is worth using — and whether to send at all. SignalDraft does that
> judgment, and shows its work.**

---

## Before you hit record (a 5-minute checklist)

These steps prevent the two things that can break a live demo: the rate limit and
live-search variance.

1. **Mind the rate limit.** The app allows **5 runs per IP per hour** (a deliberate
   public-abuse guardrail). The recording does **one** live single run plus **one**
   batch of five = six runs. That exceeds five in one hour on one network. Pick one:
   - **(Recommended)** Do the **batch of five first** (off camera or as step 4),
     let it populate the dashboard, then **wait for the next hour** before recording
     the live single run; or
   - run the **live single run from a different network** than the batch (e.g.
     phone hotspot for one of them), or
   - make the batch **four rows** so the total is five.
2. **Pre-load the saved fallbacks.** Every run is saved to the shared dashboard, so
   you do not have to trust live search on the day. Before recording, confirm these
   five runs exist at `https://signaldraft.vercel.app/dashboard` (run any that are
   missing):
   - **HIGH** — clean, person-level, recent
   - **MEDIUM** — company-level / "verify before sending"
   - **SKIP** — an obscure prospect with no usable signal
   - **safety-veto** — negative news found but excluded from the hook
   - **disambiguation** — a common-name prospect with a low-confidence flag
   If a live run on the day comes back differently than you want (search varies),
   **reopen the saved run** for that case instead. Same screen, identical card —
   the viewer can't tell, and you can say honestly "here's one I ran earlier."
3. **Set the theme** to whichever looks best on your screen (toggle, top-left).
4. **Have the example CSV ready** — on `/batch`, the **"Use an example"** link loads
   the five demo prospects, so you never type during the recording.
5. **Clear or filter old runs.** If the dashboard has older test runs you don't want
   on camera, either clear them (Upstash console) or use the dashboard **filter** to
   show only the demo prospects while recording.

---

## The five demo prospects (one per verdict case)

These are the locked demo set — four real, recent US-listed CFO appointments plus
one deliberately obscure (synthetic) prospect for the SKIP case. **Live search
varies**, so the verdict you get on the day may differ; the "what to say" column is
written to hold up either way, and the saved-run fallback covers the rest.

| Case | Prospect | Company | What it demonstrates |
|---|---|---|---|
| **HIGH** | Carey Hendrickson | PACS Group | A clean, recent, person-level appointment → a confident drafted email. |
| **MEDIUM** | Shimon Steinmetz | Arq, Inc. | A solid signal held at MEDIUM → "draft, but verify before sending." |
| **SKIP** | Devon Ashcroft | Larkfield Instruments | No usable public signal → an honest "skip", no email. |
| **safety-veto** | Hilary Maxson | Oracle | Negative news (layoffs) found, flagged, and kept *out* of the hook. |
| **disambiguation** | Sid Thacker | Peloton | A low-confidence identity flag that does **not** block the run. |

> Note on HIGH vs MEDIUM: Hendrickson and Steinmetz are both strong appointment
> signals and can each land HIGH **or** MEDIUM depending on the day's search (recency
> of what surfaces). That's fine — you have one of each across the two, and the live
> single run below uses whichever is cleanly HIGH on the day. The point you're
> making is the *distinction*, not the specific name.

---

## The recording, start to finish

### 0. Open on the problem (~20s, on the landing page)

*(Start on `https://signaldraft.vercel.app`, the single-run form visible.)*

> **SAY:** "This is SignalDraft. The premise: when a rep is under deadline, real
> personalised research collapses into generic copy-paste. But finding facts about a
> prospect was never the hard part — the hard part is judging which fact is recent,
> specific, and *safe* enough to actually build an email on, and whether to send at
> all. SignalDraft makes that judgment, live, and shows its reasoning. Let me show
> you one run end to end."

---

### 1. One live run, end to end — the HIGH (~90s)

*(In the form, enter the prospect that is cleanly HIGH on the day — start with
**Carey Hendrickson / PACS Group / Chief Financial Officer**. Point at the seller
panel before you submit.)*

> **SAY:** "Notice the system already knows who it's selling — this is Zamp's real
> positioning: AI that automates finance operations, with its actual published value
> props. That context is what 'relevant' will be judged against. I'll submit."

*(Submit. As the stages stream, narrate the live timeline — this is the core of the
demo, so slow down here.)*

> **SAY:** "Watch it think. **Resolve** — it pins down who this person is.
> **Gather** — it fires several targeted web searches in parallel, weighted toward
> the highest-intent signals like leadership changes and funding. **Extract** — Claude
> filters the raw results down to the ones that are really about this person and
> on-topic, dropping the noise. **Score** — and this is the important part: a human
> didn't decide this verdict and neither did Claude. *Code* scored every signal on
> recency, specificity, and relevance, multiplied by how strong that signal *type* is,
> and applied the gates. **Draft**, then a sixth stage, **Self-check**, where the draft
> reviews its own work against the bar and tightens it."

*(When the card renders, point at the verdict badge, then the "why this hook" line,
then the email.)*

> **SAY:** "HIGH. And here's the 'shows its work' part — it tells you *which* signal
> it built on and why it was chosen, with the source link. The email itself is built
> on Josh Braun's four-sentence structure: a trigger about them, a genuine question,
> one proof point from Zamp's value props, and a low-pressure close. No 'I hope this
> finds you well', no buzzwords, no em-dashes — those are banned in code, not just
> asked for. Every claim traces to that one signal; it invented nothing."

*(Scroll down to the ranked signal list.)*

> **SAY:** "And it's not hiding the other signals — here's everything it considered,
> ranked, each with its score. Full transparency."

---

### 2. The self-check catch (~30s)

> **SAY:** "That sixth stage matters. In testing, a first draft invented a pain
> point — it claimed the team was 'still carrying manual reconciliation work', which
> wasn't in any signal. The self-check caught it and removed it before I ever saw it.
> It's a second, adversarial pass at the model's own work. And it's best-effort by
> design: if that self-check call ever fails, the original draft is kept — a quality
> feature can never cost you the result."

*(If you have a saved run where `revised: true`, reopen it and point at the
"Draft revised after self-review" note as concrete proof. Otherwise narrate it as
above — it's true either way.)*

---

### 3. The other verdicts — MEDIUM, SKIP, veto, disambiguation (~2 min)

The cleanest way to show the range without burning four more live runs is the
**dashboard** plus **reopening saved runs**. Go to the dashboard.

*(Click "Dashboard".)*

> **SAY:** "Every run is saved to one shared dashboard — anyone with the link sees
> it, on any device, no login. Here are the summary metrics: how often the hook is
> person-specific, how many drafts are grounded in a real source, the honest-skip
> rate, average time to draft. Let me show the other verdicts."

**MEDIUM** *(reopen the Steinmetz / Arq run, or whichever is MEDIUM):*

> **SAY:** "Same machinery, different judgment. This one is MEDIUM — the signal is
> good but company-level or a little older, so it drafts the email but flags it:
> 'verify before sending.' It knows the difference between confident and tentative."

**SKIP** *(reopen the Devon Ashcroft / Larkfield run):*

> **SAY:** "This prospect has no real public signal. Instead of inventing something,
> it does the honest thing: SKIP, no email, with the reason. A tool that knows when
> *not* to send is the one a rep can actually trust. The skip is a feature."

**safety-veto** *(reopen the Hilary Maxson / Oracle run; point at the flag and the
ranked signals.)*

> **SAY:** "This is my favourite. Oracle's been in the news for layoffs — and the
> system *found* that. But look: it refused to build the email on negative news.
> It's flagged 'found and excluded', kept visible in the ranked list so you can see
> it was considered, but the email is built on a clean, positive signal instead.
> That safety judgment is hard-coded, not left to chance."

**disambiguation** *(reopen the Sid Thacker / Peloton run; point at the
low-confidence flag.)*

> **SAY:** "And here's a common-name case. The system wasn't fully sure it had the
> right person — so it says so, with a low-confidence flag. But notice it *didn't*
> stop; the flag is a caution, not a roadblock. It surfaces its own uncertainty
> instead of hiding it."

---

### 4. The batch (~45s)

*(Go to `/batch`. Click "Use an example".)*

> **SAY:** "It also runs in batch. I'll load an example list of five prospects" —
> *(point at 'Arq, Inc.')* — "including one with a comma in the company name, which
> the CSV parser handles correctly. Each row runs through the exact same engine and
> lands on the dashboard."

*(If you're inside the rate limit, click **Run 5** and let it stream a couple of
rows, then cut. If not — see the rate-limit note — just show that it loaded the five
rows and say:)*

> **SAY:** "Each one streams its current stage, and when they finish they're all on
> the shared dashboard — the same five verdicts, side by side."

---

### 5. Dark mode + close (~20s)

*(Toggle the theme, top-left. Then land back on the dashboard or the landing page.)*

> **SAY:** "Light and dark, remembered across visits."

> **SAY (close):** "So — SignalDraft doesn't just find signals; it makes the
> judgment a good rep makes. Is this worth using, is it safe, and should I send at
> all. And it shows that reasoning at every step, so a rep can trust it and a manager
> can audit it. Verdict by code, drafting by Claude, every claim grounded, the unsafe
> ones vetoed. That's the whole idea."

---

## The headline numbers (for the close, or for narration)

- **Six-stage pipeline**, verdict decided by **code** (not the model), so it's
  deterministic and explainable.
- **61 offline tests** pass; type-check, lint, and production build all clean.
- **Live and shared** — `https://signaldraft.vercel.app`, one Upstash-backed
  dashboard every visitor sees.
- **Five acceptance cases** all demonstrable: HIGH, MEDIUM, SKIP, safety-veto,
  disambiguation.
- Built lean: **Next.js 16 + TypeScript + Tailwind + Claude + Tavily**, no agent
  framework, the engine fully testable from a terminal.

---

## If something goes wrong on the day (fallbacks)

| Problem | Fallback |
|---|---|
| A live run returns a different verdict than you wanted | **Reopen the saved run** for that case from the dashboard. Identical screen. |
| `429 / rate limit reached` | You've used five runs this hour on this IP. Switch network (hotspot), or do the rest of the demo from **saved runs** — no new runs needed. |
| A live run stalls or errors mid-stream | The UI shows a clear error and a **Retry**. Or just reopen a saved run and keep moving. |
| The safety-veto doesn't fire live (search didn't surface the negative news) | Reopen the **saved Maxson veto run**. This is the most variance-prone case — rely on the saved one. |
| Old/irrelevant runs clutter the dashboard | Use the dashboard **filter** (by name or verdict) to show only the demo prospects. |

> The golden rule: **the saved dashboard is your safety net.** Anything you can do
> live, you can show from a saved run that looks identical. Never let live variance
> stall the recording.
