import { config } from "@/lib/config";
import { tavilySearch } from "@/lib/tavily";
import type { Identity, RawResult, SourceType } from "@/lib/types";

// Stage 2 (U5): cast a wide net. We fire one targeted web search per source
// type in parallel, collect the raw hits, and dedupe them. No judgement yet —
// that happens in extract/score (U6). Gate 2 (passesGate2) then decides whether
// we found enough to continue or should honestly SKIP for insufficient signal.

// The fixed set of queries, one per source type (R5). This list IS the cost
// cap: a small, bounded number of searches keeps a run fast, cheap, and inside
// the function time budget (KTD3). Results-per-query is separately capped in
// config.gather.maxResultsPerQuery.
function buildQueries(identity: Identity): { q: string; sourceType: SourceType }[] {
  const person = `"${identity.name}"`;
  const company = identity.company;
  return [
    { q: `${person} ${company} news`, sourceType: "news" },
    { q: `${person} ${company} announcement OR "press release"`, sourceType: "press" },
    { q: `${person} podcast OR interview`, sourceType: "podcast" },
    { q: `${person} keynote OR conference talk OR panel`, sourceType: "talk" },
    { q: `${company} finance OR accounting jobs hiring`, sourceType: "job" },
    { q: `${company} blog finance OR operations`, sourceType: "blog" },
    { q: `site:linkedin.com ${person} ${company}`, sourceType: "linkedin" },
  ];
}

export async function gather(identity: Identity): Promise<RawResult[]> {
  const queries = buildQueries(identity);

  // Promise.allSettled (not Promise.all) so one slow or failing query never
  // sinks the whole stage — we keep whatever the others return (R5 error path).
  const settled = await Promise.allSettled(
    queries.map((query) =>
      tavilySearch(query.q, {
        maxResults: config.gather.maxResultsPerQuery,
        searchDepth: "basic",
      }),
    ),
  );

  const raw: RawResult[] = [];
  settled.forEach((outcome, i) => {
    if (outcome.status !== "fulfilled") return; // skip a failed query
    for (const r of outcome.value.results) {
      raw.push({
        title: r.title,
        snippet: r.content,
        url: r.url,
        publishedDate: r.publishedDate || undefined,
        sourceType: queries[i].sourceType,
      });
    }
  });

  return dedupeByUrl(raw);
}

// Keep the first occurrence of each URL (the same page often shows up under
// several queries).
function dedupeByUrl(results: RawResult[]): RawResult[] {
  const seen = new Set<string>();
  const unique: RawResult[] = [];
  for (const r of results) {
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    unique.push(r);
  }
  return unique;
}

// Gate 2 (R5): do we have enough usable results to keep going? Below the floor
// means an honest SKIP for insufficient signal. Pure function so the
// orchestrator stays readable and this stays easy to test.
export function passesGate2(results: RawResult[]): boolean {
  return results.length >= config.gather.minResults;
}
