import type { AppError } from "@/lib/appError";
import {
  fieldError as libFieldError,
  formError as libFormError,
  readFormFields,
  toFormState,
  type FormState,
} from "@/lib/formState";

/** Form fields, in display order. Field errors for any other key show at form level. */
export const CREATE_GROUP_FIELDS = ["name", "currency"] as const;
export type CreateGroupField = (typeof CREATE_GROUP_FIELDS)[number];

/** Raw strings as the user typed them, so a failed submit can redisplay them. */
export type CreateGroupFormValues = Record<CreateGroupField, string>;

/** Serializable state shared by the server action and the form. */
export type CreateGroupFormState = FormState<CreateGroupField>;

export const initialCreateGroupFormState: CreateGroupFormState = {
  error: null,
  values: { name: "", currency: "MMK" },
};

/** FormData -> plain values. Missing or non-text entries become "". No trimming: validation is the service's job. */
export function readCreateGroupForm(formData: FormData): CreateGroupFormValues {
  return readFormFields(formData, CREATE_GROUP_FIELDS);
}

/** Service error -> form state. Only VALIDATION errors carry field messages. */
export function toCreateGroupFormState(
  error: AppError,
  values: CreateGroupFormValues,
): CreateGroupFormState {
  return toFormState(error, values);
}

export function fieldError(
  state: CreateGroupFormState,
  field: CreateGroupField,
): string | undefined {
  return libFieldError(state, field);
}

/** Message for the top of the form: non-field errors, or VALIDATION issues no field shows. */
export function formError(state: CreateGroupFormState): string | undefined {
  return libFormError(state, CREATE_GROUP_FIELDS);
}
