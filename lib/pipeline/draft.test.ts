import { describe, it, expect } from "vitest";
import { dropEmDashes } from "@/lib/pipeline/draft";

// The "no em-dashes" rule is a product promise (the #1 AI tell). Models honour it
// only intermittently, so the draft + self-check stages enforce it in code via
// dropEmDashes. These cases pin that behaviour down.
describe("dropEmDashes", () => {
  it("turns a spaced em-dash into a comma", () => {
    expect(dropEmDashes("trusting your instincts — was a good reminder")).toBe(
      "trusting your instincts, was a good reminder",
    );
  });

  it("handles a parenthetical pair of em-dashes", () => {
    expect(dropEmDashes("the talk — the Goldman part — stuck with me")).toBe(
      "the talk, the Goldman part, stuck with me",
    );
  });

  it("leaves text with no em-dashes untouched", () => {
    expect(dropEmDashes("a clean sentence, no tells.")).toBe(
      "a clean sentence, no tells.",
    );
  });

  it("does not touch hyphens or en-dashes (legitimate uses)", () => {
    expect(dropEmDashes("day-to-day close work across Q3–Q4")).toBe(
      "day-to-day close work across Q3–Q4",
    );
  });
});
