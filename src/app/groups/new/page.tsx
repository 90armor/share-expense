import type { Metadata } from "next";
import { Card } from "@/components/Card";
import { CreateGroupForm } from "@/features/group/CreateGroupForm";

export const metadata: Metadata = { title: "Create a group" };

// Static page (no request data): the form posts to a Server Action.
export default function NewGroupPage() {
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-16">
      <Card className="flex w-full max-w-md flex-col gap-6">
        <h1 className="text-2xl font-semibold">Create a group</h1>
        <CreateGroupForm />
      </Card>
    </main>
  );
}
