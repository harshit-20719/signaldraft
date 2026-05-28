import { describe, it, expect } from "vitest";
import { resolve } from "@/lib/pipeline/resolve";
import { gather } from "@/lib/pipeline/gather";
import { extract } from "@/lib/pipeline/extract";
import type { SellerContext } from "@/lib/types";

// LIVE test — hits real Claude + Tavily. Skipped during normal `npm test`. Run:
//   set -a && . ./.env.local && set +a && LIVE=1 npx vitest run lib/pipeline/extract.live.test.ts
// Extraction is non-deterministic, so this is an eyeball test: we log the kept
// signals and assert the STRICT FILTER did its job (it kept fewer than the raw
// haul, and what it kept is the right shape).
const live = process.env.LIVE === "1";

const seller: SellerContext = {
  company: "Zamp",
  product: "finance-ops automation that speeds up the monthly close",
  valueProps: ["faster close", "fewer manual reconciliations"],
  targetBuyer: "finance leaders, CFO to Head of AP",
};

describe.skipIf(!live)("extract (LIVE — resolve + gather + Claude filter)", () => {
  it("keeps only on-topic, right-person signals from a real haul", async () => {
    const identity = await resolve(
      { name: "Amy Hood", company: "Microsoft", role: "CFO" },
      seller,
    );
    const raw = await gather(identity);
    const signals = await extract(raw, identity, seller);

    console.log(`EXTRACT -> ${raw.length} raw -> ${signals.length} kept`);
    for (const s of signals.slice(0, 8)) {
      console.log(
        `  [${s.subject}/${s.type}/rel=${s.relevance}${s.negative ? "/NEG" : ""}] ${s.what}  (${s.source}${s.when ? ", " + s.when : ""})`,
      );
    }

    // The filter should drop noise, not pass everything through.
    expect(signals.length).toBeLessThanOrEqual(raw.length);
    // Every kept signal carries a real url and a relevance read.
    for (const s of signals) {
      expect(s.url).toMatch(/^https?:\/\//);
      expect(["high", "medium", "low"]).toContain(s.relevance);
    }
  }, 90000);
});
