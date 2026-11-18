import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Money } from "@/lib/money";
import { SettleForm } from "./SettleForm";

const GROUP_ID = "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const AUNG = { id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", name: "Aung" };
const BO_BO = { id: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e", name: "Bo Bo" };
const MMK_631192: Money = { amount: 63119200n, currency: "MMK" };

// Server-render to an HTML string: runs in the node test environment, no jsdom.
// Only the first render is visible here; opening, closing, focus and the
// Server -> Client prop serialization are browser/RSC behaviour (PR manual table).
function render(props: Partial<Parameters<typeof SettleForm>[0]> = {}): string {
  return renderToStaticMarkup(
    createElement(SettleForm, {
      groupId: GROUP_ID,
      from: BO_BO,
      to: AUNG,
      amount: MMK_631192,
      ...props,
    }),
  );
}

function attr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
}

/** The first match of `pattern`; asserts there is one. */
function tag(html: string, pattern: RegExp): string {
  expect(html).toMatch(pattern);
  return html.match(pattern)![0];
}

function hiddenValue(html: string, name: string): string | undefined {
  return attr(
    tag(html, new RegExp(`<input type="hidden" name="${name}"[^>]*>`)),
    "value",
  );
}

describe("SettleForm", () => {
  it("renders a Mark as paid opener before the dialog, labelled with the whole line", () => {
    const html = render();
    const [beforeDialog] = html.split("<dialog");
    expect(html).toContain("<dialog");
    const opener = tag(
      beforeDialog,
      /<button type="button"[^>]*>Mark as paid<\/button>/,
    );
    expect(attr(opener, "aria-label")).toBe(
      "Mark as paid: Bo Bo pays Aung MMK 631,192.00",
    );
  });

  it("renders the dialog closed on the first render", () => {
    const dialog = tag(render(), /<dialog[^>]*>/);
    expect(dialog).not.toMatch(/\sopen[\s=>]/);
  });

  it("puts the line in hidden fields: group, who paid, who received", () => {
    const html = render();
    expect(hiddenValue(html, "groupId")).toBe(GROUP_ID);
    expect(hiddenValue(html, "fromId")).toBe(BO_BO.id);
    expect(hiddenValue(html, "toId")).toBe(AUNG.id);
  });

  it("sends an MMK amount over 1,000 as a plain decimal, but shows it grouped", () => {
    const html = render();
    expect(hiddenValue(html, "amount")).toBe("631192.00");
    const dialogBody = html.slice(html.indexOf("<dialog"));
    expect(dialogBody).toContain("Bo Bo paid Aung MMK 631,192.00.");
  });

  it("keeps all four fields inside the form in the dialog", () => {
    const html = render();
    const dialogBody = html.slice(html.indexOf("<dialog"));
    const form = tag(dialogBody, /<form[^>]*>[\s\S]*?<\/form>/);
    for (const name of ["groupId", "fromId", "toId", "amount"]) {
      expect(form).toMatch(new RegExp(`<input type="hidden" name="${name}"`));
    }
  });

  it("ties the footer submit button to the form with form={id}", () => {
    const html = render();
    const formId = attr(tag(html, /<form[^>]*>/), "id");
    expect(formId).toBeTruthy();
    const submit = tag(html, /<button[^>]*type="submit"[^>]*>[^<]*<\/button>/);
    expect(attr(submit, "form")).toBe(formId);
    expect(submit).toMatch(/>Mark as paid<\/button>$/);
    expect(html.indexOf(submit)).toBeGreaterThan(html.indexOf("</form>"));
  });

  it("titles the dialog and says the payment can't be undone", () => {
    const html = render();
    expect(html).toMatch(/<h2[^>]*>Mark as paid\?<\/h2>/);
    expect(html).toContain("This can&#x27;t be undone.");
  });

  it("lets a long name wrap in the dialog body", () => {
    const long = { id: AUNG.id, name: "A".repeat(100) };
    const html = render({ to: long });
    const body = tag(html, new RegExp(`<p class="[^"]*">[^<]*${long.name}`));
    expect(attr(body, "class")?.split(/\s+/)).toContain("break-words");
  });

  it("shows no error alert and uses no danger colour on the first render", () => {
    const html = render();
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("danger");
  });
});
