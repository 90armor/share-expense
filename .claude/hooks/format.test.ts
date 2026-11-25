// Runs the PostToolUse format hook the way Claude Code does: the hook JSON
// (code.claude.com/docs/en/hooks › PostToolUse input) on stdin, with
// CLAUDE_PROJECT_DIR set. The hook must always exit 0 with no output; the file
// on disk shows whether Prettier ran.
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const HOOK = fileURLToPath(new URL("./format.mjs", import.meta.url));
const REPO = fileURLToPath(new URL("../..", import.meta.url));

const UGLY = "const a = {b:1,c:'x'}\n";
const PRETTY = 'const a = { b: 1, c: "x" };\n';
const BROKEN = "const a = {\n";

// root: a fake project using the repo's Prettier (node_modules symlink) and
// config. bare: a project without node_modules. other: outside any root.
// sibling: `<root>-other`, which a plain startsWith(root) would treat as inside.
const dirs = { root: "", bare: "", other: "", sibling: "" };

beforeAll(() => {
  dirs.root = mkdtempSync(path.join(tmpdir(), "format-hook-"));
  dirs.bare = mkdtempSync(path.join(tmpdir(), "format-hook-bare-"));
  dirs.other = mkdtempSync(path.join(tmpdir(), "format-hook-other-"));
  dirs.sibling = `${dirs.root}-other`;
  mkdirSync(dirs.sibling);
  symlinkSync(
    path.join(REPO, "node_modules"),
    path.join(dirs.root, "node_modules"),
  );
  for (const root of [dirs.root, dirs.bare]) {
    copyFileSync(
      path.join(REPO, ".prettierrc.json"),
      path.join(root, ".prettierrc.json"),
    );
    writeFileSync(path.join(root, ".prettierignore"), "generated\n");
  }
});

afterAll(() => {
  for (const dir of Object.values(dirs)) {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function runHook(stdin: string, root = dirs.root) {
  const { status, stdout, stderr } = spawnSync(process.execPath, [HOOK], {
    input: stdin,
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
  });
  return { status, stdout, stderr };
}

type Row = {
  label: string;
  tool: "Edit" | "Write";
  // Where the file lives; `file` is joined to it (may contain "..").
  base: keyof typeof dirs;
  file: string;
  content: string;
  expected: string;
  root?: keyof typeof dirs;
};

const ROWS: Row[] = [
  {
    label: "formats an edited .ts file in the repo",
    tool: "Edit",
    base: "root",
    file: "src/a.ts",
    content: UGLY,
    expected: PRETTY,
  },
  {
    label: "formats a written .ts file in the repo",
    tool: "Write",
    base: "root",
    file: "src/b.ts",
    content: UGLY,
    expected: PRETTY,
  },
  {
    label: "formats a path with glob characters ([id]) as a literal path",
    tool: "Edit",
    base: "root",
    file: "src/app/[id]/page.tsx",
    content: UGLY,
    expected: PRETTY,
  },
  {
    label: "skips a .prettierignore path",
    tool: "Edit",
    base: "root",
    file: "generated/c.ts",
    content: UGLY,
    expected: UGLY,
  },
  {
    label: "skips an unsupported file type",
    tool: "Edit",
    base: "root",
    file: "notes.xyz",
    content: UGLY,
    expected: UGLY,
  },
  {
    label: "leaves a file with a syntax error as written",
    tool: "Edit",
    base: "root",
    file: "src/broken.ts",
    content: BROKEN,
    expected: BROKEN,
  },
  {
    label: "skips a file outside the repo",
    tool: "Edit",
    base: "other",
    file: "d.ts",
    content: UGLY,
    expected: UGLY,
  },
  {
    label: "skips <root>-other (shares the root's string prefix)",
    tool: "Edit",
    base: "sibling",
    file: "e.ts",
    content: UGLY,
    expected: UGLY,
  },
  {
    label: "skips <root>/../outside (traversal)",
    tool: "Edit",
    base: "root",
    file: "", // filled in below: ../<basename of other>/f.ts
    content: UGLY,
    expected: UGLY,
  },
  {
    label: "leaves the file as written when Prettier is not installed",
    tool: "Edit",
    base: "bare",
    file: "src/g.ts",
    content: UGLY,
    expected: UGLY,
    root: "bare",
  },
];

describe("format hook always exits 0 with no output", () => {
  it.each(ROWS.map((row) => [row.label, row] as const))("%s", (_, row) => {
    const rel = row.file || path.join("..", path.basename(dirs.other), "f.ts");
    // Unnormalized on purpose for the traversal row (`<root>/../…`).
    const file = `${dirs[row.base]}${path.sep}${rel}`;
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, row.content);
    const toolInput =
      row.tool === "Write"
        ? { file_path: file, content: row.content }
        : { file_path: file, old_string: "x", new_string: "x" };
    const { status, stdout, stderr } = runHook(
      JSON.stringify({
        hook_event_name: "PostToolUse",
        tool_name: row.tool,
        tool_input: toolInput,
        tool_response: { filePath: file },
        cwd: dirs.root,
      }),
      dirs[row.root ?? "root"],
    );
    expect({ status, stdout, stderr }).toEqual({
      status: 0,
      stdout: "",
      stderr: "",
    });
    expect(readFileSync(file, "utf8")).toBe(row.expected);
  });

  it("exits 0 when its own input is not JSON", () => {
    expect(runHook("not json")).toEqual({ status: 0, stdout: "", stderr: "" });
  });
});
