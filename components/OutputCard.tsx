"use client";

import { useEffect, useRef, useState } from "react";
import type { FlagType, RunRecord } from "@/lib/types";
import { VerdictBadge } from "@/components/VerdictBadge";
import { SignalList } from "@/components/SignalList";

// U11 — the result surface, reused in three places: live on the home page when a
// run finishes, on the /runs/[id] reopen page, and (its verdict badge) on the
// dashboard. It renders every verdict tier from ONE component:
//   HIGH / MEDIUM -> the editable draft + the hook reasoning + the ranked signals
//   SKIP          -> no draft; the recommendation + reason, but STILL the signals
//                    it considered (with "why not used"), so the judgment stays
//                    visible even when the answer is "don't send anything".

// Human label + colour for each machine flag. The flag's own `message` carries
// the detail; this is the short headline.
const FLAG_META: Record<FlagType, { label: string; tone: "neutral" | "caution" | "warn" }> = {
  low_confidence_identity: { label: "Low-confidence identity", tone: "neutral" },
  negative_news_avoided: { label: "Negative news avoided", tone: "caution" },
  company_level_verify: { label: "Verify before sending", tone: "warn" },
  insufficient_signal: { label: "Insufficient signal", tone: "neutral" },
  no_safe_hook: { label: "No safe hook", tone: "neutral" },
};

const FLAG_TONE: Record<"neutral" | "caution" | "warn", string> = {
  neutral: "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300",
  caution: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300",
  warn: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
};

const labelClass =
  "text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-800";

export function OutputCard({ record }: { record: RunRecord }) {
  const isSkip = record.verdict === "SKIP";

  // The draft is editable locally so the rep can tweak it before copying. Seeded
  // from the saved draft; when a *different* run is shown in the same component
  // instance, it re-seeds from the new record. This is a render-time reset —
  // React's recommended alternative to a setState-in-effect for "reset state
  // when a prop changes" — so a fresh run's draft replaces the old one while
  // edits to the same run survive re-renders.
  const [seededId, setSeededId] = useState(record.id);
  const [subject, setSubject] = useState(record.draft?.subject ?? "");
  const [body, setBody] = useState(record.draft?.body ?? "");
  if (seededId !== record.id) {
    setSeededId(record.id);
    setSubject(record.draft?.subject ?? "");
    setBody(record.draft?.body ?? "");
  }

  const [copied, setCopied] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  async function copyEmail() {
    const text = `Subject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — select the body so
      // the user can copy it manually with the keyboard.
      bodyRef.current?.focus();
      bodyRef.current?.select();
    }
  }

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      {/* Header: verdict + who the run was about + when. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <VerdictBadge verdict={record.verdict} />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {record.prospect.name}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {record.prospect.company}
            </span>
          </div>
        </div>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {(record.timings.durationMs / 1000).toFixed(1)}s · {record.signals.length}{" "}
          signal{record.signals.length === 1 ? "" : "s"} considered
        </span>
      </div>

      {/* Flags row. */}
      {record.flags.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {record.flags.map((flag, i) => {
            const meta = FLAG_META[flag.type];
            return (
              <div key={`${flag.type}-${i}`} className="flex items-start gap-2">
                <span
                  className={`mt-0.5 inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-medium ${FLAG_TONE[meta.tone]}`}
                >
                  {meta.label}
                </span>
                <span className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  {flag.message}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!record.draft ? (
        // ----- No-draft layout: recommendation + reason -----
        // Keyed on draft presence (not just SKIP) so a HIGH/MEDIUM record that
        // somehow arrives without a draft still shows an explanation instead of
        // empty editable fields and a Copy button that copies an empty email.
        <div className="flex flex-col gap-2 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900/60">
          <p className={labelClass}>Recommendation</p>
          <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            {record.recommendation ?? "No draft was produced for this run."}
          </p>
        </div>
      ) : (
        // ----- HIGH / MEDIUM layout: hook reasoning + editable draft -----
        <>
          {record.hook && (
            <div className="flex flex-col gap-1 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900/60">
              <p className={labelClass}>Why this hook</p>
              <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                {record.hook.why}
              </p>
              {record.hook.url && (
                <a
                  href={record.hook.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-flex w-fit items-center gap-0.5 text-xs font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                >
                  Based on: {record.hook.what} ↗
                </a>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="draft-subject" className={labelClass}>
                Subject
              </label>
              <input
                id="draft-subject"
                className={inputClass}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="draft-body" className={labelClass}>
                Body
              </label>
              <textarea
                id="draft-body"
                ref={bodyRef}
                className={`${inputClass} min-h-[180px] resize-y leading-6`}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={copyEmail}
              className="inline-flex w-fit items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {copied ? "Copied!" : "Copy email"}
            </button>
          </div>
        </>
      )}

      {/* Ranked signals — shown for every verdict, including SKIP (so the
          judgment stays visible even when the answer is "don't send"). */}
      <div className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <p className={labelClass}>
          Signals considered{isSkip ? " (why not used)" : ", ranked"}
        </p>
        <SignalList
          signals={record.signals}
          verdict={record.verdict}
          hookUrl={record.hook?.url}
        />
      </div>
    </section>
  );
}
