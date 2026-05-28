import { claudeStructured } from "@/lib/anthropic";
import { config } from "@/lib/config";
import { DraftSchema, draftPrompt } from "@/lib/prompts/draft";
import type { Draft, Hook, Identity, SellerContext, Verdict } from "@/lib/types";

export interface DraftArgs {
  verdict: Verdict;
  hook?: Hook;
  identity: Identity;
  seller: SellerContext;
}

// Stage 5 (U7): write the email, or honestly abstain. For HIGH/MEDIUM, Claude
// drafts a short, grounded email built only on the one chosen hook (cite real
// signals, invent nothing, no AI tells). For SKIP — or any case with no chosen
// hook — we return null: the honest-abstain contract. The recommendation + reason
// shown to the rep on a SKIP is produced by the score stage, not here, so this
// stage never has to manufacture a draft it shouldn't.
export async function draft({
  verdict,
  hook,
  identity,
  seller,
}: DraftArgs): Promise<Draft | null> {
  if (verdict === "SKIP" || !hook) return null;

  const { system, prompt } = draftPrompt({ verdict, hook, identity, seller });
  const out = await claudeStructured({
    schema: DraftSchema,
    system,
    prompt,
    // The one place we may swap to a stronger writer if Sonnet's prose isn't
    // good enough (KTD6); defaults to the same model for now.
    model: config.claude.draftModel,
    maxTokens: 700,
  });

  return { subject: out.subject.trim(), body: out.body.trim() };
}
