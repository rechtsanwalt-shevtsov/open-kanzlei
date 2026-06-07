import type { UserTeamDto } from '../teams/team-service.js';

export interface SessionUser {
  id: string;
  tenantId: string;
  username: string;
  email: string | null;
  preferredLanguage: 'de' | 'en' | null;
  teams: UserTeamDto[];
  tenantDefaultLanguage: 'de' | 'en';
}

export interface RegisterTenantInput {
  firmName: string;
  adminUsername: string;
  adminEmail: string;
  adminPassword: string;
  defaultLanguage: 'de' | 'en';
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface CurrentUserResponse {
  id: string;
  tenant_id: string;
  username: string;
  email: string | null;
  preferred_language: 'de' | 'en' | null;
  teams: UserTeamDto[];
}

export function toCurrentUserResponse(user: SessionUser): CurrentUserResponse {
  return {
    id: user.id,
    tenant_id: user.tenantId,
    username: user.username,
    email: user.email,
    preferred_language: user.preferredLanguage,
    teams: user.teams,
  };
}
