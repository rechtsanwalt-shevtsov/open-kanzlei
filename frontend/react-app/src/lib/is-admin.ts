import type { components } from '../api/schema.js';

type UserTeam = components['schemas']['UserTeam'];

export function userIsAdmin(teams: UserTeam[]): boolean {
  return teams.some((t) => t.key === 'admin');
}

export function formatTeamNames(teams: UserTeam[]): string {
  return teams.map((t) => t.name).join(', ');
}
