import { AddMemberForm } from "./AddMemberForm";
import { RemoveMemberForm } from "./RemoveMemberForm";
import type { Member } from "./service";

export type MembersSectionProps = {
  groupId: string;
  members: readonly Member[];
};

/**
 * Compact member list. Each row keeps its own Remove button + confirm Modal,
 * and adding opens a separate Modal, so no Modal is ever opened inside another.
 */
export function MembersSection({ groupId, members }: MembersSectionProps) {
  return (
    <section aria-labelledby="members-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="members-heading" className="text-lg font-semibold">
          Members
        </h2>
        <AddMemberForm groupId={groupId} />
      </div>
      {members.length === 0 ? (
        <p className="text-muted">No members yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between gap-4 py-1"
            >
              <span className="min-w-0 break-words">{member.name}</span>
              <RemoveMemberForm
                groupId={groupId}
                memberId={member.id}
                memberName={member.name}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
