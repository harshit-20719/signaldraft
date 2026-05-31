import type { Signal, Verdict } from "@/lib/types";
import { config } from "@/lib/config";

// U11 — the ranked signal list. This is the "show its work" surface: every
// signal the engine considered, best-first, each with its three transparent
// scores, what it is about (person vs company), its source link, and a plain
// note explaining its role — chosen as the hook, found-but-excluded (negative
// news, AE4), or considered-but-too-weak on a SKIP. Pure presentational.

// Scores are 0..1 internally; shown as percentages because "80%" reads more
// plainly than "0.8" for a non-technical viewer.
function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

type NoteTone = "good" | "caution" | "muted";

const NOTE_CLASS: Record<NoteTone, string> = {
  good: "text-emerald-700 dark:text-emerald-400",
  caution: "text-amber-700 dark:text-amber-400",
  muted: "text-zinc-500 dark:text-zinc-400",
};

// Why this signal ended up where it did — the per-signal explanation.
function noteFor(
  sig: Signal,
  verdict: Verdict,
  isHook: boolean,
): { text: string; tone: NoteTone } | null {
  if (sig.negative)
    return {
      text: "Negative news — found, but deliberately excluded from the hook.",
      tone: "caution",
    };
  if (isHook) return { text: "Chosen as the hook.", tone: "good" };
  if (verdict === "SKIP")
    return {
      text: "Considered, but too weak, old, or generic to build a credible hook on.",
      tone: "muted",
    };
  return null; // a safe, non-hook signal on a HIGH/MEDIUM run — just ranked below
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded border border-zinc-200 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
      {children}
    </span>
  );
}

export function SignalList({
  signals,
  verdict,
  hookUrl,
}: {
  signals: Signal[];
  verdict: Verdict;
  hookUrl?: string;
}) {
  if (signals.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No signals survived filtering — there was nothing recent and on-topic to
        build on.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {signals.map((sig, i) => {
        const isHook = !!hookUrl && sig.url === hookUrl;
        const note = noteFor(sig, verdict, isHook);
        return (
          <li
            key={`${sig.url}-${i}`}
            className={`rounded-lg border p-3 ${
              isHook
                ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-800/60 dark:bg-emerald-950/20"
                : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1.5">
                <p className="text-sm leading-6 text-zinc-800 dark:text-zinc-200">
                  {sig.what}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Tag>{sig.subject === "person" ? "Person" : "Company"}</Tag>
                  <Tag>{sig.type}</Tag>
                  {sig.url ? (
                    <a
                      href={sig.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-xs font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                    >
                      {sig.source || "source"} ↗
                    </a>
                  ) : (
                    <span className="text-xs text-zinc-400">
                      {sig.source || "no source"}
                    </span>
                  )}
                </div>
                {note && (
                  <p className={`text-xs leading-5 ${NOTE_CLASS[note.tone]}`}>
                    {note.text}
                  </p>
                )}
              </div>

              {/* Scores. Overall is prominent; the three inputs sit beneath it. */}
              <div className="flex shrink-0 flex-col items-end">
                <span className="text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {pct(sig.scores.total)}
                </span>
                <span className="text-[11px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  overall
                </span>
                <span className="mt-1 text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                  R {pct(sig.scores.recency)} · S {pct(sig.scores.specificity)} ·
                  Rel {pct(sig.scores.relevance)}
                </span>
                {config.score.archetypeTiers[sig.type] !== 1 && (
                  <span
                    className={`text-[11px] tabular-nums ${
                      config.score.archetypeTiers[sig.type] > 1
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-zinc-400 dark:text-zinc-500"
                    }`}
                  >
                    ×{config.score.archetypeTiers[sig.type]} signal type
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
