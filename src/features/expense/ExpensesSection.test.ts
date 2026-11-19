import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/money";
import type { Expense } from "./service";
import {
  ADD_MEMBER_FIRST_TEXT,
  ExpensesSection,
  type ExpensesSectionProps,
} from "./ExpensesSection";

const GROUP_ID = "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const AUNG = { id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", name: "Aung" };
const BO_BO = { id: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e", name: "Bo Bo" };

const DINNER: Expense = {
  id: "3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f",
  description: "Dinner",
  amount: { amount: 123450n, currency: "MMK" },
  payer: AUNG,
  participants: [AUNG, BO_BO],
};
const NO_DESCRIPTION: Expense = {
  id: "4d5e6f7a-8b9c-4d0e-9f2a-3b4c5d6e7f8a",
  description: null,
  amount: { amount: 500n, currency: "MMK" },
  payer: BO_BO,
  participants: [BO_BO],
};

// Server-render to an HTML string: runs in the node test environment, no jsdom.
function render(props: Partial<ExpensesSectionProps> = {}): string {
  return renderToStaticMarkup(
    createElement(ExpensesSection, {
      groupId: GROUP_ID,
      currency: "MMK",
      members: [AUNG, BO_BO],
      expenses: [],
      ...props,
    }),
  );
}

const OPENER = /<button type="button"[^>]*>Add expense<\/button>/;

describe("ExpensesSection", () => {
  it("renders an Expenses heading", () => {
    expect(render()).toMatch(/<h2[^>]*>Expenses<\/h2>/);
  });

  it("with no members: shows the add-a-member text and no Add expense button", () => {
    const html = render({ members: [] });
    expect(html).toContain(ADD_MEMBER_FIRST_TEXT);
    expect(html).not.toMatch(OPENER);
    expect(html).not.toContain("<dialog");
    expect(html).not.toContain("No expenses yet.");
  });

  it("with members but no expenses: shows the empty text and the Add expense button", () => {
    const html = render();
    expect(html).toContain("No expenses yet.");
    expect(html).toMatch(OPENER);
    expect(html).not.toContain("<table");
    expect(html).not.toContain(ADD_MEMBER_FIRST_TEXT);
  });

  it("with expenses: shows the table and the Add expense button", () => {
    const html = render({ expenses: [DINNER, NO_DESCRIPTION] });
    expect(html).toMatch(OPENER);
    expect(html).not.toContain("No expenses yet.");
    const table = html.match(/<table[\s\S]*<\/table>/)?.[0] ?? "";
    const headers = [...table.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map(
      (match) => match[1],
    );
    expect(headers).toEqual(["Description", "Paid by", "Amount", "Shared by"]);
    expect(table).toContain(">Dinner<");
    expect(table).toContain(">No description<");
    expect(table).toContain(formatMoney(DINNER.amount));
    expect(table).toContain(formatMoney(NO_DESCRIPTION.amount));
    // "Shared by" lists names joined with ", " (unchanged).
    expect(table).toContain(">Aung, Bo Bo<");
  });

  // A name or description can be 100 characters with no spaces; the text
  // columns cap their content so it wraps instead of pushing Amount out of view.
  // Class check only: the real layout is covered in the PR's manual test table.
  it("caps the text columns but not Amount, so long names wrap", () => {
    const LONG = "x".repeat(100);
    const html = render({
      expenses: [
        {
          ...DINNER,
          description: LONG,
          payer: { ...AUNG, name: LONG },
          participants: [{ ...AUNG, name: LONG }, BO_BO],
        },
      ],
    });
    const row = html.match(/<tbody[\s\S]*<\/tbody>/)?.[0] ?? "";
    const tds = row.match(/<td[\s\S]*?<\/td>/g) ?? [];
    expect(tds).toHaveLength(4);
    const [description, payer, amount, participants] = tds;
    for (const cell of [description, payer, participants]) {
      expect(cell).toMatch(/<div class="[^"]*max-w-28[^"]*break-words/);
    }
    expect(description).toContain(`>${LONG}<`);
    expect(payer).toContain(`>${LONG}<`);
    expect(participants).toContain(`>${LONG}, Bo Bo<`);
    expect(amount).not.toContain("<div");
    expect(amount).toContain("whitespace-nowrap");
  });

  it("renders the Add expense button before the table", () => {
    const html = render({ expenses: [DINNER] });
    expect(html.search(OPENER)).toBeLessThan(html.indexOf("<table"));
  });
});
