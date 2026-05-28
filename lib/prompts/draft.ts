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
    "You write one short, genuinely human-sounding cold outreach email for a B2B",
    "seller. The reader is a busy finance leader, so respect their time.",
    "",
    "GROUNDING (non-negotiable):",
    "- You are given exactly ONE signal to build the opener on. Reference only it.",
    "- Invent nothing: no made-up metrics, no assumed pain points, no fake mutual",
    "  connections, no fabricated details about the person or company.",
    "- If the signal is thin, keep the email shorter rather than padding it with",
    "  invented specifics.",
    "",
    "NO AI TELLS (a draft that reads as AI-written is a failure):",
    "- No em-dashes (—). Use commas, periods, or parentheses instead.",
    '- Banned openers/phrases: "I hope this email finds you well", "I wanted to',
    '  reach out", "I came across", "In today\'s fast-paced", "reaching out',
    '  because". Banned buzzwords: leverage, synergy, circle back, touch base,',
    '  game-changer, cutting-edge, revolutionary, thrilled, excited to.',
    "- Sound like a thoughtful peer, not a marketer. Contractions are fine.",
    "",
    "STRUCTURE:",
    "- Open with the specific signal (the hook), in the reader's frame, not yours.",
    "- One sentence connecting it to a single, concrete value the seller offers.",
    "- A soft, low-pressure ask (a short question or 'worth a quick chat?').",
    '- Sign off simply with a first-name placeholder like "[Your name]".',
    verdict === "MEDIUM"
      ? "- This hook is company-level or slightly older, not personally confirmed: keep the reference a touch more tentative (e.g. 'saw that <company>...') and do not claim it is about them personally."
      : "- This hook is a strong, recent, person-specific signal: you can reference it directly and confidently.",
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
