Per-feature code lives in `src/features/<name>/`. Copy the pattern in `docs/FEATURE_PATTERN.md`.

Naming: one folder per MVP feature, singular (e.g. `group`, `expense`); its routes are plural (`/groups/...`).

Created when that feature's code lands — not pre-scaffolded.

- `group/` — Create group (the reference example): `schema.ts`, `service.ts`, `formState.ts`, `actions.ts`, `CreateGroupForm.tsx`, with tests next to each.
- `member/` — Add/remove members on `/groups/[id]`: `schema.ts`, `service.ts`, `formState.ts`, `actions.ts`, `AddMemberForm.tsx` (Add member button + Modal), `RemoveMemberForm.tsx` (Remove button + confirm Modal), `MembersSection.tsx` (compact list on the group page), with tests next to each.
- `expense/` — Add and list expenses on `/groups/[id]`: `schema.ts`, `service.ts` (one transaction; payer/participants must be members of this group), `formState.ts`, `actions.ts`, `AddExpenseForm.tsx` (Add expense button + Modal), `ExpensesSection.tsx` (table + empty states on the group page), with tests next to each.
- `balance/` — View balance on `/groups/[id]`, read-only (no schema, service, action or form): `balanceView.ts` (`toBalanceView` turns the members + expenses the page already loaded into names, nets and transfers via `src/lib/balance.ts`; corrupt data → logged `UNEXPECTED`), `BalanceSection.tsx` (who pays whom, per-member list, empty states), with tests next to each.
- `settlement/` — Settle (record "A paid B this amount"), data part: `schema.ts`, `service.ts` (`addSettlement`: one transaction; both members must belong to this group, not the same member, amount > 0 and ≤ the cap; `listSettlements`: newest first), with tests next to each. The form and balance wiring land in feat/settle-ui.
