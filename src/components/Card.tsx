import type { HTMLAttributes } from "react";
import { cx } from "@/lib/cx";

export type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cx(
        "rounded-lg border border-border bg-surface p-6 shadow-card",
        className,
      )}
      {...props}
    />
  );
}
