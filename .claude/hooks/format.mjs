// @ts-check
// PostToolUse auto-format: after Edit/Write, run the project's Prettier on that
// one file. A convenience only; CI's format:check is the gate. It fails open:
// it always exits 0 with no output, so a formatting problem never blocks the
// agent or gives it anything to retry. Prettier itself skips ignored and
// unsupported files. Why and what it misses: docs/decisions.md › Format hook.
// Tests: format.test.ts next to this file.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

try {
  const env = process.env.CLAUDE_PROJECT_DIR;
  const file = JSON.parse(readFileSync(0, "utf8"))?.tool_input?.file_path;
  if (env && typeof file === "string" && path.isAbsolute(file)) {
    // Normalized (no trailing "/", "." or "//"), so the folder walk below
    // always reaches root exactly.
    const root = path.resolve(env);
    const rel = path.relative(root, path.resolve(file));
    const inside =
      rel !== "" &&
      rel !== ".." &&
      !rel.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(rel);
    if (inside) {
      const abs = path.join(root, rel);
      const prettier = path.join(
        root,
        "node_modules/prettier/bin/prettier.cjs",
      );
      // cwd = the checkout the file is in: the nearest folder up to root with a
      // .git (a worktree under .claude/worktrees/ has a .git file), so Prettier
      // reads that checkout's ./.gitignore and ./.prettierignore like
      // format:check there. A failed run (syntax error, missing Prettier,
      // timeout) leaves the file as the tool wrote it.
      let cwd = path.dirname(abs);
      while (cwd !== root && !existsSync(path.join(cwd, ".git"))) {
        cwd = path.dirname(cwd);
      }
      spawnSync(
        process.execPath,
        [
          prettier,
          "--write",
          "--ignore-unknown",
          "--no-error-on-unmatched-pattern",
          "--log-level=silent",
          "--",
          path.relative(cwd, abs),
        ],
        { cwd, stdio: "ignore", timeout: 8000 },
      );
    }
  }
} catch {
  // Fail open on purpose (unlike guard.mjs): bad input never blocks an edit.
}
process.exit(0);
