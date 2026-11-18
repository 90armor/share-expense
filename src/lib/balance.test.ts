import { describe, expect, it } from "vitest";
import {
  computeNetBalances,
  computeTransfers,
  type BalanceExpense,
  type NetBalance,
  type Transfer,
} from "./balance";
import type { CurrencyCode } from "./currency";
import { AMOUNT_MAX_MINOR_UNITS } from "./limits";
import { sumMoney, type Money } from "./money";

const usd = (amount: bigint): Money => ({ amount, currency: "USD" });

const expense = (
  payerId: string,
  amount: Money,
  participantIds: readonly string[],
): BalanceExpense => ({ payerId, amount, participantIds });

/** A recorded settlement: `fromId` paid `toId` `amount`. */
const settle = (fromId: string, toId: string, amount: Money): Transfer => ({
  fromId,
  toId,
  amount,
});

/** Builds nets from [memberId, minor units] pairs. */
const netsOf = (
  pairs: readonly (readonly [string, bigint])[],
  currency: CurrencyCode = "USD",
): NetBalance[] =>
  pairs.map(([memberId, amount]) => ({
    memberId,
    net: { amount, currency },
  }));

/** [memberId, minor units] pairs, in the returned order. */
const netPairs = (balances: readonly NetBalance[]) =>
  balances.map((b) => [b.memberId, b.net.amount]);

/** [fromId, toId, minor units] triples, in the returned order. */
const transferTriples = (transfers: readonly Transfer[]) =>
  transfers.map((t) => [t.fromId, t.toId, t.amount.amount]);

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [
      item,
      ...rest,
    ]),
  );
}

describe("hand-computed examples", () => {
  const expense1 = expense("a", usd(10001n), ["a", "b", "c"]);
  const expense2 = expense("b", usd(3000n), ["a", "b"]);

  it("1: a pays 10001 for a, b, c (shares 3334, 3334, 3333)", () => {
    const nets = computeNetBalances([expense1]);
    expect(nets).toEqual(
      netsOf([
        ["a", 6667n],
        ["b", -3334n],
        ["c", -3333n],
      ]),
    );
    expect(computeTransfers(nets)).toEqual([
      { fromId: "b", toId: "a", amount: usd(3334n) },
      { fromId: "c", toId: "a", amount: usd(3333n) },
    ]);
  });

  it("2: plus b pays 3000 for a, b (1500 each)", () => {
    const nets = computeNetBalances([expense1, expense2]);
    expect(nets).toEqual(
      netsOf([
        ["a", 5167n],
        ["b", -1834n],
        ["c", -3333n],
      ]),
    );
    expect(computeTransfers(nets)).toEqual([
      { fromId: "c", toId: "a", amount: usd(3333n) },
      { fromId: "b", toId: "a", amount: usd(1834n) },
    ]);
  });

  it("3: a +100, b +50, c -75, d -75, in any input order", () => {
    // Step 1: debtors c 75 = d 75 -> c (lowest id); creditor a 100. c -> a 75.
    //         Left: a +25, b +50, d -75.
    // Step 2: debtor d 75; creditor b 50 (now owed more than a). d -> b 50.
    //         Left: a +25, d -25.
    // Step 3: d -> a 25. All zero: 3 transfers = 4 non-zero members - 1.
    const expected = [
      ["c", "a", 75n],
      ["d", "b", 50n],
      ["d", "a", 25n],
    ];
    const nets = netsOf([
      ["a", 100n],
      ["b", 50n],
      ["c", -75n],
      ["d", -75n],
    ]);
    const orders = permutations(nets);
    expect(orders).toHaveLength(24);
    for (const order of orders) {
      expect(transferTriples(computeTransfers(order))).toEqual(expected);
    }
  });

  it("4: equal debtors AND equal creditors, in any input order", () => {
    // Nets: a +50, b +50, c -40, d -40, e -20.
    // Step 1: debtors c 40 = d 40 -> c; creditors a 50 = b 50 -> a. c -> a 40.
    //         Left: a +10, b +50, d -40, e -20.
    // Step 2: debtor d 40; creditor b 50. d -> b 40.
    //         Left: a +10, b +10, e -20.
    // Step 3: debtor e 20; creditors a 10 = b 10 -> a. e -> a 10.
    //         Left: b +10, e -10.
    // Step 4: e -> b 10. All zero.
    // With the tie-break flipped (highest id) it would be
    // d -> b 40, c -> a 40, e -> b 10, e -> a 10.
    const expected = [
      ["c", "a", 40n],
      ["d", "b", 40n],
      ["e", "a", 10n],
      ["e", "b", 10n],
    ];
    const nets = netsOf([
      ["a", 50n],
      ["b", 50n],
      ["c", -40n],
      ["d", -40n],
      ["e", -20n],
    ]);
    const orders = permutations(nets);
    expect(orders).toHaveLength(120);
    for (const order of orders) {
      expect(transferTriples(computeTransfers(order))).toEqual(expected);
    }
  });

  it("creditor tie only: a +50, b +50, c -100 -> c pays a first", () => {
    expect(
      transferTriples(
        computeTransfers(
          netsOf([
            ["b", 50n],
            ["c", -100n],
            ["a", 50n],
          ]),
        ),
      ),
    ).toEqual([
      ["c", "a", 50n],
      ["c", "b", 50n],
    ]);
  });
});

