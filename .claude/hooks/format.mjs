// @ts-check
// PostToolUse auto-format: after Edit/Write, run the project's Prettier on that
// one file. A convenience only; CI's format:check is the gate. It fails open:
// it always exits 0 with no output, so a formatting problem never blocks the
// agent or gives it anything to retry. Prettier itself skips ignored and
// unsupported files. Why and what it misses: docs/decisions.md › Format hook.
// Tests: format.test.ts next to this file.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

try {
  const root = process.env.CLAUDE_PROJECT_DIR;
  const file = JSON.parse(readFileSync(0, "utf8"))?.tool_input?.file_path;
  if (root && typeof file === "string" && path.isAbsolute(file)) {
    const rel = path.relative(root, path.resolve(file));
    const inside =
      rel !== "" &&
      rel !== ".." &&
      !rel.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(rel);
    if (inside) {
      const prettier = path.join(
        root,
        "node_modules/prettier/bin/prettier.cjs",
      );
      // cwd = root, so Prettier reads ./.gitignore and ./.prettierignore like
      // format:check. A failed run (syntax error, missing Prettier, timeout)
      // leaves the file as the tool wrote it.
      spawnSync(
        process.execPath,
        [
          prettier,
          "--write",
          "--ignore-unknown",
          "--no-error-on-unmatched-pattern",
          "--log-level=silent",
          "--",
          rel,
        ],
        { cwd: root, stdio: "ignore", timeout: 8000 },
      );
    }
  }
} catch {
  // Fail open on purpose (unlike guard.mjs): bad input never blocks an edit.
}
process.exit(0);
