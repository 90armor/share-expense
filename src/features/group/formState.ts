import type { AppError } from "@/lib/appError";

/** Form fields, in display order. Field errors for any other key show at form level. */
export const CREATE_GROUP_FIELDS = ["name", "currency"] as const;
export type CreateGroupField = (typeof CREATE_GROUP_FIELDS)[number];

/** Raw strings as the user typed them, so a failed submit can redisplay them. */
export type CreateGroupFormValues = Record<CreateGroupField, string>;

/** Serializable state shared by the server action and the form. */
export type CreateGroupFormState = {
  error: AppError | null;
  values: CreateGroupFormValues;
};

export const initialCreateGroupFormState: CreateGroupFormState = {
  error: null,
  values: { name: "", currency: "MMK" },
};

/** FormData -> plain values. Missing or non-text entries become "". No trimming: validation is the service's job. */
export function readCreateGroupForm(formData: FormData): CreateGroupFormValues {
  const read = (field: CreateGroupField) => {
    const value = formData.get(field);
    return typeof value === "string" ? value : "";
  };
  return { name: read("name"), currency: read("currency") };
}

/** Service error -> form state. Only VALIDATION errors carry field messages. */
export function toCreateGroupFormState(
  error: AppError,
  values: CreateGroupFormValues,
): CreateGroupFormState {
  const safeError: AppError =
    error.code === "VALIDATION" && error.fields
      ? {
          code: error.code,
          message: error.message,
          fields: { ...error.fields },
        }
      : { code: error.code, message: error.message };
  return { error: safeError, values: { ...values } };
}

export function fieldError(
  state: CreateGroupFormState,
  field: CreateGroupField,
): string | undefined {
  if (state.error?.code !== "VALIDATION") return undefined;
  return state.error.fields?.[field];
}

/** Message for the top of the form: non-field errors, or VALIDATION issues no field shows. */
export function formError(state: CreateGroupFormState): string | undefined {
  const { error } = state;
  if (!error) return undefined;
  if (error.code !== "VALIDATION") return error.message;

  const visible: readonly string[] = CREATE_GROUP_FIELDS;
  const hidden = Object.entries(error.fields ?? {}).find(
    ([key]) => !visible.includes(key),
  );
  return hidden?.[1];
}
