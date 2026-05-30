"use client";

import type { ReactNode } from "react";

// U10 — one card in the live run timeline. This component is deliberately
// "dumb": it knows nothing about the pipeline, it just renders whatever state
// and text it is handed. LiveRunView owns the judgment of what each stage's
// state and gate outcome are; this file owns how a single stage *looks*.
//
// The four states map to what the rep is watching happen in real time:
//   pending  — not reached yet (dimmed, hollow dot, no spinner)
//   running  — happening now (animated dot + emphasised label)
//   done     — finished, with a one-line summary of what it found
//   skipped  — a gate routed past it (this is honest judgment, not an error)
// plus a fifth, error, for when a stage actually fails (stalled / dropped).

export type CardStatus = "pending" | "running" | "done" | "skipped" | "error";

// A gate is the decision point that follows a stage. Tone drives the colour:
//   pass — the run continues (green)
//   warn — it continues but with a caveat, e.g. low confidence / MEDIUM (amber)
//   stop — it routes to an honest SKIP (neutral gray — NOT a failure)
export interface GateBadge {
  label: string;
  tone: "pass" | "warn" | "stop";
}

interface StageCardProps {
  label: string;
  status: CardStatus;
  summary?: string;
  banner?: ReactNode; // e.g. the Gate-1 low-confidence warning, inside the card
  gate?: GateBadge; // the decision point rendered beneath the card
  isLast?: boolean; // suppress the connector line on the final card
}

const GLYPH: Record<CardStatus, string> = {
  pending: "○",
  running: "●",
  done: "✓",
  skipped: "–",
  error: "✕",
};

const GLYPH_CLASS: Record<CardStatus, string> = {
  pending: "text-zinc-300 dark:text-zinc-700",
  running: "animate-pulse text-zinc-900 dark:text-zinc-100",
  done: "text-emerald-600 dark:text-emerald-400",
  skipped: "text-zinc-400 dark:text-zinc-500",
  error: "text-rose-600 dark:text-rose-400",
};

const LABEL_CLASS: Record<CardStatus, string> = {
  pending: "text-zinc-400 dark:text-zinc-600",
  running: "text-zinc-900 dark:text-zinc-100",
  done: "text-zinc-800 dark:text-zinc-200",
  skipped: "text-zinc-500 dark:text-zinc-400",
  error: "text-rose-700 dark:text-rose-300",
};

const GATE_CLASS: Record<GateBadge["tone"], string> = {
  pass: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
  warn: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
  stop: "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300",
};

export function StageCard({
  label,
  status,
  summary,
  banner,
  gate,
  isLast,
}: StageCardProps) {
  return (
    <li className="flex gap-3">
      {/* Glyph + connector line down to the next card. */}
      <div className="flex flex-col items-center">
        <span
          className={`flex h-6 w-6 items-center justify-center text-sm leading-none ${GLYPH_CLASS[status]}`}
          aria-hidden
        >
          {status === "running" ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            GLYPH[status]
          )}
        </span>
        {!isLast && (
          <span className="w-px flex-1 bg-zinc-200 dark:bg-zinc-800" aria-hidden />
        )}
      </div>

      {/* Content. */}
      <div className={`flex-1 ${isLast ? "pb-0" : "pb-5"}`}>
        <p className={`text-sm font-medium ${LABEL_CLASS[status]}`}>{label}</p>

        {summary && (
          <p className="mt-0.5 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {summary}
          </p>
        )}

        {banner}

        {gate && (
          <span
            className={`mt-2 inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-xs font-medium ${GATE_CLASS[gate.tone]}`}
          >
            {gate.label}
          </span>
        )}
      </div>
    </li>
  );
}
