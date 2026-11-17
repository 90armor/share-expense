"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { fieldError } from "@/lib/formState";
import { NAME_MAX_LENGTH } from "@/lib/limits";
import { addMemberAction } from "./actions";
import { addMemberFormError, initialAddMemberFormState } from "./formState";

export function AddMemberForm({ groupId }: { groupId: string }) {
  const [state, formAction, pending] = useActionState(
    addMemberAction,
    initialAddMemberFormState(groupId),
  );
  const topError = addMemberFormError(state);

  // React resets uncontrolled fields after an action; defaultValue comes from
  // state.values, so a failed submit keeps the name and a success clears it.
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {topError && (
        <p
          role="alert"
          className="rounded-md bg-danger-subtle px-3 py-2 text-sm font-medium break-words text-danger"
        >
          Error: {topError}
        </p>
      )}
      <input type="hidden" name="groupId" value={groupId} />
      <Input
        label="Member name"
        name="name"
        autoComplete="off"
        placeholder="Aung Aung"
        maxLength={NAME_MAX_LENGTH}
        hint={`Up to ${NAME_MAX_LENGTH} characters`}
        defaultValue={state.values.name}
        error={fieldError(state, "name")}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add member"}
      </Button>
    </form>
  );
}
