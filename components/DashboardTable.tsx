"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RunRecord } from "@/lib/types";
import { VerdictBadge } from "@/components/VerdictBadge";

// U12 — the run-history table. Each row reopens its run at /runs/[id]. The whole
// row is clickable for convenience, and the prospect name is a real <Link> so
// keyboard users and middle-click / open-in-new-tab still work (the row onClick
// alone would not be accessible).

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400";
const td = "px-3 py-3 text-sm text-zinc-700 align-top dark:text-zinc-300";

export function DashboardTable({ runs }: { runs: RunRecord[] }) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[640px] border-collapse">
        <thead className="border-b border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40">
          <tr>
            <th className={th}>Prospect</th>
            <th className={th}>Company</th>
            <th className={th}>Tier</th>
            <th className={th}>Hook</th>
            <th className={th}>When</th>
            <th className={th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const href = `/runs/${run.id}`;
            return (
              <tr
                key={run.id}
                onClick={() => router.push(href)}
                className="cursor-pointer border-b border-zinc-100 transition last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/40"
              >
                <td className={`${td} font-medium text-zinc-900 dark:text-zinc-100`}>
                  <Link
                    href={href}
                    onClick={(e) => e.stopPropagation()}
                    className="underline-offset-2 hover:underline"
                  >
                    {run.prospect.name || "—"}
                  </Link>
                </td>
                <td className={td}>{run.prospect.company || "—"}</td>
                <td className={td}>
                  <VerdictBadge verdict={run.verdict} size="sm" />
                </td>
                <td className={`${td} max-w-[280px]`}>
                  <span className="line-clamp-2">{run.hook?.what ?? "—"}</span>
                </td>
                <td className={`${td} whitespace-nowrap text-zinc-500 dark:text-zinc-400`}>
                  {formatDate(run.createdAt)}
                </td>
                <td className={`${td} whitespace-nowrap`}>
                  {run.draft ? "Drafted" : "Skipped"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
