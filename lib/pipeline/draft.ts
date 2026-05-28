import type { Draft, Hook, Identity, SellerContext, Verdict } from "@/lib/types";

export interface DraftArgs {
  verdict: Verdict;
  hook?: Hook;
  identity: Identity;
  seller: SellerContext;
}

// STUB (U3) — replaced by the real grounded-drafting prompt in U7.
// SKIP (or no hook) returns null, matching the honest-abstain contract.
export async function draft({
  verdict,
  hook,
  identity,
  seller,
}: DraftArgs): Promise<Draft | null> {
  if (verdict === "SKIP" || !hook) return null;
  return {
    subject: `Quick thought for ${identity.name}`,
    body: `Hi ${identity.name},\n\nSaw that ${hook.what}. Would love to compare notes.\n\n— ${seller.company}`,
  };
}
