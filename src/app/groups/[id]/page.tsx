import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/Card";
import { Table } from "@/components/Table";
import { AddExpenseForm } from "@/features/expense/AddExpenseForm";
import { listExpenses } from "@/features/expense/service";
import { getGroup } from "@/features/group/service";
import { AddMemberForm } from "@/features/member/AddMemberForm";
import { RemoveMemberForm } from "@/features/member/RemoveMemberForm";
import { listMembers } from "@/features/member/service";
import { formatMoney } from "@/lib/money";
import { getDb } from "@/server/db";

export const metadata: Metadata = { title: "Group" };

// Cache Components: `params` is request data and the group is user data, so the
// lookup runs per request inside <Suspense> (no "use cache"). The fallback is
// the prerendered shell. notFound() here streams the 404 UI with status 200 +
// noindex (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md › Status codes).
export default function GroupPage({ params }: PageProps<"/groups/[id]">) {
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-16">
      <Suspense
        fallback={
          <Card className="w-full max-w-md">
            <p className="text-muted">Loading group…</p>
          </Card>
        }
      >
        <GroupDetails params={params} />
      </Suspense>
    </main>
  );
}

async function GroupDetails({
  params,
}: {
  params: PageProps<"/groups/[id]">["params"];
}) {
  const { id } = await params;
  const result = await getGroup(getDb(), id);

  if (!result.ok) {
    // Malformed id or no such row: both are "not found" to the user, never a 500.
    if (
      result.error.code === "VALIDATION" ||
      result.error.code === "NOT_FOUND"
    ) {
      notFound();
    }
    // Details were logged by the service; the error boundary shows a generic page.
    throw new Error("Could not load group");
  }

  const group = result.value;
  const members = await listMembers(getDb(), group.id);
  // The group exists and its id is valid, so any failure here is UNEXPECTED (logged).
  if (!members.ok) throw new Error("Could not load members");
  const expenses = await listExpenses(getDb(), group.id);
  if (!expenses.ok) throw new Error("Could not load expenses");

  return (
    <Card className="flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold break-words">{group.name}</h1>
        <dl className="flex gap-2">
          <dt className="text-muted">Currency</dt>
          <dd className="font-medium">{group.currency}</dd>
        </dl>
      </div>
      <section
        aria-labelledby="members-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="members-heading" className="text-lg font-semibold">
          Members
        </h2>
        {members.value.length === 0 ? (
          <p className="text-muted">No members yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {members.value.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-4 py-2"
              >
                <span className="min-w-0 break-words">{member.name}</span>
                <RemoveMemberForm
                  groupId={group.id}
                  memberId={member.id}
                  memberName={member.name}
                />
              </li>
            ))}
          </ul>
        )}
        <AddMemberForm groupId={group.id} />
      </section>
      <section
        aria-labelledby="expenses-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="expenses-heading" className="text-lg font-semibold">
          Expenses
        </h2>
        {expenses.value.length === 0 ? (
          <p className="text-muted">No expenses yet.</p>
        ) : (
          <Table
            caption="Newest first"
            columns={[
              { key: "description", header: "Description" },
              { key: "payer", header: "Paid by" },
              { key: "amount", header: "Amount", align: "right" },
              { key: "participants", header: "Shared by" },
            ]}
            rows={expenses.value.map((expense) => ({
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
        {members.value.length === 0 ? (
          <p className="text-muted">Add a member before adding an expense.</p>
        ) : (
          <AddExpenseForm
            groupId={group.id}
            currency={group.currency}
            members={members.value}
          />
        )}
      </section>
    </Card>
  );
}
