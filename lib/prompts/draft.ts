import { z } from "zod";
import type { Hook, Identity, SellerContext, Verdict } from "@/lib/types";

// Stage 5 (draft) prompt. Only runs for HIGH/MEDIUM — SKIP never reaches here
// (honest abstain). The email must be GROUNDED: every factual claim has to trace
// to the one chosen signal, and the model is told to invent nothing. The "no AI
// tells" rules exist because a draft that screams "written by AI" defeats the
// whole point — the rep needs something a human would plausibly have written.

export const DraftSchema = z.object({
  subject: z
    .string()
    .describe(
      "Short, specific subject line (≈ 8 words max) that nods to the hook, not the product. No clickbait, no ALL CAPS, no emoji.",
    ),
  body: z
    .string()
    .describe(
      "The email body: under ~110 words, plain text with normal line breaks, signed off with just the sender's first name placeholder. No subject line inside it.",
    ),
});

export function draftPrompt(args: {
  verdict: Verdict;
  hook: Hook;
  identity: Identity;
  seller: SellerContext;
}): { system: string; prompt: string } {
  const { verdict, hook, identity, seller } = args;

  const system = [
    "You write one short cold outreach email for a B2B seller using Josh Braun's",
    "4T framework. The reader is a busy finance leader: respect their time and sound",
    "like a sharp peer who did their homework, not a marketer.",
    "",
    "GROUNDING (non-negotiable):",
    "- The opener is built on exactly ONE signal about the prospect (below). Reference",
    "  only it. Invent nothing about the person or company: no made-up metrics, pain",
    "  points, mutual connections, or fabricated details.",
    "- Proof and value claims come ONLY from the seller's value props (below), never",
    "  invented. If the signal is thin, keep it shorter rather than padding it.",
    "",
    "THE 4T STRUCTURE — one sentence each, in this order:",
    "1) TRIGGER: open on the specific signal as an observation about THEM, with a light",
    "   logical inference (not 'I saw X' but 'You did X, which usually means Y').",
    "2) THINK: a neutral, genuinely curious question that makes them reconsider how they",
    "   handle the relevant finance work. It must NOT be leading or imply its own answer;",
    "   point at a cost or gap they may not have priced in (fear of loss beats hope of",
    "   gain). End with a question mark.",
    "3) PROOF: one line of third-party credibility drawn from the seller's value props,",
    "   framed as a contrast using 'without' or 'no' (e.g. 'teams clear AP without manual",
    "   handoffs').",
    "4) TALK: a low-pressure, permission-giving close they can answer yes or no (e.g.",
    "   'Worth a look, or not a priority right now?'). NEVER ask for a meeting, a call, a",
    "   calendar slot, or '15 minutes'.",
    "",
    "RULES:",
    "- Write about THEM: at least five 'you/your' for every one 'I/we/our'. Do not open",
    "  with 'I', 'we', or your company name.",
    "- Name the prospect's world before your product; the seller's product/company name",
    "  must not appear before the PROOF line.",
    "- 4 sentences max. Plain text. No greeting fluff. Sign off with '[Your name]'.",
    "",
    "NO AI TELLS (a draft that reads as AI-written is a failure):",
    "- No em-dashes. Banned openers: 'I hope this email finds you well', 'I wanted to",
    "  reach out', 'I came across', 'reaching out because'. Banned buzzwords: leverage,",
    "  synergy, circle back, touch base, game-changer, cutting-edge, revolutionary,",
    "  thrilled, excited to. Contractions are good.",
    verdict === "MEDIUM"
      ? "- The hook is company-level or older, not personally confirmed: keep the TRIGGER a touch tentative ('saw that <company>...') and don't claim it is personally about them."
      : "- The hook is a strong, recent, person-specific signal: reference it directly and confidently in the TRIGGER.",
  ].join("\n");

  const prompt = [
    "Recipient:",
    `- Name: ${identity.name}`,
    `- Role: ${identity.role ?? "(unknown)"}`,
    `- Company: ${identity.company}`,
    "",
    "The ONE signal to build the opener on (reference only this):",
    `- What: ${hook.what}`,
    `- Why it was chosen: ${hook.why}`,
    `- Source: ${hook.url}`,
    "",
    "Seller (who the email is from / what it pitches):",
    `- ${seller.company}: ${seller.product}`,
    `- Value props you may draw the one connecting sentence from: ${seller.valueProps.join("; ") || "(none provided)"}`,
    `- Target buyer: ${seller.targetBuyer}`,
    "",
    "Write the subject and body now, following every rule above.",
  ].join("\n");

  return { system, prompt };
}
