import type { MessageKey } from '@shell/i18n/messages.js';

export const TASK_MODEL_STATUSES = ['draft', 'active', 'archived'] as const;
export type MessageModelStatus = (typeof TASK_MODEL_STATUSES)[number];

export function messageModelStatusLabel(
  status: string,
  msg: (k: MessageKey) => string,
): string {
  switch (status) {
    case 'draft':
      return msg('mmdStatusDraft');
    case 'active':
      return msg('mmdStatusActive');
    case 'archived':
      return msg('mmdStatusArchived');
    default:
      return status;
  }
}
