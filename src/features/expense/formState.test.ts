import { describe, expect, it } from "vitest";
import { appError } from "@/lib/appError";
import { fieldError } from "@/lib/formState";
import {
  addExpenseFormError,
  initialAddExpenseFormState,
  readAddExpenseForm,
  toAddExpenseFormState,
  type AddExpenseFormState,
  type AddExpenseFormValues,
} from "./formState";

function formData(entries: Array<[string, string | Blob]>): FormData {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

const GROUP_ID = "g-1";

const values: AddExpenseFormValues = {
  groupId: GROUP_ID,
  payerId: "m-1",
  amount: "1,000",
  description: "Taxi",
  participantIds: ["m-1", "m-2"],
};

describe("add expense form", () => {
  it("starts with no error, the group id and empty fields", () => {
    expect(initialAddExpenseFormState(GROUP_ID)).toEqual({
      error: null,
      values: {
        groupId: GROUP_ID,
        payerId: "",
        amount: "",
        description: "",
        participantIds: [],
      },
    });
  });

  it("reads every field as typed, all checked participants, and ignores other keys", () => {
    expect(
      readAddExpenseForm(
        formData([
          ["$ACTION_ID_abc", ""],
          ["groupId", GROUP_ID],
          ["payerId", "m-1"],
          ["amount", " 1,000 "],
          ["description", " Taxi "],
          ["participantIds", "m-1"],
          ["participantIds", "m-2"],
          ["currency", "USD"],
        ]),
      ),
    ).toEqual({
      groupId: GROUP_ID,
      payerId: "m-1",
      amount: " 1,000 ",
      description: " Taxi ",
      participantIds: ["m-1", "m-2"],
    });
  });

  it("maps missing fields to empty values and drops file uploads", () => {
    expect(
      readAddExpenseForm(
        formData([
          ["amount", new Blob(["x"])],
          ["participantIds", new Blob(["x"])],
        ]),
      ),
    ).toEqual({
      groupId: "",
      payerId: "",
      amount: "",
      description: "",
      participantIds: [],
    });
  });

  it("keeps the submitted values and field errors after a VALIDATION error", () => {
    const state = toAddExpenseFormState(
      appError("VALIDATION", "Invalid input", {
        amount: "Amount must be more than 0",
        participantIds: "Choose at least one person",
      }),
      values,
    );

    expect(state.values).toEqual(values);
    expect(fieldError(state, "amount")).toBe("Amount must be more than 0");
    expect(fieldError(state, "participantIds")).toBe(
      "Choose at least one person",
    );
    expect(addExpenseFormError(state)).toBeUndefined();
  });

  it("shows a groupId error at form level (the field is hidden)", () => {
    const state = toAddExpenseFormState(
      appError("VALIDATION", "Invalid input", { groupId: "Invalid ID" }),
      values,
    );
    expect(addExpenseFormError(state)).toBe("Invalid ID");
  });

  it("shows a per-item participant error at form level", () => {
    const state = toAddExpenseFormState(
      appError("VALIDATION", "Invalid input", {
        "participantIds.0": "Choose at least one person",
      }),
      values,
    );
    expect(addExpenseFormError(state)).toBe("Choose at least one person");
  });

  it.each([
    ["NOT_FOUND", "Group not found"],
    ["UNEXPECTED", "Something went wrong. Please try again."],
  ] as const)("shows %s at form level, never on a field", (code, message) => {
    const state: AddExpenseFormState = toAddExpenseFormState(
      appError(code, message),
      values,
    );
    expect(addExpenseFormError(state)).toBe(message);
    expect(fieldError(state, "amount")).toBeUndefined();
  });
});
