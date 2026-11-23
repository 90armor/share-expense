// Runs the PreToolUse guard the way Claude Code does: the hook JSON from the
// docs (code.claude.com/docs/en/hooks › Common input fields) on stdin, then
// the exit code decides. 2 = blocked (stderr is the reason), 0 = no decision.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const HOOK = fileURLToPath(new URL("./guard.mjs", import.meta.url));

// Two throwaway repos with the same history: one checked out on main, one on
// feat/x. Rows that depend on the current branch name the repo they run in;
// every other row runs in "feat".
type Repo = "main" | "feat";
const repos: Record<Repo, string> = { main: "", feat: "" };

function git(dir: string, ...args: string[]) {
  execFileSync(
    "git",
    [
      "-C",
      dir,
      "-c",
      "user.name=guard-test",
      "-c",
      "user.email=guard-test@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "-c",
      "core.hooksPath=/dev/null",
      ...args,
    ],
    { stdio: "ignore" },
  );
}

function makeRepo(branch: Repo): string {
  const dir = mkdtempSync(path.join(tmpdir(), "guard-hook-"));
  git(dir, "init", "-q", "-b", "main");
  writeFileSync(path.join(dir, "a.txt"), "a\n");
  git(dir, "add", "a.txt");
  git(dir, "commit", "-q", "-m", "init");
  git(dir, "branch", "feat/x");
  // A branch that exists only on the remote, for `git checkout <name>` DWIM.
  // The remote URL is never contacted.
  git(dir, "remote", "add", "origin", "https://example.invalid/repo.git");
  git(dir, "update-ref", "refs/remotes/origin/feat/remote-only", "HEAD");
  if (branch === "feat") git(dir, "switch", "-q", "feat/x");
  return dir;
}

beforeAll(() => {
  repos.main = makeRepo("main");
  repos.feat = makeRepo("feat");
});

