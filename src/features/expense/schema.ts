import { z } from "zod";
import type { CurrencyCode } from "@/lib/currency";
import {
  AMOUNT_MAX_MINOR_UNITS,
  DESCRIPTION_MAX_LENGTH,
  PARTICIPANTS_MAX,
} from "@/lib/limits";
import { formatAmount } from "@/lib/money";
import { idSchema, moneyAmountSchema } from "@/lib/validation";

/** Step 1: only the group id, so the service can load the group's currency. */
export const addExpenseGroupSchema = z.object({ groupId: idSchema });

const PARTICIPANTS_REQUIRED = "Choose at least one person";

/**
 * Untrusted id list. Cheap checks first: the size bound runs before any
 * per-id work and before the service queries the DB with these ids.
 * Per-id errors stay on `participantIds` (refine, not an element schema),
 * so the form shows them on the field.
 */
const participantIdsSchema = z
  .array(z.string(PARTICIPANTS_REQUIRED), PARTICIPANTS_REQUIRED)
  .min(1, PARTICIPANTS_REQUIRED)
  .max(PARTICIPANTS_MAX, `At most ${PARTICIPANTS_MAX} people per expense`)
  .refine((ids) => ids.every((id) => idSchema.safeParse(id).success), {
    message: "Invalid ID",
    abort: true,
  })
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "Each person can only be chosen once",
  });

/** Optional; trimmed; blank (or missing) -> null. */
const descriptionSchema = z
  .string("Description must be text")
  .trim()
  .max(
    DESCRIPTION_MAX_LENGTH,
    `Description must be at most ${DESCRIPTION_MAX_LENGTH} characters`,
  )
  .optional()
  .transform((text) => (text ? text : null));

/**
 * Step 2, built with the group's currency. Membership of payer/participants
 * in this group is checked by the service against the DB, not here.
 * The payer may or may not be a participant.
 */
export function addExpenseSchema(currency: CurrencyCode) {
  return z.object({
    groupId: idSchema,
    payerId: z.uuidv4("Choose who paid"),
    amount: moneyAmountSchema(currency)
      .refine((money) => money.amount > 0n, "Amount must be more than 0")
      .refine(
        (money) => money.amount <= AMOUNT_MAX_MINOR_UNITS,
        `Amount must be at most ${formatAmount({ amount: AMOUNT_MAX_MINOR_UNITS, currency })}`,
      ),
    description: descriptionSchema,
    participantIds: participantIdsSchema,
  });
}

/** What callers may send (untrusted, before parsing). */
export type AddExpenseInput = z.input<ReturnType<typeof addExpenseSchema>>;