// ---------------------------------------------------------------------------
// Generated groups. A seeded PRNG keeps every run identical (no dependency).

/** mulberry32: small deterministic 32-bit PRNG returning [0, 1). */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const CURRENCIES: readonly CurrencyCode[] = ["MMK", "USD", "KHR"];

type GeneratedGroup = {
  expenses: BalanceExpense[];
  settlements: Transfer[];
};

function generateGroup(
  random: () => number,
  currency: CurrencyCode,
): GeneratedGroup {
  const int = (max: number) => Math.floor(random() * max);
  const randomAmount = () => {
    const roll = random();
    return roll < 0.1
      ? AMOUNT_MAX_MINOR_UNITS
      : roll < 0.15
        ? 0n
        : BigInt(int(20_001));
  };
  // Random hex ids, so code-unit order is not the creation order.
  const ids = new Set<string>();
  const memberCount = 1 + int(8);
  while (ids.size < memberCount) {
    ids.add(int(0xffffff).toString(16).padStart(6, "0"));
  }
  const members = [...ids];

  const expenseCount = int(9);
  const expenses = Array.from({ length: expenseCount }, () => {
    const amount = randomAmount();
    let participantIds = members.filter(() => random() < 0.5);
    if (participantIds.length === 0)
      participantIds = [members[int(members.length)]];
    return expense(
      members[int(members.length)],
      { amount, currency },
      participantIds,
    );
  });

  // 0-4 settlements between two different members (none with one member).
  const settlementCount = members.length < 2 ? 0 : int(5);
  const settlements = Array.from({ length: settlementCount }, () => {
    const fromIndex = int(members.length);
    const toIndex = (fromIndex + 1 + int(members.length - 1)) % members.length;
    return settle(members[fromIndex], members[toIndex], {
      amount: randomAmount(),
      currency,
    });
  });

  return { expenses, settlements };
}

