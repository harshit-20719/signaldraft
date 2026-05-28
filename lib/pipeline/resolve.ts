import { claudeStructured } from "@/lib/anthropic";
import { ResolveSchema, resolvePrompt } from "@/lib/prompts/resolve";
import type { Identity, Prospect, SellerContext } from "@/lib/types";

// Stage 1 (U4): turn the form input into a single best-guess identity, with an
// honest high/low confidence. Gate 1 itself lives in the orchestrator and is
// non-blocking in v1 — a low-confidence identity attaches a flag but does not
// stop the run (R4). This stage just produces the identity + confidence.
export async function resolve(
  prospect: Prospect,
  seller: SellerContext,
): Promise<Identity> {
  const { system, prompt } = resolvePrompt(prospect, seller);
  const out = await claudeStructured({
    schema: ResolveSchema,
    system,
    prompt,
    maxTokens: 512,
  });

  return {
    name: out.name,
    company: out.company,
    role: out.role ?? undefined,
    confidence: out.confidence,
    note: out.note ?? undefined,
  };
}
