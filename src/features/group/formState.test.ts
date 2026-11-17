import { describe, expect, it } from "vitest";
import { appError } from "@/lib/appError";
import {
  fieldError,
  formError,
  initialCreateGroupFormState,
  readCreateGroupForm,
  toCreateGroupFormState,
  type CreateGroupFormState,
} from "./formState";

function formData(entries: Array<[string, string | Blob]>): FormData {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

const values = { name: "Trip", currency: "USD" };

describe("initialCreateGroupFormState", () => {
  it("starts with no error, an empty name and MMK", () => {
    expect(initialCreateGroupFormState).toEqual({
      error: null,
      values: { name: "", currency: "MMK" },
    });
  });
});

describe("readCreateGroupForm", () => {
  it("reads name and currency exactly as typed (no trimming)", () => {
    expect(
      readCreateGroupForm(
        formData([
          ["name", "  Trip  "],
          ["currency", "KHR"],
        ]),
      ),
    ).toEqual({ name: "  Trip  ", currency: "KHR" });
  });

  it("maps missing fields to empty strings", () => {
    expect(readCreateGroupForm(formData([]))).toEqual({
      name: "",
      currency: "",
    });
  });

  it("maps a file upload to an empty string", () => {
    expect(
      readCreateGroupForm(
        formData([
          ["name", new Blob(["x"])],
          ["currency", "MMK"],
        ]),
      ),
    ).toEqual({ name: "", currency: "MMK" });
  });

  it("ignores $ACTION_ keys and unknown fields", () => {
    const result = readCreateGroupForm(
      formData([
        ["$ACTION_ID_abc", ""],
        ["name", "Trip"],
        ["currency", "MMK"],
        ["isAdmin", "true"],
      ]),
    );
    expect(Object.keys(result).sort()).toEqual(["currency", "name"]);
  });
});

describe("toCreateGroupFormState", () => {
  it("keeps field errors and the submitted values for VALIDATION", () => {
    const error = appError("VALIDATION", "Invalid input", {
      name: "Name is required",
    });
    expect(toCreateGroupFormState(error, values)).toEqual({
      error: {
        code: "VALIDATION",
        message: "Invalid input",
        fields: { name: "Name is required" },
      },
      values,
    });
  });

  it("drops fields for non-VALIDATION errors", () => {
    const error = {
      ...appError("UNEXPECTED", "Something went wrong. Please try again."),
      fields: { name: "should not be shown" },
    };
    expect(toCreateGroupFormState(error, values)).toEqual({
      error: {
        code: "UNEXPECTED",
        message: "Something went wrong. Please try again.",
      },
      values,
    });
  });

  it("returns a plain, JSON-serializable object", () => {
    const state = toCreateGroupFormState(
      appError("VALIDATION", "Invalid input", { currency: "Unsupported" }),
      values,
    );
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

describe("fieldError / formError", () => {
  const validation: CreateGroupFormState = {
    error: appError("VALIDATION", "Invalid input", {
      name: "Name is required",
      currency: "Unsupported currency",
    }),
    values,
  };

  it("returns nothing when there is no error", () => {
    expect(fieldError(initialCreateGroupFormState, "name")).toBeUndefined();
    expect(formError(initialCreateGroupFormState)).toBeUndefined();
  });

  it("returns the message for each invalid field", () => {
    expect(fieldError(validation, "name")).toBe("Name is required");
    expect(fieldError(validation, "currency")).toBe("Unsupported currency");
  });

  it("has no form-level error when every issue is on a visible field", () => {
    expect(formError(validation)).toBeUndefined();
  });

  it("shows VALIDATION issues that are not on a visible field at form level", () => {
    const state: CreateGroupFormState = {
      error: appError("VALIDATION", "Invalid input", {
        _root: "Expected object",
      }),
      values,
    };
    expect(formError(state)).toBe("Expected object");
    expect(fieldError(state, "name")).toBeUndefined();
  });

  it("shows non-VALIDATION errors at form level, never on a field", () => {
    const state: CreateGroupFormState = {
      error: appError("UNEXPECTED", "Something went wrong. Please try again."),
      values,
    };
    expect(formError(state)).toBe("Something went wrong. Please try again.");
    expect(fieldError(state, "name")).toBeUndefined();
  });
});