/** Checks every rule for one group; returns the transfers. */
function expectValidBalances(
  { expenses, settlements }: GeneratedGroup,
  currency: CurrencyCode,
  random: () => number,
): Transfer[] {
  const nets = computeNetBalances(expenses, settlements);

  // One entry per id that appears in an expense or a settlement, sorted by id (code units).
  const appearing = new Set([
    ...expenses.flatMap((e) => [e.payerId, ...e.participantIds]),
    ...settlements.flatMap((s) => [s.fromId, s.toId]),
  ]);
  const ids = nets.map((n) => n.memberId);
  expect(new Set(ids)).toEqual(appearing);
  expect(ids).toEqual(
    [...appearing].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
  );

  // Nets sum to 0 (sumMoney also throws on a currency mismatch).
  expect(
    sumMoney(
      nets.map((n) => n.net),
      currency,
    ),
  ).toEqual({ amount: 0n, currency });

  const transfers = computeTransfers(nets);
  const netById = new Map(nets.map((n) => [n.memberId, n.net.amount]));
  const nonZeroMembers = nets.filter((n) => n.net.amount !== 0n).length;
  expect(transfers.length).toBeLessThanOrEqual(Math.max(0, nonZeroMembers - 1));

  const remaining = new Map(netById);
  for (const t of transfers) {
    expect(t.amount.currency).toBe(currency);
    expect(t.amount.amount > 0n).toBe(true);
    expect(t.fromId).not.toBe(t.toId);
    // Money flows from a debtor to a creditor; net-0 members never appear.
    expect(netById.get(t.fromId)! < 0n).toBe(true);
    expect(netById.get(t.toId)! > 0n).toBe(true);
    remaining.set(t.fromId, remaining.get(t.fromId)! + t.amount.amount);
    remaining.set(t.toId, remaining.get(t.toId)! - t.amount.amount);
  }
  // Applying the transfers zeroes every net.
  for (const amount of remaining.values()) expect(amount).toBe(0n);

  // Same result for any order of expenses, participant ids, settlements and nets.
  const reordered = shuffled(expenses, random).map((e) =>
    expense(e.payerId, e.amount, shuffled(e.participantIds, random)),
  );
  expect(computeNetBalances(reordered, shuffled(settlements, random))).toEqual(
    nets,
  );
  expect(computeTransfers(shuffled(nets, random))).toEqual(transfers);

  return transfers;
}

describe("invariants over generated groups", () => {
  it("nets sum to 0, transfers are positive and zero every net, bounded, order-independent", () => {
    const random = seededRandom(20261118);
    const GROUPS = 600;
    let checked = 0;
    let withTransfers = 0;
    let withSettlements = 0;
    for (let i = 0; i < GROUPS; i++) {
      const currency = CURRENCIES[i % CURRENCIES.length];
      const group = generateGroup(random, currency);
      const transfers = expectValidBalances(group, currency, random);
      if (transfers.length > 0) withTransfers++;
      if (group.settlements.length > 0) withSettlements++;
      checked++;
    }
    // Guards against the loop silently running zero times or only trivial groups.
    expect(checked).toBe(GROUPS);
    expect(withTransfers).toBeGreaterThan(GROUPS / 2);
    expect(withSettlements).toBeGreaterThan(GROUPS / 2);
  });
});

// ---------------------------------------------------------------------------

describe("named cases", () => {
  it("payer is not a participant", () => {
    const nets = computeNetBalances([expense("a", usd(300n), ["c", "b"])]);
    expect(netPairs(nets)).toEqual([
      ["a", 300n],
      ["b", -150n],
      ["c", -150n],
    ]);
    expect(transferTriples(computeTransfers(nets))).toEqual([
      ["b", "a", 150n],
      ["c", "a", 150n],
    ]);
  });

  it("a single participant who is the payer: net 0, no transfers", () => {
    const nets = computeNetBalances([expense("a", usd(500n), ["a"])]);
    expect(netPairs(nets)).toEqual([["a", 0n]]);
    expect(computeTransfers(nets)).toEqual([]);
  });

  it("several expenses with the same payer", () => {
    // a pays 100 for a, b (50 each); a pays 201 for b, c (b 101, c 100).
    // a: +100 + 201 - 50 = +251; b: -50 - 101 = -151; c: -100.
    const nets = computeNetBalances([
      expense("a", usd(100n), ["a", "b"]),
      expense("a", usd(201n), ["b", "c"]),
    ]);
    expect(netPairs(nets)).toEqual([
      ["a", 251n],
      ["b", -151n],
      ["c", -100n],
    ]);
    expect(transferTriples(computeTransfers(nets))).toEqual([
      ["b", "a", 151n],
      ["c", "a", 100n],
    ]);
  });

  it("no expenses: no nets, no transfers", () => {
    expect(computeNetBalances([])).toEqual([]);
    expect(computeTransfers([])).toEqual([]);
  });

  it("zero amount is allowed: its people are listed with net 0 and moves no money", () => {
    const nets = computeNetBalances([expense("a", usd(0n), ["a", "b"])]);
    expect(netPairs(nets)).toEqual([
      ["a", 0n],
      ["b", 0n],
    ]);
    expect(computeTransfers(nets)).toEqual([]);
  });

  it("a zero-amount expense next to a real one changes no transfer", () => {
    const nets = computeNetBalances([
      expense("a", usd(10001n), ["a", "b", "c"]),
      expense("c", usd(0n), ["c", "d"]),
    ]);
    expect(netPairs(nets)).toEqual([
      ["a", 6667n],
      ["b", -3334n],
      ["c", -3333n],
      ["d", 0n],
    ]);
    expect(transferTriples(computeTransfers(nets))).toEqual([
      ["b", "a", 3334n],
      ["c", "a", 3333n],
    ]);
  });

  it("ids are compared as code units, not by locale: 'B' < 'a'", () => {
    const nets = computeNetBalances([expense("B", usd(2n), ["a", "B"])]);
    expect(netPairs(nets)).toEqual([
      ["B", 1n],
      ["a", -1n],
    ]);
    // Creditor tie a 1 = B 1 -> 'B' first.
    expect(
      transferTriples(
        computeTransfers(
          netsOf([
            ["a", 1n],
            ["B", 1n],
            ["c", -2n],
          ]),
        ),
      ),
    ).toEqual([
      ["c", "B", 1n],
      ["c", "a", 1n],
    ]);
  });
});

