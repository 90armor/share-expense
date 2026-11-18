import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Expense, ExpenseMember } from "@/features/expense/service";
import type { Settlement } from "@/features/settlement/service";
import type { Money } from "@/lib/money";
import {
  toBalanceView,
  type BalanceView,
  type BalanceViewInput,
} from "./balanceView";

const GROUP_ID = "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b";

// Names stand in for the ids a, b, c of src/lib/balance.test.ts. The UUIDs keep
// that code-unit order (Aung < Bo Bo < Chit), so the lib's tie-breaks match.
const AUNG = { id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", name: "Aung" };
const BO_BO = { id: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e", name: "Bo Bo" };
const CHIT = { id: "3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f", name: "Chit" };
// Member with no expenses: the lib never sees Daw.
const DAW = { id: "4d5e6f7a-8b9c-4d0e-9f2a-3b4c5d6e7f8a", name: "Daw" };
// Not in the members list (e.g. a member of another group).
const OUTSIDER = {
  id: "5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b",
  name: "Outsider",
};

const usd = (amount: bigint): Money => ({ amount, currency: "USD" });

let expenseCount = 0;
function expense(
  payer: ExpenseMember,
  amount: Money,
  participants: readonly ExpenseMember[],
): Expense {
  expenseCount++;
  return {
    id: `7a8b9c0d-1e2f-4a3b-8c4d-${expenseCount.toString().padStart(12, "0")}`,
    description: null,
    amount,
    payer,
    participants,
  };
}

// Example 1 of src/lib/balance.test.ts: a pays 10001 for a, b, c.
const EXAMPLE_1 = expense(AUNG, usd(10001n), [AUNG, BO_BO, CHIT]);
// Example 2 adds: b pays 3000 for a, b.
const EXAMPLE_2 = expense(BO_BO, usd(3000n), [AUNG, BO_BO]);

let settlementCount = 0;
/** A recorded payment: `from` paid `to` `amount`. */
function settlement(
  from: ExpenseMember,
  to: ExpenseMember,
  amount: Money,
): Settlement {
  settlementCount++;
  return {
    id: `9c0d1e2f-3a4b-4c5d-8e6f-${settlementCount.toString().padStart(12, "0")}`,
    fromId: from.id,
    toId: to.id,
    amount,
  };
}

function run(input: Partial<BalanceViewInput>) {
  return toBalanceView({
    groupId: GROUP_ID,
    currency: "USD",
    members: [AUNG, BO_BO, CHIT, DAW],
    expenses: [],
    settlements: [],
    ...input,
  });
}

function view(input: Partial<BalanceViewInput>): BalanceView {
  const result = run(input);
  if (!result.ok) throw new Error(`Expected ok, got ${result.error.code}`);
  return result.value;
}

/** [name, minor units] pairs, in the returned order. */
const memberNets = (v: BalanceView) =>
  v.members.map((m) => [m.name, m.net.amount]);

/** [from name, to name, minor units] triples, in the returned order. */
const transferTriples = (v: BalanceView) =>
  v.transfers.map((t) => [t.from.name, t.to.name, t.amount.amount]);

describe("toBalanceView: hand-computed examples from src/lib/balance.test.ts", () => {
  it("1: Aung pays 100.01 for Aung, Bo Bo, Chit; Daw has no expenses (0)", () => {
    expect(view({ expenses: [EXAMPLE_1] })).toEqual({
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
    });
  });

  it("2: plus Bo Bo pays 30.00 for Aung, Bo Bo; transfers in greedy order, not id order", () => {
    // listExpenses returns newest first; the order must not matter.
    const v = view({ expenses: [EXAMPLE_2, EXAMPLE_1] });
    expect(v.hasExpenses).toBe(true);
    expect(memberNets(v)).toEqual([
      ["Aung", 5167n],
      ["Bo Bo", -1834n],
      ["Chit", -3333n],
      ["Daw", 0n],
    ]);
    expect(transferTriples(v)).toEqual([
      ["Chit", "Aung", 3333n],
      ["Bo Bo", "Aung", 1834n],
    ]);
  });
});

describe("toBalanceView: members", () => {
  it("lists members in the members order, not by id", () => {
    const v = view({
      members: [DAW, CHIT, AUNG, BO_BO],
      expenses: [EXAMPLE_1],
    });
    expect(memberNets(v)).toEqual([
      ["Daw", 0n],
      ["Chit", -3333n],
      ["Aung", 6667n],
      ["Bo Bo", -3334n],
    ]);
  });

  it("no expenses: every member at 0 in the group currency, no transfers", () => {
    expect(view({ currency: "MMK", expenses: [] })).toEqual({
      hasExpenses: false,
      members: [AUNG, BO_BO, CHIT, DAW].map((m) => ({
        ...m,
        net: { amount: 0n, currency: "MMK" },
      })),
      transfers: [],
    });
  });

  it("everyone settled: offsetting expenses leave every net at 0 and no transfers", () => {
    const v = view({
      expenses: [
        expense(AUNG, usd(1000n), [AUNG, BO_BO]),
        expense(BO_BO, usd(1000n), [AUNG, BO_BO]),
      ],
    });
    expect(v.hasExpenses).toBe(true);
    expect(memberNets(v)).toEqual([
      ["Aung", 0n],
      ["Bo Bo", 0n],
      ["Chit", 0n],
      ["Daw", 0n],
    ]);
    expect(v.transfers).toEqual([]);
  });

  it("no members and no expenses: empty lists", () => {
    expect(view({ members: [], expenses: [] })).toEqual({
      hasExpenses: false,
      members: [],
      transfers: [],
    });
  });
});

describe("toBalanceView: settlements (from is credited, to is debited)", () => {
  // Example 1 alone: Aung +6667, Bo Bo -3334, Chit -3333, Daw 0.

  it("Bo Bo pays Aung the full 33.34: Bo Bo is settled up, only Chit -> Aung is left", () => {
    expect(
      view({
        expenses: [EXAMPLE_1],
        settlements: [settlement(BO_BO, AUNG, usd(3334n))],
      }),
    ).toEqual({
      hasExpenses: true,
      members: [
        { ...AUNG, net: usd(3333n) },
        { ...BO_BO, net: usd(0n) },
        { ...CHIT, net: usd(-3333n) },
        { ...DAW, net: usd(0n) },
      ],
      transfers: [{ from: CHIT, to: AUNG, amount: usd(3333n) }],
    });
  });

  it("both pay in full: every net is 0 and no transfers, but hasExpenses stays true", () => {
    const v = view({
      expenses: [EXAMPLE_1],
      settlements: [
        settlement(BO_BO, AUNG, usd(3334n)),
        settlement(CHIT, AUNG, usd(3333n)),
      ],
    });
    expect(v.hasExpenses).toBe(true);
    expect(memberNets(v)).toEqual([
      ["Aung", 0n],
      ["Bo Bo", 0n],
      ["Chit", 0n],
      ["Daw", 0n],
    ]);
    expect(v.transfers).toEqual([]);
  });

  it("direction: Aung pays Bo Bo 10.00 (1000 minor units), so Aung is owed more and Bo Bo owes more", () => {
    // Aung: +6667 + 1000 = +7667; Bo Bo: -3334 - 1000 = -4334; Chit -3333.
    // Greedy: Bo Bo owes most -> Bo Bo -> Aung 4334; then Chit -> Aung 3333.
    const v = view({
      expenses: [EXAMPLE_1],
      settlements: [settlement(AUNG, BO_BO, usd(1000n))],
    });
    expect(memberNets(v)).toEqual([
      ["Aung", 7667n],
      ["Bo Bo", -4334n],
      ["Chit", -3333n],
      ["Daw", 0n],
    ]);
    expect(transferTriples(v)).toEqual([
      ["Bo Bo", "Aung", 4334n],
      ["Chit", "Aung", 3333n],
    ]);
  });

  it("the order of settlements does not matter", () => {
    const first = settlement(BO_BO, AUNG, usd(1000n));
    const second = settlement(CHIT, DAW, usd(250n));
    const a = view({ expenses: [EXAMPLE_1], settlements: [first, second] });
    const b = view({ expenses: [EXAMPLE_1], settlements: [second, first] });
    expect(a).toEqual(b);
    // Aung +6667 - 1000; Bo Bo -3334 + 1000; Chit -3333 + 250; Daw -250. Sum 0.
    expect(memberNets(a)).toEqual([
      ["Aung", 5667n],
      ["Bo Bo", -2334n],
      ["Chit", -3083n],
      ["Daw", -250n],
    ]);
  });
});

describe("toBalanceView: corrupt data returns UNEXPECTED (never throws) and logs", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it.each([
    [
      "a participant id missing from the members list",
      [expense(AUNG, usd(1000n), [AUNG, OUTSIDER])],
    ],
    [
      "a payer id missing from the members list",
      [expense(OUTSIDER, usd(1000n), [AUNG, BO_BO])],
    ],
    [
      "an expense with no participants (splitEqually throws)",
      [expense(AUNG, usd(1000n), [])],
    ],
    [
      "an expense in another currency than the group",
      [expense(AUNG, { amount: 1000n, currency: "MMK" }, [AUNG, BO_BO])],
    ],
  ])("%s", (_, expenses) => {
    const result = run({ expenses });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "UNEXPECTED",
        message: "Something went wrong. Please try again.",
      },
    });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^\[balance\] .*group 6f1c2b3a-/),
      expect.any(Error),
    );
  });

  it.each([
    [
      "a settlement from a member missing from the members list",
      () => [settlement(OUTSIDER, AUNG, usd(100n))],
    ],
    [
      "a settlement to a member missing from the members list",
      () => [settlement(BO_BO, OUTSIDER, usd(100n))],
    ],
    [
      "a settlement in another currency than the group",
      () => [settlement(BO_BO, AUNG, { amount: 100n, currency: "MMK" })],
    ],
  ])("%s", (_, settlements) => {
    const result = run({ expenses: [EXAMPLE_1], settlements: settlements() });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "UNEXPECTED",
        message: "Something went wrong. Please try again.",
      },
    });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^\[balance\] .*group 6f1c2b3a-/),
      expect.any(Error),
    );
  });
});
