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
        { key: "name", header: "Name" },
        { key: "amount", header: "Amount", align: "right", sticky: true },
        { key: "note", header: "Note" },
      ],
      rows: [{ name: "Thomas", amount: "100", note: "Lunch" }],
      ...props,
    }),
  );
}

function tags(html: string, name: "th" | "td"): string[] {
  // `(?=[\s>])` so "th" does not also match <thead>.
  return html.match(new RegExp(`<${name}(?=[\\s>])[^>]*>`, "g")) ?? [];
}

function classes(tag: string): string[] {
  return tag.match(/class="([^"]*)"/)?.[1]?.split(/\s+/) ?? [];
}

describe("Table", () => {
  it("renders headers and cells in column order", () => {
    const html = render();
    expect(html).toMatch(/<th[^>]*>Name<\/th>[\s\S]*Amount[\s\S]*Note/);
    expect(html).toMatch(/>Thomas<[\s\S]*>100<[\s\S]*>Lunch</);
  });

  // The table scrolls sideways when it is too wide. A `sticky` column pins to
  // the right edge so it stays visible; the background must be opaque or the
  // scrolled text shows through it.
  it("pins a sticky column's header to the right edge with an opaque header background", () => {
    const [, amount] = tags(render(), "th");
    expect(classes(amount)).toEqual(
      expect.arrayContaining(["sticky", "right-0", "bg-paper"]),
    );
  });

  it("pins a sticky column's cells to the right edge with an opaque row background", () => {
    const [, amount] = tags(render(), "td");
    expect(classes(amount)).toEqual(
      expect.arrayContaining(["sticky", "right-0", "bg-surface"]),
    );
  });

  it("draws a token-colored separator on the sticky column's left side", () => {
    const [, thAmount] = tags(render(), "th");
    const [, tdAmount] = tags(render(), "td");
    for (const tag of [thAmount, tdAmount]) {
      expect(classes(tag).join(" ")).toContain("var(--color-border)");
    }
  });

  it("leaves columns without `sticky` as they were", () => {
    const html = render();
    for (const tag of [...tags(html, "th"), ...tags(html, "td")]) {
      const list = classes(tag);
      if (list.includes("text-right")) continue; // the sticky Amount column
      expect(list).not.toContain("sticky");
      expect(list).not.toContain("right-0");
    }
    const [left] = tags(html, "td");
    expect(classes(left)).toEqual(
      expect.arrayContaining(["px-4", "py-3", "text-ink", "text-left"]),
    );
  });

  it("does not cap or re-wrap cell content (no wrapper div, no max-w)", () => {
    const html = render();
    expect(html).not.toContain('<div class="max-w');
    expect(html).not.toMatch(/<td[^>]*><div/);
    expect(html).not.toContain("wrap-anywhere");
  });

  it("without any sticky column, no cell is sticky", () => {
    const html = render({
      columns: [
        { key: "name", header: "Name" },
        { key: "amount", header: "Amount", align: "right" },
      ],
    });
    expect(html).not.toContain("sticky");
  });
});
