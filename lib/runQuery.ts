import type { RunRecord, Verdict } from "@/lib/types";

// Dashboard filtering + sorting, kept as a PURE function (like stats.ts and
// score.ts) so the behaviour is unit-tested and trustworthy, separate from the
// React UI. The dashboard already holds every run in memory (the list is capped
// at config.store.listCap), so filtering/sorting client-side needs no API
// change — this function just shapes the array the table renders.

// What the rep can narrow the history by.
export type TierFilter = "all" | Verdict; // all | HIGH | MEDIUM | SKIP
export type StatusFilter = "all" | "drafted" | "skipped";

// Which column the table is ordered by, and which direction.
export type SortKey = "prospect" | "company" | "tier" | "when" | "status";
export type SortDir = "asc" | "desc";

export interface RunQuery {
  tier: TierFilter;
  status: StatusFilter;
  search: string; // matched against prospect name + company
  sortKey: SortKey;
  sortDir: SortDir;
}

// The default view: nothing filtered, newest run first (the prior behaviour).
export const DEFAULT_QUERY: RunQuery = {
  tier: "all",
  status: "all",
  search: "",
  sortKey: "when",
  sortDir: "desc",
};

// Whether a query is doing any narrowing — used to decide if a "clear filters"
// affordance is worth showing.
export function isFiltering(q: RunQuery): boolean {
  return q.tier !== "all" || q.status !== "all" || q.search.trim() !== "";
}

// Tier order for sorting: HIGH is "highest". Ascending => HIGH, MEDIUM, SKIP.
const TIER_RANK: Record<Verdict, number> = { HIGH: 0, MEDIUM: 1, SKIP: 2 };

// A run is "drafted" if it produced an email, "skipped" otherwise (SKIP runs,
// and the rare draftless HIGH/MEDIUM, both read as skipped) — matching the
// Status column the table renders.
function wasDrafted(run: RunRecord): boolean {
  return run.draft != null;
}

function matchesFilters(run: RunRecord, q: RunQuery): boolean {
  if (q.tier !== "all" && run.verdict !== q.tier) return false;
  if (q.status === "drafted" && !wasDrafted(run)) return false;
  if (q.status === "skipped" && wasDrafted(run)) return false;

  const needle = q.search.trim().toLowerCase();
  if (needle) {
    const hay = `${run.prospect.name} ${run.prospect.company}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

// The primary comparison for a sort key (always ascending; direction is applied
// by the caller). Returns negative if a should come before b.
function compareByKey(a: RunRecord, b: RunRecord, key: SortKey): number {
  switch (key) {
    case "prospect":
      return a.prospect.name.localeCompare(b.prospect.name);
    case "company":
      return a.prospect.company.localeCompare(b.prospect.company);
    case "tier":
      return TIER_RANK[a.verdict] - TIER_RANK[b.verdict];
    case "status":
      return Number(wasDrafted(b)) - Number(wasDrafted(a)); // drafted first
    case "when":
    default:
      return Date.parse(a.createdAt) - Date.parse(b.createdAt);
  }
}

// Filter, then sort. The sort is stable and deterministic: ties on the chosen
// key fall back to newest-first, then to the original position, so equal rows
// never shuffle between renders.
export function queryRuns(runs: RunRecord[], q: RunQuery): RunRecord[] {
  const dir = q.sortDir === "asc" ? 1 : -1;
  return runs
    .filter((run) => matchesFilters(run, q))
    .map((run, i) => ({ run, i }))
    .sort((x, y) => {
      const primary = compareByKey(x.run, y.run, q.sortKey) * dir;
      if (primary !== 0) return primary;
      const recency = Date.parse(y.run.createdAt) - Date.parse(x.run.createdAt);
      if (recency !== 0) return recency;
      return x.i - y.i;
    })
    .map(({ run }) => run);
}
