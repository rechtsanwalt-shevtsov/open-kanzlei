import type { components } from '../api/schema.js';

type UserGroup = components['schemas']['UserGroup'];

export function userIsAdmin(groups: UserGroup[]): boolean {
  return groups.some((t) => t.key === 'admin');
}

export function formatGroupNames(groups: UserGroup[]): string {
  return groups.map((t) => t.name).join(', ');
}

/** @deprecated Use formatGroupNames */
export const formatTeamNames = formatGroupNames;
