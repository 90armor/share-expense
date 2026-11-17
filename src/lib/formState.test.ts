import { describe, expect, it } from "vitest";
import { appError } from "./appError";
import {
  fieldError,
  formError,
  readFormFields,
  toFormState,
  type FormState,
} from "./formState";

function formData(entries: Array<[string, string | Blob]>): FormData {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

const FIELDS = ["groupId", "name"] as const;
type Field = (typeof FIELDS)[number];
const values: Record<Field, string> = { groupId: "g", name: "Aung" };

describe("readFormFields", () => {
  it("reads each listed field exactly as typed (no trimming)", () => {
    expect(
      readFormFields(
        formData([
          ["groupId", "g1"],
          ["name", "  Aung  "],
        ]),
        FIELDS,
      ),
    ).toEqual({ groupId: "g1", name: "  Aung  " });
  });

  it("maps missing fields to empty strings", () => {
    expect(readFormFields(formData([]), FIELDS)).toEqual({
      groupId: "",
      name: "",
    });
  });

  it("maps a file upload to an empty string", () => {
    expect(
      readFormFields(formData([["name", new Blob(["x"])]]), ["name"] as const),
    ).toEqual({ name: "" });
  });

  it("ignores $ACTION_ keys and unknown fields", () => {
    const result = readFormFields(
      formData([
        ["$ACTION_ID_abc", ""],
        ["name", "Aung"],
        ["nameKey", "evil"],
        ["isAdmin", "true"],
      ]),
      FIELDS,
    );
    expect(Object.keys(result).sort()).toEqual(["groupId", "name"]);
  });
});

describe("toFormState", () => {
  it("keeps field errors and the submitted values for VALIDATION", () => {
    const error = appError("VALIDATION", "Invalid input", {
      name: "Name is required",
    });
    expect(toFormState(error, values)).toEqual({
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
      ...appError("CONFLICT", "Already exists"),
      fields: { name: "should not be shown" },
    };
    expect(toFormState(error, values)).toEqual({
      error: { code: "CONFLICT", message: "Already exists" },
      values,
    });
  });

  it("copies values, so later changes to the input do not leak in", () => {
    const input = { ...values };
    const state = toFormState(appError("UNEXPECTED", "x"), input);
    input.name = "changed";
    expect(state.values.name).toBe("Aung");
  });

  it("returns a plain, JSON-serializable object", () => {
    const state = toFormState(
      appError("VALIDATION", "Invalid input", { name: "Too long" }),
      values,
    );
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

describe("fieldError / formError", () => {
  const empty: FormState<Field> = { error: null, values };

  it("returns nothing when there is no error", () => {
    expect(fieldError(empty, "name")).toBeUndefined();
    expect(formError(empty, ["name"])).toBeUndefined();
  });

  it("puts VALIDATION issues on visible fields only", () => {
    const state: FormState<Field> = {
      error: appError("VALIDATION", "Invalid input", { name: "Too long" }),
      values,
    };
    expect(fieldError(state, "name")).toBe("Too long");
    expect(formError(state, ["name"])).toBeUndefined();
  });

  it("shows a VALIDATION issue on a hidden field at form level", () => {
    const state: FormState<Field> = {
      error: appError("VALIDATION", "Invalid input", { groupId: "Invalid ID" }),
      values,
    };
    expect(formError(state, ["name"])).toBe("Invalid ID");
  });

  it("shows every VALIDATION issue at form level when no field is visible", () => {
    const state: FormState<Field> = {
      error: appError("VALIDATION", "Invalid input", { name: "Too long" }),
      values,
    };
    expect(formError(state, [])).toBe("Too long");
  });

  it("shows non-VALIDATION errors at form level, never on a field", () => {
    const state: FormState<Field> = {
      error: appError("CONFLICT", "Already in this group"),
      values,
    };
    expect(formError(state, ["name"])).toBe("Already in this group");
    expect(fieldError(state, "name")).toBeUndefined();
  });
});
