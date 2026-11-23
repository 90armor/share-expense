// @ts-check
// PreToolUse guard for CLAUDE.md › Absolute Don'ts. Claude Code sends the hook
// JSON on stdin; exit 2 blocks the tool call (stderr is the reason Claude
// sees), exit 0 leaves it to the normal permission flow. Any error inside the
// guard also exits 2 (fail closed). What it matches and what it cannot catch:
// docs/decisions.md › Guard hook. Tests: guard.test.ts next to this file.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

/** @typedef {{ words: string[], redirects: string[], heredocs: string[], hereStrings: string[] }} Command */
/** @typedef {{ cwd: string }} Context */

const EXIT_BLOCK = 2;
const MAX_DEPTH = 5;
const SELF = ".claude/hooks/guard.mjs";

class Block extends Error {}
class ParseError extends Error {}

// ---------------------------------------------------------------- .env files

/** Same rule as .gitignore (`.env*`, `!.env.example`). @param {string} name */
const isEnvName = (name) => name.startsWith(".env") && name !== ".env.example";
// Globs are tested against these names, so a glob that matches only some
// other env name (e.g. `.*ging` for `.env.staging`) is not caught.
const ENV_SAMPLES = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.test",
  ".env.development.local",
  ".env.production.local",
  ".env.test.local",
  ".env.staging",
];
// `.env` inside code, not after a word character (so `process.env` is fine).
const ENV_IN_CODE = /(^|[^\w.-])\.env(?!\.example(?![\w.-]))/;
const ENV_HINT =
  'to search for the text ".env", use the Grep tool (its pattern is not checked)';

