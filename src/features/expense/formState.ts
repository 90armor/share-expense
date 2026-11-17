import type { AppError } from "@/lib/appError";
import {
  formError,
  readFormFields,
  readFormList,
  toFormState,
  type FormState,
} from "@/lib/formState";

// Hidden groupId + visible payer, amount, description and participant checkboxes.
export const ADD_EXPENSE_TEXT_FIELDS = [
  "groupId",
  "payerId",
  "amount",
  "description",
] as const;
type AddExpenseTextField = (typeof ADD_EXPENSE_TEXT_FIELDS)[number];
export type AddExpenseField = AddExpenseTextField | "participantIds";
const ADD_EXPENSE_VISIBLE_FIELDS = [
  "payerId",
  "amount",
  "description",
  "participantIds",
] as const;

export type AddExpenseFormValues = Record<AddExpenseTextField, string> & {
  participantIds: string[];
};
export type AddExpenseFormState = FormState<
  AddExpenseField,
  AddExpenseFormValues
>;

/** Also the state after a successful add, so every field clears. */
export function initialAddExpenseFormState(
  groupId: string,
): AddExpenseFormState {
  return {
    error: null,
    values: {
      groupId,
      payerId: "",
      amount: "",
      description: "",
      participantIds: [],
    },
  };
}

export function readAddExpenseForm(formData: FormData): AddExpenseFormValues {
  return {
    ...readFormFields(formData, ADD_EXPENSE_TEXT_FIELDS),
    participantIds: readFormList(formData, "participantIds"),
  };
}

export function toAddExpenseFormState(
  error: AppError,
  values: AddExpenseFormValues,
): AddExpenseFormState {
  return toFormState(error, values);
}

export function addExpenseFormError(
  state: AddExpenseFormState,
): string | undefined {
  return formError(state, ADD_EXPENSE_VISIBLE_FIELDS);
}
