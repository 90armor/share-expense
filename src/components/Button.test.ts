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

  // `enabled:` is `:enabled`, which an <a> never matches, so links styled with
  // buttonClassName() got no hover. `not-disabled:` is `:not(:disabled)`:
  // it matches links and enabled buttons, but still skips a disabled <button>.
  it.each(["primary", "secondary", "ghost", "danger"] as const)(
    "gives the %s variant a hover that also matches links",
    (variant) => {
      const hover = classes(buttonClassName({ variant })).filter((c) =>
        c.includes("hover:"),
      );
      expect(hover.length).toBeGreaterThan(0);
      for (const c of hover) expect(c).toMatch(/^not-disabled:hover:/);
    },
  );

  it("appends an extra className last", () => {
    expect(buttonClassName({ className: "w-full" }).endsWith(" w-full")).toBe(
      true,
    );
  });
});
