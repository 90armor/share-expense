import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const variantClasses: Record<Variant, string> = {
  primary: "bg-primary text-on-primary enabled:hover:bg-primary-hover",
  secondary:
    "border border-border-strong bg-surface text-ink enabled:hover:bg-paper",
  ghost: "text-primary underline-offset-4 enabled:hover:underline",
  danger: "bg-danger text-on-primary enabled:hover:bg-danger-hover",
};

const sizeClasses: Record<Size, string> = {
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-6 text-base",
};

export type ButtonStyle = {
  variant?: Variant;
  size?: Size;
  className?: string;
};

/** Button classes, for elements that must look like a Button (e.g. a `next/link`). */
export function buttonClassName({
  variant = "primary",
  size = "md",
  className,
}: ButtonStyle = {}): string {
  return cx(
    "inline-flex min-w-11 items-center justify-center gap-2 rounded-md font-medium transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
    "disabled:cursor-not-allowed disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

export function Button({
  variant,
  size,
  type = "button",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName({ variant, size, className })}
      {...props}
    />
  );
}
