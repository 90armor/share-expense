"use server";

import { refresh } from "next/cache";
import { getDb } from "@/server/db";
import {
  initialAddMemberFormState,
  initialRemoveMemberFormState,
  readAddMemberForm,
  readRemoveMemberForm,
  toAddMemberFormState,
  toRemoveMemberFormState,
  type AddMemberFormState,
  type RemoveMemberFormState,
} from "./formState";
import { addMember, removeMember } from "./service";

// Thin: FormData -> service (which validates) -> form state. On success,
// refresh() re-renders /groups/[id] in the same response (no try/catch here:
// the service catches DB errors, and refresh() does not throw).

export async function addMemberAction(
  _prevState: AddMemberFormState,
  formData: FormData,
): Promise<AddMemberFormState> {
  const values = readAddMemberForm(formData);
  const result = await addMember(getDb(), values);
  if (!result.ok) return toAddMemberFormState(result.error, values);

  refresh();
  // Cleared state: the name input resets to "".
  return initialAddMemberFormState(values.groupId);
}

export async function removeMemberAction(
  _prevState: RemoveMemberFormState,
  formData: FormData,
): Promise<RemoveMemberFormState> {
  const values = readRemoveMemberForm(formData);
  const result = await removeMember(getDb(), values);

  // NOT_FOUND = already removed (e.g. in another tab): refresh so the stale row
  // disappears, with no error. The service still returns NOT_FOUND.
  if (!result.ok && result.error.code !== "NOT_FOUND") {
    return toRemoveMemberFormState(result.error, values);
  }

  refresh();
  return initialRemoveMemberFormState(values.groupId, values.memberId);
}
