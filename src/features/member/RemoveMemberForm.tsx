"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { removeMemberAction } from "./actions";
import {
  initialRemoveMemberFormState,
  removeMemberFormError,
  type RemoveMemberFormState,
} from "./formState";

type Props = { groupId: string; memberId: string; memberName: string };

/** Remove button + confirm Modal. On success the row disappears (refresh), unmounting this. */
export function RemoveMemberForm({ groupId, memberId, memberName }: Props) {
  const [open, setOpen] = useState(false);
  const formId = useId();
  const [state, formAction, pending] = useActionState(
    removeMemberAction,
    initialRemoveMemberFormState(groupId, memberId),
  );
  // Same dismissal as AddMemberForm: the state the user closed the Modal on
  // keeps its error hidden on reopen; a finished submit shows again.
  const [dismissed, setDismissed] = useState<RemoveMemberFormState | null>(
    null,
  );
  const error = state !== dismissed ? removeMemberFormError(state) : undefined;

  return (
    <>
      {/* shrink-0: a direct flex item of the member row; Button's min-w-11
          would otherwise let a long name squeeze it below its text width. */}
      <Button
        variant="secondary"
        className="shrink-0"
        aria-label={`Remove ${memberName}`}
        onClick={() => setOpen(true)}
      >
        Remove
      </Button>
      {/* Generic title: Modal's heading has no break-words, so the possibly
          long name goes in the body instead. */}
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setDismissed(state);
        }}
        title="Remove member?"
        actions={
          // Outside the <form> (Modal footer), so tied to it with form={formId}.
          <Button
            type="submit"
            form={formId}
            variant="danger"
            disabled={pending}
          >
            {pending ? "Removing…" : "Remove member"}
          </Button>
        }
      >
        <form id={formId} action={formAction} className="flex flex-col gap-4">
          {error && (
            <p
              role="alert"
              className="rounded-md bg-danger-subtle px-3 py-2 text-sm font-medium break-words text-danger"
            >
              Error: {error}
            </p>
          )}
          <p className="break-words text-muted">
            {memberName} will be removed from this group.
          </p>
          <input type="hidden" name="groupId" value={groupId} />
          <input type="hidden" name="memberId" value={memberId} />
        </form>
      </Modal>
    </>
  );
}
