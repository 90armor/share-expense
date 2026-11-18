import type { Money } from "./money";

/** One participant's part of a split expense. */
export type ParticipantShare = Readonly<{
  participantId: string;
  share: Money;
}>;

// STUB: final signature, wrong behaviour, so the tests fail on assertions.
export function splitEqually(
  total: Money,
  participantIds: readonly string[],
): ParticipantShare[] {
  return [];
}
