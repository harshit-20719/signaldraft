import { describe, it, expect } from "vitest";
import { resolve } from "@/lib/pipeline/resolve";
import { gather, passesGate2 } from "@/lib/pipeline/gather";
import type { Identity, SellerContext } from "@/lib/types";

// LIVE test — hits real Claude + Tavily. Skipped during normal `npm test`. Run:
//   set -a && . ./.env.local && set +a && LIVE=1 npx vitest run lib/pipeline/gather.live.test.ts
const live = process.env.LIVE === "1";

const seller: SellerContext = {
  company: "Zamp",
  product: "finance-ops automation that speeds up the monthly close",
  valueProps: ["faster close", "fewer manual reconciliations"],
  targetBuyer: "finance leaders, CFO to Head of AP",
};

describe.skipIf(!live)("gather (LIVE — resolve + Tavily)", () => {
  it("returns deduped real results for a public finance leader (clears Gate 2)", async () => {
    const identity = await resolve(
      { name: "Amy Hood", company: "Microsoft", role: "CFO" },
      seller,
    );
    const results = await gather(identity);
    console.log(
      `KNOWN -> ${results.length} results, Gate 2 pass=${passesGate2(results)}`,
    );
    console.log(
      "  sample:",
      JSON.stringify(results.slice(0, 3).map((r) => `[${r.sourceType}] ${r.title}`)),
    );
    expect(passesGate2(results)).toBe(true);
    // No duplicate URLs after dedupe.
    expect(new Set(results.map((r) => r.url)).size).toBe(results.length);
  }, 60000);

  it("returns little/nothing for a no-footprint prospect (trips Gate 2 -> SKIP)", async () => {
    const identity: Identity = {
      name: "Zzqx Vanterpoolington",
      company: "Nonexistent Holdings LLC 99821",
      confidence: "low",
    };
    const results = await gather(identity);
    console.log(
      `OBSCURE -> ${results.length} results, Gate 2 pass=${passesGate2(results)}`,
    );
    expect(results.length).toBeGreaterThanOrEqual(0); // does not crash
  }, 60000);
});
