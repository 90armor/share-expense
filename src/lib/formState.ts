import type { AppError } from "./appError";

/** A text field, or a multi-value field (e.g. checkboxes sharing a name). */
export type FormValue = string | string[];

/**
 * Serializable state shared by a Server Action and its form. `values` are the
 * raw strings the user sent, so a failed submit can redisplay them. `V` only
 * needs setting for a form with a multi-value field.
 */
export type FormState<
  F extends string,
  V extends Record<F, FormValue> = Record<F, string>,
> = {
  error: AppError | null;
  values: V;
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

/** Every text entry of a multi-value field (e.g. checkboxes sharing a name), in order. Files are dropped. No trimming. */
export function readFormList(formData: FormData, field: string): string[] {
  return formData
    .getAll(field)
    .filter((value): value is string => typeof value === "string");
}

/** Service error -> form state. Only VALIDATION errors carry field messages. */
export function toFormState<
  F extends string,
  V extends Record<F, FormValue> = Record<F, string>,
>(error: AppError, values: V): FormState<F, V> {
  const safeError: AppError =
    error.code === "VALIDATION" && error.fields
      ? {
          code: error.code,
          message: error.message,
          fields: { ...error.fields },
        }
      : { code: error.code, message: error.message };
  // Copy arrays too, so later changes to the input cannot leak into the state.
  const copied = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      Array.isArray(value) ? [...value] : value,
    ]),
  ) as V;
  return { error: safeError, values: copied };
}

/** Message for one field's `error` prop (VALIDATION only). */
export function fieldError<F extends string>(
  state: FormState<F, Record<F, FormValue>>,
  field: F,
): string | undefined {
  if (state.error?.code !== "VALIDATION") return undefined;
  return state.error.fields?.[field];
}

/** Message for the top of the form: non-field errors, or VALIDATION issues no visible field shows. */
export function formError<F extends string>(
  state: FormState<F, Record<F, FormValue>>,
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
