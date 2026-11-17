"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/server/db";
import {
  readCreateGroupForm,
  toCreateGroupFormState,
  type CreateGroupFormState,
} from "./formState";
import { createGroup } from "./service";

/** Thin: FormData -> service (which validates) -> redirect or form state. */
export async function createGroupAction(
  _prevState: CreateGroupFormState,
  formData: FormData,
): Promise<CreateGroupFormState> {
  const values = readCreateGroupForm(formData);
  const result = await createGroup(getDb(), values);
  if (!result.ok) return toCreateGroupFormState(result.error, values);

  // redirect() throws to navigate, so it stays outside any try/catch.
  redirect(`/groups/${result.value.id}`);
}