describe("amounts at AMOUNT_MAX_MINOR_UNITS", () => {
  const MAX = AMOUNT_MAX_MINOR_UNITS;

  it("the cap is the value these expectations were computed for", () => {
    expect(MAX).toBe(999_999_999_999n);
  });

  it("one max expense split 3 ways (333,333,333,333 each)", () => {
    const nets = computeNetBalances([expense("a", usd(MAX), ["a", "b", "c"])]);
    expect(netPairs(nets)).toEqual([
      ["a", 666_666_666_666n],
      ["b", -333_333_333_333n],
      ["c", -333_333_333_333n],
    ]);
    expect(transferTriples(computeTransfers(nets))).toEqual([
      ["b", "a", 333_333_333_333n],
      ["c", "a", 333_333_333_333n],
    ]);
  });

  it("two max expenses: b's credit and debit cancel, b is in no transfer", () => {
    // a pays MAX for a, b: a 500,000,000,000, b 499,999,999,999.
    // b pays MAX for b, c: b 500,000,000,000, c 499,999,999,999.
    // a: +499,999,999,999; b: -499,999,999,999 + 499,999,999,999 = 0; c: -499,999,999,999.
    const nets = computeNetBalances([
      expense("a", usd(MAX), ["a", "b"]),
      expense("b", usd(MAX), ["b", "c"]),
    ]);
    expect(netPairs(nets)).toEqual([
      ["a", 499_999_999_999n],
      ["b", 0n],
      ["c", -499_999_999_999n],
    ]);
    expect(transferTriples(computeTransfers(nets))).toEqual([
      ["c", "a", 499_999_999_999n],
    ]);
  });

  it("100 max expenses add up exactly", () => {
    const nets = computeNetBalances(
      Array.from({ length: 100 }, () => expense("a", usd(MAX), ["a", "b"])),
    );
    expect(netPairs(nets)).toEqual([
      ["a", 49_999_999_999_900n],
      ["b", -49_999_999_999_900n],
    ]);
  });
});

describe("currencies", () => {
  it.each<CurrencyCode>(["MMK", "USD", "KHR"])(
    "every net and transfer keeps the group's currency (%s)",
    (currency) => {
      const nets = computeNetBalances([
        expense("a", { amount: 10001n, currency }, ["a", "b", "c"]),
      ]);
      expect(nets).toEqual(
        netsOf(
          [
            ["a", 6667n],
            ["b", -3334n],
            ["c", -3333n],
          ],
          currency,
        ),
      );
      expect(computeTransfers(nets)).toEqual([
        { fromId: "b", toId: "a", amount: { amount: 3334n, currency } },
        { fromId: "c", toId: "a", amount: { amount: 3333n, currency } },
      ]);
    },
  );
});

