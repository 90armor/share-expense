import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/Card";
import { ExpensesSection } from "@/features/expense/ExpensesSection";
import { listExpenses } from "@/features/expense/service";
import { getGroup } from "@/features/group/service";
import { MembersSection } from "@/features/member/MembersSection";
import { listMembers } from "@/features/member/service";
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
          <Card className="w-full max-w-2xl">
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

  // Order: the list is the focus. Balance (next feature) goes above Expenses.
  // Members sit below; ExpensesSection's empty text says "below" (keep in sync).
  return (
    <Card className="flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold break-words">{group.name}</h1>
        <dl className="flex gap-2">
          <dt className="text-muted">Currency</dt>
          <dd className="font-medium">{group.currency}</dd>
        </dl>
      </div>
      <ExpensesSection
        groupId={group.id}
        currency={group.currency}
        members={members.value}
        expenses={expenses.value}
      />
      <MembersSection groupId={group.id} members={members.value} />
    </Card>
  );
}
