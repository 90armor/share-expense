import type { AppError } from "@/lib/appError";
import {
  formError,
  readFormFields,
  toFormState,
  type FormState,
} from "@/lib/formState";

// ---- Add member: hidden groupId + visible name ----

/** Fields read from the form. Only `name` is shown; a groupId error shows at form level. */
export const ADD_MEMBER_FIELDS = ["groupId", "name"] as const;
const ADD_MEMBER_VISIBLE_FIELDS = ["name"] as const;
export type AddMemberField = (typeof ADD_MEMBER_FIELDS)[number];
export type AddMemberFormValues = Record<AddMemberField, string>;
export type AddMemberFormState = FormState<AddMemberField>;

/** Also the state after a successful add, so the name field clears. */
export function initialAddMemberFormState(groupId: string): AddMemberFormState {
  return { error: null, values: { groupId, name: "" } };
}

export function readAddMemberForm(formData: FormData): AddMemberFormValues {
  return readFormFields(formData, ADD_MEMBER_FIELDS);
}

export function toAddMemberFormState(
  error: AppError,
  values: AddMemberFormValues,
): AddMemberFormState {
  return toFormState(error, values);
}

export function addMemberFormError(
  state: AddMemberFormState,
): string | undefined {
  return formError(state, ADD_MEMBER_VISIBLE_FIELDS);
}

// ---- Remove member: both ids hidden, every error at form level ----

export const REMOVE_MEMBER_FIELDS = ["groupId", "memberId"] as const;
export type RemoveMemberField = (typeof REMOVE_MEMBER_FIELDS)[number];
export type RemoveMemberFormValues = Record<RemoveMemberField, string>;
export type RemoveMemberFormState = FormState<RemoveMemberField>;

export function initialRemoveMemberFormState(
  groupId: string,
  memberId: string,
): RemoveMemberFormState {
  return { error: null, values: { groupId, memberId } };
}

export function readRemoveMemberForm(
  formData: FormData,
): RemoveMemberFormValues {
  return readFormFields(formData, REMOVE_MEMBER_FIELDS);
}

export function toRemoveMemberFormState(
  error: AppError,
  values: RemoveMemberFormValues,
): RemoveMemberFormState {
  return toFormState(error, values);
}

export function removeMemberFormError(
  state: RemoveMemberFormState,
): string | undefined {
  return formError(state, []);
}
