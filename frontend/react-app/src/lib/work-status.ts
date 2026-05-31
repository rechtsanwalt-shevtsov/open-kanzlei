import type { MessageKey } from '../i18n/messages.js';

export const WORK_STATUSES = [
  'not_started',
  'started',
  'completed',
  'deferred',
] as const;

export type WorkStatus = (typeof WORK_STATUSES)[number];

/** Legacy DB values mapped for display and kanban columns */
export function normalizeWorkStatus(status: string): WorkStatus {
  if (status === 'open') return 'not_started';
  if (WORK_STATUSES.includes(status as WorkStatus)) return status as WorkStatus;
  return 'not_started';
}

const STATUS_MSG_KEYS: Record<WorkStatus, MessageKey> = {
  not_started: 'workStatusNotStarted',
  started: 'workStatusStarted',
  completed: 'workStatusCompleted',
  deferred: 'workStatusDeferred',
};

export function workStatusLabel(
  status: string,
  msg: (key: MessageKey) => string,
): string {
  const n = normalizeWorkStatus(status);
  return msg(STATUS_MSG_KEYS[n]);
}

export function workStatusClass(status: string): string {
  const n = normalizeWorkStatus(status);
  return `work-badge work-badge--${n}`;
}
