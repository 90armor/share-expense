"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { fieldError } from "@/lib/formState";
import { NAME_MAX_LENGTH } from "@/lib/limits";
import { addMemberAction } from "./actions";
import { addMemberFormError, initialAddMemberFormState } from "./formState";

/** "Add member" button + Modal with the form. Closes on success, (re)opens on error. */
export function AddMemberForm({ groupId }: { groupId: string }) {
  const [open, setOpen] = useState(false);
  const formId = useId();
  const [state, formAction, pending] = useActionState(
    addMemberAction,
    initialAddMemberFormState(groupId),
  );
  // useActionState returns its stored initial state object until a submit
  // finishes, so seen === state on every render before that (Strict Mode's
  // double render included). A finished submit is the only source of a new
  // object: no error -> close (never open), error -> open, even if the user
  // closed the Modal while it was pending.
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    setOpen(state.error !== null);
  }
  const topError = addMemberFormError(state);

  // React resets uncontrolled fields after an action; defaultValue comes from
  // state.values, so a failed submit keeps the name and a success clears it.
  // The <dialog> stays mounted while closed, so Close/Esc keeps a draft.
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Add member
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add member"
        actions={
          // Outside the <form> (Modal footer), so tied to it with form={formId}.
          <Button type="submit" form={formId} disabled={pending}>
            {pending ? "Adding…" : "Add member"}
          </Button>
        }
      >
        <form id={formId} action={formAction} className="flex flex-col gap-4">
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
        </form>
      </Modal>
    </>
  );
}
