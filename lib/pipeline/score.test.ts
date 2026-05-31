import { describe, it, expect } from "vitest";
import { score, scoreRecency } from "@/lib/pipeline/score";
import type {
  ExtractedSignal,
  RelevanceRead,
  SellerContext,
  SignalSubject,
  SignalType,
} from "@/lib/types";

// These tests pin down the CODE-driven verdict (KTD5) and double as the tuning
// surface: change a weight or threshold in config.score and the expected
// verdicts here tell you immediately whether the behaviour still matches the
// acceptance examples (AE1, AE2, AE4). `now` is injected so recency — and
// therefore the whole verdict — is deterministic and never drifts with the
// real date.
const NOW = Date.parse("2026-05-28T12:00:00Z");

const seller: SellerContext = {
  company: "Zamp",
  product: "finance-ops automation that speeds up the monthly close",
  valueProps: ["faster close", "fewer manual reconciliations"],
  targetBuyer: "finance leaders, CFO to Head of AP",
};

// Build an ExtractedSignal (extract's output: judged but not yet scored).
function sig(over: {
  subject: SignalSubject;
  relevance: RelevanceRead;
  negative: boolean;
  when?: string;
  url?: string;
  what?: string;
  type?: SignalType;
}): ExtractedSignal {
  return {
    what: over.what ?? "did a notable thing",
    when: over.when,
    source: "example.com",
    url: over.url ?? "https://example.com/x",
    subject: over.subject,
    type: over.type ?? "other",
    negative: over.negative,
    relevance: over.relevance,
  };
}

describe("scoreRecency", () => {
  it("buckets by age and floors old / dateless signals", () => {
    expect(scoreRecency("2026-05-20", NOW)).toBe(1.0); // ~8 days
    expect(scoreRecency("2026-03-20", NOW)).toBe(0.8); // ~69 days
    expect(scoreRecency("2025-01-01", NOW)).toBe(0.2); // ~1.4 years -> floor
    expect(scoreRecency(undefined, NOW)).toBe(0.3); // no date -> "probably stale"
    expect(scoreRecency("not a date", NOW)).toBe(0.3); // unparseable -> same
  });
});

