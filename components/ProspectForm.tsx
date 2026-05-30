"use client";

import { useState } from "react";
import type { Prospect } from "@/lib/types";

// U9 — the prospect input. Controlled by the parent (which owns the value and
// the run lifecycle); this component just renders the fields and does the
// required-field check before letting a run start. Name + Company are required;
// Role and the identity hint are optional. The hint is used ONLY to identify the
// right person — never scraped (STRATEGY: compliant sources).

interface ProspectFormProps {
  value: Prospect;
  onChange: (next: Prospect) => void;
  onSubmit: () => void;
  disabled: boolean; // true while a run is active — locks the form
}

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:ring-zinc-800 dark:disabled:bg-zinc-800";

const labelClass =
  "block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

export function ProspectForm({
  value,
  onChange,
  onSubmit,
  disabled,
}: ProspectFormProps) {
  const [attempted, setAttempted] = useState(false);

  const nameMissing = value.name.trim() === "";
  const companyMissing = value.company.trim() === "";

  const set = (field: keyof Prospect, v: string) =>
    onChange({ ...value, [field]: v });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (nameMissing || companyMissing) return;
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className={labelClass}>
            Name <span className="text-rose-500">*</span>
          </label>
          <input
            id="name"
            className={inputClass}
            placeholder="e.g. Amy Hood"
            value={value.name}
            onChange={(e) => set("name", e.target.value)}
            disabled={disabled}
            aria-invalid={attempted && nameMissing}
          />
          {attempted && nameMissing && (
            <p className="text-xs text-rose-500">Name is required.</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="company" className={labelClass}>
            Company <span className="text-rose-500">*</span>
          </label>
          <input
            id="company"
            className={inputClass}
            placeholder="e.g. Microsoft"
            value={value.company}
            onChange={(e) => set("company", e.target.value)}
            disabled={disabled}
            aria-invalid={attempted && companyMissing}
          />
          {attempted && companyMissing && (
            <p className="text-xs text-rose-500">Company is required.</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="role" className={labelClass}>
            Role <span className="font-normal normal-case text-zinc-400">(optional)</span>
          </label>
          <input
            id="role"
            className={inputClass}
            placeholder="e.g. CFO"
            value={value.role ?? ""}
            onChange={(e) => set("role", e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="hint" className={labelClass}>
            LinkedIn / email{" "}
            <span className="font-normal normal-case text-zinc-400">(optional)</span>
          </label>
          <input
            id="hint"
            className={inputClass}
            placeholder="identity hint only — never scraped"
            value={value.hint ?? ""}
            onChange={(e) => set("hint", e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={disabled}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {disabled ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Running…
          </>
        ) : (
          "Analyze prospect"
        )}
      </button>

      <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        Runs are saved to a public dashboard visible to anyone with this link —
        don&apos;t enter confidential data.
      </p>
    </form>
  );
}
