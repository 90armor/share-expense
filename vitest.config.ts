import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolve the `@/*` alias from tsconfig.json (off by default in Vite).
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    // .claude/hooks: the PreToolUse guard's table test (docs/decisions.md › Guard hook).
    include: ["src/**/*.test.ts", ".claude/hooks/**/*.test.ts"],
  },
});
