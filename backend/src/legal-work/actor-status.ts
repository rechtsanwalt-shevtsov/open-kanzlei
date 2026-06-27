export const ACTOR_STATUS_VALUES = ['active', 'inactive'] as const;

export type ActorStatus = (typeof ACTOR_STATUS_VALUES)[number];

export const DEFAULT_ACTOR_STATUS: ActorStatus = 'active';

export const ACTOR_STATUS_SET = new Set<string>(ACTOR_STATUS_VALUES);

export const DEFAULT_ACTOR_STATUS_OPTION_TRANSLATIONS = {
  active: { de: 'Aktiv', en: 'Active' },
  inactive: { de: 'Inaktiv', en: 'Inactive' },
} as const;
