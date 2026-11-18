import { describe, expect, it } from "vitest";
import type { CurrencyCode } from "./currency";
import { AMOUNT_MAX_MINOR_UNITS } from "./limits";
import { sumMoney, type Money } from "./money";
import { splitEqually, type ParticipantShare } from "./split";

const mmk = (amount: bigint): Money => ({ amount, currency: "MMK" });

/** [participantId, minor units] pairs, in the returned order. */
const pairs = (shares: ParticipantShare[]) =>
  shares.map((s) => [s.participantId, s.share.amount]);

/** "p000", "p001", … — zero-padded, so this list is already in ascending order. */
const idsOf = (n: number) =>
  Array.from({ length: n }, (_, i) => `p${String(i).padStart(3, "0")}`);

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [
      item,
      ...rest,
    ]),
  );
}

/** Rule invariants for one split; `sortedIds` must already be ascending. */
function expectValidSplit(total: Money, sortedIds: readonly string[]): void {
  const shares = splitEqually(total, sortedIds);
  expect(shares).toHaveLength(sortedIds.length);
  expect(shares.map((s) => s.participantId)).toEqual(sortedIds);
  expect(
    sumMoney(
      shares.map((s) => s.share),
      total.currency,
    ),
  ).toEqual(total);

  const amounts = shares.map((s) => s.share.amount);
  const max = amounts.reduce((a, b) => (a > b ? a : b));
  const min = amounts.reduce((a, b) => (a < b ? a : b));
  expect(max - min <= 1n).toBe(true);

  const n = BigInt(sortedIds.length);
  const q = total.amount / n;
  const r = total.amount % n;
  // Exactly the first r ids get q + 1, the rest get q.
  expect(amounts).toEqual(amounts.map((_, i) => (BigInt(i) < r ? q + 1n : q)));
}

describe("splitEqually: the decided example", () => {
  it("10001 split 3 ways gives 3334, 3334, 3333 in ascending id order", () => {
    expect(splitEqually(mmk(10001n), ["c", "a", "b"])).toEqual([
      { participantId: "a", share: mmk(3334n) },
      { participantId: "b", share: mmk(3334n) },
      { participantId: "c", share: mmk(3333n) },
    ]);
  });
});

describe("splitEqually: invariants", () => {
  it("sums to the total, spread <= 1, remainder to the lowest ids (totals 0..500 x 1..12 people)", () => {
    let checked = 0;
    for (let total = 0n; total <= 500n; total++) {
      for (let n = 1; n <= 12; n++) {
        expectValidSplit(mmk(total), idsOf(n));
        checked++;
      }
    }
    // Guards against the loop silently running zero times.
    expect(checked).toBe(501 * 12);
  });

  it.each([1_000_003n, 2n ** 53n + 1n, AMOUNT_MAX_MINOR_UNITS])(
    "holds for large total %s",
    (total) => {
      for (const n of [2, 3, 7, 13, 100]) {
        expectValidSplit(mmk(total), idsOf(n));
      }
    },
  );
});

describe("splitEqually: input order never matters", () => {
  const ids = ["e", "c", "a", "d", "b"];

  it.each([
    [
      7n,
      [
        ["a", 2n],
        ["b", 2n],
        ["c", 1n],
        ["d", 1n],
        ["e", 1n],
      ],
    ],
    [
      10001n,
      [
        ["a", 2001n],
        ["b", 2000n],
        ["c", 2000n],
        ["d", 2000n],
        ["e", 2000n],
      ],
    ],
  ])(
    "every permutation of 5 ids splitting %s gives the same result",
    (total, expected) => {
      const orders = permutations(ids);
      expect(orders).toHaveLength(120);
      for (const order of orders) {
        expect(pairs(splitEqually(mmk(total), order))).toEqual(expected);
      }
    },
  );
});

describe("splitEqually: ids are compared as strings (code units)", () => {
  it("not by locale: 'B' sorts before 'a'", () => {
    expect(pairs(splitEqually(mmk(1n), ["a", "B"]))).toEqual([
      ["B", 1n],
      ["a", 0n],
    ]);
  });

  it("not numerically: '10' sorts before '9'", () => {
    expect(pairs(splitEqually(mmk(1n), ["9", "10"]))).toEqual([
      ["10", 1n],
      ["9", 0n],
    ]);
  });

  it("UUID v4 ids: the extra units go to the lowest ids", () => {
    const high = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const mid = "9c858901-8a57-4791-81fe-4c455b099bc9";
    const low = "3b241101-e2bb-4255-8caf-4136c566a962";
    expect(pairs(splitEqually(mmk(2n), [high, mid, low]))).toEqual([
      [low, 1n],
      [mid, 1n],
      [high, 0n],
    ]);
  });
});

