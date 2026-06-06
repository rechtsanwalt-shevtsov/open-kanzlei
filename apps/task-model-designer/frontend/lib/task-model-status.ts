import type { MessageKey } from '@shell/i18n/messages.js';

export const TASK_MODEL_STATUSES = ['draft', 'active', 'archived'] as const;
export type TaskModelStatus = (typeof TASK_MODEL_STATUSES)[number];

export function taskModelStatusLabel(
  status: string,
  msg: (k: MessageKey) => string,
): string {
  switch (status) {
    case 'draft':
      return msg('tmdStatusDraft');
    case 'active':
      return msg('tmdStatusActive');
    case 'archived':
      return msg('tmdStatusArchived');
    default:
      return status;
  }
}
