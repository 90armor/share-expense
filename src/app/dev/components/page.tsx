import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { CheckboxGroup } from "@/components/CheckboxGroup";
import { Input } from "@/components/Input";
import { RadioGroup } from "@/components/RadioGroup";
import { Table } from "@/components/Table";
import { CURRENCY_CODES } from "@/lib/currency";
import { formatMoney, type Money } from "@/lib/money";
import { ModalDemo } from "./ModalDemo";

export const metadata: Metadata = {
  title: "Components (dev)",
  robots: { index: false },
};

const swatches = [
  ["paper", "bg-paper"],
  ["surface", "bg-surface"],
  ["border", "bg-border"],
  ["border-strong", "bg-border-strong"],
  ["ink", "bg-ink"],
  ["muted", "bg-muted"],
  ["primary", "bg-primary"],
  ["primary-hover", "bg-primary-hover"],
  ["on-primary", "bg-on-primary"],
  ["owe", "bg-owe"],
  ["owe-subtle", "bg-owe-subtle"],
  ["owed", "bg-owed"],
  ["owed-subtle", "bg-owed-subtle"],
  ["warning", "bg-warning"],
  ["warning-subtle", "bg-warning-subtle"],
  ["danger", "bg-danger"],
  ["danger-hover", "bg-danger-hover"],
  ["danger-subtle", "bg-danger-subtle"],
  ["focus", "bg-focus"],
] as const;

const memberOptions = [
  { value: "aung", label: "Aung" },
  { value: "bobo", label: "Bo Bo" },
  { value: "chit", label: "Chit" },
];

const currencyOptions = CURRENCY_CODES.map((code) => ({
  value: code,
  label: code,
}));

// Sample amounts go through the shared formatter so this page cannot drift from it.
const youOwe: Money = { amount: 1_200_000n, currency: "MMK" };
const owesYou: Money = { amount: 850_000n, currency: "MMK" };
const settled: Money = { amount: 0n, currency: "MMK" };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function ComponentsPage() {
  // Dev-only preview: a production build prerenders this route as a 404.
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-4 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Components</h1>
        <p className="text-muted">
          Dev-only preview of design tokens and base components.
        </p>
      </header>

      <Section title="Color tokens">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {swatches.map(([name, bg]) => (
            <li key={name} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={`size-10 shrink-0 rounded-md border border-border ${bg}`}
              />
              <code className="font-mono text-sm">{name}</code>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Button">
        {(["md", "lg"] as const).map((size) => (
          <div key={size} className="flex flex-wrap items-center gap-3">
            <Button size={size}>Primary {size}</Button>
            <Button size={size} variant="secondary">
              Secondary {size}
            </Button>
            <Button size={size} variant="ghost">
              Ghost {size}
            </Button>
            <Button size={size} variant="danger">
              Delete {size}
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled>Primary disabled</Button>
          <Button disabled variant="secondary">
            Secondary disabled
          </Button>
          <Button disabled variant="ghost">
            Ghost disabled
          </Button>
          <Button disabled variant="danger">
            Danger disabled
          </Button>
        </div>
      </Section>

      <Section title="Input">
        <div className="grid gap-6 sm:grid-cols-2">
          <Input label="Group name" placeholder="Trip to Bagan" />
          <Input
            label="Amount"
            hint="Up to 2 decimal places."
            inputMode="decimal"
          />
          <Input
            label="Member name"
            defaultValue=""
            hint="Shown to everyone in the group."
            error="Name is required."
          />
          <Input label="Currency" defaultValue="MMK" disabled />
        </div>
      </Section>

      <Section title="RadioGroup">
        <div className="grid gap-6 sm:grid-cols-2">
          <RadioGroup
            label="Currency"
            name="demo-currency"
            options={currencyOptions}
            defaultValue="MMK"
            hint="All amounts in this group use this currency."
          />
          <RadioGroup
            label="Currency"
            name="demo-currency-error"
            options={currencyOptions}
            error="Unsupported currency"
          />
          <RadioGroup
            label="Currency"
            name="demo-currency-disabled"
            options={currencyOptions}
            defaultValue="USD"
            disabled
          />
        </div>
      </Section>

      <Section title="CheckboxGroup">
        <div className="grid gap-6 sm:grid-cols-2">
          <CheckboxGroup
            label="Shared by"
            name="demo-shared"
            options={memberOptions}
            defaultValues={["aung", "chit"]}
            hint="Split equally between everyone checked."
          />
          <CheckboxGroup
            label="Shared by"
            name="demo-shared-error"
            options={memberOptions}
            error="Choose at least one person"
          />
          <CheckboxGroup
            label="Shared by"
            name="demo-shared-disabled"
            options={memberOptions}
            defaultValues={["bobo"]}
            disabled
          />
        </div>
      </Section>

      <Section title="Card">
        <Card>
          <h3 className="text-lg font-semibold">Weekend trip</h3>
          <p className="mt-1 text-muted">4 members · 12 expenses</p>
        </Card>
      </Section>

      <Section title="Table">
        <Table
          caption="Balances (sample data)"
          columns={[
            { key: "member", header: "Member" },
            { key: "status", header: "Status" },
            { key: "amount", header: "Amount", align: "right" },
          ]}
          rows={[
            {
              member: "Aung",
              status: <span className="font-medium text-owe">You owe</span>,
              amount: <span className="text-owe">{formatMoney(youOwe)}</span>,
            },
            {
              member: "Hnin",
              status: <span className="font-medium text-owed">Owes you</span>,
              amount: <span className="text-owed">{formatMoney(owesYou)}</span>,
            },
            {
              member: "Kyaw",
              status: <span className="text-muted">Settled</span>,
              amount: formatMoney(settled),
            },
          ]}
        />
      </Section>

      <Section title="Status colors">
        <div className="flex flex-col gap-2">
          <p className="rounded-md bg-owe-subtle px-3 py-2 text-owe">
            You owe: {formatMoney(youOwe)}
          </p>
          <p className="rounded-md bg-owed-subtle px-3 py-2 text-owed">
            Owed to you: {formatMoney(owesYou)}
          </p>
          <p className="rounded-md bg-warning-subtle px-3 py-2 text-warning">
            Warning: This group has unsettled balances.
          </p>
          <p className="rounded-md bg-danger-subtle px-3 py-2 text-danger">
            Danger: Deleting a group cannot be undone.
          </p>
        </div>
      </Section>

      <Section title="Modal">
        <div>
          <ModalDemo />
        </div>
      </Section>
    </main>
  );
}
