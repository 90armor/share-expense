import { Card } from "@/components/Card";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold">Share Expense</h1>
        <p className="mt-2 text-muted">
          Split group expenses and see who owes whom. Coming soon.
        </p>
      </Card>
    </main>
  );
}
