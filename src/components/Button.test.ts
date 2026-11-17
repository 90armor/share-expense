import { describe, expect, it } from "vitest";
import { buttonClassName } from "./Button";

function classes(value: string): string[] {
  return value.split(" ");
}

describe("buttonClassName", () => {
  it("defaults to primary, md, with a focus ring", () => {
    const value = classes(buttonClassName());
    expect(value).toContain("bg-primary");
    expect(value).toContain("min-h-11");
    expect(value).toContain("focus-visible:outline-focus");
  });

  it("applies the variant and size", () => {
    const value = classes(buttonClassName({ variant: "danger", size: "lg" }));
    expect(value).toContain("bg-danger");
    expect(value).toContain("min-h-12");
    expect(value).not.toContain("bg-primary");
    expect(value).not.toContain("min-h-11");
  });

  it("appends an extra className last", () => {
    expect(buttonClassName({ className: "w-full" }).endsWith(" w-full")).toBe(
      true,
    );
  });
});
