export const MESSAGE_PARTICIPANT_ROLES = ['from', 'to', 'cc', 'bcc', 'reply_to'] as const;

export type MessageParticipantRole = (typeof MESSAGE_PARTICIPANT_ROLES)[number];

export function isMessageParticipantRole(value: string): value is MessageParticipantRole {
  return (MESSAGE_PARTICIPANT_ROLES as readonly string[]).includes(value);
}
