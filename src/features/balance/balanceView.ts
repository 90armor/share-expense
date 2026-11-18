import type { Expense } from "@/features/expense/service";
import type { Member } from "@/features/member/service";
import type { Settlement } from "@/features/settlement/service";
import { appError } from "@/lib/appError";
import {
  computeNetBalances,
  computeTransfers,
  type BalanceExpense,
  type Transfer,
} from "@/lib/balance";
import type { CurrencyCode } from "@/lib/currency";
import { assertSameCurrency, type Money } from "@/lib/money";
import { fail, ok, type Result } from "@/lib/result";

/** A member's net: positive = is owed money, negative = owes money, 0 = settled up. */
export type MemberBalance = Readonly<{ id: string; name: string; net: Money }>;
/** `from` pays `amount` to `to`. */
export type BalanceTransfer = Readonly<{
  from: Member;
  to: Member;
  amount: Money;
}>;
export type BalanceView = Readonly<{
  hasExpenses: boolean;
  /** Every member, in the members order; members with no expenses at 0. */
  members: readonly MemberBalance[];
  /** Who pays whom, in the greedy order of `computeTransfers`. */
  transfers: readonly BalanceTransfer[];
}>;

export type BalanceViewInput = Readonly<{
  groupId: string;
  currency: CurrencyCode;
  members: readonly Member[];
  expenses: readonly Expense[];
  /** Recorded payments ("from paid to"), applied on top of the expenses. */
  settlements: readonly Settlement[];
}>;

/**
 * The group page's balance, built from the members, expenses and settlements
 * it already loaded (no second query, so it always matches the expenses
 * table). A settlement credits `fromId` (who paid) and debits `toId`; see
 * `computeNetBalances`.
 *
 * Never throws. The lib throws on data that validated input can't produce
 * (no participants, mixed currencies, …), and every member id in an expense
 * or settlement is always in `members` (the page loads members last; a member
 * with expenses or settlements can't be removed). Any of these means corrupt
 * data: it is logged and returned as a generic UNEXPECTED, like a failing DB
 * call in a service. `hasExpenses` counts expenses only.
 */
export function toBalanceView({
  groupId,
  currency,
  members,
  expenses,
  settlements,
}: BalanceViewInput): Result<BalanceView> {
  try {
    const zero: Money = { amount: 0n, currency };
    const balanceExpenses = expenses.map((expense): BalanceExpense => {
      assertSameCurrency(zero, expense.amount);
      return {
        payerId: expense.payer.id,
        amount: expense.amount,
        participantIds: expense.participants.map((member) => member.id),
      };
    });

    const balanceSettlements = settlements.map((settlement): Transfer => {
      assertSameCurrency(zero, settlement.amount);
      return {
        fromId: settlement.fromId,
        toId: settlement.toId,
        amount: settlement.amount,
      };
    });

    const nets = computeNetBalances(balanceExpenses, balanceSettlements);
    const memberById = new Map(members.map((member) => [member.id, member]));
    const memberOf = (id: string): Member => {
      const member = memberById.get(id);
      if (!member) {
        throw new Error(`Expense or settlement refers to unknown member ${id}`);
      }
      return { id: member.id, name: member.name };
    };
    // Checks every id up front, including members whose net is 0.
    for (const { memberId } of nets) memberOf(memberId);

    const netById = new Map(nets.map((n) => [n.memberId, n.net]));
    return ok({
      hasExpenses: expenses.length > 0,
      members: members.map((member) => ({
        id: member.id,
        name: member.name,
        net: netById.get(member.id) ?? zero,
      })),
      transfers: computeTransfers(nets).map((transfer) => ({
        from: memberOf(transfer.fromId),
        to: memberOf(transfer.toId),
        amount: transfer.amount,
      })),
    });
  } catch (error) {
    console.error(
      `[balance] computing the balance failed (group ${groupId}):`,
      error,
    );
    return fail(
      appError("UNEXPECTED", "Something went wrong. Please try again."),
    );
  }
}
