import { z } from "zod";
import { currencyCodeSchema, nameSchema } from "@/lib/validation";

export const createGroupSchema = z.object({
  name: nameSchema,
  currency: currencyCodeSchema,
});

/** What callers may send (untrusted, before parsing). */
export type CreateGroupInput = z.input<typeof createGroupSchema>;
/** What the service stores (trimmed name, supported currency). */
export type CreateGroupData = z.output<typeof createGroupSchema>;
