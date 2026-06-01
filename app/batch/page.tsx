"use client";

import { useState } from "react";
import Link from "next/link";
import { SellerContextPanel } from "@/components/SellerContextPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VerdictBadge } from "@/components/VerdictBadge";
import { config, defaultSeller } from "@/lib/config";
import { parseProspectCsv, type ProspectRow } from "@/lib/csv";
import type { RunStreamMessage, SellerContext, Verdict } from "@/lib/types";

// R3 (stretch) — CSV batch. Upload or paste a small prospect list and run each
// through the SAME engine as a single run, one at a time, so every result lands
// in the shared dashboard. Capped at config.batch.maxRows to stay inside the
// public per-IP rate limit. There is no new backend: this page just drives the
// existing POST /api/run per row and reads each stream to its final record.

const MAX = config.batch.maxRows;

// The five demo prospects (U14), one per verdict case, so "Use an example" loads
// a list that exercises the full range in a single batch: a clean HIGH, a
// company-level MEDIUM, an honest SKIP (an obscure prospect with no public
// signal), the safety veto (negative news found but kept out of the hook), and a
// low-confidence disambiguation flag. "Arq, Inc." carries a comma, so the field
// is quoted — a live test of the CSV quoted-comma handling.
const EXAMPLE_CSV = `name,company,role
Shimon Steinmetz,"Arq, Inc.",Chief Financial Officer
Carey Hendrickson,PACS Group,Chief Financial Officer
Hilary Maxson,Oracle,Chief Financial Officer
Sid Thacker,Peloton Interactive,Chief Financial Officer
Devon Ashcroft,Larkfield Instruments,Head of Finance`;

type RowStatus =
  | { state: "pending" }
  | { state: "running"; stage?: string }
  | { state: "done"; verdict: Verdict; drafted: boolean; id: string }
  | { state: "error"; message: string };

interface BatchItem {
  prospect: ProspectRow;
  status: RowStatus;
}

const STAGE_VERB: Record<string, string> = {
  resolve: "resolving identity",
  gather: "gathering signals",
  extract: "extracting signals",
  score: "scoring",
  draft: "drafting",
  selfcheck: "self-checking",
};

// If a single row goes silent for this long, treat it as stalled and abort it —
// so one hung run can't freeze the whole sequential batch. Mirrors the single-run
// page's safeguard (the server caps a run at 60s, so 90s of silence is abnormal).
const ROW_INACTIVITY_MS = 90_000;

// Drive one run through POST /api/run and read the stream to its final record.
// We only surface the current stage (for the progress line) and the final
// outcome; the full live timeline is the single-run page's job, not the batch's.
// This never throws: every failure (network drop, stall, bad response) is turned
// into an "error" RowStatus so the batch loop can record it and move on.
async function runOne(
  prospect: ProspectRow,
  seller: SellerContext,
  onStage: (stage: string) => void,
): Promise<RowStatus> {
  // Abort the row if it goes silent too long, re-arming on every chunk so a
  // slow-but-progressing run is never killed — only a genuinely stalled one.
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const arm = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), ROW_INACTIVITY_MS);
  };
  const disarm = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  try {
    arm();
    let res: Response;
    try {
      res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospect, seller }),
        signal: controller.signal,
      });
    } catch {
      return { state: "error", message: "Network error — could not reach the server." };
    }

    if (res.status === 429) {
      return { state: "error", message: "Rate limit reached — wait an hour and retry." };
    }
    if (!res.ok || !res.body) {
      const msg = await res
        .json()
        .then((d) => d.error as string)
        .catch(() => null);
      return { state: "error", message: msg ?? "The run could not be started." };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let result: RowStatus = {
      state: "error",
      message: "The run ended unexpectedly.",
    };

    const handle = (raw: string) => {
      const line = raw.trim();
      if (!line) return;
      let msg: RunStreamMessage;
      try {
        msg = JSON.parse(line) as RunStreamMessage;
      } catch {
        return;
      }
      if (msg.type === "event") {
        if (msg.event.status === "running") onStage(msg.event.stage);
      } else if (msg.type === "record") {
        const r = msg.record;
        result = { state: "done", verdict: r.verdict, drafted: r.draft != null, id: r.id };
      } else if (msg.type === "error") {
        result = { state: "error", message: msg.message };
      }
    };

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      arm(); // progress = alive; reset the silence clock
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        handle(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
      }
    }
    handle(buffer);
    return result;
  } catch (err) {
    // A dropped or stalled connection (reader.read() throws, or our timeout
    // aborts) becomes a clean per-row error instead of throwing out of the loop.
    const aborted = err instanceof DOMException && err.name === "AbortError";
    return {
      state: "error",
      message: aborted
        ? "Timed out — no response for 90 seconds."
        : "The connection dropped mid-run.",
    };
  } finally {
    disarm();
  }
}

