export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <div className="flex max-w-xl flex-col items-center gap-5">
        <span className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          v1 · in progress
        </span>
        <h1 className="text-5xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          SignalDraft
        </h1>
        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Finds a real, recent signal about a prospect, judges whether it is
          worth reaching out, and either drafts a grounded email or honestly
          recommends a skip.
        </p>
      </div>
    </main>
  );
}
