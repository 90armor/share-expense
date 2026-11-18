import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RadioGroup, type RadioGroupProps } from "./RadioGroup";

// Server-render to an HTML string: runs in the node test environment, no jsdom.
function render(props: Partial<RadioGroupProps> = {}): string {
  return renderToStaticMarkup(
    createElement(RadioGroup, {
      label: "Currency",
      name: "currency",
      options: [
        { value: "MMK", label: "MMK" },
        { value: "USD", label: "USD" },
        { value: "KHR", label: "KHR" },
      ],
      ...props,
    }),
  );
}

function radios(html: string): string[] {
  return html.match(/<input[^>]*>/g) ?? [];
}

function attr(html: string, name: string): string | undefined {
  return html.match(new RegExp(`${name}="([^"]*)"`))?.[1];
}

function classes(tag: string): string[] {
  return attr(tag, "class")?.split(/\s+/) ?? [];
}

// A member name can be 100 characters with no spaces.
const LONG = "x".repeat(100);

describe("RadioGroup", () => {
  it("renders a fieldset whose legend is the label", () => {
    const html = render();
    expect(html).toMatch(/^<fieldset/);
    expect(html).toMatch(/<legend[^>]*>Currency<\/legend>/);
  });

  it("renders one radio per option, all sharing the name", () => {
    const inputs = radios(render());
    expect(inputs).toHaveLength(3);
    for (const input of inputs) {
      expect(input).toContain('type="radio"');
      expect(input).toContain('name="currency"');
    }
    expect(inputs.map((input) => attr(input, "value"))).toEqual([
      "MMK",
      "USD",
      "KHR",
    ]);
  });

  it("checks only the defaultValue option", () => {
    const checked = radios(render({ defaultValue: "USD" })).filter((input) =>
      input.includes('checked=""'),
    );
    expect(checked).toHaveLength(1);
    expect(attr(checked[0], "value")).toBe("USD");
  });

  it("wires the hint to the fieldset with aria-describedby", () => {
    const html = render({ hint: "One currency per group." });
    const describedBy = attr(html, "aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(html).toContain(`id="${describedBy}"`);
    expect(html).toContain("One currency per group.");
  });

  it("names the radiogroup from its legend", () => {
    const html = render();
    expect(html).toMatch(/^<fieldset[^>]*role="radiogroup"/);
    const legendId = html.match(/<legend id="([^"]+)"/)?.[1];
    expect(legendId).toBeTruthy();
    expect(attr(html, "aria-labelledby")).toBe(legendId);
  });

  it("shows the error as text and marks the group invalid", () => {
    const html = render({ error: "Unsupported currency" });
    expect(html).toContain("Error: Unsupported currency");
    const errorId = html.match(/<p id="([^"]+)"[^>]*>Error:/)?.[1];
    expect(errorId).toBeTruthy();
    expect(attr(html, "aria-describedby")?.split(" ")).toContain(errorId);
    // aria-invalid belongs on the radiogroup; the radio role does not support it.
    expect(html).toMatch(/^<fieldset[^>]*aria-invalid="true"/);
    for (const input of radios(html)) {
      expect(input).not.toContain("aria-invalid");
    }
  });

  // Node can only check classes; these do not prove the layout (checked in the
  // browser). A fieldset defaults to min-inline-size: min-content, so without
  // min-w-0 it grows to the longest unbreakable label.
  it("lets the fieldset shrink below its widest option (min-w-0)", () => {
    const fieldset = render().match(/^<fieldset[^>]*>/)?.[0] ?? "";
    expect(classes(fieldset)).toContain("min-w-0");
  });

  it("wraps a long option label: text in a min-w-0 break-words span, input shrink-0", () => {
    const html = render({
      options: [
        { value: "a", label: LONG },
        { value: "b", label: "Bo Bo" },
      ],
    });
    const span = html.match(new RegExp(`<span[^>]*>${LONG}</span>`))?.[0];
    expect(span, "label text is in its own span").toBeDefined();
    expect(classes(span ?? "")).toEqual(
      expect.arrayContaining(["min-w-0", "break-words"]),
    );
    for (const input of radios(html)) {
      expect(classes(input)).toContain("shrink-0");
    }
  });

  it("has no error text or aria-invalid without an error", () => {
    const html = render();
    expect(html).not.toContain("Error:");
    expect(html).not.toContain("aria-invalid");
  });
});
