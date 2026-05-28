import { tavily } from "@tavily/core";
import type {
  TavilySearchOptions,
  TavilySearchResponse,
} from "@tavily/core";

// Thin wrapper around the Tavily web-search API. Same pattern as the Claude
// wrapper: read the key once, fail clearly if it is missing, expose one simple
// call. Server-side only (KTD9) — Tavily is the only way SignalDraft touches
// the web, including LinkedIn via public-snippet `site:linkedin.com` queries.

function getClient() {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error(
      "TAVILY_API_KEY is not set. Add it to .env.local (see .env.example).",
    );
  }
  return tavily({ apiKey });
}

// Run one search query and return Tavily's full response (results, etc.).
// U5 fires several of these in parallel; here it is the single building block.
export async function tavilySearch(
  query: string,
  options?: TavilySearchOptions,
): Promise<TavilySearchResponse> {
  const client = getClient();
  return client.search(query, options);
}
