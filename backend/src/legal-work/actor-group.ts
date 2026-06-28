import { TEAM_ADMIN, TEAM_REGULAR } from '../platform/teams/team-keys.js';
import type { SelectOptionTranslations } from './select-option-translations.js';

/** Assignable platform group keys for actor models (excludes plattformuser). */
export const ACTOR_GROUP_VALUES = [TEAM_ADMIN, TEAM_REGULAR] as const;

export type ActorGroupKey = (typeof ACTOR_GROUP_VALUES)[number];

export const DEFAULT_ACTOR_GROUP: ActorGroupKey = TEAM_REGULAR;

export const DEFAULT_ACTOR_GROUP_OPTION_TRANSLATIONS: SelectOptionTranslations = {
  admin: { de: 'Administratoren', en: 'Administrators' },
  regular: { de: 'Benutzer', en: 'Users' },
};

export function isActorGroupKey(value: string): value is ActorGroupKey {
  return (ACTOR_GROUP_VALUES as readonly string[]).includes(value);
}
