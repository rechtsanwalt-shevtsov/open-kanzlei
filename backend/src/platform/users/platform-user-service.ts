import argon2 from 'argon2';
import type pg from 'pg';
import { badRequest, conflict, notFound } from '../../api/errors.js';
import { getEventService } from '../../foundation/events/event-service.js';
import { withTenantTransaction } from '../../foundation/database/tenant-context.js';
import { loadInstanceAttributes, upsertInstanceAttributes } from '../../legal-work/attributes.js';
import { resolveActorInstanceStatus } from '../../legal-work/actor-instance-status.js';
import {
  COLLABORATOR_ACTOR_MODEL_KEY,
  ensureCollaboratorActorModel,
} from '../../legal-work/actor-tenant-seed.js';
import {
  actorIsAdmin,
  addActorToTeam,
  assertTeamsInTenant,
  ensureDefaultTeams,
  getTeamIdByKey,
  loadActorTeams,
  setActorTeams,
  type ActorTeamDto,
} from '../teams/team-service.js';
import { TEAM_ADMIN, TEAM_PLATFORMUSER, TEAM_REGULAR } from '../teams/team-keys.js';
import { assertPassword, assertUsername } from './validation.js';

export interface PlatformUserDto {
  id: string;
  display_name: string;
  username: string | null;
  email: string | null;
  actor_model_id: string;
  groups: ActorTeamDto[];
  has_login: boolean;
  preferred_language: 'de' | 'en' | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePlatformUserInput {
  username: string;
  password: string;
  email?: string | null;
  firstName?: string | null;
  displayName?: string | null;
  actorModelId?: string;
  teamIds: string[];
  preferredLanguage?: 'de' | 'en' | null;
}

export interface UpdatePlatformUserInput {
  username?: string;
  password?: string;
  email?: string | null;
  firstName?: string | null;
  displayName?: string | null;
  teamIds?: string[];
  preferredLanguage?: 'de' | 'en' | null;
  revokeLogin?: boolean;
}

type CredentialRow = {
  actor_id: string;
  username: string;
  preferred_language: 'de' | 'en' | null;
  created_at: Date;
  updated_at: Date;
};

async function resolveCollaboratorModelId(
  client: pg.PoolClient,
  tenantId: string,
  actorModelId?: string,
): Promise<string> {
  if (actorModelId) {
    const result = await client.query<{ id: string }>(
      `SELECT id FROM legal.actor_models WHERE tenant_id = $1 AND id = $2`,
      [tenantId, actorModelId],
    );
    if (!result.rows[0]) throw notFound();
    return result.rows[0].id;
  }
  return ensureCollaboratorActorModel(client, tenantId);
}

async function loadActorEmail(
  client: pg.PoolClient,
  tenantId: string,
  actorId: string,
  actorModelId: string,
): Promise<string | null> {
  const result = await client.query<{ plaintext_value: string | null }>(
    `SELECT av.plaintext_value
     FROM meta.attribute_values av
     JOIN meta.attribute_definitions ad ON ad.id = av.attribute_definition_id
     WHERE av.tenant_id = $1
       AND av.owner_type = 'actor'
       AND av.owner_id = $2
       AND ad.owner_type = 'actor_model'
       AND ad.owner_id = $3
       AND ad.key = 'email'
     LIMIT 1`,
    [tenantId, actorId, actorModelId],
  );
  return result.rows[0]?.plaintext_value ?? null;
}

async function loadActorDisplayName(
  client: pg.PoolClient,
  tenantId: string,
  actorId: string,
  actorModelId: string,
): Promise<string> {
  const attrs = await loadInstanceAttributes(
    client,
    tenantId,
    'actor',
    actorId,
    'actor_model',
    actorModelId,
  );
  const name = typeof attrs.name === 'string' ? attrs.name.trim() : '';
  if (name) return name;
  const first = typeof attrs.first_name === 'string' ? attrs.first_name.trim() : '';
  if (first) return first;
  return actorId.slice(0, 8);
}

async function loadActorPlatformAccess(
  client: pg.PoolClient,
  tenantId: string,
  actorId: string,
): Promise<PlatformUserDto | null> {
  const actorResult = await client.query<{
    id: string;
    actor_model_id: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT id, actor_model_id, created_at, updated_at
     FROM legal.actors
     WHERE tenant_id = $1 AND id = $2`,
    [tenantId, actorId],
  );
  const actor = actorResult.rows[0];
  if (!actor) return null;

  const credResult = await client.query<CredentialRow>(
    `SELECT actor_id, username, preferred_language, created_at, updated_at
     FROM platform.actor_credentials
     WHERE actor_id = $1 AND tenant_id = $2`,
    [actorId, tenantId],
  );
  const cred = credResult.rows[0];

  const groups = await loadActorTeams(client, actorId, { includePlatformUser: true });
  const email = await loadActorEmail(client, tenantId, actorId, actor.actor_model_id);
  const displayName = await loadActorDisplayName(
    client,
    tenantId,
    actorId,
    actor.actor_model_id,
  );

  return {
    id: actor.id,
    display_name: displayName,
    username: cred?.username ?? null,
    email,
    actor_model_id: actor.actor_model_id,
    groups,
    has_login: cred !== undefined,
    preferred_language: cred?.preferred_language ?? null,
    created_at: (cred?.created_at ?? actor.created_at).toISOString(),
    updated_at: (cred?.updated_at ?? actor.updated_at).toISOString(),
  };
}

async function countLoginCapableAdmins(
  client: pg.PoolClient,
  tenantId: string,
  excludeActorId?: string,
): Promise<number> {
  const result = await client.query<{ count: string }>(
    `SELECT COUNT(DISTINCT a.id)::text AS count
     FROM legal.actors a
     JOIN platform.actor_credentials c ON c.actor_id = a.id
     JOIN platform.actor_teams at ON at.actor_id = a.id
     JOIN platform.teams t ON t.id = at.team_id
     WHERE a.tenant_id = $1
       AND t.key = $2
       AND EXISTS (
         SELECT 1
         FROM platform.actor_teams at2
         JOIN platform.teams t2 ON t2.id = at2.team_id
         WHERE at2.actor_id = a.id AND t2.key = $3
       )
       AND ($4::uuid IS NULL OR a.id <> $4)`,
    [tenantId, TEAM_ADMIN, TEAM_PLATFORMUSER, excludeActorId ?? null],
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function listPlatformUsers(tenantId: string): Promise<PlatformUserDto[]> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<{ id: string }>(
      `SELECT id FROM legal.actors
       WHERE tenant_id = $1 AND is_tenant_root = false
       ORDER BY created_at DESC`,
      [tenantId],
    );
    const users: PlatformUserDto[] = [];
    for (const row of result.rows) {
      const user = await loadActorPlatformAccess(client, tenantId, row.id);
      if (user) users.push(user);
    }
    return users;
  });
}

export async function getPlatformUser(
  tenantId: string,
  actorId: string,
): Promise<PlatformUserDto | null> {
  return withTenantTransaction(tenantId, async (client) =>
    loadActorPlatformAccess(client, tenantId, actorId),
  );
}

export async function createPlatformUser(
  tenantId: string,
  actorId: string,
  input: CreatePlatformUserInput,
): Promise<PlatformUserDto> {
  if (!input.teamIds?.length) {
    throw badRequest('error.validation_failed');
  }

  const username = assertUsername(input.username);
  assertPassword(input.password);

  return withTenantTransaction(tenantId, async (client) => {
    await ensureDefaultTeams(client, tenantId);
    const actorModelId = await resolveCollaboratorModelId(client, tenantId, input.actorModelId);
    const status = await resolveActorInstanceStatus(client, tenantId, actorModelId, 'active', {
      status: 'active',
    });

    const actorResult = await client.query<{ id: string }>(
      `INSERT INTO legal.actors (tenant_id, actor_model_id, status)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [tenantId, actorModelId, status],
    );
    const newActorId = actorResult.rows[0]!.id;

    const displayName = input.displayName?.trim() || username;
    await upsertInstanceAttributes(
      client,
      tenantId,
      'actor',
      newActorId,
      'actor_model',
      actorModelId,
      {
        name: displayName,
        first_name: input.firstName?.trim() || null,
        email: input.email?.trim() || null,
        status,
      },
    );

    const passwordHash = await argon2.hash(input.password);
    try {
      await client.query(
        `INSERT INTO platform.actor_credentials
           (actor_id, tenant_id, username, password_hash, preferred_language)
         VALUES ($1, $2, $3, $4, $5)`,
        [newActorId, tenantId, username, passwordHash, input.preferredLanguage ?? null],
      );
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') {
        throw conflict('error.username_taken');
      }
      throw err;
    }

