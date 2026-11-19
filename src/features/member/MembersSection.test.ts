import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MembersSection, type MembersSectionProps } from "./MembersSection";

const GROUP_ID = "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const AUNG = { id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", name: "Aung" };
const BO_BO = { id: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e", name: "Bo Bo" };

// Server-render to an HTML string: runs in the node test environment, no jsdom.
function render(props: Partial<MembersSectionProps> = {}): string {
  return renderToStaticMarkup(
    createElement(MembersSection, {
      groupId: GROUP_ID,
      members: [AUNG, BO_BO],
      ...props,
    }),
  );
}

const OPENER = /<button type="button"[^>]*>Add member<\/button>/;

describe("MembersSection", () => {
  it("renders a Members heading and the Add member button", () => {
    const html = render();
    expect(html).toMatch(/<h2[^>]*>Members<\/h2>/);
    expect(html).toMatch(OPENER);
  });

  it("with no members: shows the empty text and the Add member button", () => {
    const html = render({ members: [] });
    expect(html).toContain("No members yet.");
    expect(html).toMatch(OPENER);
    expect(html).not.toContain("<li");
  });

  it("lists each member with its own Remove button", () => {
    const html = render();
    expect(html).not.toContain("No members yet.");
    const items = html.match(/<li[\s\S]*?<\/li>/g) ?? [];
    expect(items).toHaveLength(2);
    expect(items[0]).toContain(">Aung<");
    expect(items[0]).toContain('aria-label="Remove Aung"');
    expect(items[1]).toContain(">Bo Bo<");
    expect(items[1]).toContain('aria-label="Remove Bo Bo"');
  });

  // Class check only: it proves the classes are rendered, not the layout. The
  // Remove button is a direct flex item of the row, so shrink-0 must sit on it;
  // without it the Button's min-w-11 lets a long name squeeze it to 44px.
  it("keeps the Remove button from shrinking next to a long name", () => {
    const name = "a".repeat(100);
    const html = render({ members: [{ id: AUNG.id, name }] });
    const button =
      html.match(
        new RegExp(`<button[^>]*aria-label="Remove ${name}"[^>]*>`),
      )?.[0] ?? "";
    expect(button).toMatch(/class="[^"]*\bshrink-0\b/);
    expect(html).toMatch(
      new RegExp(`<span class="min-w-0 break-words">${name}</span>`),
    );
  });
});
