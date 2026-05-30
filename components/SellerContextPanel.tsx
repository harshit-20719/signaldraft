"use client";

import type { SellerContext } from "@/lib/types";

// U9 — the seller-context panel (R2, KTD8). Pre-filled with the finance-ops
// defaults and editable, so relevance scoring stays grounded in who the rep is
// actually selling. Collapsible to give the live run view room; the parent owns
// the collapsed state so it can auto-collapse on submit. Value props are edited
// as one-per-line text and mapped to/from a string[].

interface SellerContextPanelProps {
  value: SellerContext;
  onChange: (next: SellerContext) => void;
  disabled: boolean;
  collapsed: boolean;
  onToggle: () => void;
}

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-800 dark:disabled:bg-zinc-800";

const labelClass =
  "block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

export function SellerContextPanel({
  value,
  onChange,
  disabled,
  collapsed,
  onToggle,
}: SellerContextPanelProps) {
  const set = (field: keyof SellerContext, v: string | string[]) =>
    onChange({ ...value, [field]: v });

  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex flex-col">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Seller context
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {value.company} · used to judge how relevant a signal is
          </span>
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {collapsed ? "Edit ▾" : "Hide ▴"}
        </span>
      </button>

      {!collapsed && (
        <div className="flex flex-col gap-4 border-t border-zinc-200 px-4 py-4 dark:border-zinc-800">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="seller-company" className={labelClass}>
              Your company
            </label>
            <input
              id="seller-company"
              className={inputClass}
              value={value.company}
              onChange={(e) => set("company", e.target.value)}
              disabled={disabled}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="seller-product" className={labelClass}>
              What you sell
            </label>
            <textarea
              id="seller-product"
              className={`${inputClass} min-h-[60px] resize-y`}
              value={value.product}
              onChange={(e) => set("product", e.target.value)}
              disabled={disabled}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="seller-valueprops" className={labelClass}>
              Value props{" "}
              <span className="font-normal normal-case text-zinc-400">
                (one per line)
              </span>
            </label>
            <textarea
              id="seller-valueprops"
              className={`${inputClass} min-h-[80px] resize-y`}
              value={value.valueProps.join("\n")}
              onChange={(e) =>
                set(
                  "valueProps",
                  e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                )
              }
              disabled={disabled}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="seller-buyer" className={labelClass}>
              Target buyer
            </label>
            <input
              id="seller-buyer"
              className={inputClass}
              value={value.targetBuyer}
              onChange={(e) => set("targetBuyer", e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>
      )}
    </section>
  );
}
