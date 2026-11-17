import type { AppError } from "./appError";

/**
 * Serializable state shared by a Server Action and its form. `values` are the
 * raw strings the user sent, so a failed submit can redisplay them.
 */
export type FormState<F extends string> = {
  error: AppError | null;
  values: Record<F, string>;
};

/** FormData -> plain values for `fields` only. Missing or non-text entries become "". No trimming: validation is the service's job. */
export function readFormFields<F extends string>(
  formData: FormData,
  fields: readonly F[],
): Record<F, string> {
  const values = {} as Record<F, string>;
  for (const field of fields) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value : "";
  }
  return values;
}

/** Service error -> form state. Only VALIDATION errors carry field messages. */
export function toFormState<F extends string>(
  error: AppError,
  values: Record<F, string>,
): FormState<F> {
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

/** Message for one field's `error` prop (VALIDATION only). */
export function fieldError<F extends string>(
  state: FormState<F>,
  field: F,
): string | undefined {
  if (state.error?.code !== "VALIDATION") return undefined;
  return state.error.fields?.[field];
}

/** Message for the top of the form: non-field errors, or VALIDATION issues no visible field shows. */
export function formError<F extends string>(
  state: FormState<F>,
  visibleFields: readonly F[],
): string | undefined {
  const { error } = state;
  if (!error) return undefined;
  if (error.code !== "VALIDATION") return error.message;

  const visible: readonly string[] = visibleFields;
  const hidden = Object.entries(error.fields ?? {}).find(
    ([key]) => !visible.includes(key),
  );
  return hidden?.[1];
}
