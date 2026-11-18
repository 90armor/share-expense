import { useId } from "react";
import { cx } from "@/lib/cx";

export type CheckboxOption = { value: string; label: string };

export type CheckboxGroupProps = {
  /** Shown as the fieldset legend. */
  label: string;
  /** Shared by every checkbox, so the form sends one entry per checked box. */
  name: string;
  options: readonly CheckboxOption[];
  /** Uncontrolled: the options checked on render (and after a form reset). */
  defaultValues?: readonly string[];
  hint?: string;
  error?: string;
  disabled?: boolean;
};

export function CheckboxGroup({
  label,
  name,
  options,
  defaultValues = [],
  hint,
  error,
  disabled,
}: CheckboxGroupProps) {
  const id = useId();
  const legendId = `${id}-legend`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  // A <fieldset> is a group named by its legend. aria-invalid goes on each
  // checkbox: the checkbox role supports it, the group role does not.
  return (
    <fieldset
      aria-labelledby={legendId}
      aria-describedby={describedBy}
      disabled={disabled}
      // min-w-0: a fieldset defaults to min-inline-size: min-content, so a
      // long unbreakable label would make it wider than its container.
      className="flex min-w-0 flex-col gap-1.5"
    >
      <legend id={legendId} className="mb-1.5 text-sm font-medium text-ink">
        {label}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={cx(
              "flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-md bg-surface px-3 text-base break-words text-ink",
              "has-checked:font-medium has-disabled:cursor-not-allowed has-disabled:bg-paper has-disabled:text-muted",
              error ? "border-2 border-danger" : "border border-border-strong",
            )}
          >
            <input
              type="checkbox"
              name={name}
              value={option.value}
              defaultChecked={defaultValues.includes(option.value)}
              aria-invalid={error ? true : undefined}
              className="size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            />
            <span className="min-w-0">{option.label}</span>
          </label>
        ))}
      </div>
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-danger">
          Error: {error}
        </p>
      )}
    </fieldset>
  );
}
