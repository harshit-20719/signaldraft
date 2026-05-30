import { describe, it, expect } from "vitest";
import {
  queryRuns,
  isFiltering,
  DEFAULT_QUERY,
  type RunQuery,
} from "@/lib/runQuery";
import type { Draft, RunRecord, Verdict } from "@/lib/types";

// Build a RunRecord with only the fields queryRuns cares about; the rest get
// harmless defaults. draft defaults to present for HIGH/MEDIUM and null for SKIP
// (the real invariant), but can be overridden to exercise the draftless edge.
function makeRun(o: {
  name: string;
  company: string;
  verdict: Verdict;
  createdAt: string;
  draft?: Draft | null;
}): RunRecord {
  const draft =
    o.draft !== undefined
      ? o.draft
      : o.verdict === "SKIP"
        ? null
        : { subject: "s", body: "b" };
  return {
    id: o.name,
    createdAt: o.createdAt,
    prospect: { name: o.name, company: o.company },
    seller: { company: "Zamp", product: "p", valueProps: [], targetBuyer: "t" },
    verdict: o.verdict,
    signals: [],
    draft,
    flags: [],
    timings: { startedAt: 0, finishedAt: 0, durationMs: 0 },
  };
}

const q = (over: Partial<RunQuery>): RunQuery => ({ ...DEFAULT_QUERY, ...over });
const names = (runs: RunRecord[]) => runs.map((r) => r.prospect.name);

// A small fixture set spanning tiers, draft state, names, companies and dates.
const A = makeRun({ name: "Amy Hood", company: "Microsoft", verdict: "MEDIUM", createdAt: "2026-05-03T00:00:00Z" });
const B = makeRun({ name: "Bob Lee", company: "Acme", verdict: "HIGH", createdAt: "2026-05-01T00:00:00Z" });
const C = makeRun({ name: "Cara Diaz", company: "Zeta", verdict: "SKIP", createdAt: "2026-05-02T00:00:00Z" });
const D = makeRun({ name: "Dan Park", company: "Beta", verdict: "HIGH", createdAt: "2026-05-05T00:00:00Z" });
const ALL = [A, B, C, D];

describe("queryRuns — filtering", () => {
  it("returns [] for an empty input", () => {
    expect(queryRuns([], DEFAULT_QUERY)).toEqual([]);
  });

  it("filters by tier", () => {
    // HIGH runs are B and D; default sort is newest-first, so D before B.
    expect(names(queryRuns(ALL, q({ tier: "HIGH" })))).toEqual(["Dan Park", "Bob Lee"]);
    expect(names(queryRuns(ALL, q({ tier: "MEDIUM" })))).toEqual(["Amy Hood"]);
    expect(names(queryRuns(ALL, q({ tier: "SKIP" })))).toEqual(["Cara Diaz"]);
  });

  it("filters by drafted vs skipped status", () => {
    // SKIP (C) has no draft; the other three do.
    expect(names(queryRuns(ALL, q({ status: "skipped" })))).toEqual(["Cara Diaz"]);
    expect(new Set(names(queryRuns(ALL, q({ status: "drafted" }))))).toEqual(
      new Set(["Amy Hood", "Bob Lee", "Dan Park"]),
    );
  });

  it("treats a draftless HIGH/MEDIUM as skipped (matches the Status column)", () => {
    const draftless = makeRun({ name: "Eve Ng", company: "Xeno", verdict: "HIGH", createdAt: "2026-05-04T00:00:00Z", draft: null });
    expect(names(queryRuns([draftless], q({ status: "skipped" })))).toEqual(["Eve Ng"]);
    expect(queryRuns([draftless], q({ status: "drafted" }))).toEqual([]);
  });

  it("searches prospect name and company, case-insensitively", () => {
    expect(names(queryRuns(ALL, q({ search: "micro" })))).toEqual(["Amy Hood"]); // company
    expect(names(queryRuns(ALL, q({ search: "lee" })))).toEqual(["Bob Lee"]); // name
    expect(names(queryRuns(ALL, q({ search: "AMY" })))).toEqual(["Amy Hood"]); // case
  });

  it("combines filters (AND), returning [] when nothing matches", () => {
    // Zeta is a SKIP, so requiring HIGH + "zeta" matches nothing.
    expect(queryRuns(ALL, q({ tier: "HIGH", search: "zeta" }))).toEqual([]);
  });
});

describe("queryRuns — sorting", () => {
  it("defaults to newest-first by date", () => {
    expect(names(queryRuns(ALL, DEFAULT_QUERY))).toEqual(["Dan Park", "Amy Hood", "Cara Diaz", "Bob Lee"]);
  });

  it("sorts by prospect name both directions", () => {
    expect(names(queryRuns(ALL, q({ sortKey: "prospect", sortDir: "asc" })))).toEqual(["Amy Hood", "Bob Lee", "Cara Diaz", "Dan Park"]);
    expect(names(queryRuns(ALL, q({ sortKey: "prospect", sortDir: "desc" })))).toEqual(["Dan Park", "Cara Diaz", "Bob Lee", "Amy Hood"]);
  });

  it("sorts by company", () => {
    expect(names(queryRuns(ALL, q({ sortKey: "company", sortDir: "asc" })))).toEqual(["Bob Lee", "Dan Park", "Amy Hood", "Cara Diaz"]); // Acme, Beta, Microsoft, Zeta
  });

  it("sorts by tier with HIGH first when ascending", () => {
    // HIGH (D,B) then MEDIUM (A) then SKIP (C); within HIGH, newest-first tiebreak => D before B.
    expect(names(queryRuns(ALL, q({ sortKey: "tier", sortDir: "asc" })))).toEqual(["Dan Park", "Bob Lee", "Amy Hood", "Cara Diaz"]);
  });

  it("sorts by date ascending (oldest first)", () => {
    expect(names(queryRuns(ALL, q({ sortKey: "when", sortDir: "asc" })))).toEqual(["Bob Lee", "Cara Diaz", "Amy Hood", "Dan Park"]);
  });

  it("breaks ties on the sort key with newest-first (stable)", () => {
    // Two HIGHs sorted by tier are tied on the key; the newer (Dan, 05-05) wins.
    const highs = queryRuns([B, D], q({ sortKey: "tier", sortDir: "asc" }));
    expect(names(highs)).toEqual(["Dan Park", "Bob Lee"]);
  });
});

describe("isFiltering", () => {
  it("is false for the default query and true once any filter is set", () => {
    expect(isFiltering(DEFAULT_QUERY)).toBe(false);
    expect(isFiltering(q({ search: "   " }))).toBe(false); // whitespace only
    expect(isFiltering(q({ tier: "HIGH" }))).toBe(true);
    expect(isFiltering(q({ status: "skipped" }))).toBe(true);
    expect(isFiltering(q({ search: "amy" }))).toBe(true);
  });
});
