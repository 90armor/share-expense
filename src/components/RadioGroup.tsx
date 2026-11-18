import { useId } from "react";
import { cx } from "@/lib/cx";

export type RadioOption = { value: string; label: string };

export type RadioGroupProps = {
  /** Shown as the fieldset legend. */
  label: string;
  name: string;
  options: readonly RadioOption[];
  /** Uncontrolled: the option checked on render (and after a form reset). */
  defaultValue?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
};

export function RadioGroup({
  label,
  name,
  options,
  defaultValue,
  hint,
  error,
  disabled,
}: RadioGroupProps) {
  const id = useId();
  const legendId = `${id}-legend`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <fieldset
      role="radiogroup"
      aria-labelledby={legendId}
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
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
              "flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-md bg-surface px-3 text-base text-ink",
              "has-checked:font-medium has-disabled:cursor-not-allowed has-disabled:bg-paper has-disabled:text-muted",
              error ? "border-2 border-danger" : "border border-border-strong",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={option.value === defaultValue}
              className="size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            />
            <span className="min-w-0 break-words">{option.label}</span>
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
