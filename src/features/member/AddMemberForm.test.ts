import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AddMemberForm } from "./AddMemberForm";

const GROUP_ID = "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b";

// Server-render to an HTML string: runs in the node test environment, no jsdom.
// Only the first render is visible here; opening, closing and focus are
// browser behaviour (PR manual test table).
function render(): string {
  return renderToStaticMarkup(
    createElement(AddMemberForm, { groupId: GROUP_ID }),
  );
}

function attr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
}

function tag(html: string, pattern: RegExp): string {
  const found = html.match(pattern)?.[0];
  if (!found)
    throw new Error(`No match for ${pattern} in ${html.slice(0, 120)}…`);
  return found;
}

describe("AddMemberForm", () => {
  it("renders an Add member opener button before the dialog", () => {
    const html = render();
    const [beforeDialog] = html.split("<dialog");
    expect(html).toContain("<dialog");
    expect(beforeDialog).toMatch(
      /<button type="button"[^>]*>Add member<\/button>/,
    );
  });

  it("renders the dialog closed on the first render", () => {
    const dialog = tag(render(), /<dialog[^>]*>/);
    expect(dialog).not.toMatch(/\sopen[\s=>]/);
  });

  it("puts the fields in a form inside the dialog", () => {
    const html = render();
    const dialogBody = html.slice(html.indexOf("<dialog"));
    const form = tag(dialogBody, /<form[^>]*>[\s\S]*?<\/form>/);
    expect(attr(tag(form, /<form[^>]*>/), "id")).toBeTruthy();
    expect(form).toMatch(
      new RegExp(`<input type="hidden" name="groupId" value="${GROUP_ID}"/>`),
    );
    expect(form).toMatch(/<input[^>]*name="name"/);
  });

  it("ties the footer submit button to the form with form={id}", () => {
    const html = render();
    const formId = attr(tag(html, /<form[^>]*>/), "id");
    const submit = tag(html, /<button[^>]*type="submit"[^>]*>[^<]*<\/button>/);
    expect(attr(submit, "form")).toBe(formId);
    expect(submit).toMatch(/>Add member<\/button>$/);
    // In the Modal footer, after the form, not inside it.
    expect(html.indexOf(submit)).toBeGreaterThan(html.indexOf("</form>"));
  });

  it("shows no error alert on the first render", () => {
    expect(render()).not.toContain('role="alert"');
  });
});
