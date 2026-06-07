export const TEAM_ADMIN = 'admin' as const;
export const TEAM_REGULAR = 'regular' as const;

export const SYSTEM_TEAM_KEYS = [TEAM_ADMIN, TEAM_REGULAR] as const;

export type SystemTeamKey = (typeof SYSTEM_TEAM_KEYS)[number];

export function isSystemTeamKey(value: string): value is SystemTeamKey {
  return (SYSTEM_TEAM_KEYS as readonly string[]).includes(value);
}

export const DEFAULT_TEAM_NAMES: Record<SystemTeamKey, string> = {
  admin: 'Administratoren',
  regular: 'Benutzer',
};
