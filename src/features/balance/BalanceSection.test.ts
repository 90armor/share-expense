import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Money } from "@/lib/money";
import {
  ALL_SETTLED_TEXT,
  BalanceSection,
  NO_EXPENSES_TEXT,
  NO_MEMBERS_TEXT,
} from "./BalanceSection";
import type { BalanceView } from "./balanceView";

const AUNG = { id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", name: "Aung" };
const BO_BO = { id: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e", name: "Bo Bo" };
const CHIT = { id: "3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f", name: "Chit" };
const DAW = { id: "4d5e6f7a-8b9c-4d0e-9f2a-3b4c5d6e7f8a", name: "Daw" };

const usd = (amount: bigint): Money => ({ amount, currency: "USD" });

// Example 1 of src/lib/balance.test.ts, plus Daw with no expenses.
const EXAMPLE_1: BalanceView = {
  hasExpenses: true,
  members: [
    { ...AUNG, net: usd(6667n) },
    { ...BO_BO, net: usd(-3334n) },
    { ...CHIT, net: usd(-3333n) },
    { ...DAW, net: usd(0n) },
  ],
  transfers: [
    { from: BO_BO, to: AUNG, amount: usd(3334n) },
    { from: CHIT, to: AUNG, amount: usd(3333n) },
  ],
};

const ALL_SETTLED: BalanceView = {
  hasExpenses: true,
  members: [
    { ...AUNG, net: usd(0n) },
    { ...BO_BO, net: usd(0n) },
  ],
  transfers: [],
};

const NO_EXPENSES: BalanceView = {
  hasExpenses: false,
  members: [
    { ...AUNG, net: usd(0n) },
    { ...BO_BO, net: usd(0n) },
  ],
  transfers: [],
};

const NO_MEMBERS: BalanceView = {
  hasExpenses: false,
  members: [],
  transfers: [],
};

// Server-render to an HTML string: runs in the node test environment, no jsdom.
const render = (view: BalanceView): string =>
  renderToStaticMarkup(createElement(BalanceSection, { view }));

const MINUS = "−";

/** Class tokens of the <span> whose whole text is `text`, or null. */
function spanClasses(html: string, text: string): string[] | null {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(
    new RegExp(`<span class="([^"]*)">${escaped}</span>`),
  );
  return match ? match[1].split(/\s+/) : null;
}

/** Text of each <li> in the list labelled by `headingId`, tags stripped. */
function listItems(html: string, headingId: string): string[] {
  const list =
    html.match(
      new RegExp(
        `<ul[^>]*aria-labelledby="${headingId}"[^>]*>([\\s\\S]*?)</ul>`,
      ),
    )?.[1] ?? "";
  return [...list.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) =>
    m[1].replace(/<[^>]*>/g, ""),
  );
}

describe("BalanceSection", () => {
  it("renders a Balance heading", () => {
    expect(render(EXAMPLE_1)).toMatch(
      /<h2 id="balance-heading"[^>]*>Balance<\/h2>/,
    );
  });

  it("lists who pays whom first, in the given (greedy) order, in ink", () => {
    const html = render(EXAMPLE_1);
    expect(html).toMatch(
      /<h3 id="balance-transfers-heading"[^>]*>Who pays whom<\/h3>/,
    );
    expect(listItems(html, "balance-transfers-heading")).toEqual([
      "Bo Bo pays Aung USD 33.34",
      "Chit pays Aung USD 33.33",
    ]);
    expect(html.indexOf("Who pays whom")).toBeLessThan(
      html.indexOf("Per member"),
    );
    // Transfer lines never use the money colours.
    const transfers =
      html.match(
        /aria-labelledby="balance-transfers-heading"[\s\S]*?<\/ul>/,
      )?.[0] ?? "";
    expect(transfers).not.toMatch(/text-owe/);
  });

  it("per member: 'is owed' with + and text-owed, 'owes' with − and text-owe, 'settled up' muted with no sign", () => {
    const html = render(EXAMPLE_1);
    expect(listItems(html, "balance-members-heading")).toEqual([
      "Aungis owed +USD 66.67",
      `Bo Boowes ${MINUS}USD 33.34`,
      `Chitowes ${MINUS}USD 33.33`,
      "Dawsettled up USD 0.00",
    ]);

    const owed = spanClasses(html, "is owed +USD 66.67");
    expect(owed).toContain("text-owed");
    expect(owed).not.toContain("text-owe");

    const owes = spanClasses(html, `owes ${MINUS}USD 33.34`);
    expect(owes).toContain("text-owe");
    expect(owes).not.toContain("text-owed");

    const settled = spanClasses(html, "settled up USD 0.00");
    expect(settled).toContain("text-muted");
    expect(settled).not.toContain("text-owe");
    expect(settled).not.toContain("text-owed");

    // The minus is U+2212, never an ASCII hyphen; danger is not for money.
    expect(html).not.toContain("USD -");
    expect(html).not.toContain("danger");
  });

  it("everyone settled: the settled text instead of transfers, and the list still shown", () => {
    const html = render(ALL_SETTLED);
    expect(html).toContain(ALL_SETTLED_TEXT);
    expect(html).not.toContain('aria-labelledby="balance-transfers-heading"');
    expect(listItems(html, "balance-members-heading")).toEqual([
      "Aungsettled up USD 0.00",
      "Bo Bosettled up USD 0.00",
    ]);
    expect(html).not.toContain(NO_EXPENSES_TEXT);
    expect(html).not.toContain(NO_MEMBERS_TEXT);
  });

  it("members but no expenses: one line, no lists", () => {
    const html = render(NO_EXPENSES);
    expect(html).toContain(NO_EXPENSES_TEXT);
    expect(html).not.toContain("<ul");
    expect(html).not.toContain(ALL_SETTLED_TEXT);
    expect(html).not.toContain(NO_MEMBERS_TEXT);
  });

  it("no members: one line, no lists", () => {
    const html = render(NO_MEMBERS);
    expect(html).toContain(NO_MEMBERS_TEXT);
    expect(html).not.toContain("<ul");
    expect(html).not.toContain(NO_EXPENSES_TEXT);
    expect(html).not.toContain(ALL_SETTLED_TEXT);
  });

  it("empty-state texts", () => {
    expect(NO_MEMBERS_TEXT).toBe(
      "Add members and expenses to see who owes whom.",
    );
    expect(NO_EXPENSES_TEXT).toBe(
      "No expenses yet, so everyone is settled up.",
    );
    expect(ALL_SETTLED_TEXT).toBe(
      "Everyone is settled up. No payments needed.",
    );
  });

  it("long names can wrap: break-words on transfer lines, min-w-0 + break-words on member names", () => {
    const long = { id: AUNG.id, name: "A".repeat(100) };
    const html = render({
      hasExpenses: true,
      members: [
        { ...long, net: usd(100n) },
        { ...BO_BO, net: usd(-100n) },
      ],
      transfers: [{ from: BO_BO, to: long, amount: usd(100n) }],
    });
    const nameSpan = spanClasses(html, long.name);
    expect(nameSpan).toContain("min-w-0");
    expect(nameSpan).toContain("break-words");
    const transferLi = html.match(
      new RegExp(`<li class="([^"]*)">Bo Bo pays ${long.name} `),
    );
    expect(transferLi?.[1].split(/\s+/)).toContain("break-words");
  });

  it("is read-only: no Settle button, no form, no paid state", () => {
    for (const view of [EXAMPLE_1, ALL_SETTLED, NO_EXPENSES, NO_MEMBERS]) {
      const html = render(view);
      expect(html).not.toContain("<button");
      expect(html).not.toContain("<form");
      expect(html).not.toMatch(/\bsettle\b/i);
      expect(html).not.toMatch(/\bpaid\b/i);
    }
  });
});
