import { badRequest, forbidden } from '../api/errors.js';
import type { SelectOptionTranslations } from './select-option-translations.js';

export const WORK_STATUS_VALUES = ['not_started', 'started', 'completed'] as const;

export type WorkStatus = (typeof WORK_STATUS_VALUES)[number];

export const DEFAULT_WORK_STATUS: WorkStatus = 'not_started';

const WORK_STATUS_SET = new Set<string>(WORK_STATUS_VALUES);

export function assertWorkStatus(value: string): asserts value is WorkStatus {
  if (!WORK_STATUS_SET.has(value)) {
    throw badRequest('error.validation_failed');
  }
}

export function assertPlatformWorkStatusSelectOptionsUnchanged(options: string[]): void {
  if (
    options.length !== WORK_STATUS_VALUES.length ||
    !options.every((value, index) => value === WORK_STATUS_VALUES[index])
  ) {
    throw forbidden('error.attribute_definition_reserved');
  }
}

export function assertPlatformWorkStatusSelectOptionTranslationsAllowed(
  translations: SelectOptionTranslations,
): void {
  for (const key of Object.keys(translations)) {
    if (!WORK_STATUS_SET.has(key)) {
      throw forbidden('error.attribute_definition_reserved');
    }
  }
}
