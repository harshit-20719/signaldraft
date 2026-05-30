import { z } from "zod";
import type { Draft, Hook, Identity, SellerContext, Verdict } from "@/lib/types";

// Stage 6 (self-check, R11) prompt. After the draft is written, Claude reviews
// its OWN email against the same bar the draft had to meet — grounding,
// specificity, and the no-AI-tells rules — and either passes it or returns a
// tightened version. This is the "critique and regenerate" stretch goal: a
// second, adversarial pass at the writing, made visible as its own stage so the
// rep can see the model holding itself to the standard.

export const SelfCheckSchema = z.object({
  assessment: z
    .enum(["pass", "revise"])
    .describe(
      "'pass' if the draft already meets every rule and you changed nothing; 'revise' if you improved it.",
    ),
  critique: z
    .string()
    .describe(
      "One short sentence (no more): what you checked and what you changed, or why it already met the bar. Plain language for the rep.",
    ),
  subject: z
    .string()
    .describe("The final subject line — identical to the input if you passed it, improved if you revised."),
  body: z
    .string()
    .describe("The final email body — identical to the input if you passed it, improved if you revised. Same rules as the original draft."),
});

export function selfCheckPrompt(args: {
  draft: Draft;
  hook: Hook;
  identity: Identity;
  seller: SellerContext;
  verdict: Verdict;
}): { system: string; prompt: string } {
  const { draft, hook, identity, seller, verdict } = args;

  const system = [
    "You are a demanding reviewer of B2B cold outreach emails. You are handed a",
    "draft email plus the ONE signal it was supposed to be built on. Your job is to",
    "judge it honestly against the bar below and, if it falls short, return a",
    "tightened version. Do not rewrite for the sake of it: if the draft already",
    "meets every rule, pass it through unchanged.",
    "",
    "THE BAR (the draft must clear all of it):",
    "1. GROUNDING — every factual claim traces to the one provided signal. No",
    "   invented metrics, pain points, mutual connections, or details. If you find",
    "   an invented claim, remove it.",
    "2. SPECIFIC OPENER — it opens on the actual signal, in the reader's frame, not",
    "   with a generic greeting or a pitch about the seller.",
    "3. NO AI TELLS — no em-dashes (—); none of: 'I hope this email finds you well',",
    "   'I wanted to reach out', 'I came across', 'reaching out because', leverage,",
    "   synergy, circle back, touch base, game-changer, cutting-edge, revolutionary,",
    "   thrilled, excited to. Sound like a thoughtful peer, not a marketer.",
    "4. BREVITY + ASK — under ~110 words, one concrete value sentence, one soft",
    "   low-pressure ask, signed with a first-name placeholder like '[Your name]'.",
    verdict === "MEDIUM"
      ? "5. HEDGING — the hook is company-level or older, so the reference must stay a touch tentative and must not claim the signal is personally about them."
      : "5. CONFIDENCE — the hook is a strong recent person-level signal; a direct, confident reference is appropriate.",
    "",
    "If you revise, keep every remaining claim grounded in the same one signal —",
    "fixing tells must never introduce new invented facts.",
  ].join("\n");

  const prompt = [
    "Recipient:",
    `- ${identity.name}, ${identity.role ?? "(role unknown)"} at ${identity.company}`,
    "",
    "The ONE signal the email may reference (nothing else):",
    `- What: ${hook.what}`,
    `- Source: ${hook.url}`,
    "",
    "Seller (who it is from / what it pitches):",
    `- ${seller.company}: ${seller.product}`,
    "",
    "The draft to review:",
    `Subject: ${draft.subject}`,
    "",
    draft.body,
    "",
    "Review it against the bar. Return the final subject and body (unchanged if it",
    "passes), your assessment, and a one-sentence critique.",
  ].join("\n");

  return { system, prompt };
}