afterAll(() => {
  for (const dir of Object.values(repos)) {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

type Row = {
  label: string;
  tool: string;
  toolInput: Record<string, unknown>;
  repo: Repo;
};

const bash = (command: string, repo: Repo = "feat"): Row => ({
  label: `Bash[${repo}] ${JSON.stringify(command)}`,
  tool: "Bash",
  toolInput: { command, description: "test" },
  repo,
});

const tool = (name: string, toolInput: Record<string, unknown>): Row => ({
  label: `${name} ${JSON.stringify(toolInput)}`,
  tool: name,
  toolInput,
  repo: "feat",
});

function runHook(stdin: string) {
  const result = spawnSync(process.execPath, [HOOK], {
    input: stdin,
    encoding: "utf8",
    timeout: 10_000,
  });
  return { status: result.status, stderr: result.stderr };
}

function run(row: Row) {
  return runHook(
    JSON.stringify({
      session_id: "guard-test",
      transcript_path: "/tmp/guard-test.jsonl",
      cwd: repos[row.repo],
      permission_mode: "default",
      hook_event_name: "PreToolUse",
      tool_name: row.tool,
      tool_input: row.toolInput,
      tool_use_id: "toolu_guard_test",
    }),
  );
}

const BLOCK: Row[] = [
  // rm -rf, any flag form, wrapped or chained
  bash("rm -rf build"),
  bash("rm -fr build"),
  bash("rm -r -f build"),
  bash("rm --recursive --force build"),
  bash("rm -Rf b"),
  bash("rm -rfv b"),
  bash("\\rm -rf b"),
  bash("/bin/rm -rf b"),
  bash("command rm -rf b"),
  bash("sudo rm -rf b"),
  bash("env FOO=1 rm -rf b"),
  bash("FOO=1 rm -rf b"),
  bash("timeout 5 rm -rf b"),
  bash("ls && rm -rf b"),
  bash("true; rm -rf b"),
  bash("(rm -rf b)"),
  bash("echo $(rm -rf b)"),
  bash("echo `rm -rf b`"),
  bash('bash -c "rm -rf b"'),
  bash("sh -c 'cd /tmp && rm -rf b'"),
  bash('eval "rm -rf b"'),
  bash("find . -name y -exec rm -rf {} +"),
  bash("ls | xargs rm -rf"),
  bash("if true; then rm -rf b; fi"),
  bash("bash <<'EOF'\nrm -rf b\nEOF"),
  bash("rm -r --forc b"),
  bash("rm --rec -f b"),
  bash("bash -c -x 'rm -rf b'"),
  bash("bash -c -- 'rm -rf b'"),
  bash("function f { rm -rf b; }; f"),
  bash("env -S'rm -rf b'"),
  bash("env --split-string='rm -rf b'"),

  // force push, and any push that lands on main
  bash("git push --force"),
  bash("git push -f origin feat/x"),
  bash("git push -uf origin feat/x"),
  bash("git push --force-with-lease origin feat/x"),
  bash("git push --force-with-lease=feat/x origin feat/x"),
  bash("git push origin +feat/x"),
  bash("git push origin main"),
  bash("git push upstream main"),
  bash("git push origin HEAD:main"),
  bash("git push origin feat/x:refs/heads/main"),
  bash("git push origin :main"),
  bash("git push origin --delete main"),
  bash("git push --all"),
  bash("git push --mirror"),
  bash("git -C . push origin main"),
  bash("git push", "main"),
  bash("git push origin", "main"),
  bash("git push -u origin HEAD", "main"),
  bash("git push origin @", "main"),
  // git accepts any unambiguous prefix of a long option
  bash("git push --force-w origin feat/x"),
  bash("git push --mirr"),
  bash("git --config-env foo=BAR push --force"),

  // commit or merge while on main
  bash('git commit -m "fix: x"', "main"),
  bash("git commit --amend --no-edit", "main"),
  bash("git merge feat/x", "main"),

  // gh pr merge, any form
  bash("gh pr merge 41 --squash"),
  bash("gh pr merge"),
  bash("gh pr merge -R 90armor/share-expense 41 --auto --squash"),

  // throwing away tracked or untracked work
  bash("git reset --hard"),
  bash("git reset --hard HEAD~1"),
  bash("git checkout -- a.txt"),
  bash("git checkout ."),
  bash("git checkout a.txt"),
  bash("git checkout main -- a.txt"),
  bash("git checkout -f feat/x"),
  bash("git switch -f main"),
  bash("git switch --discard-changes main"),
  bash("git restore a.txt"),
  bash("git restore --worktree a.txt"),
  bash("git restore -SW a.txt"),
  bash("git restore --staged --worktree a.txt"),
  bash("git clean -fd"),
  bash("git clean -xdf"),
  bash("git clean --force"),
  bash("git rm -rf src"),
  bash("git reset --har HEAD~1"),
  bash("git clean --forc -d"),
  bash("git switch --discard main"),
  bash("git rm -r --forc src"),
  bash("git restore --staged --work a.txt"),
  bash("git checkout --pathspec-from-file=list.txt"),

  // .env through the file tools
  tool("Read", { file_path: "/r/.env" }),
  tool("Read", { file_path: "/r/.env.local" }),
  tool("Read", { file_path: "/r/.env.development.local" }),
  tool("Read", { file_path: "/r/sub/.env" }),
  tool("Read", { file_path: "/r/.env.staging" }),
  tool("Grep", { pattern: "KEY", path: "/r/.env" }),
  tool("Grep", { pattern: "KEY", glob: ".env*" }),
  // A Grep glob overrides .gitignore: measured, glob "*" searched a
  // gitignored .env while no glob skipped it (docs/decisions.md › Guard hook).
  tool("Grep", { pattern: "KEY", glob: "*" }),
  tool("Grep", { pattern: "KEY", glob: "**/*" }),
  tool("Grep", { pattern: "KEY", glob: "*.env" }),
  tool("Grep", { pattern: "KEY", glob: "*.development" }),
  tool("Glob", { pattern: "**/.env*" }),
  tool("Glob", { pattern: ".env.local" }),

  // .env through Bash
  bash("cat .env"),
  bash("head -5 .env.local"),
  bash("less .env"),
  bash("source .env"),
  bash(". ./.env"),
  bash("cp .env /tmp/x"),
  bash("cat < .env"),
  bash("cat<.env"),
  bash("cat .en''v"),
  bash("cat .env*"),
  bash("cat .e*"),
  bash("cat .*nt"),
  bash("cat {.env,x}"),
  bash("grep KEY .env"),
  bash("awk 1 .env"),
  bash("bash -c 'cat .env'"),
  bash(`node -e "require('fs').readFileSync('.env','utf8')"`),
  bash(`python3 -c "print(open('.env').read())"`),
  bash(
    "node <<'EOF'\nconsole.log(require('fs').readFileSync('.env', 'utf8'))\nEOF",
  ),
  bash("docker compose --env-file .env up"),
  tool("Monitor", {
    command: "tail -f .env",
    description: "test",
    timeout_ms: 1000,
  }),
];

const ALLOW: Row[] = [
  tool("Read", { file_path: "/r/.env.example" }),
  tool("Read", { file_path: "/r/src/lib/env.ts" }),
  tool("Grep", { pattern: "\\.env", path: "/r/src" }),
  tool("Grep", { pattern: "KEY", glob: "*.ts" }),
  tool("Grep", { pattern: "KEY", glob: "src/**/*.{ts,tsx}" }),
  // Glob returns names only, never contents.
  tool("Glob", { pattern: "*" }),
  tool("Glob", { pattern: "**/*.ts" }),
  tool("Glob", { pattern: ".env.example" }),

  bash("cat .env.example"),
  bash("cat src/lib/env.ts"),
  bash(`node -e "console.log(process.env.HOME)"`),
  bash("rm -r somedir"),
  bash("rm -f file"),
  bash("rm file"),
  bash("rmdir d"),
  // A shell `*` skips dotfiles; only the Grep tool's glob is strict.
  bash("echo a=*"),

  // the dangerous text is only data
  bash('git commit -m "chore: never run rm -rf"'),
  bash('echo "git push --force"'),
  bash(
    "git commit -m \"$(cat <<'EOF'\nchore: block rm -rf, git push --force and .env reads\n\nDon't merge with gh pr merge.\nEOF\n)\"",
  ),
  bash("git log --grep=force"),

  bash("git push origin feat/x"),
  bash("git push -u origin feat/x"),
  bash("git push origin main:feat/y"),
  bash("git push --follow-tags origin feat/x"),
  bash("git push --force-if-includes origin feat/x"),
  bash("bash -c 'echo hi' -x"),
  bash("git push", "feat"),
  bash("git push origin HEAD", "feat"),

  bash('git commit -m "feat: x"', "feat"),
  bash("git merge main", "feat"),

  bash("gh pr view 41"),
  bash('gh pr create --title "chore: x" --body "y"'),
  bash("gh pr checks 41"),

  bash("git checkout -b feat/y"),
  bash("git checkout feat/x"),
  bash("git checkout main"),
  bash("git checkout feat/remote-only"),
  bash("git checkout -"),
  bash("git switch feat/x"),
  bash("git switch -c feat/y"),
  bash("git restore --staged a.txt"),
  bash("git restore -S a.txt"),
  bash("git reset HEAD a.txt"),
  bash("git reset --soft HEAD~1"),
  bash("git clean -n"),
  bash("git status"),
  bash("npm run test"),
  tool("Monitor", {
    command: "tail -f dev.log",
    description: "test",
    timeout_ms: 1000,
  }),
  tool("Edit", { file_path: "/r/.env", old_string: "a", new_string: "b" }),
];

describe("guard hook blocks with exit 2 and a reason on stderr", () => {
  it.each(BLOCK.map((row) => [row.label, row] as const))("%s", (_, row) => {
    const { status, stderr } = run(row);
    expect(status).toBe(2);
    expect(stderr).toMatch(/^Blocked by \.claude\/hooks\/guard\.mjs: /);
  });
});

describe("guard hook allows with exit 0 and no output", () => {
  it.each(ALLOW.map((row) => [row.label, row] as const))("%s", (_, row) => {
    const { status, stderr } = run(row);
    expect(stderr).toBe("");
    expect(status).toBe(0);
  });
});

describe("guard hook fails closed", () => {
  it("blocks a command it cannot parse", () => {
    const { status, stderr } = run(bash('echo "unterminated'));
    expect(status).toBe(2);
    expect(stderr).toContain("could not parse");
  });

  it("blocks when its own input is not JSON", () => {
    const { status, stderr } = runHook("not json");
    expect(status).toBe(2);
    expect(stderr).toContain("the guard itself failed");
  });
});
