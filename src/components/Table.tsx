import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export type TableColumn = {
  key: string;
  header: string;
  align?: "left" | "right";
  /**
   * Pin this column to the right edge of the scroll area, so it stays visible
   * when a very long word makes the table scroll sideways (e.g. an Amount
   * column). Opaque background + a left separator, so scrolled text does not
   * run into it. Not a wrapping fix: the text columns still scroll. Use it on
   * the last column only: `right-0` sticky pushes a cell left, so a column
   * followed by others scrolls away once you pass it.
   */
  sticky?: boolean;
};

export type TableProps = {
  caption: string;
  columns: TableColumn[];
  rows: Record<string, ReactNode>[];
};

// `border-collapse` borders do not move with a sticky cell, so the separator is
// an inset shadow (drawn by the cell itself) using the border token.
const STICKY = "sticky right-0 shadow-[inset_1px_0_0_var(--color-border)]";

export function Table({ caption, columns, rows }: TableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full border-collapse text-sm">
        <caption className="px-4 py-3 text-left font-medium text-ink">
          {caption}
        </caption>
        <thead>
          <tr className="border-y border-border bg-paper">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cx(
                  "px-4 py-3 font-medium text-muted",
                  column.align === "right" ? "text-right" : "text-left",
                  column.sticky && cx(STICKY, "bg-paper"),
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-border last:border-b-0">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cx(
                    "px-4 py-3 text-ink",
                    column.align === "right" ? "text-right" : "text-left",
                    column.sticky && cx(STICKY, "bg-surface"),
                  )}
                >
                  {row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
