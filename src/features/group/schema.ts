import { z } from "zod";
import { GROUP_NAME_MAX_LENGTH } from "@/lib/limits";
import { currencyCodeSchema, nameSchema } from "@/lib/validation";

export const createGroupSchema = z.object({
  name: nameSchema(GROUP_NAME_MAX_LENGTH),
  currency: currencyCodeSchema,
});

/** What callers may send (untrusted, before parsing). */
export type CreateGroupInput = z.input<typeof createGroupSchema>;
/** What the service stores (trimmed name, supported currency). */
export type CreateGroupData = z.output<typeof createGroupSchema>;
