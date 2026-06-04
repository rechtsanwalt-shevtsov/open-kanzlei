import argon2 from 'argon2';
import type pg from 'pg';
import { badRequest, conflict, notFound } from '../../api/errors.js';
import { getEventService } from '../../foundation/events/event-service.js';
import { withTenantTransaction } from '../../foundation/database/tenant-context.js';
import {
  isTenantRoleKey,
  ROLE_ADMIN,
  type TenantRoleKey,
} from '../roles/role-keys.js';
import { assertTeamInTenant } from '../teams/team-service.js';
import { assertPassword, assertUsername } from './validation.js';

export interface TenantUserDto {
  id: string;
  username: string;
  email: string | null;
  role: TenantRoleKey;
  team_id: string | null;
  team_name: string | null;
  is_active: boolean;
  preferred_language: 'de' | 'en' | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTenantUserInput {
  username: string;
  email?: string | null;
  password: string;
  role: TenantRoleKey;
  teamId?: string | null;
  preferredLanguage?: 'de' | 'en' | null;
}

export interface UpdateTenantUserInput {
  email?: string | null;
  role?: TenantRoleKey;
  teamId?: string | null;
  isActive?: boolean;
  preferredLanguage?: 'de' | 'en' | null;
  password?: string;
}

type UserRow = {
  id: string;
  username: string;
  email: string | null;
  team_id: string | null;
  team_name: string | null;
  is_active: boolean;
  preferred_language: 'de' | 'en' | null;
  created_at: Date;
  updated_at: Date;
  role: string;
};

function mapUser(row: UserRow): TenantUserDto {
  const role = isTenantRoleKey(row.role) ? row.role : ROLE_ADMIN;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role,
    team_id: row.team_id,
    team_name: row.team_name,
    is_active: row.is_active,
    preferred_language: row.preferred_language,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

const USER_SELECT = `
  SELECT u.id, u.username, u.email, u.team_id, tm.name AS team_name,
         u.is_active, u.preferred_language, u.created_at, u.updated_at,
         COALESCE(
           (SELECT r.key FROM platform.user_roles ur
            JOIN platform.roles r ON r.id = ur.role_id
            WHERE ur.user_id = u.id
            ORDER BY r.key
            LIMIT 1),
           'regular'
         ) AS role
  FROM platform.users u
  LEFT JOIN platform.teams tm ON tm.id = u.team_id AND tm.tenant_id = u.tenant_id
  WHERE u.tenant_id = $1
`;

import { ensureTenantRole, getRoleIdByKey } from '../roles/tenant-roles.js';

async function setUserRole(
  client: pg.PoolClient,
  tenantId: string,
  userId: string,
  roleKey: TenantRoleKey,
): Promise<void> {
  await ensureTenantRole(client, tenantId, 'admin');
  await ensureTenantRole(client, tenantId, 'regular');
  const roleId = await getRoleIdByKey(client, tenantId, roleKey);
  await client.query(`DELETE FROM platform.user_roles WHERE user_id = $1`, [userId]);
  await client.query(
    `INSERT INTO platform.user_roles (user_id, role_id) VALUES ($1, $2)`,
    [userId, roleId],
  );
}

async function countActiveAdmins(
  client: pg.PoolClient,
  tenantId: string,
  excludeUserId?: string,
): Promise<number> {
  const result = await client.query<{ count: string }>(
    `SELECT COUNT(DISTINCT u.id)::text AS count
     FROM platform.users u
     JOIN platform.user_roles ur ON ur.user_id = u.id
     JOIN platform.roles r ON r.id = ur.role_id
     WHERE u.tenant_id = $1 AND u.is_active = true AND r.key = 'admin'
       AND ($2::uuid IS NULL OR u.id <> $2)`,
    [tenantId, excludeUserId ?? null],
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
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function listTenantUsers(tenantId: string): Promise<TenantUserDto[]> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<UserRow>(
      `${USER_SELECT} ORDER BY u.username`,
      [tenantId],
    );
    return result.rows.map(mapUser);
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
  if (!isTenantRoleKey(input.role)) {
    throw badRequest('error.validation_failed');
  }

  const username = assertUsername(input.username);
  assertPassword(input.password);
  const email = input.email?.trim() || null;

  return withTenantTransaction(tenantId, async (client) => {
    await assertTeamInTenant(client, tenantId, input.teamId);
    await ensureTenantRole(client, tenantId, 'admin');
    await ensureTenantRole(client, tenantId, 'regular');

    const passwordHash = await argon2.hash(input.password);

    let userId: string;
    try {
      const userResult = await client.query<{ id: string }>(
        `INSERT INTO platform.users
           (tenant_id, username, email, password_hash, team_id, preferred_language)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          tenantId,
          username,
          email,
          passwordHash,
          input.teamId ?? null,
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

    await setUserRole(client, tenantId, userId, input.role);

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
  if (input.role !== undefined && !isTenantRoleKey(input.role)) {
    throw badRequest('error.validation_failed');
  }

  return withTenantTransaction(tenantId, async (client) => {
    const existing = await loadUser(client, tenantId, userId);
    if (!existing) throw notFound();

    if (input.teamId !== undefined) {
      await assertTeamInTenant(client, tenantId, input.teamId);
    }

    const nextRole = input.role ?? existing.role;
    const nextActive = input.isActive ?? existing.is_active;
    const demotingAdmin =
      existing.role === ROLE_ADMIN &&
      (nextRole !== ROLE_ADMIN || nextActive === false);
    const isSelf = actorUserId === userId;

    if (demotingAdmin) {
      const adminsLeft = await countActiveAdmins(client, tenantId, userId);
      if (adminsLeft === 0) {
        throw conflict('error.last_admin');
      }
      if (isSelf && nextRole !== ROLE_ADMIN) {
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
    if (input.teamId !== undefined) {
      sets.push(`team_id = $${idx++}`);
      values.push(input.teamId);
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

    if (input.role !== undefined && input.role !== existing.role) {
      if (isSelf && input.role !== ROLE_ADMIN) {
        throw conflict('error.cannot_demote_self');
      }
      await setUserRole(client, tenantId, userId, input.role);
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
