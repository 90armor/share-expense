import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/Card";
import { getGroup } from "@/features/group/service";
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
  return (
    <Card className="flex w-full max-w-md flex-col gap-4">
      <h1 className="text-2xl font-semibold break-words">{group.name}</h1>
      <dl className="flex gap-2">
        <dt className="text-muted">Currency</dt>
        <dd className="font-medium">{group.currency}</dd>
      </dl>
    </Card>
  );
}
