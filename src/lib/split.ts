import type { Money } from "./money";

/** One participant's part of a split expense. */
export type ParticipantShare = Readonly<{
  participantId: string;
  share: Money;
}>;

/** Plain code-unit order (like `<`), never locale-dependent. */
export function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Splits `total` equally between `participantIds`. With total = q × n + r,
 * everyone gets q and the first r ids in ascending order get one extra minor
 * unit, so shares sum exactly to `total` and differ by at most 1. The result
 * is sorted by participantId, whatever the input order.
 *
 * Throws on an empty list, a duplicate id or a negative total: callers pass
 * validated expenses, so these are programmer bugs (like a currency mismatch
 * in money.ts), not user input.
 */
export function splitEqually(
  total: Money,
  participantIds: readonly string[],
): ParticipantShare[] {
  if (total.amount < 0n) throw new Error("Cannot split a negative amount");
  if (participantIds.length === 0) {
    throw new Error("Cannot split between zero participants");
  }

  const ids = [...participantIds].sort(byCodeUnit);
  for (let i = 1; i < ids.length; i++) {
    if (ids[i] === ids[i - 1]) {
      throw new Error(`Duplicate participant id: ${ids[i]}`);
    }
  }

  const n = BigInt(ids.length);
  const q = total.amount / n;
  const r = total.amount % n;
  return ids.map((participantId, i) => ({
    participantId,
    share: { amount: BigInt(i) < r ? q + 1n : q, currency: total.currency },
  }));
}
