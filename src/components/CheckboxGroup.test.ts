import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CheckboxGroup, type CheckboxGroupProps } from "./CheckboxGroup";

// Server-render to an HTML string: runs in the node test environment, no jsdom.
function render(props: Partial<CheckboxGroupProps> = {}): string {
  return renderToStaticMarkup(
    createElement(CheckboxGroup, {
      label: "Shared by",
      name: "participantIds",
      options: [
        { value: "a", label: "Aung" },
        { value: "b", label: "Bo Bo" },
        { value: "c", label: "Chit" },
      ],
      ...props,
    }),
  );
}

function checkboxes(html: string): string[] {
  return html.match(/<input[^>]*>/g) ?? [];
}

function attr(html: string, name: string): string | undefined {
  return html.match(new RegExp(`${name}="([^"]*)"`))?.[1];
}

describe("CheckboxGroup", () => {
  it("renders a fieldset whose legend is the label", () => {
    const html = render();
    expect(html).toMatch(/^<fieldset/);
    expect(html).toMatch(/<legend[^>]*>Shared by<\/legend>/);
  });

  it("renders one checkbox per option, all sharing the name", () => {
    const inputs = checkboxes(render());
    expect(inputs).toHaveLength(3);
    for (const input of inputs) {
      expect(input).toContain('type="checkbox"');
      expect(input).toContain('name="participantIds"');
    }
    expect(inputs.map((input) => attr(input, "value"))).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("checks only the defaultValues options", () => {
    const checked = checkboxes(render({ defaultValues: ["a", "c"] })).filter(
      (input) => input.includes('checked=""'),
    );
    expect(checked.map((input) => attr(input, "value"))).toEqual(["a", "c"]);
  });

  it("checks nothing without defaultValues", () => {
    for (const input of checkboxes(render())) {
      expect(input).not.toContain("checked");
    }
  });

  it("wires the hint to the fieldset with aria-describedby", () => {
    const html = render({ hint: "Split equally." });
    const describedBy = attr(html, "aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(html).toMatch(/^<fieldset[^>]*aria-describedby=/);
    expect(html).toContain(`id="${describedBy}"`);
    expect(html).toContain("Split equally.");
  });

  it("shows the error as text and marks each checkbox invalid", () => {
    const html = render({ error: "Choose at least one person" });
    expect(html).toContain("Error: Choose at least one person");
    const errorId = html.match(/<p id="([^"]+)"[^>]*>Error:/)?.[1];
    expect(errorId).toBeTruthy();
    expect(attr(html, "aria-describedby")?.split(" ")).toContain(errorId);
    // aria-invalid belongs on the checkboxes; the group role does not support it.
    expect(html).not.toMatch(/^<fieldset[^>]*aria-invalid/);
    for (const input of checkboxes(html)) {
      expect(input).toContain('aria-invalid="true"');
    }
  });

  it("has no error text or aria-invalid without an error", () => {
    const html = render();
    expect(html).not.toContain("Error:");
    expect(html).not.toContain("aria-invalid");
  });

  it("disables the whole group", () => {
    expect(render({ disabled: true })).toMatch(/^<fieldset[^>]*disabled=""/);
  });
});
