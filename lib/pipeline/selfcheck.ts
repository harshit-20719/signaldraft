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

  const subject = dropEmDashes(out.subject.trim());
  const body = dropEmDashes(out.body.trim());
  // Trust the actual text, not just the label: only call it "revised" if the
  // model said so AND something genuinely changed. Guards against a "revise"
  // assessment that returns identical text. (The input draft is already
  // em-dash-normalised by the draft stage, so the comparison is apples-to-apples.)
  const revised =
    out.assessment === "revise" &&
    (subject !== draft.subject.trim() || body !== draft.body.trim());

  return {
    revised,
    note: out.critique.trim(),
    draft: { subject, body },
  };
}
