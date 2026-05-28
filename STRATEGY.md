---
name: SignalDraft
last_updated: 2026-05-28
---

# SignalDraft Strategy

## Target problem

GTM/SDR reps source outreach signals manually across LinkedIn, news, and buyers'
blogs. Because that sourcing is slow and doesn't scale within a campaign's time
window, reps start with deep personalised research but degrade to copy-pasting
names onto generic-sounding drafts to hit deadlines. The crux is making the
*judgment* — which signal is relevant and high-confidence enough to build a hook
around — fast and reliably, then drafting a message that references it well.

## Our approach

We win by making the AI's judgment visible — showing which signal it picked and
why — layered with two commitments: being honest when there's no good signal
(recommend skip, don't fake a hook), and grounding every claim in a real, cited
source (never inventing facts). So that the rep can *trust* and delegate the
signal-judgment at scale, instead of degrading to generic copy-paste under
deadline pressure.

## Who it's for

**Primary:** SDR / GTM rep running outreach at volume against campaign deadlines.
They're hiring SignalDraft to produce genuinely unique, personalised,
human-sounding email drafts (no AI tells) at speed — keeping outreach quality
high across a large prospect list instead of letting it collapse as the deadline
nears.

_Seller context (not the user): the workflow writes TO finance leaders — CFO
through Head of AP — at growth-stage B2B companies, reflecting a Zamp-style
finance-ops automation pitch._

## Key metrics

- **Hook specificity rate** — % of drafts whose hook is about *this person,
  recently* (vs generic or company-only). Scored per run on the demo set.
- **Grounding fidelity** — % of claims that trace to a real cited source; target
  zero invented facts. Checked per run against cited signals.
- **Honest abstention rate** — when signal is thin, % of cases the system
  correctly recommends "skip / go generic" instead of faking a hook. Measured on
  thin-signal test cases.
- **Time-to-draft** — seconds from prospect name to reviewed draft. Logged per run.
- _North star (not yet measurable in a case study): reply / positive-reply rate
  on sent emails._

## Tracks

### Signal Intelligence (the judgment engine)

Gathering signals across sources, structuring them, scoring them for relevance and
confidence, and the honesty gates (disambiguation, skip-when-thin). Stages 2–4
plus the gates.

_Why it serves the approach:_ this is the judgment we make visible and the
honest-abstention layer — the brain behind the thesis.

### Grounded Drafting

Turning the chosen hook into a short, human-sounding email that cites only real
signals, plus the optional self-check. Stages 5–6.

_Why it serves the approach:_ delivers "human, never invents facts" in the rep's
actual output.

### Transparent Experience (the UI)

The live run view (each stage visible as it runs) and the dashboard (history,
status, outputs across runs).

_Why it serves the approach:_ "make the judgment visible" only exists if the rep
can *see* it — this is where the thesis becomes tangible, and it's explicitly
required by the assignment.

## Milestones

- **2026-05-28** — Day 1: build kickoff.
- **2026-06-02** — Soft submission deadline.
- **2026-06-03** — Hard submission deadline.

## Not working on

- **Direct LinkedIn scraping** — out of scope (ToS, reliability). LinkedIn
  *signals* still come in through compliant channels only: Tavily search
  snippets, and optionally a third-party enrichment tool (Clay). Direct
  profile/post scraping is a future customer-authorised integration.
- **Auto-sending emails** — output is always a draft for human review; the human
  stays in the loop.
- **Fully autonomous agent** — deliberately chose a prompt-chaining workflow with
  gates over an open-ended agent.
- **Draft self-check loop (Stage 6)** — stretch goal, only if time allows after
  v1 (Stages 1–5) is solid.

## Marketing

**One-liner:** Personalised outreach that shows its work — every email grounded
in a real signal, every signal you can see.
