import { claudeStructured } from "@/lib/anthropic";
import { config } from "@/lib/config";
import { dropEmDashes } from "@/lib/pipeline/draft";
import { SelfCheckSchema, selfCheckPrompt } from "@/lib/prompts/selfcheck";
import type {
  Draft,
  Hook,
  Identity,
  SelfCheckResult,
  SellerContext,
  Verdict,
} from "@/lib/types";

export interface SelfCheckArgs {
  draft: Draft;
  hook: Hook;
  identity: Identity;
  seller: SellerContext;
  verdict: Verdict;
}

// Stage 6 (R11): the draft reviews itself. Claude critiques the email it just
// wrote against grounding / specificity / no-AI-tells and returns the final
// (possibly tightened) version plus a one-line note. The orchestrator only calls
// this when there is a draft to review (never on SKIP), so this function can
// assume a real draft + hook.
export async function selfCheck({
  draft,
  hook,
  identity,
  seller,
  verdict,
}: SelfCheckArgs): Promise<SelfCheckResult> {
  const { system, prompt } = selfCheckPrompt({ draft, hook, identity, seller, verdict });
  const out = await claudeStructured({
    schema: SelfCheckSchema,
    system,
    prompt,
    model: config.claude.draftModel,
    maxTokens: 800,
  });

  // Best-effort: the self-check must never DESTROY a good draft. If the model
  // returns blank/whitespace text (a real failure mode — refusal, or truncation
  // at the token cap), fall back to the original draft so an empty reply can
  // never wipe a real email.
  const subject = dropEmDashes(out.subject.trim()) || draft.subject;
  const body = dropEmDashes(out.body.trim()) || draft.body;
  // Trust the actual text, not just the label: only call it "revised" if the
  // model said so AND something genuinely changed. Guards against a "revise"
  // assessment that returns identical text (or a fallback to the original above).
  // The input draft is already em-dash-normalised by the draft stage, so the
  // comparison is apples-to-apples.
  const revised =
    out.assessment === "revise" &&
    (subject !== draft.subject.trim() || body !== draft.body.trim());

  return {
    revised,
    // The note is shown on the card, so it must clear the same no-em-dash bar as
    // the email body itself.
    note: dropEmDashes(out.critique.trim()),
    draft: { subject, body },
  };
}