describe("settlements: from is credited, to is debited", () => {
  // Example 1: a pays 10001 for a, b, c -> a +6667, b -3334, c -3333.
  const expense1 = expense("a", usd(10001n), ["a", "b", "c"]);

  it("b pays a the full suggested 3334: b is settled, only c -> a is left", () => {
    const nets = computeNetBalances([expense1], [settle("b", "a", usd(3334n))]);
    expect(nets).toEqual(
      netsOf([
        ["a", 3333n],
        ["b", 0n],
        ["c", -3333n],
      ]),
    );
    expect(computeTransfers(nets)).toEqual([
      { fromId: "c", toId: "a", amount: usd(3333n) },
    ]);
  });

  it("b and c both pay in full: every net is 0, no transfers", () => {
    const nets = computeNetBalances(
      [expense1],
      [settle("b", "a", usd(3334n)), settle("c", "a", usd(3333n))],
    );
    expect(netPairs(nets)).toEqual([
      ["a", 0n],
      ["b", 0n],
      ["c", 0n],
    ]);
    expect(computeTransfers(nets)).toEqual([]);
  });

  it("partial: b pays a 1000 of 3334", () => {
    // a: 6667 - 1000 = 5667; b: -3334 + 1000 = -2334; c: -3333.
    // Greedy: c owes most (3333) -> c -> a 3333; then b -> a 2334.
    const nets = computeNetBalances([expense1], [settle("b", "a", usd(1000n))]);
    expect(netPairs(nets)).toEqual([
      ["a", 5667n],
      ["b", -2334n],
      ["c", -3333n],
    ]);
    expect(transferTriples(computeTransfers(nets))).toEqual([
      ["c", "a", 3333n],
      ["b", "a", 2334n],
    ]);
  });

  it("over-payment: b pays a 5000, so a now owes b the extra 1666", () => {
    // a: 6667 - 5000 = 1667; b: -3334 + 5000 = +1666; c: -3333.
    // Greedy: c -> a 1667 (a is owed more than b), then c -> b 1666.
    const nets = computeNetBalances([expense1], [settle("b", "a", usd(5000n))]);
    expect(netPairs(nets)).toEqual([
      ["a", 1667n],
      ["b", 1666n],
      ["c", -3333n],
    ]);
    expect(transferTriples(computeTransfers(nets))).toEqual([
      ["c", "a", 1667n],
      ["c", "b", 1666n],
    ]);
  });

  it("an id that appears only in a settlement gets an entry", () => {
    const nets = computeNetBalances([], [settle("x", "y", usd(100n))]);
    expect(netPairs(nets)).toEqual([
      ["x", 100n],
      ["y", -100n],
    ]);
    expect(transferTriples(computeTransfers(nets))).toEqual([["y", "x", 100n]]);
  });

  it("a member with no expenses who only received a settlement now owes it", () => {
    // d is in no expense; b pays d 500 by mistake: b +500 against the debt, d -500.
    const nets = computeNetBalances([expense1], [settle("b", "d", usd(500n))]);
    expect(netPairs(nets)).toEqual([
      ["a", 6667n],
      ["b", -2834n],
      ["c", -3333n],
      ["d", -500n],
    ]);
  });

  it("the order of settlements does not matter", () => {
    const settlements = [
      settle("b", "a", usd(1000n)),
      settle("c", "a", usd(500n)),
      settle("b", "c", usd(7n)),
    ];
    const expected = computeNetBalances([expense1], settlements);
    expect(netPairs(expected)).toEqual([
      ["a", 5167n],
      ["b", -2327n],
      ["c", -2840n],
    ]);
    for (const order of permutations(settlements)) {
      expect(computeNetBalances([expense1], order)).toEqual(expected);
    }
  });

  it("a zero settlement moves no money but lists its members", () => {
    const nets = computeNetBalances([], [settle("a", "b", usd(0n))]);
    expect(netPairs(nets)).toEqual([
      ["a", 0n],
      ["b", 0n],
    ]);
    expect(computeTransfers(nets)).toEqual([]);
  });

  it("keeps the currency of the settlements when there are no expenses (MMK)", () => {
    const nets = computeNetBalances(
      [],
      [settle("a", "b", { amount: 63119200n, currency: "MMK" })],
    );
    expect(nets).toEqual(
      netsOf(
        [
          ["a", 63119200n],
          ["b", -63119200n],
        ],
        "MMK",
      ),
    );
  });
});

