"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import type { Member } from "@/features/member/service";
import { formatMoney, type Money } from "@/lib/money";
import { settleAction } from "./actions";
import {
  initialSettleFormState,
  settleFormError,
  toAmountFieldValue,
} from "./formState";

type Props = { groupId: string; from: Member; to: Member; amount: Money };

/**
 * "Mark as paid" button + confirm Modal for one "Who pays whom" line: records
 * that `from` paid `to` the full suggested `amount`. On success the Modal
 * closes and the page refreshes; the line usually disappears, but the
 * recomputed balance can contain the same line again. On error the Modal
 * stays open with the alert. There is no undo.
 */
export function SettleForm({ groupId, from, to, amount }: Props) {
  const [open, setOpen] = useState(false);
  const formId = useId();
  const amountValue = toAmountFieldValue(amount);
  const [state, formAction, pending] = useActionState(
    settleAction,
    initialSettleFormState(groupId, from.id, to.id, amountValue),
  );
  // Close on success, whatever the keys: the recomputed balance can contain a
  // line with this line's key, which keeps this mounted (docs/decisions.md).
  // Same check as AddMemberForm: a finished submit is the only source of a
  // new state object. On error nothing changes (the Modal keeps the alert).
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state.error === null) setOpen(false);
  }
  const error = settleFormError(state);
  const line = `${from.name} pays ${to.name} ${formatMoney(amount)}`;

  return (
    <>
      <Button
        variant="secondary"
        aria-label={`Mark as paid: ${line}`}
        onClick={() => setOpen(true)}
      >
        Mark as paid
      </Button>
      {/* Generic title: Modal's heading has no break-words, so the possibly
          long names go in the body instead. */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Mark as paid?"
        actions={
          // Outside the <form> (Modal footer), so tied to it with form={formId}.
          <Button type="submit" form={formId} disabled={pending}>
            {pending ? "Saving…" : "Mark as paid"}
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
            {`${from.name} paid ${to.name} ${formatMoney(amount)}. This can't be undone.`}
          </p>
          {/* Values come from props (the line), never from the form state. */}
          <input type="hidden" name="groupId" value={groupId} />
          <input type="hidden" name="fromId" value={from.id} />
          <input type="hidden" name="toId" value={to.id} />
          <input type="hidden" name="amount" value={amountValue} />
        </form>
      </Modal>
    </>
  );
}
