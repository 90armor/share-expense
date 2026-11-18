"use server";

import { refresh } from "next/cache";
import { getDb } from "@/server/db";
import {
  readSettleForm,
  toSettleFormState,
  type SettleFormState,
} from "./formState";
import { addSettlement } from "./service";

// Thin: FormData -> service (which validates, including that both ids belong
// to this group) -> form state. On success, refresh() re-renders /groups/[id]
// in the same response: the settled line disappears, unmounting its form
// (no try/catch: the service catches DB errors, and refresh() does not throw).
export async function settleAction(
  _prevState: SettleFormState,
  formData: FormData,
): Promise<SettleFormState> {
  const values = readSettleForm(formData);
  const result = await addSettlement(getDb(), values);
  if (!result.ok) return toSettleFormState(result.error, values);

  refresh();
  return { error: null, values };
}
