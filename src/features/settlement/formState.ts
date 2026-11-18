import type { AppError } from "@/lib/appError";
import {
  formError,
  readFormFields,
  toFormState,
  type FormState,
} from "@/lib/formState";
import { formatAmount, type Money } from "@/lib/money";

// Settle ("Mark as paid") form: every field is hidden (the line it belongs to),
// so every error shows at form level.
export const SETTLE_FIELDS = ["groupId", "fromId", "toId", "amount"] as const;
export type SettleField = (typeof SETTLE_FIELDS)[number];
export type SettleFormValues = Record<SettleField, string>;
export type SettleFormState = FormState<SettleField>;

export function initialSettleFormState(
  groupId: string,
  fromId: string,
  toId: string,
  amount: string,
): SettleFormState {
  return { error: null, values: { groupId, fromId, toId, amount } };
}

export function readSettleForm(formData: FormData): SettleFormValues {
  return readFormFields(formData, SETTLE_FIELDS);
}

export function toSettleFormState(
  error: AppError,
  values: SettleFormValues,
): SettleFormState {
  return toFormState(error, values);
}

export function settleFormError(state: SettleFormState): string | undefined {
  return formError(state, []);
}

/**
 * The hidden amount field: a plain decimal with no thousands separators
 * ("631192.00", not "631,192.00"), which `parseAmount` reads back exactly.
 */
export function toAmountFieldValue(money: Money): string {
  return formatAmount(money).replaceAll(",", "");
}
