import { config } from "@/lib/config";
import { tavilySearch } from "@/lib/tavily";
import type { Identity, RawResult, SourceType } from "@/lib/types";

// Stage 2 (U5): cast a wide net. We fire one targeted web search per source
// type in parallel, collect the raw hits, and dedupe them. No judgement yet —
// that happens in extract/score (U6). Gate 2 (passesGate2) then decides whether
// we found enough to continue or should honestly SKIP for insufficient signal.

// The query set is weighted toward the highest-value signal ARCHETYPES, not just
// spread across sources (R5 + the archetype tiers in config.score). We actively
// hunt the events that score highest: a new/changed exec and a funding round
// (×1.25) each get a dedicated query and MORE results, while low-tier personal
// content (podcasts/posts/talks, ×0.80-0.85) is consolidated into one query with
// FEWER results. Same number of searches as before (this list is still the cost
// cap), just aimed to match where the score weight is. The archetype of each
// surfaced result is still decided by extract, not by which query found it, so
// these queries only change WHAT we find, not how it is scored.
function buildQueries(identity: Identity): {
  q: string;
  sourceType: SourceType;
  maxResults: number;
}[] {
  const person = `"${identity.name}"`;
  const company = identity.company;
  const base = config.gather.maxResultsPerQuery;
  const more = base + 3; // T1 archetypes — cast wider
  const fewer = Math.max(2, base - 2); // personalisation-only — cast narrower
  return [
    // T1 (×1.25) — actively hunted, more results:
    {
      q: `${person} ${company} (appointed OR named OR hired OR "joins as" OR promoted OR "new CFO" OR "steps down")`,
      sourceType: "news",
      maxResults: more,
    },
    {
      q: `${company} (funding OR raises OR "Series" OR investment OR acquisition OR acquires)`,
      sourceType: "press",
      maxResults: more,
    },
    // Broad net for the other events (earnings, expansion, product, general news):
    { q: `${person} ${company} news`, sourceType: "news", maxResults: base + 1 },
    // T2 (×1.10) — hiring for finance/AP roles signals active spend:
    {
      q: `${company} (finance OR accounting OR "accounts payable") jobs hiring`,
      sourceType: "job",
      maxResults: base,
    },
    // T3 — announcements / launches:
    {
      q: `${person} ${company} announcement OR "press release" OR launch`,
      sourceType: "press",
      maxResults: base,
    },
    // T4/T5 — personal voice (talk / podcast / interview), narrower:
    {
      q: `${person} (interview OR podcast OR keynote OR conference OR panel)`,
      sourceType: "talk",
      maxResults: fewer,
    },
    // LinkedIn public snippets — personal context:
    { q: `site:linkedin.com ${person} ${company}`, sourceType: "linkedin", maxResults: fewer },
  ];
}

export async function gather(identity: Identity): Promise<RawResult[]> {
  const queries = buildQueries(identity);

  // Promise.allSettled (not Promise.all) so one slow or failing query never
  // sinks the whole stage — we keep whatever the others return (R5 error path).
  const settled = await Promise.allSettled(
    queries.map((query) =>
      tavilySearch(query.q, {
        maxResults: query.maxResults,
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
