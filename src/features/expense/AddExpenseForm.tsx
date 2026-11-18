"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/Button";
import { CheckboxGroup } from "@/components/CheckboxGroup";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { RadioGroup } from "@/components/RadioGroup";
import type { CurrencyCode } from "@/lib/currency";
import { fieldError } from "@/lib/formState";
import { AMOUNT_MAX_MINOR_UNITS, DESCRIPTION_MAX_LENGTH } from "@/lib/limits";
import { formatAmount } from "@/lib/money";
import { addExpenseAction } from "./actions";
import { addExpenseFormError, initialAddExpenseFormState } from "./formState";

type Props = {
  groupId: string;
  currency: CurrencyCode;
  members: readonly { id: string; name: string }[];
};

/** "Add expense" button + Modal with the form. Closes on success, (re)opens on error. */
export function AddExpenseForm({ groupId, currency, members }: Props) {
  const [open, setOpen] = useState(false);
  const formId = useId();
  const [state, formAction, pending] = useActionState(
    addExpenseAction,
    initialAddExpenseFormState(groupId),
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
  const topError = addExpenseFormError(state);
  const options = members.map((member) => ({
    value: member.id,
    label: member.name,
  }));
  const maxAmount = formatAmount({ amount: AMOUNT_MAX_MINOR_UNITS, currency });

  // React resets uncontrolled fields after an action; defaults come from
  // state, so a failed submit keeps what was sent and a success clears it.
  // With no error (first render or after a success) everyone shares.
  // The <dialog> stays mounted while closed, so Close/Esc keeps a draft.
  return (
    <>
      <Button onClick={() => setOpen(true)}>Add expense</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add expense"
        actions={
          // Outside the <form> (Modal footer), so tied to it with form={formId}.
          <Button type="submit" form={formId} disabled={pending}>
            {pending ? "Adding…" : "Add expense"}
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
            label={`Amount (${currency})`}
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="1,000.00"
            hint={`Up to 2 decimal places, at most ${maxAmount}`}
            defaultValue={state.values.amount}
            error={fieldError(state, "amount")}
          />
          <Input
            label="Description (optional)"
            name="description"
            autoComplete="off"
            placeholder="Dinner"
            maxLength={DESCRIPTION_MAX_LENGTH}
            hint={`Up to ${DESCRIPTION_MAX_LENGTH} characters`}
            defaultValue={state.values.description}
            error={fieldError(state, "description")}
          />
          <RadioGroup
            label="Paid by"
            name="payerId"
            options={options}
            defaultValue={state.values.payerId}
            error={fieldError(state, "payerId")}
          />
          <CheckboxGroup
            label="Shared by"
            name="participantIds"
            options={options}
            defaultValues={
              state.error
                ? state.values.participantIds
                : members.map((member) => member.id)
            }
            hint="Split equally between everyone checked."
            error={fieldError(state, "participantIds")}
          />
        </form>
      </Modal>
    </>
  );
}
