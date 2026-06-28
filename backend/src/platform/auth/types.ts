import type { ActorTeamDto } from '../teams/team-service.js';

export interface SessionActor {
  id: string;
  tenantId: string;
  username: string;
  email: string | null;
  preferredLanguage: 'de' | 'en' | null;
  groups: ActorTeamDto[];
  tenantDefaultLanguage: 'de' | 'en';
}

/** @deprecated Use SessionActor */
export type SessionUser = SessionActor;

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
  groups: ActorTeamDto[];
}

export function toCurrentUserResponse(actor: SessionActor): CurrentUserResponse {
  return {
    id: actor.id,
    tenant_id: actor.tenantId,
    username: actor.username,
    email: actor.email,
    preferred_language: actor.preferredLanguage,
    groups: actor.groups,
  };
}
