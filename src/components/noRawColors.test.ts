import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Colors must come from the tokens in src/app/globals.css (see docs/DESIGN_SYSTEM.md).
const RAW_HEX = /#[0-9a-fA-F]{3,8}\b/g;
const ARBITRARY_COLOR = /-\[(?:#|rgba?\(|hsla?\(|oklch\(|color-mix\()/g;
const DEFAULT_PALETTE =
  /\b(?:bg|text|border|ring|outline|fill|stroke|from|via|to|divide|placeholder|accent|caret|decoration|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(?:-\d{2,3})?\b/g;

function findColorViolations(text: string): string[] {
  return [RAW_HEX, ARBITRARY_COLOR, DEFAULT_PALETTE].flatMap((pattern) =>
    [...text.matchAll(pattern)].map((match) => match[0]),
  );
}

const ROOT = process.cwd();
const SCAN_DIRS = ["src/components", "src/app", "src/features"];
const SKIP_FILES = ["src/app/globals.css"];

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(path);
    return /\.(tsx?|css)$/.test(entry.name) ? [path] : [];
  });
}

describe("findColorViolations", () => {
  it("catches raw hex colors", () => {
    expect(findColorViolations('style={{ color: "#B0573F" }}')).toEqual([
      "#B0573F",
    ]);
  });

  it("catches arbitrary color values", () => {
    // "#fff" is also reported by the raw-hex rule.
    expect(
      findColorViolations('className="bg-[#fff] text-[rgb(0,0,0)]"'),
    ).toEqual(["#fff", "-[#", "-[rgb("]);
  });

  it("catches Tailwind default palette classes", () => {
    expect(
      findColorViolations('className="bg-zinc-50 text-black border-red-500"'),
    ).toEqual(["bg-zinc-50", "text-black", "border-red-500"]);
  });

  it("allows token classes", () => {
    expect(
      findColorViolations(
        'className="bg-paper text-ink border-border-strong text-owe bg-ink/40"',
      ),
    ).toEqual([]);
  });
});

describe("source files", () => {
  it("use design tokens only (no raw or default-palette colors)", () => {
    const violations = SCAN_DIRS.flatMap((dir) => listFiles(join(ROOT, dir)))
      .map((file) => relative(ROOT, file))
      .filter(
        (file) => !SKIP_FILES.includes(file) && !file.endsWith(".test.ts"),
      )
      .flatMap((file) =>
        readFileSync(join(ROOT, file), "utf8")
          .split("\n")
          .flatMap((line, index) =>
            findColorViolations(line).map(
              (match) => `${file}:${index + 1}: ${match}`,
            ),
          ),
      );

    expect(violations).toEqual([]);
  });
});
