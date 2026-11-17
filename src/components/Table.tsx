import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export type TableColumn = {
  key: string;
  header: string;
  align?: "left" | "right";
};

export type TableProps = {
  caption: string;
  columns: TableColumn[];
  rows: Record<string, ReactNode>[];
};

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
