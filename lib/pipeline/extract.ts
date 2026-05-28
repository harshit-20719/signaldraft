import type { RawResult, Signal } from "@/lib/types";

// STUB (U3) — replaced by the real Claude extraction in U6.
// Maps each raw result straight into a signal with fixed sample scores, so the
// downstream stages have something shaped correctly to work with. (The real
// version also uses identity + seller context to judge each result.)
export async function extract(raw: RawResult[]): Promise<Signal[]> {
  return raw.map((r) => ({
    what: r.title,
    when: r.publishedDate,
    source: hostnameOf(r.url),
    url: r.url,
    subject: r.sourceType === "press" ? "company" : "person",
    type: r.sourceType === "press" ? "press" : "other",
    negative: false,
    scores: { recency: 0.8, specificity: 0.7, relevance: 0.7, total: 0.73 },
  }));
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
