import {
  addMoney,
  assertSameCurrency,
  isZero,
  subtractMoney,
  sumMoney,
  type Money,
} from "./money";
import { byCodeUnit, splitEqually } from "./split";

/** One expense as plain data; the group's currency is in `amount`. */
export type BalanceExpense = Readonly<{
  payerId: string;
  amount: Money;
  participantIds: readonly string[];
}>;

/** A member's net: positive = is owed money, negative = owes money. */
export type NetBalance = Readonly<{ memberId: string; net: Money }>;

/** `fromId` pays `amount` to `toId`. */
export type Transfer = Readonly<{
  fromId: string;
  toId: string;
  amount: Money;
}>;

/**
 * Net per member: the payer is credited the full amount and every participant
 * is debited their `splitEqually` share, so the nets always sum to 0.
 *
 * Returns one entry per id that appears in an expense (payer or participant),
 * including nets of 0, sorted by id (code-unit order). Members with no
 * expenses are not known here; the caller shows them as 0.
 *
 * Throws on mixed currencies; an empty or duplicate participant list or a
 * negative amount throws from `splitEqually`. Callers pass validated
 * expenses, so these are programmer bugs, not user input.
 */
export function computeNetBalances(
  expenses: readonly BalanceExpense[],
): NetBalance[] {
  const nets = new Map<string, Money>();
  const netOf = (id: string, currency: Money["currency"]): Money =>
    nets.get(id) ?? { amount: 0n, currency };

  for (const { payerId, amount, participantIds } of expenses) {
    assertSameCurrency(expenses[0].amount, amount);
    const shares = splitEqually(amount, participantIds);
    nets.set(payerId, addMoney(netOf(payerId, amount.currency), amount));
    for (const { participantId, share } of shares) {
      nets.set(
        participantId,
        subtractMoney(netOf(participantId, amount.currency), share),
      );
    }
  }

  return [...nets.keys()]
    .sort(byCodeUnit)
    .map((memberId) => ({ memberId, net: nets.get(memberId)! }));
}

/**
 * "Who pays whom" from the nets, with a deterministic greedy: repeatedly the
 * debtor who owes the most pays the creditor who is owed the most the smaller
 * of the two amounts. After every transfer both sides are re-evaluated (the
 * leftover goes back into the comparison). Ties go to the lowest member id
 * (code-unit order). Members with net 0 appear in no transfer. Every step
 * zeroes at least one member and the last zeroes two, so there are at most
 * (members with a non-zero net) - 1 transfers. Output is in greedy order;
 * the input order never matters.
 *
 * Throws on mixed currencies, a duplicate member id, or nets that do not sum
 * to 0 (the greedy relies on it).
 */
export function computeTransfers(balances: readonly NetBalance[]): Transfer[] {
  if (balances.length === 0) return [];
  const { currency } = balances[0].net;
  for (const { net } of balances) assertSameCurrency(balances[0].net, net);
  const total = sumMoney(
    balances.map((b) => b.net),
    currency,
  );
  if (!isZero(total)) throw new Error("Net balances must sum to zero");

  const remaining = new Map<string, Money>();
  const ids = balances.map((b) => b.memberId).sort(byCodeUnit);
  for (let i = 1; i < ids.length; i++) {
    if (ids[i] === ids[i - 1]) {
      throw new Error(`Duplicate member id: ${ids[i]}`);
    }
  }
  for (const { memberId, net } of balances) remaining.set(memberId, net);

  const transfers: Transfer[] = [];
  for (;;) {
    // Scan in ascending id order with strict comparisons: ties keep the lowest id.
    let debtorId: string | undefined;
    let creditorId: string | undefined;
    for (const id of ids) {
      const net = remaining.get(id)!.amount;
      if (
        net < 0n &&
        (debtorId === undefined || net < remaining.get(debtorId)!.amount)
      ) {
        debtorId = id;
      }
      if (
        net > 0n &&
        (creditorId === undefined || net > remaining.get(creditorId)!.amount)
      ) {
        creditorId = id;
      }
    }
    // Nets sum to 0, so no debtor means no creditor either.
    if (debtorId === undefined || creditorId === undefined) return transfers;

    const debt = -remaining.get(debtorId)!.amount;
    const credit = remaining.get(creditorId)!.amount;
    const amount: Money = { amount: debt < credit ? debt : credit, currency };
    transfers.push({ fromId: debtorId, toId: creditorId, amount });
    remaining.set(debtorId, addMoney(remaining.get(debtorId)!, amount));
    remaining.set(
      creditorId,
      subtractMoney(remaining.get(creditorId)!, amount),
    );
  }
}
