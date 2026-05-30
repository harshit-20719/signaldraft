"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { OutputCard } from "@/components/OutputCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { RunRecord } from "@/lib/types";

// U11 — reopen a saved run by URL. This renders the SAME OutputCard the live run
// hands off to, proving the card is verdict-driven and source-agnostic: it does
// not care whether the record just streamed in or was loaded from the store.
//
// Next.js 16 note: in a Client Component the dynamic-route `params` is a Promise
// and is unwrapped with React's `use()` hook (a client page cannot be `async`).
// We fetch through the GET /api/runs/[id] route built in U8, with a loading
// state, so the page mirrors how the rest of the app reads data.

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; record: RunRecord };

export default function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/runs/${id}`)
      .then(async (res): Promise<LoadState> => {
        if (res.ok) {
          const { run } = (await res.json()) as { run: RunRecord };
          return { status: "loaded", record: run };
        }
        if (res.status === 404) {
          return {
            status: "error",
            message:
              "This run was not found — it may have expired (runs are kept for 30 days) or the link is wrong.",
          };
        }
        return { status: "error", message: "Could not load this run." };
      })
      .catch((): LoadState => ({
        status: "error",
        message: "Could not load this run — check your connection and try again.",
      }))
      .then((next) => {
        if (!cancelled) setState(next);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="text-xs font-medium text-zinc-500 underline-offset-4 hover:text-zinc-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ← Dashboard
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/"
            className="text-xs font-medium text-zinc-500 underline-offset-4 hover:text-zinc-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            New run →
          </Link>
        </div>
      </div>

      {state.status === "loading" && (
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Loading run…
        </div>
      )}

      {state.status === "error" && (
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {state.message}
          </p>
          <Link
            href="/dashboard"
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Back to dashboard
          </Link>
        </div>
      )}

      {state.status === "loaded" && <OutputCard record={state.record} />}
    </main>
  );
}
