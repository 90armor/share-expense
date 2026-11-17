import { describe, expect, it } from "vitest";
import { appError } from "@/lib/appError";
import { fieldError } from "@/lib/formState";
import {
  addMemberFormError,
  initialAddMemberFormState,
  initialRemoveMemberFormState,
  readAddMemberForm,
  readRemoveMemberForm,
  removeMemberFormError,
  toAddMemberFormState,
  toRemoveMemberFormState,
  type AddMemberFormState,
} from "./formState";

function formData(entries: Array<[string, string | Blob]>): FormData {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

const GROUP_ID = "g-1";

describe("add member form", () => {
  it("starts with no error, the group id and an empty name", () => {
    expect(initialAddMemberFormState(GROUP_ID)).toEqual({
      error: null,
      values: { groupId: GROUP_ID, name: "" },
    });
  });

  it("reads groupId and name as typed and ignores nameKey and other keys", () => {
    expect(
      readAddMemberForm(
        formData([
          ["$ACTION_ID_abc", ""],
          ["groupId", GROUP_ID],
          ["name", "  Aung  "],
          ["nameKey", "evil"],
        ]),
      ),
    ).toEqual({ groupId: GROUP_ID, name: "  Aung  " });
  });

  it("maps missing fields and file uploads to empty strings", () => {
    expect(readAddMemberForm(formData([["name", new Blob(["x"])]]))).toEqual({
      groupId: "",
      name: "",
    });
  });

  it("keeps the typed values after an error", () => {
    const values = { groupId: GROUP_ID, name: "Aung" };
    expect(
      toAddMemberFormState(appError("CONFLICT", "Already here"), values),
    ).toEqual({
      error: { code: "CONFLICT", message: "Already here" },
      values,
    });
  });

  it("shows a name error on the field and a groupId error at form level", () => {
    const state: AddMemberFormState = {
      error: appError("VALIDATION", "Invalid input", {
        name: "Name is required",
        groupId: "Invalid ID",
      }),
      values: { groupId: "x", name: "" },
    };
    expect(fieldError(state, "name")).toBe("Name is required");
    expect(addMemberFormError(state)).toBe("Invalid ID");
  });

  it("shows CONFLICT at form level", () => {
    const state = toAddMemberFormState(
      appError("CONFLICT", "Already in this group"),
      { groupId: GROUP_ID, name: "Aung" },
    );
    expect(addMemberFormError(state)).toBe("Already in this group");
    expect(fieldError(state, "name")).toBeUndefined();
  });
});

describe("remove member form", () => {
  it("starts with no error and both ids", () => {
    expect(initialRemoveMemberFormState(GROUP_ID, "m-1")).toEqual({
      error: null,
      values: { groupId: GROUP_ID, memberId: "m-1" },
    });
  });

  it("reads groupId and memberId only", () => {
    expect(
      readRemoveMemberForm(
        formData([
          ["groupId", GROUP_ID],
          ["memberId", "m-1"],
          ["name", "Aung"],
        ]),
      ),
    ).toEqual({ groupId: GROUP_ID, memberId: "m-1" });
  });

  it("shows every error at form level (no visible fields)", () => {
    const values = { groupId: GROUP_ID, memberId: "bad" };
    expect(
      removeMemberFormError(
        toRemoveMemberFormState(
          appError("VALIDATION", "Invalid input", { memberId: "Invalid ID" }),
          values,
        ),
      ),
    ).toBe("Invalid ID");
    expect(
      removeMemberFormError(
        toRemoveMemberFormState(
          appError("NOT_FOUND", "Member not found"),
          values,
        ),
      ),
    ).toBe("Member not found");
  });
});
