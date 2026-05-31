import { describe, it, expect, vi, beforeEach } from "vitest";

// Stage 6 makes exactly one Claude call. We mock it (vi.hoisted so the mock is
// ready before the module under test imports it) to drive the self-check's pure
// logic offline — including the failure modes it must be robust against.
const { claudeStructured } = vi.hoisted(() => ({ claudeStructured: vi.fn() }));
vi.mock("@/lib/anthropic", () => ({ claudeStructured }));

import { selfCheck } from "@/lib/pipeline/selfcheck";
import type { Draft, Hook, Identity, SellerContext } from "@/lib/types";

const draft: Draft = {
  subject: "Congrats on the round",
  body: "Saw you closed the Series C. Worth a look?",
};
const hook: Hook = {
  what: "Closed a $50M Series C",
  url: "https://example.com/funding",
  why: "recent funding",
};
const identity: Identity = {
  name: "Amy Hood",
  company: "Microsoft",
  role: "CFO",
  confidence: "high",
};
const seller: SellerContext = {
  company: "Zamp",
  product: "finance-ops automation",
  valueProps: ["vendor onboarding in days, not weeks"],
  targetBuyer: "finance leaders",
};
const args = { draft, hook, identity, seller, verdict: "HIGH" as const };

beforeEach(() => {
  claudeStructured.mockReset();
});

describe("selfCheck (Stage 6)", () => {
  it("falls back to the ORIGINAL draft when the model returns blank text", async () => {
    claudeStructured.mockResolvedValue({
      assessment: "revise",
      critique: "Tightened it.",
      subject: "   ", // whitespace-only
      body: "", // empty
    });
    const result = await selfCheck(args);
    // A blank reply must never wipe a real email.
    expect(result.draft).toEqual(draft);
    expect(result.revised).toBe(false);
  });

  it("strips em-dashes from the critique note (no AI tells, even in the note)", async () => {
    claudeStructured.mockResolvedValue({
      assessment: "pass",
      critique: "Checked grounding — it already met the bar.",
      subject: draft.subject,
      body: draft.body,
    });
    const result = await selfCheck(args);
    expect(result.note).not.toContain("—");
    expect(result.note).toBe("Checked grounding, it already met the bar.");
  });

  it("reports 'revised' only when the text actually changed", async () => {
    claudeStructured.mockResolvedValue({
      assessment: "revise",
      critique: "Removed a tell.",
      subject: "Congrats on the round",
      body: "Different, tighter body. Worth a look?",
    });
    const changed = await selfCheck(args);
    expect(changed.revised).toBe(true);
    expect(changed.draft.body).toBe("Different, tighter body. Worth a look?");

    claudeStructured.mockResolvedValue({
      assessment: "revise", // says revise...
      critique: "No real change.",
      subject: draft.subject,
      body: draft.body, // ...but hands back identical text
    });
    const same = await selfCheck(args);
    expect(same.revised).toBe(false);
  });
});
