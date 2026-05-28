import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Project root, with a trailing slash (matches the "@/*" alias in tsconfig.json).
const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    // The judgment engine (lib/) is plain TypeScript — no DOM needed for its tests.
    environment: "node",
  },
  resolve: {
    // Mirror tsconfig's "@/*" -> "./*" so engine tests can import via "@/lib/...".
    // Regex form so it only rewrites "@/..." and never touches scoped packages
    // like "@anthropic-ai/sdk".
    alias: [{ find: /^@\//, replacement: root }],
  },
});