export default function BatchPage() {
  const [csvText, setCsvText] = useState("");
  const [items, setItems] = useState<BatchItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [seller, setSeller] = useState<SellerContext>(() => ({
    ...defaultSeller,
    valueProps: [...defaultSeller.valueProps],
  }));
  const [sellerCollapsed, setSellerCollapsed] = useState(true);
  const [running, setRunning] = useState(false);

  function loadFromText(text: string) {
    const parsed = parseProspectCsv(text);
    if (parsed.length === 0) {
      setItems([]);
      setTruncated(false);
      setLoadError(
        "No valid rows found. The first line must be a header with at least a name and a company column.",
      );
      return;
    }
    setLoadError(null);
    setTruncated(parsed.length > MAX);
    setItems(parsed.slice(0, MAX).map((p) => ({ prospect: p, status: { state: "pending" } })));
  }

  function onFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setCsvText(text);
      loadFromText(text);
    };
    reader.readAsText(file);
  }

  async function runBatch() {
    if (running || items.length === 0) return;
    setRunning(true);
    setSellerCollapsed(true);
    // Reset any prior outcomes to pending before a fresh pass.
    setItems((prev) => prev.map((it) => ({ ...it, status: { state: "pending" } })));

    const list = items.map((it) => it.prospect);
    const sellerSnapshot = seller;
    try {
      for (let i = 0; i < list.length; i++) {
        setItems((prev) =>
          prev.map((it, idx) => (idx === i ? { ...it, status: { state: "running" } } : it)),
        );
        // runOne never throws — every failure comes back as an error status — so
        // one bad row is recorded and the batch moves on to the next.
        const status = await runOne(list[i], sellerSnapshot, (stage) =>
          setItems((prev) =>
            prev.map((it, idx) =>
              idx === i ? { ...it, status: { state: "running", stage } } : it,
            ),
          ),
        );
        setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, status } : it)));
      }
    } finally {
      // Whatever happens, re-enable the controls — never leave the UI wedged.
      setRunning(false);
    }
  }

  const anyDone = items.some((it) => it.status.state === "done");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <ThemeToggle />
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xs font-medium text-zinc-500 underline-offset-4 hover:text-zinc-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              New run
            </Link>
            <Link
              href="/dashboard"
              className="text-xs font-medium text-zinc-500 underline-offset-4 hover:text-zinc-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Dashboard →
            </Link>
          </div>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Batch run
        </h1>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Run up to {MAX} prospects from a CSV. Each one goes through the same
          engine and lands on the dashboard. Columns: <code>name</code>,{" "}
          <code>company</code>, optional <code>role</code> and <code>hint</code>{" "}
          (first row is the header).
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          disabled={running}
          placeholder={"name,company,role\nAmy Hood,Microsoft,CFO"}
          className="min-h-[120px] w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 outline-none transition focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => loadFromText(csvText)}
            disabled={running || csvText.trim().length === 0}
            className="inline-flex items-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Load prospects
          </button>
          <label className="inline-flex cursor-pointer items-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
            Upload .csv
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={running}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = ""; // allow re-uploading the same file
              }}
              className="hidden"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setCsvText(EXAMPLE_CSV);
              loadFromText(EXAMPLE_CSV);
            }}
            disabled={running}
            className="text-xs font-medium text-zinc-500 underline-offset-4 hover:text-zinc-800 hover:underline disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Use an example
          </button>
        </div>
        {loadError && (
          <p className="text-xs leading-5 text-rose-600 dark:text-rose-400">{loadError}</p>
        )}
        {truncated && (
          <p className="text-xs leading-5 text-amber-600 dark:text-amber-400">
            More than {MAX} rows — only the first {MAX} will run (public demo limit).
          </p>
        )}
      </div>

      <SellerContextPanel
        value={seller}
        onChange={setSeller}
        disabled={running}
        collapsed={sellerCollapsed}
        onToggle={() => setSellerCollapsed((c) => !c)}
      />

      {items.length > 0 && (
        <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {items.length} prospect{items.length === 1 ? "" : "s"}
            </h2>
            <button
              type="button"
              onClick={runBatch}
              disabled={running}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {running ? "Running…" : `Run ${items.length}`}
            </button>
          </div>

          <ol className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {items.map((it, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {it.prospect.name}
                  </span>
                  <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {it.prospect.company}
                  </span>
                </div>
                <RowStatusView status={it.status} />
              </li>
            ))}
          </ol>

          {anyDone && (
            <Link
              href="/dashboard"
              className="inline-flex w-fit items-center gap-2 text-sm font-medium text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
            >
              View all results in the dashboard →
            </Link>
          )}
        </div>
      )}
    </main>
  );
}

function RowStatusView({ status }: { status: RowStatus }) {
  if (status.state === "pending") {
    return <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">Queued</span>;
  }
  if (status.state === "running") {
    return (
      <span className="inline-flex shrink-0 items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        {status.stage ? STAGE_VERB[status.stage] ?? "running" : "starting"}…
      </span>
    );
  }
  if (status.state === "error") {
    return (
      <span className="shrink-0 text-right text-xs text-rose-600 dark:text-rose-400">
        {status.message}
      </span>
    );
  }
  return (
    <Link
      href={`/runs/${status.id}`}
      className="inline-flex shrink-0 items-center gap-2"
      title="Open this run"
    >
      <VerdictBadge verdict={status.verdict} size="sm" />
      <span className="text-xs text-zinc-400 underline-offset-2 hover:underline dark:text-zinc-500">
        {status.drafted ? "drafted" : "skipped"}
      </span>
    </Link>
  );
}
