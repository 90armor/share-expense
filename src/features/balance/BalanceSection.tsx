import { cx } from "@/lib/cx";
import { formatMoney, negate, type Money } from "@/lib/money";
import type { BalanceView } from "./balanceView";

export const NO_MEMBERS_TEXT = "Add members and expenses to see who owes whom.";
export const NO_EXPENSES_TEXT = "No expenses yet, so everyone is settled up.";
export const ALL_SETTLED_TEXT = "Everyone is settled up. No payments needed.";

export type BalanceSectionProps = { view: BalanceView };

/** U+2212, the minus sign (not the ASCII hyphen formatMoney uses). */
const MINUS = "−";

/**
 * Status text + signed amount + token. Colour is never the only signal:
 * owe/owed always come with "owes"/"is owed" and a sign (docs/DESIGN_SYSTEM.md).
 */
function memberStatus(net: Money): { text: string; className: string } {
  if (net.amount > 0n) {
    return {
      text: `is owed +${formatMoney(net)}`,
      className: "font-medium text-owed",
    };
  }
  if (net.amount < 0n) {
    return {
      text: `owes ${MINUS}${formatMoney(negate(net))}`,
      className: "font-medium text-owe",
    };
  }
  return { text: `settled up ${formatMoney(net)}`, className: "text-muted" };
}

/**
 * Read-only balance: who pays whom (the answer, in ink), then each member's
 * net (the reason). No actions; settling is a separate feature.
 */
export function BalanceSection({ view }: BalanceSectionProps) {
  return (
    <section aria-labelledby="balance-heading" className="flex flex-col gap-4">
      <h2 id="balance-heading" className="text-lg font-semibold">
        Balance
      </h2>
      {view.members.length === 0 ? (
        <p className="text-muted">{NO_MEMBERS_TEXT}</p>
      ) : !view.hasExpenses ? (
        <p className="text-muted">{NO_EXPENSES_TEXT}</p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <h3 id="balance-transfers-heading" className="font-medium">
              Who pays whom
            </h3>
            {view.transfers.length === 0 ? (
              <p className="text-muted">{ALL_SETTLED_TEXT}</p>
            ) : (
              <ul
                aria-labelledby="balance-transfers-heading"
                className="flex flex-col gap-1"
              >
                {view.transfers.map((transfer) => (
                  <li
                    key={`${transfer.from.id}-${transfer.to.id}`}
                    className="break-words text-ink"
                  >
                    {`${transfer.from.name} pays ${transfer.to.name} `}
                    <span className="whitespace-nowrap font-medium">
                      {formatMoney(transfer.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <h3 id="balance-members-heading" className="font-medium">
              Per member
            </h3>
            <ul
              aria-labelledby="balance-members-heading"
              className="flex flex-col divide-y divide-border"
            >
              {view.members.map((member) => {
                const status = memberStatus(member.net);
                return (
                  <li
                    key={member.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-1"
                  >
                    <span className="min-w-0 break-words">{member.name}</span>
                    <span className={cx("whitespace-nowrap", status.className)}>
                      {status.text}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
