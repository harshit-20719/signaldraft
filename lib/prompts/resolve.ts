import { z } from "zod";
import type { Prospect, SellerContext } from "@/lib/types";

// The shape Claude must return for Stage 1. All fields are required; "optional"
// values use .nullable() because structured outputs expect every key present
// (null stands in for "not applicable"). Descriptions are sent to the model as
// part of the schema, so they double as inline instructions.
export const ResolveSchema = z.object({
  name: z.string().describe("Canonical full name of the person"),
  company: z.string().describe("Company name, echoed from the input"),
  role: z
    .string()
    .nullable()
    .describe("Role/title if provided or clearly implied, otherwise null"),
  confidence: z
    .enum(["high", "low"])
    .describe(
      "high if this clearly maps to one specific real person; low if ambiguous",
    ),
  note: z
    .string()
    .nullable()
    .describe(
      "One-sentence disambiguation reason when confidence is low, otherwise null",
    ),
});

// Build the system + user prompt for the resolve stage.
export function resolvePrompt(
  prospect: Prospect,
  seller: SellerContext,
): { system: string; prompt: string } {
  const system = [
    "You are the identity-resolution step of a B2B sales-research pipeline.",
    "Your job: turn a prospect's form input into a single best-guess canonical",
    "identity, and honestly judge how confident you are that it maps to ONE",
    "specific real person.",
    "",
    "You have no web access. Reason only from the input and your general",
    "knowledge. Never invent biographical facts about the person.",
    "",
    "Confidence rules:",
    '- "high": the name plus company (and any hint) point to one identifiable',
    "  person, or the name is distinctive enough that confusion is unlikely.",
    '- "low": the name is common and the company is missing or generic, or the',
    "  inputs are too thin to know which person this is. When low, give a",
    '  one-sentence reason in "note".',
    "",
    "Canonicalize lightly: expand an obvious nickname to a fuller name only if",
    'you are confident; otherwise keep the given name. Echo the company as given.',
    'Fill "role" only if provided or clearly implied; otherwise null. Set "note"',
    "to null when confidence is high.",
  ].join("\n");

  const prompt = [
    "Prospect to resolve:",
    `- Name: ${prospect.name}`,
    `- Company: ${prospect.company}`,
    `- Role/title: ${prospect.role ?? "(not provided)"}`,
    `- Identity hint (LinkedIn URL or email — for matching the right person only, not a fact source): ${prospect.hint ?? "(none)"}`,
    "",
    "Seller context (the outreach will pitch this; included only for relevance, not identity):",
    `- ${seller.company}: ${seller.product}`,
    `- Target buyer: ${seller.targetBuyer}`,
  ].join("\n");

  return { system, prompt };
}
