import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Table, type TableProps } from "./Table";

// Server-render to an HTML string: runs in the node test environment, no jsdom.
// These tests only check the classes in the markup, not the real layout.
function render(props: Partial<TableProps> = {}): string {
  return renderToStaticMarkup(
    createElement(Table, {
      caption: "Newest first",
      columns: [
        { key: "name", header: "Name", wrap: true },
        { key: "amount", header: "Amount", align: "right" },
      ],
      rows: [{ name: "Thomas", amount: "100" }],
      ...props,
    }),
  );
}

function cells(html: string): string[] {
  return html.match(/<td[\s\S]*?<\/td>/g) ?? [];
}

function classes(tag: string): string[] {
  return tag.match(/class="([^"]*)"/)?.[1]?.split(/\s+/) ?? [];
}

// A member name can be 100 characters with no spaces.
const LONG = "x".repeat(100);

describe("Table", () => {
  it("renders the long text inside a cell", () => {
    expect(render({ rows: [{ name: LONG, amount: "1" }] })).toContain(LONG);
  });

  // Why a cap and not `break-words` alone: overflow-wrap: break-word does not
  // lower a table column's min-content width, so a 100-char word keeps the
  // column 100 characters wide. A max-width on the content does clamp it.
  // (`wrap-anywhere` would also work but lets "Christopher" break mid-word.)
  it("wraps a `wrap` column's content in a capped, word-breaking box", () => {
    const [nameCell] = cells(render({ rows: [{ name: LONG, amount: "1" }] }));
    const box = nameCell.match(/<div[^>]*>/)?.[0] ?? "";
    expect(classes(box)).toEqual(
      expect.arrayContaining(["max-w-28", "break-words"]),
    );
    expect(nameCell).toContain(LONG);
  });

  it("leaves columns without `wrap` as they were (no box, e.g. Amount)", () => {
    const [, amountCell] = cells(render());
    expect(amountCell).not.toContain("<div");
    expect(amountCell).not.toContain("max-w-");
  });

  it("does not use wrap-anywhere (it breaks normal words mid-word when narrow)", () => {
    expect(render()).not.toContain("wrap-anywhere");
  });

  it("keeps the padding, ink colour and alignment classes", () => {
    const [left, right] = cells(render());
    expect(classes(left.match(/<td[^>]*>/)?.[0] ?? "")).toEqual(
      expect.arrayContaining(["px-4", "py-3", "text-ink", "text-left"]),
    );
    expect(classes(right.match(/<td[^>]*>/)?.[0] ?? "")).toEqual(
      expect.arrayContaining(["px-4", "py-3", "text-ink", "text-right"]),
    );
  });
});