describe("score — Gate 3 verdicts", () => {
  it("AE1: a recent, person-specific, relevant, safe signal scores into HIGH", () => {
    const result = score(
      [sig({ subject: "person", relevance: "high", negative: false, when: "2026-05-20" })],
      seller,
      NOW,
    );
    expect(result.verdict).toBe("HIGH");
    expect(result.hook).toBeDefined();
    expect(result.signals[0].scores.total).toBeCloseTo(1.0, 5);
    // HIGH is a clean run — no verify/veto flags.
    expect(result.flags).toHaveLength(0);
  });

  it("AE2: a recent COMPANY-level signal scores into MEDIUM with a verify flag", () => {
    const result = score(
      [sig({ subject: "company", relevance: "high", negative: false, when: "2026-05-20" })],
      seller,
      NOW,
    );
    expect(result.verdict).toBe("MEDIUM");
    expect(result.hook).toBeDefined();
    expect(result.flags.some((f) => f.type === "company_level_verify")).toBe(true);
  });

  it("AE2: an OLDER person-level signal also lands at MEDIUM (recent gates HIGH)", () => {
    const result = score(
      [sig({ subject: "person", relevance: "high", negative: false, when: "2025-10-01" })],
      seller,
      NOW,
    );
    expect(result.verdict).toBe("MEDIUM"); // recency 0.4 < highRecencyMin, so not HIGH
    expect(result.flags.some((f) => f.type === "company_level_verify")).toBe(true);
  });

  it("AE4: with a recent negative signal AND a safe lower one, the veto drops to the safe hook", () => {
    const negative = sig({
      subject: "person",
      relevance: "high",
      negative: true,
      when: "2026-05-25",
      url: "https://example.com/layoffs",
      what: "Announced layoffs across the finance org",
    });
    const safe = sig({
      subject: "company",
      relevance: "medium",
      negative: false,
      when: "2026-05-20",
      url: "https://example.com/product",
      what: "Company shipped a new reporting feature",
    });
    const result = score([negative, safe], seller, NOW);

    // Falls to the safe lower-tier signal rather than skipping outright.
    expect(result.verdict).toBe("MEDIUM");
    // The hook is the SAFE signal, never the negative one.
    expect(result.hook?.url).toBe("https://example.com/product");
    // The negative news is found, kept, and flagged — not silently dropped.
    expect(result.flags.some((f) => f.type === "negative_news_avoided")).toBe(true);
    const keptNegative = result.signals.find((s) => s.url === "https://example.com/layoffs");
    expect(keptNegative?.negative).toBe(true);
    // It still ranks first by raw score (so the card shows why it was excluded).
    expect(result.signals[0].url).toBe("https://example.com/layoffs");
  });

  it("AE4: when ONLY negative news exists, the verdict is an honest SKIP", () => {
    const result = score(
      [sig({ subject: "person", relevance: "high", negative: true, when: "2026-05-25" })],
      seller,
      NOW,
    );
    expect(result.verdict).toBe("SKIP");
    expect(result.hook).toBeUndefined();
    expect(result.flags.some((f) => f.type === "negative_news_avoided")).toBe(true);
    expect(result.flags.some((f) => f.type === "no_safe_hook")).toBe(true);
    // The negative signal is still retained for display.
    expect(result.signals).toHaveLength(1);
    expect(result.recommendation).toBeTruthy();
  });

  it("edge: an empty signal set is an honest SKIP (insufficient signal)", () => {
    const result = score([], seller, NOW);
    expect(result.verdict).toBe("SKIP");
    expect(result.flags.some((f) => f.type === "insufficient_signal")).toBe(true);
    expect(result.signals).toHaveLength(0);
    expect(result.recommendation).toBeTruthy();
  });

  it("edge: a weak, generic, dateless signal is too thin to use -> SKIP", () => {
    const result = score(
      [sig({ subject: "company", relevance: "low", negative: false })], // base ≈ 0.37
      seller,
      NOW,
    );
    expect(result.verdict).toBe("SKIP");
    expect(result.flags.some((f) => f.type === "no_safe_hook")).toBe(true);
  });

  it("edge: of two safe signals, the more recent person-level one ranks first", () => {
    const older = sig({
      subject: "person",
      relevance: "high",
      negative: false,
      when: "2025-01-01",
      url: "https://example.com/older",
    });
    const newer = sig({
      subject: "person",
      relevance: "high",
      negative: false,
      when: "2026-05-25",
      url: "https://example.com/newer",
    });
    const result = score([older, newer], seller, NOW);
    expect(result.signals[0].url).toBe("https://example.com/newer");
    expect(result.signals[0].scores.total).toBeGreaterThan(result.signals[1].scores.total);
    expect(result.hook?.url).toBe("https://example.com/newer");
    expect(result.verdict).toBe("HIGH");
  });

  it("archetype: a funding signal outranks an equal-base post (signal-strength tier)", () => {
    const common = {
      subject: "company" as const,
      relevance: "medium" as const,
      negative: false,
      when: "2026-05-20",
    };
    const post = sig({ ...common, type: "post", url: "https://example.com/post" });
    const funding = sig({ ...common, type: "funding", url: "https://example.com/funding" });
    // Pass the post first to prove ranking is by score, not input order.
    const result = score([post, funding], seller, NOW);
    expect(result.signals[0].url).toBe("https://example.com/funding");
    expect(result.signals[0].scores.total).toBeGreaterThan(result.signals[1].scores.total);
    expect(result.hook?.url).toBe("https://example.com/funding");
  });

  it("archetype: an identical person-level base is HIGH as 'leadership' but MEDIUM as 'post'", () => {
    const base = {
      subject: "person" as const,
      relevance: "medium" as const,
      negative: false,
      when: "2026-05-20",
    };
    expect(score([sig({ ...base, type: "leadership" })], seller, NOW).verdict).toBe("HIGH");
    expect(score([sig({ ...base, type: "post" })], seller, NOW).verdict).toBe("MEDIUM");
  });

  it("archetype: a boosted top-tier signal clamps at 1.0, never above", () => {
    const result = score(
      [sig({ subject: "person", relevance: "high", negative: false, when: "2026-05-20", type: "leadership" })],
      seller,
      NOW,
    );
    expect(result.signals[0].scores.total).toBe(1.0); // base 1.0 × 1.25, clamped to 1.0
    expect(result.verdict).toBe("HIGH");
  });
});
