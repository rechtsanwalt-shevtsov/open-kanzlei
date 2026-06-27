export const TEAM_ADMIN = 'admin' as const;
export const TEAM_REGULAR = 'regular' as const;
export const TEAM_PLATFORMUSER = 'plattformuser' as const;

export const SYSTEM_TEAM_KEYS = [TEAM_ADMIN, TEAM_REGULAR, TEAM_PLATFORMUSER] as const;

export type SystemTeamKey = (typeof SYSTEM_TEAM_KEYS)[number];

export function isSystemTeamKey(value: string): value is SystemTeamKey {
  return (SYSTEM_TEAM_KEYS as readonly string[]).includes(value);
}

/** Teams selectable in normal team/actor UI (excludes login-only plattformuser). */
export const ASSIGNABLE_SYSTEM_TEAM_KEYS = [TEAM_ADMIN, TEAM_REGULAR] as const;

export function isAssignableTeamKey(value: string | null): boolean {
  if (!value) return true;
  return value !== TEAM_PLATFORMUSER;
}

export const DEFAULT_TEAM_NAMES: Record<SystemTeamKey, string> = {
  admin: 'Administratoren',
  regular: 'Benutzer',
  plattformuser: 'Plattformuser',
};
