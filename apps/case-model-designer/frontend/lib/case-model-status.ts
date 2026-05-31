import type { MessageKey } from '@shell/i18n/messages.js';

export const CASE_MODEL_STATUSES = ['draft', 'active', 'archived'] as const;
export type CaseModelStatus = (typeof CASE_MODEL_STATUSES)[number];

export function caseModelStatusLabel(
  status: string,
  msg: (k: MessageKey) => string,
): string {
  switch (status) {
    case 'draft':
      return msg('cmdStatusDraft');
    case 'active':
      return msg('cmdStatusActive');
    case 'archived':
      return msg('cmdStatusArchived');
    default:
      return status;
  }
}
