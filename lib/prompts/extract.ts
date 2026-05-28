import { z } from "zod";
import type { Identity, RawResult, SellerContext } from "@/lib/types";

// Stage 3 (extract) prompt. This is the STRICT FILTER that makes honest SKIP
// possible: Tavily returns ~30 results even for a nonsense prospect, so the raw
// count almost never trips Gate 2. The real "thin signal -> SKIP" judgment has
// to come from here dropping wrong-person / off-topic / stale noise, leaving the
// score stage (Gate 3) with little or nothing usable.
//
// One batched call (all results in, kept results out) instead of one call per
// result — cheaper and lets Claude compare results against each other. Claude
// returns each kept signal by its INDEX in the provided list plus its judgments;
// code then rebuilds the signal from the REAL raw result (url, source, date), so
// a hallucinated link can never reach the output.

const SIGNAL_TYPES = [
  "funding",
  "hiring",
  "product",
  "leadership",
  "press",
  "talk",
  "post",
  "other",
] as const;

export const ExtractedItemSchema = z.object({
  index: z
    .number()
    .int()
    .describe("0-based index of the result in the provided list that this signal refers to"),
  what: z
    .string()
    .describe(
      "One plain, factual sentence describing what happened, drawn ONLY from the result's title and snippet. No embellishment, no inferred motives.",
    ),
  subject: z
    .enum(["person", "company"])
    .describe(
      "'person' if the signal is specifically about the prospect as an individual (their own words, move, post, talk); 'company' if it is about their employer in general.",
    ),
  type: z.enum(SIGNAL_TYPES).describe("Best-fit category for the signal."),
  when: z
    .string()
    .nullable()
    .describe(
      "A date EXPLICITLY stated in the title or snippet (ISO like 2026-03-15, or 'March 2026'). null if no date is stated — never guess a date.",
    ),
  negative: z
    .boolean()
    .describe(
      "true if this is negative/risky news a seller should NOT build a warm opener on: layoffs, lawsuits, fraud, scandal, data breach, forced resignation, collapsing results. Otherwise false.",
    ),
  relevance: z
    .enum(["high", "medium", "low"])
    .describe(
      "How relevant the signal is to the SELLER's pitch and target buyer: 'high' = directly connects to what the seller sells; 'medium' = plausibly connected; 'low' = real but only loosely related.",
    ),
});

export const ExtractSchema = z.object({
  kept: z
    .array(ExtractedItemSchema)
    .describe(
      "ONLY the results that are clearly about the right person or their company AND are genuine, usable signals. DROP (omit) anything that is: about a different person who happens to share the name, off-topic, generic boilerplate or navigation, a directory/listing page, or so old it is stale. When in doubt, drop it. An empty array is the correct answer when nothing is usable.",
    ),
});

export function extractPrompt(
  raw: RawResult[],
  identity: Identity,
  seller: SellerContext,
): { system: string; prompt: string } {
  const system = [
    "You are the signal-extraction step of a B2B sales-research pipeline.",
    "You are given raw web-search results about a prospect. Your job is to act",
    "as a STRICT FILTER, then structure only what survives.",
    "",
    "Filtering (be ruthless — most raw results are noise):",
    "- DROP any result that is about a DIFFERENT person who shares the name. Use",
    "  the company, role, and context to decide who the right person is.",
    "- DROP results that are off-topic, generic company boilerplate, navigation,",
    "  directory/listing pages, or have no real news in them.",
    "- DROP stale results when fresher signal exists; keep an older one only if it",
    "  is genuinely substantive.",
    "- When unsure whether a result is about the right person or is usable, DROP it.",
    "  A smaller set of real signals is far better than a padded one.",
    "",
    "For each result you KEEP, return its index plus your judgments: a one-sentence",
    "factual summary (from the text only — invent nothing), whether it is about the",
    "person or just the company, the signal type, any explicit date, whether it is",
    "negative news, and how relevant it is to the seller's pitch.",
    "",
    "Returning an empty `kept` array is correct and expected when none of the",
    "results are clearly about the right person or none are usable.",
  ].join("\n");

  const valueProps = seller.valueProps.length
    ? seller.valueProps.join("; ")
    : "(none provided)";

  const resultLines = raw
    .map((r, i) =>
      [
        `[${i}] (${r.sourceType}) ${r.title}`,
        `    url: ${r.url}`,
        `    published: ${r.publishedDate ?? "(no date)"}`,
        `    snippet: ${r.snippet}`,
      ].join("\n"),
    )
    .join("\n\n");

  const prompt = [
    "Right person to match against (drop results about anyone else):",
    `- Name: ${identity.name}`,
    `- Company: ${identity.company}`,
    `- Role: ${identity.role ?? "(unknown)"}`,
    identity.note ? `- Note: ${identity.note}` : "",
    "",
    "Seller context (judge relevance against this):",
    `- ${seller.company}: ${seller.product}`,
    `- Value props: ${valueProps}`,
    `- Target buyer: ${seller.targetBuyer}`,
    "",
    `Raw results (${raw.length}), each prefixed with its index:`,
    "",
    resultLines,
  ]
    .filter(Boolean)
    .join("\n");

  return { system, prompt };
}
