import argon2 from 'argon2';
import type pg from 'pg';
import { badRequest, conflict, notFound } from '../../api/errors.js';
import { getEventService } from '../../foundation/events/event-service.js';
import { withTenantTransaction } from '../../foundation/database/tenant-context.js';
import {
  assertTeamsInTenant,
  ensureDefaultTeams,
  loadUserTeams,
  userIsAdmin,
  type UserTeamDto,
} from '../teams/team-service.js';
import { TEAM_ADMIN } from '../teams/team-keys.js';
import { assertPassword, assertUsername } from './validation.js';

export interface TenantUserDto {
  id: string;
  username: string;
  email: string | null;
  teams: UserTeamDto[];
  is_active: boolean;
  preferred_language: 'de' | 'en' | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTenantUserInput {
  username: string;
  email?: string | null;
  password: string;
  teamIds: string[];
  preferredLanguage?: 'de' | 'en' | null;
}

export interface UpdateTenantUserInput {
  email?: string | null;
  teamIds?: string[];
  isActive?: boolean;
  preferredLanguage?: 'de' | 'en' | null;
  password?: string;
}

type UserRow = {
  id: string;
  username: string;
  email: string | null;
  is_active: boolean;
  preferred_language: 'de' | 'en' | null;
  created_at: Date;
  updated_at: Date;
};

function mapUser(row: UserRow, teams: UserTeamDto[]): TenantUserDto {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    teams,
    is_active: row.is_active,
    preferred_language: row.preferred_language,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

const USER_SELECT = `
  SELECT u.id, u.username, u.email, u.is_active, u.preferred_language,
         u.created_at, u.updated_at
  FROM platform.users u
  WHERE u.tenant_id = $1
`;

async function setUserTeams(
  client: pg.PoolClient,
  tenantId: string,
  userId: string,
  teamIds: string[],
): Promise<void> {
  const uniqueTeamIds = [...new Set(teamIds)];
  await assertTeamsInTenant(client, tenantId, uniqueTeamIds);
  await client.query(`DELETE FROM platform.user_teams WHERE user_id = $1`, [userId]);
  for (const teamId of uniqueTeamIds) {
    await client.query(
      `INSERT INTO platform.user_teams (user_id, team_id) VALUES ($1, $2)`,
      [userId, teamId],
    );
  }
}

async function countActiveAdmins(
  client: pg.PoolClient,
  tenantId: string,
  excludeUserId?: string,
): Promise<number> {
  const result = await client.query<{ count: string }>(
    `SELECT COUNT(DISTINCT u.id)::text AS count
     FROM platform.users u
     JOIN platform.user_teams ut ON ut.user_id = u.id
     JOIN platform.teams t ON t.id = ut.team_id
     WHERE u.tenant_id = $1 AND u.is_active = true AND t.key = $3
       AND ($2::uuid IS NULL OR u.id <> $2)`,
    [tenantId, excludeUserId ?? null, TEAM_ADMIN],
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function loadUser(
  client: pg.PoolClient,
  tenantId: string,
  userId: string,
): Promise<TenantUserDto | null> {
  const result = await client.query<UserRow>(
    `${USER_SELECT} AND u.id = $2`,
    [tenantId, userId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const teams = await loadUserTeams(client, userId);
  return mapUser(row, teams);
}

export async function listTenantUsers(tenantId: string): Promise<TenantUserDto[]> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<UserRow>(
      `${USER_SELECT} ORDER BY u.username`,
      [tenantId],
    );
    const users: TenantUserDto[] = [];
    for (const row of result.rows) {
      const teams = await loadUserTeams(client, row.id);
      users.push(mapUser(row, teams));
    }
    return users;
  });
}

export async function getTenantUser(
  tenantId: string,
  userId: string,
): Promise<TenantUserDto | null> {
  return withTenantTransaction(tenantId, async (client) => loadUser(client, tenantId, userId));
}

export async function createTenantUser(
  tenantId: string,
  actorUserId: string,
  input: CreateTenantUserInput,
): Promise<TenantUserDto> {
  if (!input.teamIds?.length) {
    throw badRequest('error.validation_failed');
  }

  const username = assertUsername(input.username);
  assertPassword(input.password);
  const email = input.email?.trim() || null;

  return withTenantTransaction(tenantId, async (client) => {
    await ensureDefaultTeams(client, tenantId);

    const passwordHash = await argon2.hash(input.password);

    let userId: string;
    try {
      const userResult = await client.query<{ id: string }>(
        `INSERT INTO platform.users
           (tenant_id, username, email, password_hash, preferred_language)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          tenantId,
          username,
          email,
          passwordHash,
          input.preferredLanguage ?? null,
        ],
      );
      userId = userResult.rows[0]!.id;
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') {
        throw conflict('error.username_taken');
      }
      throw err;
    }

    const teamIds = [...new Set(input.teamIds)];

    await setUserTeams(client, tenantId, userId, teamIds);

    await getEventService().publish(client, {
      tenantId,
      type: 'user.created',
      aggregateType: 'user',
      aggregateId: userId,
      actorUserId: actorUserId,
      data: { user_id: userId },
    });

    const user = await loadUser(client, tenantId, userId);
    if (!user) throw badRequest('error.internal');
    return user;
  });
}

export async function updateTenantUser(
  tenantId: string,
  userId: string,
  actorUserId: string,
  input: UpdateTenantUserInput,
): Promise<TenantUserDto> {
  if (input.teamIds !== undefined && input.teamIds.length === 0) {
    throw badRequest('error.validation_failed');
  }

  return withTenantTransaction(tenantId, async (client) => {
    const existing = await loadUser(client, tenantId, userId);
    if (!existing) throw notFound();

    const nextActive = input.isActive ?? existing.is_active;
    const wasAdmin = userIsAdmin(existing.teams);
    const isSelf = actorUserId === userId;

    let nextTeamIds: string[] | undefined;
    if (input.teamIds !== undefined) {
      nextTeamIds = [...new Set(input.teamIds)];
    }

    const nextTeams =
      nextTeamIds !== undefined
        ? (
            await client.query<UserTeamDto>(
              `SELECT t.id, t.key, t.name
               FROM platform.teams t
               WHERE t.tenant_id = $1 AND t.id = ANY($2::uuid[])
               ORDER BY t.key NULLS LAST, t.name`,
              [tenantId, nextTeamIds],
            )
          ).rows
        : existing.teams;

    const willBeAdmin = userIsAdmin(nextTeams);
    const removingAdmin = wasAdmin && (!willBeAdmin || nextActive === false);

    if (removingAdmin) {
      const adminsLeft = await countActiveAdmins(client, tenantId, userId);
      if (adminsLeft === 0) {
        throw conflict('error.last_admin');
      }
      if (isSelf && !willBeAdmin) {
        throw conflict('error.cannot_demote_self');
      }
    }

    if (input.password) {
      assertPassword(input.password);
    }

    const sets: string[] = ['updated_at = now()'];
    const values: unknown[] = [userId, tenantId];
    let idx = 3;

    if (input.email !== undefined) {
      sets.push(`email = $${idx++}`);
      values.push(input.email?.trim() || null);
    }
    if (input.isActive !== undefined) {
      sets.push(`is_active = $${idx++}`);
      values.push(input.isActive);
    }
    if (input.preferredLanguage !== undefined) {
      sets.push(`preferred_language = $${idx++}`);
      values.push(input.preferredLanguage);
    }
    if (input.password) {
      const passwordHash = await argon2.hash(input.password);
      sets.push(`password_hash = $${idx++}`);
      values.push(passwordHash);
    }

    await client.query(
      `UPDATE platform.users SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2`,
      values,
    );

    if (nextTeamIds !== undefined) {
      if (isSelf && !willBeAdmin) {
        throw conflict('error.cannot_demote_self');
      }
      await setUserTeams(client, tenantId, userId, nextTeamIds);
    }

    await getEventService().publish(client, {
      tenantId,
      type: 'user.updated',
      aggregateType: 'user',
      aggregateId: userId,
      actorUserId: actorUserId,
      data: { user_id: userId },
    });

    const user = await loadUser(client, tenantId, userId);
    if (!user) throw notFound();
    return user;
  });
}

export async function deleteTenantUser(
  tenantId: string,
  userId: string,
  actorUserId: string,
): Promise<void> {
  if (actorUserId === userId) {
    throw conflict('error.cannot_delete_self');
  }

  return withTenantTransaction(tenantId, async (client) => {
    const existing = await loadUser(client, tenantId, userId);
    if (!existing) throw notFound();

    if (userIsAdmin(existing.teams) && existing.is_active) {
      const adminsLeft = await countActiveAdmins(client, tenantId, userId);
      if (adminsLeft === 0) {
        throw conflict('error.last_admin');
      }
    }

    await client.query(
      `UPDATE events.domain_events SET actor_user_id = NULL WHERE actor_user_id = $1`,
      [userId],
    );
    await client.query(
      `UPDATE meta.attribute_definitions SET created_by = NULL WHERE created_by = $1`,
      [userId],
    );

    const result = await client.query(
      `DELETE FROM platform.users WHERE id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );
    if (!result.rowCount) throw notFound();

    await getEventService().publish(client, {
      tenantId,
      type: 'user.deleted',
      aggregateType: 'user',
      aggregateId: userId,
      actorUserId: actorUserId,
      data: { user_id: userId },
    });
  });
}
