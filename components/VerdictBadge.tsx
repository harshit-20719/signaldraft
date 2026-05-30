import type { Verdict } from "@/lib/types";

// U11 — the verdict pill, used on the output card, the reopen page, and the
// dashboard table. The colours are PINNED by design:
//   HIGH   = green  (a confident, person-specific hook)
//   MEDIUM = amber  (usable but company-level/older — verify before sending)
//   SKIP   = gray   (NOT red — an honest abstain is good judgment, not a failure)
// A pure presentational component (no hooks), so it works inside any tree.

const STYLE: Record<Verdict, string> = {
  HIGH: "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:ring-emerald-800/60",
  MEDIUM: "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:ring-amber-800/60",
  SKIP: "bg-zinc-200 text-zinc-700 ring-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700",
};

const SIZE = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
} as const;

export function VerdictBadge({
  verdict,
  size = "md",
}: {
  verdict: Verdict;
  size?: keyof typeof SIZE;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold uppercase tracking-wide ring-1 ring-inset ${STYLE[verdict]} ${SIZE[size]}`}
    >
      {verdict}
    </span>
  );
}
