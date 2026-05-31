import { badRequest } from '../api/errors.js';

export const WORK_STATUS_VALUES = [
  'not_started',
  'started',
  'completed',
  'deferred',
] as const;

export type WorkStatus = (typeof WORK_STATUS_VALUES)[number];

export const DEFAULT_WORK_STATUS: WorkStatus = 'not_started';

export function assertWorkStatus(value: string): asserts value is WorkStatus {
  if (!WORK_STATUS_VALUES.includes(value as WorkStatus)) {
    throw badRequest('error.validation_failed');
  }
}
