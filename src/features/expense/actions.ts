"use server";

import { refresh } from "next/cache";
import { getDb } from "@/server/db";
import {
  initialAddExpenseFormState,
  readAddExpenseForm,
  toAddExpenseFormState,
  type AddExpenseFormState,
} from "./formState";
import { addExpense } from "./service";

// Thin: FormData -> service (which validates, including that every id belongs
// to this group) -> form state. On success, refresh() re-renders /groups/[id]
// in the same response (no try/catch: the service catches DB errors, and
// refresh() does not throw).
export async function addExpenseAction(
  _prevState: AddExpenseFormState,
  formData: FormData,
): Promise<AddExpenseFormState> {
  const values = readAddExpenseForm(formData);
  const result = await addExpense(getDb(), values);
  if (!result.ok) return toAddExpenseFormState(result.error, values);

  refresh();
  // Cleared state: amount/description/payer reset, every member checked again.
  return initialAddExpenseFormState(values.groupId);
}
