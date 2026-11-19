import { Table } from "@/components/Table";
import type { Member } from "@/features/member/service";
import type { CurrencyCode } from "@/lib/currency";
import { formatMoney } from "@/lib/money";
import { AddExpenseForm } from "./AddExpenseForm";
import type { Expense } from "./service";

// Says "below": it depends on Members being rendered below Expenses on the
// group page. Change it together with the page order.
export const ADD_MEMBER_FIRST_TEXT =
  "Add a member below before adding an expense.";

export type ExpensesSectionProps = {
  groupId: string;
  currency: CurrencyCode;
  members: readonly Member[];
  expenses: readonly Expense[];
};

/** Expenses table (newest first) with the "Add expense" button + Modal in the heading row. */
export function ExpensesSection({
  groupId,
  currency,
  members,
  expenses,
}: ExpensesSectionProps) {
  return (
    <section aria-labelledby="expenses-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="expenses-heading" className="text-lg font-semibold">
          Expenses
        </h2>
        {/* No members: the service would reject any expense (the payer must be a member). */}
        {members.length > 0 && (
          <AddExpenseForm
            groupId={groupId}
            currency={currency}
            members={members}
          />
        )}
      </div>
      {members.length === 0 ? (
        <p className="text-muted">{ADD_MEMBER_FIRST_TEXT}</p>
      ) : expenses.length === 0 ? (
        <p className="text-muted">No expenses yet.</p>
      ) : (
        <Table
          caption="Newest first"
          columns={[
            { key: "description", header: "Description" },
            { key: "payer", header: "Paid by" },
            { key: "participants", header: "Shared by" },
            // Last and sticky: with a long name the table scrolls sideways and
            // Amount stays pinned at the right. Sticky only holds on the last column.
            { key: "amount", header: "Amount", align: "right", sticky: true },
          ]}
          rows={expenses.map((expense) => ({
            description: expense.description ?? (
              <span className="text-muted">No description</span>
            ),
            payer: expense.payer.name,
            amount: (
              <span className="whitespace-nowrap">
                {formatMoney(expense.amount)}
              </span>
            ),
            participants: expense.participants
              .map((member) => member.name)
              .join(", "),
          }))}
        />
      )}
    </section>
  );
}
