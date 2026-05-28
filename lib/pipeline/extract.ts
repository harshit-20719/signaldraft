import { claudeStructured } from "@/lib/anthropic";
import { ExtractSchema, extractPrompt } from "@/lib/prompts/extract";
import type {
  ExtractedSignal,
  Identity,
  RawResult,
  SellerContext,
} from "@/lib/types";

// Stage 3 (U6): turn raw web hits into a small set of structured, judged signals
// — and, crucially, DROP the noise. This is a strict filter, not a passive
// structurer: because Tavily returns ~30 results even for a nonsense prospect,
// honest SKIP depends on extraction throwing out wrong-person / off-topic /
// stale results so the score stage (Gate 3) is left with little or nothing
// usable. Claude judges (what / who / type / date / negative / relevance); code
// keeps the real url, source, and date from the raw result so nothing is
// hallucinated. Scoring (the numbers) happens later in score.ts (KTD5).
export async function extract(
  raw: RawResult[],
  identity: Identity,
  seller: SellerContext,
): Promise<ExtractedSignal[]> {
  if (raw.length === 0) return [];

  const { system, prompt } = extractPrompt(raw, identity, seller);
  const out = await claudeStructured({
    schema: ExtractSchema,
    system,
    prompt,
    maxTokens: 4096,
  });

  const signals: ExtractedSignal[] = [];
  const usedIndexes = new Set<number>();
  for (const item of out.kept) {
    const src = raw[item.index];
    // Ignore an out-of-range or duplicated index defensively — the url/date/
    // source always come from the real raw result, never from Claude.
    if (!src || usedIndexes.has(item.index)) continue;
    usedIndexes.add(item.index);

    signals.push({
      what: item.what,
      when: src.publishedDate ?? item.when ?? undefined,
      source: hostnameOf(src.url),
      url: src.url,
      subject: item.subject,
      type: item.type,
      negative: item.negative,
      relevance: item.relevance,
    });
  }
  return signals;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
