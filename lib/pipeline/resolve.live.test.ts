import { describe, it, expect } from "vitest";
import { resolve } from "@/lib/pipeline/resolve";
import type { SellerContext } from "@/lib/types";

// LIVE test — hits the real Claude API. Skipped during normal `npm test` so the
// suite stays offline and free. Run explicitly with the keys loaded:
//   LIVE=1 node --env-file=.env.local node_modules/.bin/vitest run lib/pipeline/resolve.live.test.ts
const live = process.env.LIVE === "1";

const seller: SellerContext = {
  company: "Zamp",
  product: "finance-ops automation that speeds up the monthly close",
  valueProps: ["faster close", "fewer manual reconciliations"],
  targetBuyer: "finance leaders, CFO to Head of AP",
};

describe.skipIf(!live)("resolve (LIVE — calls Claude with structured output)", () => {
  it("resolves a clearly-identifiable person", async () => {
    const id = await resolve({ name: "Tim Cook", company: "Apple" }, seller);
    console.log("CLEAR ->", JSON.stringify(id));
    expect(id.name).toBeTruthy();
    expect(["high", "low"]).toContain(id.confidence);
  }, 30000);

  it("handles an ambiguous common name", async () => {
    const id = await resolve(
      { name: "John Smith", company: "a small consulting firm" },
      seller,
    );
    console.log("AMBIGUOUS ->", JSON.stringify(id));
    expect(id.name).toBeTruthy();
    expect(["high", "low"]).toContain(id.confidence);
  }, 30000);
});
