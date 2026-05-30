"use client";

import { useRef, useState } from "react";
import { ProspectForm } from "@/components/ProspectForm";
import { SellerContextPanel } from "@/components/SellerContextPanel";
import { defaultSeller } from "@/lib/config";
import type {
  Prospect,
  RunRecord,
  RunStreamMessage,
  SellerContext,
  StageEvent,
  StageName,
  Verdict,
} from "@/lib/types";

// U9 + the seed of U10's inline stream reader. This is the home screen: enter a
// prospect, edit the seller context, submit, and watch the run stream in. The
// run view here is deliberately MINIMAL — a stage-status list plus the final
// result. Day 5 replaces it with the rich StageCard timeline (U10) and the
// OutputCard (U11); the streaming/wiring it sits on is the real thing.

const STAGES: StageName[] = ["resolve", "gather", "extract", "score", "draft"];
const STAGE_LABELS: Record<StageName, string> = {
  resolve: "Resolve identity",
  gather: "Gather signals",
  extract: "Extract & filter",
  score: "Score & verdict",
  draft: "Draft / abstain",
};

const VERDICT_STYLE: Record<Verdict, string> = {
  HIGH: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  MEDIUM: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  SKIP: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

function statusGlyph(status: StageEvent["status"] | "pending"): string {
  switch (status) {
    case "done":
      return "✓";
    case "skipped":
      return "–";
    case "error":
      return "✗";
    case "running":
      return "●";
    default:
      return "○";
  }
}

export default function Home() {
  const [prospect, setProspect] = useState<Prospect>({ name: "", company: "" });
  const [seller, setSeller] = useState<SellerContext>(() => ({
    ...defaultSeller,
    valueProps: [...defaultSeller.valueProps],
  }));
  const [sellerCollapsed, setSellerCollapsed] = useState(true);

  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<Partial<Record<StageName, StageEvent>>>({});
  const [record, setRecord] = useState<RunRecord | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Guards against a second submit racing in while one run is active.
  const inFlight = useRef(false);

  async function startRun() {
    if (inFlight.current) return;
    inFlight.current = true;
    setRunning(true);
    setEvents({});
    setRecord(null);
    setErrorMsg(null);
    setSellerCollapsed(true); // give the run view room (R: auto-collapse on submit)

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospect, seller }),
      });

      if (!res.ok || !res.body) {
        const msg = await res
          .json()
          .then((d) => d.error as string)
          .catch(() => "The run could not be started.");
        setErrorMsg(msg ?? "The run could not be started.");
        return;
      }

      // Read the newline-delimited JSON stream and dispatch each message as it
      // arrives — this is what makes the run feel live.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          handleMessage(JSON.parse(line) as RunStreamMessage);
        }
      }
    } catch {
      setErrorMsg("The connection dropped mid-run. Please try again.");
    } finally {
      setRunning(false);
      inFlight.current = false;
    }
  }

  function handleMessage(msg: RunStreamMessage) {
    if (msg.type === "event") {
      setEvents((prev) => ({ ...prev, [msg.event.stage]: msg.event }));
    } else if (msg.type === "record") {
      setRecord(msg.record);
    } else if (msg.type === "error") {
      setErrorMsg(msg.message);
    }
  }

  const showRunPanel = running || record !== null || errorMsg !== null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <span className="w-fit rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          v1 · in progress
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          SignalDraft
        </h1>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Finds a real, recent signal about a prospect, judges whether it&apos;s
          worth reaching out, and either drafts a grounded email or honestly
          recommends a skip.
        </p>
      </header>

      <div className="flex flex-col gap-5">
        <ProspectForm
          value={prospect}
          onChange={setProspect}
          onSubmit={startRun}
          disabled={running}
        />
        <SellerContextPanel
          value={seller}
          onChange={setSeller}
          disabled={running}
          collapsed={sellerCollapsed}
          onToggle={() => setSellerCollapsed((c) => !c)}
        />
      </div>

      {showRunPanel && (
        <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Run
          </h2>

          {/* Minimal stage timeline — replaced by StageCards in U10. */}
          <ol className="flex flex-col gap-2">
            {STAGES.map((stage) => {
              const ev = events[stage];
              const status = ev?.status ?? "pending";
              return (
                <li key={stage} className="flex items-start gap-3 text-sm">
                  <span
                    className={`mt-0.5 w-4 text-center ${
                      status === "running"
                        ? "animate-pulse text-zinc-900 dark:text-zinc-100"
                        : status === "done"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : status === "error"
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-zinc-400 dark:text-zinc-600"
                    }`}
                  >
                    {statusGlyph(status)}
                  </span>
                  <span className="flex flex-col">
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">
                      {STAGE_LABELS[stage]}
                    </span>
                    {ev?.summary && (
                      <span className="text-zinc-500 dark:text-zinc-400">
                        {ev.summary}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>

          {errorMsg && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {errorMsg}
            </p>
          )}

          {/* Minimal result — replaced by the OutputCard in U11. */}
          {record && (
            <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${VERDICT_STYLE[record.verdict]}`}
                >
                  {record.verdict}
                </span>
                {record.hook && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {record.hook.why}
                  </span>
                )}
              </div>

              {record.draft ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {record.draft.subject}
                  </p>
                  <pre className="whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 font-sans text-sm leading-6 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                    {record.draft.body}
                  </pre>
                </div>
              ) : (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {record.recommendation ?? "No draft produced."}
                </p>
              )}

              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Saved to the dashboard · {record.signals.length} signal(s)
                considered · {record.timings.durationMs}ms
              </p>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
