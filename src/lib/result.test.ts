import { describe, expect, it } from "vitest";
import { appError } from "./appError";
import { fail, ok, type Result } from "./result";

describe("appError", () => {
  it("builds a plain error object without fields", () => {
    expect(appError("NOT_FOUND", "Group not found")).toEqual({
      code: "NOT_FOUND",
      message: "Group not found",
    });
  });

  it("includes field messages when given", () => {
    expect(
      appError("VALIDATION", "Invalid input", { name: "Required" }),
    ).toEqual({
      code: "VALIDATION",
      message: "Invalid input",
      fields: { name: "Required" },
    });
  });
});

describe("result", () => {
  it("ok wraps a value", () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });

  it("fail wraps an AppError", () => {
    const error = appError("CONFLICT", "Already settled");
    expect(fail(error)).toEqual({ ok: false, error });
  });

  it("narrows on the ok flag", () => {
    const result: Result<string> = ok("x");
    if (result.ok) {
      expect(result.value).toBe("x");
    } else {
      throw new Error("expected ok");
    }
  });
});