/** @param {string} text @returns {string[]} */
function braceExpand(text, limit = 64) {
  const match = /\{([^{}]*,[^{}]*)\}/.exec(text);
  if (!match) return [text];
  const out = [];
  for (const part of match[1].split(",")) {
    const joined =
      text.slice(0, match.index) +
      part +
      text.slice(match.index + match[0].length);
    for (const expanded of braceExpand(joined, limit)) {
      out.push(expanded);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** @param {string} glob */
function globToRegex(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    const close = c === "[" ? glob.indexOf("]", i + 2) : -1;
    if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else if (close > i) {
      const set = glob.slice(i + 1, close).replace(/^!/, "^");
      re += `[${set.replace(/\\/g, "\\\\")}]`;
      i = close;
    } else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

/**
 * True when a path, or a glob, names or may match an env file. By default a
 * glob counts only if its last segment starts with "." or contains "env"
 * (shell globs skip dotfiles, so `cat *` is fine). `strict` counts every glob
 * that matches, for the Grep tool, whose glob overrides .gitignore.
 * @param {unknown} text
 */
function mayNameEnvFile(text, strict = false) {
  if (typeof text !== "string" || text === "") return false;
  for (const alt of braceExpand(text)) {
    const segment = alt.split("/").pop();
    if (!segment) continue;
    if (isEnvName(segment)) return true;
    if (
      /[*?[]/.test(segment) &&
      (strict || segment.startsWith(".") || segment.includes("env")) &&
      ENV_SAMPLES.some((name) => globToRegex(segment).test(name))
    )
      return true;
  }
  return false;
}

/** @param {string} word */
function checkEnvWord(word) {
  const eq = word.indexOf("=");
  const candidates = eq >= 0 ? [word, word.slice(eq + 1)] : [word];
  if (candidates.some((candidate) => mayNameEnvFile(candidate)))
    throw new Block(`reads an env file (${word}); ${ENV_HINT}`);
}

// ---------------------------------------------------------------- shell parser

/**
 * Splits a script into simple commands, with quotes removed. Commands inside
 * $(...), `...` and <(...) are added to the same list. Unterminated quotes or
 * heredocs throw a ParseError.
 * @param {string} src
 */
function parseScript(src) {
  /** @type {Command[]} */
  const commands = [];
  /** @type {{ delimiter: string, stripTabs: boolean, command: Command }[]} */
  const heredocQueue = [];
  let pos = 0;

  function readHeredocBodies() {
    for (let h = heredocQueue.shift(); h; h = heredocQueue.shift()) {
      const lines = [];
      for (;;) {
        if (pos >= src.length)
          throw new ParseError(`heredoc ${h.delimiter} is not closed`);
        const nl = src.indexOf("\n", pos);
        const end = nl === -1 ? src.length : nl;
        const line = src.slice(pos, end);
        pos = end + 1;
        if ((h.stripTabs ? line.replace(/^\t+/, "") : line) === h.delimiter)
          break;
        lines.push(line);
      }
      h.command.heredocs.push(lines.join("\n"));
    }
  }

  /** @type {Record<string, string>} */
  const ESCAPES = { n: "\n", t: "\t", r: "\r" };

  /** pos is at "$". @returns {string} */
  function readDollar() {
    const next = src[pos + 1];
    if (next === "'") {
      pos += 2;
      let out = "";
      for (;;) {
        if (pos >= src.length) throw new ParseError("unterminated $'...'");
        const c = src[pos];
        if (c === "'") {
          pos++;
          return out;
        }
        if (c === "\\") {
          const e = src[pos + 1] ?? "";
          const hex = /^x([0-9a-fA-F]{1,2})/.exec(src.slice(pos + 1, pos + 4));
          const oct = /^0?([0-7]{1,3})/.exec(src.slice(pos + 1, pos + 5));
          if (hex) {
            out += String.fromCharCode(parseInt(hex[1], 16));
            pos += 1 + hex[0].length;
          } else if (oct) {
            out += String.fromCharCode(parseInt(oct[1], 8));
            pos += 1 + oct[0].length;
          } else {
            out += ESCAPES[e] ?? e;
            pos += 2;
          }
          continue;
        }
        out += c;
        pos++;
      }
    }
    if (next === "(") {
      pos += 2;
      parseSequence(")");
      return "$()";
    }
    if (next === "{") {
      const close = src.indexOf("}", pos);
      if (close === -1) throw new ParseError("unterminated ${");
      const text = src.slice(pos, close + 1);
      pos = close + 1;
      return text;
    }
    pos++;
    return "$";
  }

  function readDoubleQuoted() {
    pos++; // opening "
    let out = "";
    for (;;) {
      if (pos >= src.length) throw new ParseError('unterminated "');
      const c = src[pos];
      if (c === '"') {
        pos++;
        return out;
      }
      if (c === "\\" && '$`"\\\n'.includes(src[pos + 1])) {
        if (src[pos + 1] !== "\n") out += src[pos + 1];
        pos += 2;
      } else if (c === "$") out += readDollar();
      else if (c === "`") {
        pos++;
        parseSequence("`");
        out += "$()";
      } else {
        out += c;
        pos++;
      }
    }
  }

  /** @param {string | null} terminator */
  function parseSequence(terminator) {
    /** @returns {Command} */
    const newCommand = () => ({
      words: [],
      redirects: [],
      heredocs: [],
      hereStrings: [],
    });
    let command = newCommand();
    /** @type {string | null} */
    let word = null;
    /** @type {null | "redirect" | "hereString" | { heredoc: boolean }} */
    let pending = null;
    let parenDepth = 0;

    const endWord = () => {
      if (word === null) return;
      if (pending === "redirect") command.redirects.push(word);
      else if (pending === "hereString") command.hereStrings.push(word);
      else if (pending)
        heredocQueue.push({
          delimiter: word,
          stripTabs: pending.heredoc,
          command,
        });
      else command.words.push(word);
      pending = null;
      word = null;
    };
    const endCommand = () => {
      endWord();
      const { words, redirects, heredocs, hereStrings } = command;
      if (
        words.length ||
        redirects.length ||
        heredocs.length ||
        hereStrings.length
      )
        commands.push(command);
      // A heredoc registered for this command still fills it later.
      command = newCommand();
      pending = null;
    };
    /** @param {string} text */
    const append = (text) => {
      word = (word ?? "") + text;
    };

    while (pos < src.length) {
      const c = src[pos];
      const two = src.slice(pos, pos + 2);
      if (
        terminator &&
        c === terminator &&
        (terminator !== ")" || parenDepth === 0)
      ) {
        endCommand();
        pos++;
        return;
      }
      if (c === " " || c === "\t") {
        endWord();
        pos++;
      } else if (c === "\n") {
        endCommand();
        pos++;
        readHeredocBodies();
      } else if (c === "#" && word === null) {
        while (pos < src.length && src[pos] !== "\n") pos++;
      } else if (c === "\\") {
        if (src[pos + 1] !== "\n") append(src[pos + 1] ?? "");
        pos += 2;
      } else if (c === "'") {
        const close = src.indexOf("'", pos + 1);
        if (close === -1) throw new ParseError("unterminated '");
        append(src.slice(pos + 1, close));
        pos = close + 1;
      } else if (c === '"') {
        append(readDoubleQuoted());
      } else if (c === "$") {
        append(readDollar());
      } else if (c === "`") {
        pos++;
        parseSequence("`");
        append("$()");
      } else if ((c === "<" || c === ">") && src[pos + 1] === "(") {
        pos += 2;
        parseSequence(")");
        append("$()");
      } else if (c === "<" || c === ">" || two === "&>") {
        if (word !== null && /^\d+$/.test(word)) word = null; // fd number
        endWord();
        const op = /** @type {RegExpExecArray} */ (
          /^(<<<|<<-|<<|&>>|&>|>>|>&|<&|<>|>\||<|>)/.exec(src.slice(pos))
        )[0];
        pos += op.length;
        if (op === "<<<") pending = "hereString";
        else if (op === "<<" || op === "<<-")
          pending = { heredoc: op === "<<-" };
        else pending = "redirect";
      } else if (c === ";" || c === "|" || c === "&") {
        endCommand();
        pos += ["&&", "||", "|&", ";;"].includes(two) ? 2 : 1;
      } else if (c === "(") {
        parenDepth++;
        endCommand();
        pos++;
      } else if (c === ")") {
        if (parenDepth > 0) parenDepth--;
        endCommand();
        pos++;
      } else {
        append(c);
        pos++;
      }
    }
    if (terminator) throw new ParseError(`missing ${terminator}`);
    endCommand();
  }

  parseSequence(null);
  if (heredocQueue.length)
    throw new ParseError(`heredoc ${heredocQueue[0].delimiter} is not closed`);
  return commands;
}

// ---------------------------------------------------------------- commands

const RESERVED = new Set([
  "if",
  "then",
  "else",
  "elif",
  "fi",
  "do",
  "done",
  "while",
  "until",
  "!",
  "{",
  "}",
]);
const NO_COMMAND = new Set(["for", "case", "select"]);
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const SHELLS = /^(sh|bash|zsh|dash|ksh)$/;
const INTERPRETERS =
  /^(node|nodejs|deno|bun|tsx|ts-node|python[0-9.]*|ruby|perl|php|osascript|lua)$/;

/** @param {string[]} args @param {string[]} valueOptions */
function skipOptions(args, valueOptions = []) {
  let i = 0;
  while (i < args.length && args[i].startsWith("-") && args[i] !== "-") {
    if (args[i] === "--") return args.slice(i + 1);
    i += valueOptions.includes(args[i]) ? 2 : 1;
  }
  return args.slice(i);
}

/**
 * Strips wrappers (sudo, env, timeout, xargs, find -exec, ...) and returns the
 * argv lists that will actually run, plus scripts to parse (env -S).
 * @param {string[]} words
 * @returns {{ argvs: string[][], scripts: string[] }}
 */
function unwrap(words) {
  /** @type {string[][]} */
  const argvs = [];
  /** @type {string[]} */
  const scripts = [];
  let w = words.slice();
  for (;;) {
    while (w.length && (RESERVED.has(w[0]) || ASSIGNMENT.test(w[0])))
      w = w.slice(1);
    if (w[0] === "function") {
      w = w.slice(2); // `function name { body` — check the body
      continue;
    }
    if (!w.length || NO_COMMAND.has(w[0])) break;
    const name = path.basename(w[0]);
    const rest = w.slice(1);
    if (name === "sudo") {
      w = skipOptions(rest, [
        "-u",
        "-g",
        "-C",
        "-h",
        "-p",
        "-U",
        "-r",
        "-t",
        "-D",
        "-R",
        "-T",
        "--user",
        "--group",
        "--chdir",
        "--prompt",
      ]);
    } else if (name === "env") {
      let i = 0;
      while (i < rest.length) {
        const a = rest[i];
        if (a === "-S" || a === "--split-string") {
          if (rest[i + 1] !== undefined) scripts.push(rest[i + 1]);
          i = rest.length;
        } else if (a.startsWith("-S") || a.startsWith("--split-string=")) {
          scripts.push(a.slice(a.startsWith("-S") ? 2 : 15));
          i = rest.length;
        } else if (["-u", "--unset", "-C", "--chdir"].includes(a)) i += 2;
        else if (a === "--") i++;
        else if (a.startsWith("-") || ASSIGNMENT.test(a)) i++;
        else break;
      }
      w = rest.slice(i);
    } else if (
      ["command", "builtin", "nohup", "noglob", "busybox", "time"].includes(
        name,
      )
    ) {
      w = skipOptions(rest);
    } else if (name === "exec") {
      w = skipOptions(rest, ["-a"]);
    } else if (name === "timeout") {
      w = skipOptions(rest, ["-s", "--signal", "-k", "--kill-after"]).slice(1);
    } else if (name === "nice") {
      w = skipOptions(rest, ["-n", "--adjustment"]);
    } else if (name === "stdbuf") {
      w = skipOptions(rest, [
        "-i",
        "-o",
        "-e",
        "--input",
        "--output",
        "--error",
      ]);
    } else if (name === "xargs") {
      w = skipOptions(rest, [
        "-I",
        "-n",
        "-P",
        "-d",
        "-E",
        "-L",
        "-s",
        "-a",
        "--max-args",
        "--max-procs",
        "--delimiter",
        "--arg-file",
        "--max-lines",
        "--max-chars",
        "--eof",
        "--replace",
      ]);
    } else if (name === "find") {
      for (let i = 0; i < rest.length; i++) {
        if (!["-exec", "-execdir", "-ok", "-okdir"].includes(rest[i])) continue;
        const end = rest.findIndex((a, j) => j > i && (a === ";" || a === "+"));
        const inner = unwrap(rest.slice(i + 1, end === -1 ? undefined : end));
        argvs.push(...inner.argvs);
        scripts.push(...inner.scripts);
        if (end === -1) break;
        i = end;
      }
      break;
    } else {
      argvs.push(w);
      break;
    }
  }
  return { argvs, scripts };
}

/** Short-option cluster test (`-uf` has f), stopping at `--`. @param {string[]} args @param {string} letter */
function hasShort(args, letter) {
  for (const a of args) {
    if (a === "--") return false;
    if (/^-[A-Za-z]+$/.test(a) && a.includes(letter)) return true;
  }
  return false;
}
/**
 * Long-option test. git and GNU tools accept any unambiguous prefix
 * (`--har` = `--hard`), so any prefix of at least one letter counts; an
 * ambiguous one makes the tool itself fail, so blocking it costs nothing.
 * @param {string} arg @param {string} name
 */
const isLong = (arg, name) => {
  const option = arg.split("=")[0];
  return (
    option.length > 2 && option.startsWith("--") && name.startsWith(option)
  );
};
/** @param {string[]} args @param {...string} names */
const hasLong = (args, ...names) =>
  args.some((a) => names.some((n) => isLong(a, n)));

/** @param {string} dir @param {string[]} args */
function gitOut(dir, args) {
  try {
    return execFileSync("git", ["-C", dir, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3000,
    }).trim();
  } catch {
    return null;
  }
}
/** @param {string} dir */
const currentBranch = (dir) =>
  gitOut(dir, ["symbolic-ref", "--quiet", "--short", "HEAD"]);

/** @param {string} dir @param {string} name */
function isCommit(dir, name) {
  const verify = (/** @type {string} */ ref) =>
    gitOut(dir, ["rev-parse", "--verify", "--quiet", "--end-of-options", ref]);
  if (verify(`${name}^{commit}`) !== null) return true;
  const remotes = (gitOut(dir, ["remote"]) ?? "").split("\n").filter(Boolean);
  return remotes.some(
    (r) => verify(`refs/remotes/${r}/${name}^{commit}`) !== null,
  );
}

/** @param {string[]} argv */
function checkRm(argv) {
  let recursive = false;
  let force = false;
  for (const a of argv.slice(1)) {
    if (a === "--") break;
    if (isLong(a, "--recursive")) recursive = true;
    else if (isLong(a, "--force")) force = true;
    else if (/^-[A-Za-z]+$/.test(a)) {
      if (/[rR]/.test(a)) recursive = true;
      if (a.includes("f")) force = true;
    }
  }
  if (recursive && force)
    throw new Block(`rm with recursive + force flags (${argv.join(" ")})`);
}

/** @param {string[]} args @param {string} dir */
function checkPush(args, dir) {
  if (
    hasLong(
      args,
      "--force",
      "--force-with-lease",
      "--mirror",
      "--all",
      "--branches",
    ) ||
    hasShort(args, "f")
  )
    throw new Block("force push, or a push of every branch (--all/--mirror)");
  const positionals = [];
  for (let i = 0; i < args.length; i++) {
    const valueOptions = [
      "-o",
      "--push-option",
      "--repo",
      "--receive-pack",
      "--exec",
    ];
    if (valueOptions.includes(args[i])) i++;
    else if (!args[i].startsWith("-")) positionals.push(args[i]);
  }
  const refspecs = positionals.slice(1);
  if (refspecs.length === 0 && currentBranch(dir) === "main")
    throw new Block("push while on main (a bare push goes to main)");
  for (const spec of refspecs) {
    if (spec.startsWith("+")) throw new Block(`force push (refspec ${spec})`);
    let dest = spec.includes(":") ? spec.slice(spec.indexOf(":") + 1) : spec;
    if (dest === "HEAD" || dest === "@") dest = currentBranch(dir) ?? "";
    if (dest.replace(/^refs\/heads\//, "") === "main")
      throw new Block(`push to main (refspec ${spec})`);
  }
}

/** @param {string[]} args @param {string} dir */
function checkCheckout(args, dir) {
  const discard = () =>
    new Block(
      "git checkout that would overwrite files (paths, . or -f); to change branch, use git switch",
    );
  if (
    args.includes("--") ||
    hasLong(args, "--force", "--patch", "--pathspec-from-file") ||
    hasShort(args, "f") ||
    hasShort(args, "p")
  )
    throw discard();
  if (hasShort(args, "b") || hasShort(args, "B") || hasLong(args, "--orphan"))
    return;
  const positionals = args.filter((a) => a === "-" || !a.startsWith("-"));
  if (positionals.length === 0) return;
  if (positionals.length === 1 && positionals[0] === "-") return;
  if (
    positionals.length > 1 ||
    positionals[0] === "." ||
    !isCommit(dir, positionals[0])
  )
    throw discard();
}

/** @param {string[]} argv @param {string} cwd */
function checkGit(argv, cwd) {
  let dir = cwd;
  let i = 1;
  while (i < argv.length && argv[i].startsWith("-")) {
    const a = argv[i];
    if (a === "-C") {
      dir = path.resolve(dir, argv[i + 1] ?? "");
      i += 2;
    } else if (
      [
        "-c",
        "--git-dir",
        "--work-tree",
        "--namespace",
        "--config-env",
      ].includes(a)
    )
      i += 2;
    else i++;
  }
  const sub = argv[i];
  const args = argv.slice(i + 1);
  switch (sub) {
    case "push":
      return checkPush(args, dir);
    case "commit":
    case "merge":
      if (currentBranch(dir) === "main")
        throw new Block(`git ${sub} while on main; create a branch first`);
      return;
    case "reset":
      if (hasLong(args, "--hard")) throw new Block("git reset --hard");
      return;
    case "checkout":
      return checkCheckout(args, dir);
    case "switch":
      if (hasLong(args, "--force", "--discard-changes") || hasShort(args, "f"))
        throw new Block("git switch that discards local changes");
      return;
    case "restore": {
      const staged = hasLong(args, "--staged") || hasShort(args, "S");
      const worktree = hasLong(args, "--worktree") || hasShort(args, "W");
      if (!staged || worktree)
        throw new Block(
          "git restore of working-tree files (only --staged is allowed); undo edits with the Edit tool",
        );
      return;
    }
    case "clean":
      if (hasLong(args, "--force") || hasShort(args, "f"))
        throw new Block("git clean -f");
      return;
    case "rm":
      if (hasLong(args, "--force") || hasShort(args, "f"))
        throw new Block("git rm -f");
      return;
  }
}

/** @param {string[]} argv */
function checkGh(argv) {
  const positionals = [];
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === "-R" || argv[i] === "--repo") i++;
    else if (!argv[i].startsWith("-")) positionals.push(argv[i]);
  }
  if (positionals[0] === "pr" && positionals[1] === "merge")
    throw new Block("gh pr merge (merging is the user's step)");
}

/** @param {string[]} argv @param {Command} command @param {Context} ctx @param {number} depth */
function checkArgv(argv, command, ctx, depth) {
  const name = path.basename(argv[0]);
  const fed = [...command.heredocs, ...command.hereStrings];
  if (SHELLS.test(name)) {
    const flag = argv.findIndex(
      (a, i) => i > 0 && /^-[A-Za-z]*c[A-Za-z]*$/.test(a),
    );
    // The script is the first non-option word after -c (`bash -c -x 'cmd'`).
    let at = flag + 1;
    while (flag > 0 && argv[at]?.startsWith("-"))
      if (argv[at++] === "--") break;
    if (flag > 0 && argv[at] !== undefined)
      checkScript(argv[at], ctx, depth + 1);
    for (const body of fed) checkScript(body, ctx, depth + 1);
  } else if (name === "eval") {
    checkScript(argv.slice(1).join(" "), ctx, depth + 1);
  } else if (INTERPRETERS.test(name)) {
    for (const text of [...argv.slice(1), ...fed])
      if (ENV_IN_CODE.test(text))
        throw new Block(`${name} code that names an env file; ${ENV_HINT}`);
  } else if (name === "rm") checkRm(argv);
  else if (name === "git") checkGit(argv, ctx.cwd);
  else if (name === "gh") checkGh(argv);
}

/** @param {string} script @param {Context} ctx @param {number} depth */
function checkScript(script, ctx, depth) {
  if (depth > MAX_DEPTH) throw new Block("command nested too deeply to check");
  let commands;
  try {
    commands = parseScript(script);
  } catch (error) {
    if (error instanceof ParseError)
      throw new Block(
        `guard could not parse the command (${error.message}), blocked to be safe`,
      );
    throw error;
  }
  for (const command of commands) {
    for (const word of [...command.words, ...command.redirects])
      checkEnvWord(word);
    const { argvs, scripts } = unwrap(command.words);
    for (const script of scripts) checkScript(script, ctx, depth + 1);
    for (const argv of argvs) checkArgv(argv, command, ctx, depth);
  }
}

// ---------------------------------------------------------------- entry

/** @param {any} input the PreToolUse hook JSON */
function check(input) {
  const ti = input.tool_input ?? {};
  /** @param {unknown} value */
  const envBlock = (value, strict = false) => {
    if (mayNameEnvFile(value, strict))
      throw new Block(`reads an env file (${value})`);
  };
  switch (input.tool_name) {
    case "Read":
      return envBlock(ti.file_path);
    case "Grep":
      envBlock(ti.path);
      return envBlock(ti.glob, true);
    case "Glob":
      envBlock(ti.path);
      return envBlock(ti.pattern);
    case "Bash":
    case "Monitor":
      if (typeof ti.command === "string")
        checkScript(ti.command, { cwd: input.cwd || process.cwd() }, 0);
  }
}

try {
  check(JSON.parse(readFileSync(0, "utf8")));
} catch (error) {
  const reason =
    error instanceof Block
      ? `${error.message}. Project rule (CLAUDE.md › Absolute Don'ts): do not retry it in another form; ask the user.`
      : `the guard itself failed (${error instanceof Error ? error.message : String(error)}), so the call is blocked to be safe.`;
  process.stderr.write(`Blocked by ${SELF}: ${reason}\n`);
  process.exitCode = EXIT_BLOCK;
}
