"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { removeMemberAction } from "./actions";
import {
  initialRemoveMemberFormState,
  removeMemberFormError,
} from "./formState";

type Props = { groupId: string; memberId: string; memberName: string };

/** Remove button + confirm Modal. On success the row disappears (refresh), unmounting this. */
export function RemoveMemberForm({ groupId, memberId, memberName }: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    removeMemberAction,
    initialRemoveMemberFormState(groupId, memberId),
  );
  const error = removeMemberFormError(state);

  return (
    <>
      <Button
        variant="secondary"
        aria-label={`Remove ${memberName}`}
        onClick={() => setOpen(true)}
      >
        Remove
      </Button>
      {/* Generic title: Modal's heading (src/components, unchanged) has no
          break-words, so the possibly long name goes in the body instead. */}
      <Modal open={open} onClose={() => setOpen(false)} title="Remove member?">
        <form action={formAction} className="flex flex-col gap-4">
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
          <Button type="submit" variant="danger" disabled={pending}>
            {pending ? "Removing…" : "Remove member"}
          </Button>
        </form>
      </Modal>
    </>
  );
}
