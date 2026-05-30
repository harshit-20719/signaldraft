"use client";

import {
  DEFAULT_QUERY,
  isFiltering,
  type RunQuery,
  type StatusFilter,
  type TierFilter,
} from "@/lib/runQuery";

// P2 — the dashboard filter bar: narrow the run history by tier, by drafted-vs-
// skipped status, and by a free-text search over prospect name + company. It is
// a controlled component (the dashboard page owns the RunQuery); the sort lives
// on the table headers, so clearing filters here deliberately preserves the
// current sort order.

const tierOptions: { value: TierFilter; label: string }[] = [
  { value: "all", label: "All tiers" },
  { value: "HIGH", label: "HIGH" },
  { value: "MEDIUM", label: "MEDIUM" },
  { value: "SKIP", label: "SKIP" },
];

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All status" },
  { value: "drafted", label: "Drafted" },
  { value: "skipped", label: "Skipped" },
];

const fieldClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:border-zinc-500";

export function DashboardControls({
  query,
  onChange,
  total,
  shown,
}: {
  query: RunQuery;
  onChange: (next: RunQuery) => void;
  total: number;
  shown: number;
}) {
  const filtering = isFiltering(query);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query.search}
          onChange={(e) => onChange({ ...query, search: e.target.value })}
          placeholder="Search name or company"
          aria-label="Search by prospect name or company"
          className={`${fieldClass} w-full sm:w-56`}
        />
        <select
          value={query.tier}
          onChange={(e) => onChange({ ...query, tier: e.target.value as TierFilter })}
          aria-label="Filter by tier"
          className={fieldClass}
        >
          {tierOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={query.status}
          onChange={(e) => onChange({ ...query, status: e.target.value as StatusFilter })}
          aria-label="Filter by status"
          className={fieldClass}
        >
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {filtering && (
          <button
            type="button"
            onClick={() =>
              onChange({ ...DEFAULT_QUERY, sortKey: query.sortKey, sortDir: query.sortDir })
            }
            className="rounded-lg px-2 py-1.5 text-sm text-zinc-500 underline-offset-4 transition hover:text-zinc-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Clear
          </button>
        )}
      </div>
      <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
        {shown === total
          ? `${total} run${total === 1 ? "" : "s"}`
          : `${shown} of ${total} runs`}
      </span>
    </div>
  );
}
