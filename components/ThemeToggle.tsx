"use client";

// P3 — the light/dark toggle. The trick that keeps this simple and bug-free: the
// icon shown is driven PURELY by the `.dark` class via CSS (sun in light, moon in
// dark), so there is no React state for the theme and therefore no server/client
// hydration mismatch — the button renders identically on the server and client,
// and only CSS decides which icon is visible. A click reads the current theme off
// <html>, flips it, and remembers the choice in localStorage. The matching init
// script in layout.tsx applies the saved (or system) choice before first paint,
// so there is no flash.

function applyTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // private mode / storage disabled: the toggle still works for this session.
  }
}

export function ThemeToggle() {
  return (
    <button
      type="button"
      aria-label="Toggle light and dark mode"
      title="Toggle light / dark"
      onClick={() => {
        const isDark = document.documentElement.classList.contains("dark");
        applyTheme(isDark ? "light" : "dark");
      }}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      {/* Sun — shown in light mode */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        aria-hidden="true"
        className="block h-4 w-4 dark:hidden"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
        />
      </svg>
      {/* Moon — shown in dark mode */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        aria-hidden="true"
        className="hidden h-4 w-4 dark:block"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21.752 15.002A9.718 9.718 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
        />
      </svg>
    </button>
  );
}