describe("invalid input throws", () => {
  it("a settlement in another currency than the expenses", () => {
    expect(() =>
      computeNetBalances(
        [expense("a", usd(100n), ["a", "b"])],
        [settle("b", "a", { amount: 50n, currency: "MMK" })],
      ),
    ).toThrow("Currency mismatch: USD vs MMK");
  });

  it("settlements in different currencies (no expenses)", () => {
    expect(() =>
      computeNetBalances(
        [],
        [
          settle("b", "a", usd(1n)),
          settle("c", "a", { amount: 1n, currency: "MMK" }),
        ],
      ),
    ).toThrow("Currency mismatch: USD vs MMK");
  });

  it("a negative settlement amount", () => {
    expect(() => computeNetBalances([], [settle("b", "a", usd(-1n))])).toThrow(
      "Settlement amount cannot be negative",
    );
  });

  it("a settlement from a member to the same member", () => {
    expect(() => computeNetBalances([], [settle("a", "a", usd(100n))])).toThrow(
      "Settlement from and to the same member: a",
    );
  });

  it("expenses in different currencies", () => {
    expect(() =>
      computeNetBalances([
        expense("a", usd(100n), ["a", "b"]),
        expense("b", { amount: 100n, currency: "MMK" }, ["b"]),
      ]),
    ).toThrow("Currency mismatch: USD vs MMK");
  });

  it("negative amount (from splitEqually)", () => {
    expect(() =>
      computeNetBalances([expense("a", usd(-1n), ["a", "b"])]),
    ).toThrow("Cannot split a negative amount");
  });

  it("no participants (from splitEqually)", () => {
    expect(() => computeNetBalances([expense("a", usd(100n), [])])).toThrow(
      "Cannot split between zero participants",
    );
  });

  it("duplicate participant (from splitEqually)", () => {
    expect(() =>
      computeNetBalances([expense("a", usd(100n), ["a", "b", "a"])]),
    ).toThrow("Duplicate participant id: a");
  });

  it("nets in different currencies", () => {
    expect(() =>
      computeTransfers([
        { memberId: "a", net: usd(1n) },
        { memberId: "b", net: { amount: -1n, currency: "KHR" } },
      ]),
    ).toThrow("Currency mismatch: USD vs KHR");
  });

  it("duplicate member id in the nets", () => {
    expect(() =>
      computeTransfers(
        netsOf([
          ["a", 1n],
          ["b", -2n],
          ["a", 1n],
        ]),
      ),
    ).toThrow("Duplicate member id: a");
  });

  it("nets that do not sum to 0", () => {
    expect(() =>
      computeTransfers(
        netsOf([
          ["a", 100n],
          ["b", -99n],
        ]),
      ),
    ).toThrow("Net balances must sum to zero");
  });
});

describe("does not mutate its input", () => {
  it("leaves frozen expenses and nets untouched", () => {
    const expenses = Object.freeze([
      Object.freeze(expense("a", usd(10001n), Object.freeze(["c", "a", "b"]))),
    ]);
    const nets = Object.freeze(
      computeNetBalances(expenses).map((n) => Object.freeze(n)),
    );
    const before = netPairs(nets);
    computeTransfers(nets);
    expect(netPairs(nets)).toEqual(before);
    expect(expenses[0].participantIds).toEqual(["c", "a", "b"]);
  });

  it("leaves frozen settlements untouched", () => {
    const settlements = Object.freeze([
      Object.freeze(settle("b", "a", Object.freeze(usd(1000n)))),
      Object.freeze(settle("c", "a", Object.freeze(usd(500n)))),
    ]);
    computeNetBalances([], settlements);
    expect(settlements).toEqual([
      settle("b", "a", usd(1000n)),
      settle("c", "a", usd(500n)),
    ]);
  });
});
