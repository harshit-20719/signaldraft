"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardTable } from "@/components/DashboardTable";
import { DashboardControls } from "@/components/DashboardControls";
import { ThemeToggle } from "@/components/ThemeToggle";
import { computeStats, type DashboardStats } from "@/lib/stats";
import { DEFAULT_QUERY, queryRuns, type RunQuery, type SortKey } from "@/lib/runQuery";
import type { RunRecord } from "@/lib/types";

// U12 — the dashboard: the shared history of every run plus a summary strip of
// the four product metrics (R14, R15). Fetches through GET /api/runs (the same
// store the live run writes to), so opening this in a second browser shows runs
// other people triggered — that is the whole point of the shared store (KTD4).

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; runs: RunRecord[] };

// Render a rate as a percent, or "—" when there is no denominator yet.
function pct(n: number | null): string {
  return n === null ? "—" : `${Math.round(n * 100)}%`;
}

function seconds(ms: number | null): string {
  return ms === null ? "—" : `${(ms / 1000).toFixed(1)}s`;
}

function StatCard({
  value,
  label,
  hint,
}: {
  value: string;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <span className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
        {value}
      </span>
      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      <span className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        {hint}
      </span>
    </div>
  );
}

function StatsStrip({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard
        value={pct(stats.hookSpecificity)}
        label="Hook specificity"
        hint="drafts built on a person-level signal, not just the company"
      />
      <StatCard
        value={pct(stats.grounding)}
        label="Grounded drafts"
        hint="drafts whose hook traces to a real cited source"
      />
      <StatCard
        value={pct(stats.honestAbstention)}
        label="Honest SKIP rate"
        hint="runs the system declined instead of forcing a draft"
      />
      <StatCard
        value={seconds(stats.avgTimeToDraftMs)}
        label="Avg time to draft"
        hint="mean run time for runs that produced a draft"
      />
    </div>
  );
}

export default function DashboardPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [query, setQuery] = useState<RunQuery>(DEFAULT_QUERY);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/runs")
      .then(async (res): Promise<LoadState> => {
        if (!res.ok) return { status: "error", message: "Could not load the dashboard." };
        const { runs } = (await res.json()) as { runs: RunRecord[] };
        return { status: "loaded", runs };
      })
      .catch((): LoadState => ({
        status: "error",
        message: "Could not load the dashboard — check your connection and try again.",
      }))
      .then((next) => {
        if (!cancelled) setState(next);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const runs = state.status === "loaded" ? state.runs : [];
  const hasRuns = runs.length > 0;
  const filtered = queryRuns(runs, query);

  const handleSort = (key: SortKey) =>
    setQuery((q) =>
      q.sortKey === key
        ? { ...q, sortDir: q.sortDir === "asc" ? "desc" : "asc" }
        : { ...q, sortKey: key, sortDir: key === "when" ? "desc" : "asc" },
    );

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Dashboard
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Every run, shared — and how the judgment is holding up.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/"
            className="text-xs font-medium text-zinc-500 underline-offset-4 hover:text-zinc-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            New run →
          </Link>
        </div>
      </header>

      {state.status === "loading" && (
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Loading runs…
        </div>
      )}

      {state.status === "error" && (
        <div className="rounded-xl border border-zinc-200 p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          {state.message}
        </div>
      )}

      {/* Empty state: a friendly prompt and NO stats strip (no 0/0 or NaN%). */}
      {state.status === "loaded" && !hasRuns && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            No runs yet
          </p>
          <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
            Submit a prospect to get started — every run shows up here for anyone
            with this link.
          </p>
          <Link
            href="/"
            className="mt-1 inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Run a prospect
          </Link>
        </div>
      )}

      {hasRuns && (
        <>
          <StatsStrip stats={computeStats(runs)} />
          <DashboardControls
            query={query}
            onChange={setQuery}
            total={runs.length}
            shown={filtered.length}
          />
          {filtered.length > 0 ? (
            <DashboardTable
              runs={filtered}
              sortKey={query.sortKey}
              sortDir={query.sortDir}
              onSort={handleSort}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No runs match these filters.
              </p>
              <button
                type="button"
                onClick={() =>
                  setQuery({ ...DEFAULT_QUERY, sortKey: query.sortKey, sortDir: query.sortDir })
                }
                className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-300"
              >
                Clear filters
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