describe("splitEqually: edge cases", () => {
  it.each([10001n, 0n, AMOUNT_MAX_MINOR_UNITS])(
    "one participant gets the whole total %s",
    (total) => {
      expect(splitEqually(mmk(total), ["only"])).toEqual([
        { participantId: "only", share: mmk(total) },
      ]);
    },
  );

  it("total smaller than the number of participants", () => {
    expect(pairs(splitEqually(mmk(2n), ["e", "d", "c", "b", "a"]))).toEqual([
      ["a", 1n],
      ["b", 1n],
      ["c", 0n],
      ["d", 0n],
      ["e", 0n],
    ]);
  });

  it("total not divisible by the number of participants", () => {
    expect(pairs(splitEqually(mmk(100n), ["z", "x", "y"]))).toEqual([
      ["x", 34n],
      ["y", 33n],
      ["z", 33n],
    ]);
    expect(pairs(splitEqually(mmk(10n), ["d", "c", "b", "a"]))).toEqual([
      ["a", 3n],
      ["b", 3n],
      ["c", 2n],
      ["d", 2n],
    ]);
  });

  it("zero total gives everyone zero", () => {
    expect(pairs(splitEqually(mmk(0n), ["b", "a", "c"]))).toEqual([
      ["a", 0n],
      ["b", 0n],
      ["c", 0n],
    ]);
  });
});

describe("splitEqually: currencies", () => {
  it.each<CurrencyCode>(["MMK", "USD", "KHR"])(
    "every share keeps the total's currency (%s)",
    (currency) => {
      const total: Money = { amount: 10001n, currency };
      const shares = splitEqually(total, ["c", "a", "b"]);
      expect(shares).toEqual([
        { participantId: "a", share: { amount: 3334n, currency } },
        { participantId: "b", share: { amount: 3334n, currency } },
        { participantId: "c", share: { amount: 3333n, currency } },
      ]);
      // sumMoney throws on a currency mismatch, so this also checks currencies.
      expect(
        sumMoney(
          shares.map((s) => s.share),
          currency,
        ),
      ).toEqual(total);
    },
  );
});

describe("splitEqually: near AMOUNT_MAX_MINOR_UNITS", () => {
  it("the cap is the value these expectations were computed for", () => {
    expect(AMOUNT_MAX_MINOR_UNITS).toBe(999_999_999_999n);
  });

  it("the cap split 100 ways: 99 x 10,000,000,000 and 1 x 9,999,999,999", () => {
    const ids = idsOf(100);
    expect(pairs(splitEqually(mmk(AMOUNT_MAX_MINOR_UNITS), ids))).toEqual(
      ids.map((id, i) => [id, i < 99 ? 10_000_000_000n : 9_999_999_999n]),
    );
  });

  it("the cap and the cap - 1 split 3 ways", () => {
    expect(
      pairs(splitEqually(mmk(AMOUNT_MAX_MINOR_UNITS), ["c", "b", "a"])),
    ).toEqual([
      ["a", 333_333_333_333n],
      ["b", 333_333_333_333n],
      ["c", 333_333_333_333n],
    ]);
    expect(
      pairs(splitEqually(mmk(AMOUNT_MAX_MINOR_UNITS - 1n), ["c", "b", "a"])),
    ).toEqual([
      ["a", 333_333_333_333n],
      ["b", 333_333_333_333n],
      ["c", 333_333_333_332n],
    ]);
  });
});

describe("splitEqually: invalid input throws", () => {
  it("empty participant list", () => {
    expect(() => splitEqually(mmk(100n), [])).toThrow(
      "Cannot split between zero participants",
    );
  });

  it("duplicate participant ids, even when not next to each other", () => {
    expect(() => splitEqually(mmk(100n), ["a", "b", "a"])).toThrow(
      "Duplicate participant id: a",
    );
  });

  it("negative total", () => {
    expect(() => splitEqually(mmk(-1n), ["a", "b"])).toThrow(
      "Cannot split a negative amount",
    );
  });
});

describe("splitEqually: does not mutate its input", () => {
  it("leaves the caller's id array untouched", () => {
    const ids = Object.freeze(["c", "a", "b"]);
    splitEqually(mmk(10n), ids);
    expect(ids).toEqual(["c", "a", "b"]);
  });
});
