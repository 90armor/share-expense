"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { RadioGroup } from "@/components/RadioGroup";
import { CURRENCY_CODES } from "@/lib/currency";
import { createGroupAction } from "./actions";
import {
  fieldError,
  formError,
  initialCreateGroupFormState,
} from "./formState";

const currencyOptions = CURRENCY_CODES.map((code) => ({
  value: code,
  label: code,
}));

export function CreateGroupForm() {
  const [state, formAction, pending] = useActionState(
    createGroupAction,
    initialCreateGroupFormState,
  );
  const topError = formError(state);

  // React resets uncontrolled fields after an action; the default* props come
  // from state.values, so the reset restores what the user submitted.
  return (
    <form action={formAction} className="flex flex-col gap-6">
      {topError && (
        <p
          role="alert"
          className="rounded-md bg-danger-subtle px-3 py-2 text-sm font-medium text-danger"
        >
          Error: {topError}
        </p>
      )}
      <Input
        label="Group name"
        name="name"
        autoComplete="off"
        placeholder="Trip to Bagan"
        defaultValue={state.values.name}
        error={fieldError(state, "name")}
      />
      <RadioGroup
        label="Currency"
        name="currency"
        options={currencyOptions}
        defaultValue={state.values.currency}
        hint="All amounts in this group use this currency."
        error={fieldError(state, "currency")}
      />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creating…" : "Create group"}
      </Button>
    </form>
  );
}
