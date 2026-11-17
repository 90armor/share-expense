import { z } from "zod";
import { idSchema, nameSchema } from "@/lib/validation";

/** No nameKey here: zod drops unknown keys, so a client-sent key never reaches the service. */
export const addMemberSchema = z.object({
  groupId: idSchema,
  name: nameSchema,
});

export const removeMemberSchema = z.object({
  groupId: idSchema,
  memberId: idSchema,
});

/** What callers may send (untrusted, before parsing). */
export type AddMemberInput = z.input<typeof addMemberSchema>;
export type RemoveMemberInput = z.input<typeof removeMemberSchema>;

/**
 * Key for "same name in one group": NFC, trimmed, whitespace runs collapsed to
 * one space, lowercased with `toLowerCase` (locale-independent on purpose).
 * Computed by the member service only. Known limitation: NFC does not unify
 * every Burmese spelling variant, and U+200B is not whitespace here.
 */
export function memberNameKey(name: string): string {
  return name.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}
