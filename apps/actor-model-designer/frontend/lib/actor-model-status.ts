import type { MessageKey } from '@shell/i18n/messages.js';

export const ACTOR_MODEL_STATUSES = ['draft', 'active', 'archived'] as const;
export type ActorModelStatus = (typeof ACTOR_MODEL_STATUSES)[number];

export function actorModelStatusLabel(
  status: string,
  msg: (k: MessageKey) => string,
): string {
  switch (status) {
    case 'draft':
      return msg('amdStatusDraft');
    case 'active':
      return msg('amdStatusActive');
    case 'archived':
      return msg('amdStatusArchived');
    default:
      return status;
  }
}
