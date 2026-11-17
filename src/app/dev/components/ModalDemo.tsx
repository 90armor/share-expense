"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";

// Dev-only fake: waits, then fails, to show pending and the error alert.
async function fakeDelete(): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 800));
  return "Demo only, nothing was deleted.";
}

export function ModalDemo() {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const formId = useId();
  const [error, formAction, pending] = useActionState(fakeDelete, "");

  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={() => setOpen(true)}>Open modal</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Example modal">
        <p className="text-muted">
          Press Esc or the Close button to dismiss. Focus stays inside while it
          is open.
        </p>
      </Modal>

      <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
        Open confirm modal
      </Button>
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Delete example?"
        actions={
          <Button
            type="submit"
            form={formId}
            variant="danger"
            disabled={pending}
          >
            {pending ? "Deleting…" : "Delete"}
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
          <Input label="Reason (optional)" name="reason" />
        </form>
      </Modal>
    </div>
  );
}
