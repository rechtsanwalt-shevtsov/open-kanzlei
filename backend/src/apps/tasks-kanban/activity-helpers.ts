import { ACTIVITY_NOT_SET } from './constants.js';

export function activityColumnKeys(selectOptions: string[]): string[] {
  return selectOptions.filter((key) => key !== ACTIVITY_NOT_SET);
}

export function firstActivityKey(selectOptions: string[]): string | null {
  const idx = selectOptions.indexOf(ACTIVITY_NOT_SET);
  if (idx === -1 || idx + 1 >= selectOptions.length) return null;
  return selectOptions[idx + 1] ?? null;
}

export function swimlaneOptionsKey(selectOptions: string[]): string {
  return JSON.stringify(selectOptions);
}

export function compareSelectOptions(a: string[], b: string[]): boolean {
  return swimlaneOptionsKey(a) === swimlaneOptionsKey(b);
}
