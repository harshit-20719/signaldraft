"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ProspectForm } from "@/components/ProspectForm";
import { SellerContextPanel } from "@/components/SellerContextPanel";
import { LiveRunView } from "@/components/LiveRunView";
import { OutputCard } from "@/components/OutputCard";
import { defaultSeller } from "@/lib/config";
import type {
  Prospect,
  RunRecord,
  RunStreamMessage,
  SellerContext,
  StageEvent,
  StageName,
} from "@/lib/types";

// The home screen: enter a prospect, edit the seller context, submit, and watch
// the run stream in stage-by-stage. The stream reader is kept INLINE here on
// purpose — there is exactly one consumer of the stream (this page), so a
// separate hook abstraction would add indirection without paying for itself
// (U10). This component owns the run lifecycle; LiveRunView renders the timeline
// it produces, and the OutputCard (U11) renders the final result.

// If no stream activity arrives for this long, treat the run as stalled. The
// server caps a run at 60s (maxDuration), so 90s of *silence* is comfortably
// abnormal — we abort, mark the in-flight stage failed, and offer a retry.
const RUN_INACTIVITY_MS = 90_000;

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
  // Which stage to paint as failed when the run errors/stalls (the one that was
  // mid-flight). Null if the failure happened between stages.
  const [failedStage, setFailedStage] = useState<StageName | null>(null);

  // Imperative run state that must not trigger re-renders or go stale in
  // closures: a re-entrancy guard, the current fetch's abort handle, the
  // inactivity timer, and the stage currently running (read by the timer).
  const inFlight = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningStageRef = useRef<StageName | null>(null);

  const clearRunTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // (Re)start the inactivity clock. Called when the run starts and again on every
  // chunk that arrives, so a long-but-progressing run is never killed — only a
  // genuinely silent one.
  const armInactivityTimer = () => {
    clearRunTimer();
    timeoutRef.current = setTimeout(() => {
      abortRef.current?.abort();
      setFailedStage(runningStageRef.current);
      setErrorMsg(
        "No response from the server for 90 seconds — the run may have stalled. You can retry.",
      );
    }, RUN_INACTIVITY_MS);
  };

  // Clean up any pending timer / in-flight request if the page unmounts mid-run.
  useEffect(() => {
    return () => {
      clearRunTimer();
      abortRef.current?.abort();
    };
  }, []);

  async function startRun() {
    if (inFlight.current) return;
    inFlight.current = true;
    setRunning(true);
    setEvents({});
    setRecord(null);
    setErrorMsg(null);
    setFailedStage(null);
    setSellerCollapsed(true); // give the run view room (auto-collapse on submit)
    runningStageRef.current = null;

    const controller = new AbortController();
    abortRef.current = controller;
    let sawTerminal = false; // a final `record` or `error` message arrived

    try {
      armInactivityTimer();
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospect, seller }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const msg = await res
          .json()
          .then((d) => d.error as string)
          .catch(() => null);
        setErrorMsg(msg ?? "The run could not be started.");
        sawTerminal = true;
        return;
      }

      // Read the newline-delimited JSON stream and dispatch each message as it
      // arrives — this is what makes the run feel live.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Dispatch one complete NDJSON line. Reassigns the surrounding
      // `sawTerminal` so the post-loop and catch logic know a final record/error
      // already landed and must not be clobbered.
      const handleLine = (raw: string) => {
        const line = raw.trim();
        if (!line) return;
        const msg = JSON.parse(line) as RunStreamMessage;

        if (msg.type === "event") {
          const ev = msg.event;
          // Track the in-flight stage so a stall can point at the right card.
          if (ev.status === "running") runningStageRef.current = ev.stage;
          else if (runningStageRef.current === ev.stage)
            runningStageRef.current = null;
          setEvents((prev) => ({ ...prev, [ev.stage]: ev }));
        } else if (msg.type === "record") {
          sawTerminal = true;
          clearRunTimer(); // the run finished — the inactivity timer must not fire
          setRecord(msg.record);
        } else if (msg.type === "error") {
          sawTerminal = true;
          clearRunTimer();
          setErrorMsg(msg.message);
          setFailedStage(runningStageRef.current);
        }
      };

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        // Progress = alive; reset the silence clock — but not once the terminal
        // message has arrived (we are only draining the close).
        if (!sawTerminal) armInactivityTimer();
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          handleLine(buffer.slice(0, nl));
          buffer = buffer.slice(nl + 1);
        }
      }
      // Flush a final line the server didn't terminate with a newline, so a
      // terminal record/error in the last chunk is never silently dropped.
      handleLine(buffer);

      // Stream closed cleanly but with no final record/error: an abnormal end.
      // Surface it rather than leaving the timeline frozen mid-run.
      if (!sawTerminal) {
        setErrorMsg("The run ended unexpectedly before finishing. You can retry.");
        setFailedStage(runningStageRef.current);
      }
    } catch (err) {
      // Don't clobber a result that already arrived: a timeout aborts the fetch
      // (AbortError — message already set), and a late parse/IO error after a
      // terminal message must not overwrite the real record/error.
      if (
        !sawTerminal &&
        !(err instanceof DOMException && err.name === "AbortError")
      ) {
        setErrorMsg("The connection dropped mid-run. You can retry.");
        setFailedStage(runningStageRef.current);
      }
    } finally {
      clearRunTimer();
      abortRef.current = null;
      setRunning(false);
      inFlight.current = false;
    }
  }

  const showRunPanel = running || record !== null || errorMsg !== null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="w-fit rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            v1 · in progress
          </span>
          <Link
            href="/dashboard"
            className="text-xs font-medium text-zinc-500 underline-offset-4 hover:text-zinc-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Dashboard →
          </Link>
        </div>
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
        <LiveRunView
          events={events}
          failedStage={failedStage}
          errorMsg={errorMsg}
          running={running}
          record={record}
          onRetry={startRun}
        />
      )}

      {/* The result surface (U11) — the same card the reopen page uses. It
          re-seeds its editable draft when a fresh run arrives (self-contained). */}
      {record && <OutputCard record={record} />}
    </main>
  );
}