    await setActorTeams(client, tenantId, newActorId, input.teamIds);
    const platformUserTeamId = await getTeamIdByKey(client, tenantId, TEAM_PLATFORMUSER);
    await addActorToTeam(client, newActorId, platformUserTeamId);

    await getEventService().publish(client, {
      tenantId,
      type: 'platform_user.created',
      aggregateType: 'platform_user',
      aggregateId: newActorId,
      actorId,
      data: { actor_id: newActorId },
    });

    const user = await loadActorPlatformAccess(client, tenantId, newActorId);
    if (!user) throw badRequest('error.internal');
    return user;
  });
}

export async function updatePlatformUser(
  tenantId: string,
  targetActorId: string,
  actorId: string,
  input: UpdatePlatformUserInput,
): Promise<PlatformUserDto> {
  if (input.teamIds !== undefined && input.teamIds.length === 0) {
    throw badRequest('error.validation_failed');
  }

  return withTenantTransaction(tenantId, async (client) => {
    const existing = await loadActorPlatformAccess(client, tenantId, targetActorId);
    if (!existing) throw notFound();

    await ensureDefaultTeams(client, tenantId);
    const platformUserTeamId = await getTeamIdByKey(client, tenantId, TEAM_PLATFORMUSER);

    const isSelf = actorId === targetActorId;
    const wasAdmin = actorIsAdmin(existing.groups);

    let nextGroupRows: ActorTeamDto[] = existing.groups;
    if (input.teamIds !== undefined) {
      const teamRows = await client.query<ActorTeamDto>(
        `SELECT t.id, t.key, t.name
         FROM platform.teams t
         WHERE t.tenant_id = $1 AND t.id = ANY($2::uuid[])
         ORDER BY t.key NULLS LAST, t.name`,
        [tenantId, [...new Set(input.teamIds)]],
      );
      nextGroupRows = teamRows.rows;
    }

    const willBeAdmin = actorIsAdmin(nextGroupRows);
    if (wasAdmin && !willBeAdmin) {
      const adminsLeft = await countLoginCapableAdmins(client, tenantId, targetActorId);
      if (adminsLeft === 0) {
        throw conflict('error.last_admin');
      }
      if (isSelf) {
        throw conflict('error.cannot_demote_self');
      }
    }

    const wantsLogin = nextGroupRows.some((g) => g.key === TEAM_PLATFORMUSER);
    const hadLogin = existing.has_login;

    if (input.revokeLogin || (hadLogin && !wantsLogin)) {
      if (wasAdmin) {
        const adminsLeft = await countLoginCapableAdmins(client, tenantId, targetActorId);
        if (adminsLeft === 0) {
          throw conflict('error.last_admin');
        }
      }
      if (isSelf) {
        throw conflict('error.cannot_delete_self');
      }
      await client.query(
        `DELETE FROM platform.actor_credentials WHERE actor_id = $1 AND tenant_id = $2`,
        [targetActorId, tenantId],
      );
      if (input.teamIds !== undefined) {
        const withoutPlatform = nextGroupRows.filter((g) => g.key !== TEAM_PLATFORMUSER);
        await setActorTeams(client, tenantId, targetActorId, withoutPlatform.map((g) => g.id), {
          replaceAll: true,
        });
      }
    } else {
      if (wantsLogin && !hadLogin) {
        const username = assertUsername(input.username ?? '');
        assertPassword(input.password ?? '');
        const passwordHash = await argon2.hash(input.password!);
        try {
          await client.query(
            `INSERT INTO platform.actor_credentials
               (actor_id, tenant_id, username, password_hash, preferred_language)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              targetActorId,
              tenantId,
              username,
              passwordHash,
              input.preferredLanguage ?? null,
            ],
          );
        } catch (err: unknown) {
          if ((err as { code?: string }).code === '23505') {
            throw conflict('error.username_taken');
          }
          throw err;
        }
      } else if (hadLogin) {
        if (input.password) {
          assertPassword(input.password);
        }
        if (input.username) {
          assertUsername(input.username);
        }

        const credSets: string[] = ['updated_at = now()'];
        const credValues: unknown[] = [targetActorId, tenantId];
        let credIdx = 3;

        if (input.username !== undefined) {
          credSets.push(`username = $${credIdx++}`);
          credValues.push(assertUsername(input.username));
        }
        if (input.password) {
          const passwordHash = await argon2.hash(input.password);
          credSets.push(`password_hash = $${credIdx++}`);
          credValues.push(passwordHash);
        }
        if (input.preferredLanguage !== undefined) {
          credSets.push(`preferred_language = $${credIdx++}`);
          credValues.push(input.preferredLanguage);
        }

        if (credSets.length > 1) {
          try {
            await client.query(
              `UPDATE platform.actor_credentials SET ${credSets.join(', ')}
               WHERE actor_id = $1 AND tenant_id = $2`,
              credValues,
            );
          } catch (err: unknown) {
            if ((err as { code?: string }).code === '23505') {
              throw conflict('error.username_taken');
            }
            throw err;
          }
        }
      }

      if (
        input.email !== undefined ||
        input.firstName !== undefined ||
        input.displayName !== undefined
      ) {
        const attrs: Record<string, string | null> = {};
        if (input.displayName !== undefined) attrs.name = input.displayName?.trim() || null;
        if (input.firstName !== undefined) attrs.first_name = input.firstName?.trim() || null;
        if (input.email !== undefined) attrs.email = input.email?.trim() || null;
        await upsertInstanceAttributes(
          client,
          tenantId,
          'actor',
          targetActorId,
          'actor_model',
          existing.actor_model_id,
          attrs,
        );
      }

      if (input.teamIds !== undefined) {
        if (isSelf && !willBeAdmin) {
          throw conflict('error.cannot_demote_self');
        }
        const finalTeamIds = wantsLogin
          ? [...new Set([...input.teamIds, platformUserTeamId])]
          : input.teamIds.filter((id) => id !== platformUserTeamId);
        await setActorTeams(client, tenantId, targetActorId, finalTeamIds, {
          replaceAll: true,
        });
      } else if (wantsLogin && !hadLogin) {
        await addActorToTeam(client, targetActorId, platformUserTeamId);
      }
    }

    await getEventService().publish(client, {
      tenantId,
      type:
        input.revokeLogin || (hadLogin && !wantsLogin)
          ? 'platform_user.login_revoked'
          : hadLogin || wantsLogin
            ? 'platform_user.updated'
            : 'platform_user.updated',
      aggregateType: 'platform_user',
      aggregateId: targetActorId,
      actorId,
      data: { actor_id: targetActorId },
    });

    const user = await loadActorPlatformAccess(client, tenantId, targetActorId);
    if (!user) throw notFound();
    return user;
  });
}

export async function revokePlatformUserLogin(
  tenantId: string,
  targetActorId: string,
  actorId: string,
): Promise<void> {
  await updatePlatformUser(tenantId, targetActorId, actorId, { revokeLogin: true });
}

export async function createInitialAdminPlatformUser(
  client: pg.PoolClient,
  tenantId: string,
  input: {
    username: string;
    passwordHash: string;
    email: string;
    displayName: string;
    preferredLanguage?: 'de' | 'en' | null;
  },
): Promise<string> {
  await ensureDefaultTeams(client, tenantId);
  const actorModelId = await ensureCollaboratorActorModel(client, tenantId);
  const status = await resolveActorInstanceStatus(client, tenantId, actorModelId, 'active', {
    status: 'active',
  });

  const actorResult = await client.query<{ id: string }>(
    `INSERT INTO legal.actors (tenant_id, actor_model_id, status)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [tenantId, actorModelId, status],
  );
  const newActorId = actorResult.rows[0]!.id;

  await upsertInstanceAttributes(
    client,
    tenantId,
    'actor',
    newActorId,
    'actor_model',
    actorModelId,
    {
      name: input.displayName,
      email: input.email,
      status,
    },
  );

  await client.query(
    `INSERT INTO platform.actor_credentials
       (actor_id, tenant_id, username, password_hash, preferred_language)
     VALUES ($1, $2, $3, $4, $5)`,
    [newActorId, tenantId, input.username, input.passwordHash, input.preferredLanguage ?? null],
  );

  const adminTeamId = await getTeamIdByKey(client, tenantId, TEAM_ADMIN);
  const regularTeamId = await getTeamIdByKey(client, tenantId, TEAM_REGULAR);
  const platformUserTeamId = await getTeamIdByKey(client, tenantId, TEAM_PLATFORMUSER);

  for (const teamId of [adminTeamId, regularTeamId, platformUserTeamId]) {
    await addActorToTeam(client, newActorId, teamId);
  }

  return newActorId;
}
