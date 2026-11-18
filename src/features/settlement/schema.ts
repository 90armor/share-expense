import { z } from "zod";
import type { CurrencyCode } from "@/lib/currency";
import { idSchema, positiveAmountSchema } from "@/lib/validation";

/** Step 1: only the group id, so the service can load the group's currency. */
export const addSettlementGroupSchema = z.object({ groupId: idSchema });

/**
 * Step 2, built with the group's currency: "from paid to this amount".
 * Membership of both ids in this group is checked by the service against the
 * DB, not here. The same-member rule sits on `toId` so the error has a field.
 */
export function addSettlementSchema(currency: CurrencyCode) {
  return z
    .object({
      groupId: idSchema,
      fromId: idSchema,
      toId: idSchema,
      amount: positiveAmountSchema(currency),
    })
    .refine((settlement) => settlement.fromId !== settlement.toId, {
      message: "A member can't pay themselves",
      path: ["toId"],
    });
}

/** What callers may send (untrusted, before parsing). */
export type AddSettlementInput = z.input<
  ReturnType<typeof addSettlementSchema>
>;
