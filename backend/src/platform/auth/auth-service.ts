import argon2 from 'argon2';
import type pg from 'pg';
import { conflict, badRequest, unauthorized } from '../../api/errors.js';
import { getEventService } from '../../foundation/events/event-service.js';
import {
  setTenantContext,
  withTransaction,
} from '../../foundation/database/tenant-context.js';
import { getPool } from '../../foundation/database/pool.js';
import { allocateUniqueTenantSlug } from '../tenants/slug.js';
import {
  ensureDefaultTeams,
  getTeamIdByKey,
  loadUserTeams,
} from '../teams/team-service.js';
import { TEAM_ADMIN, TEAM_REGULAR } from '../teams/team-keys.js';
import type {
  LoginInput,
  RegisterTenantInput,
  SessionUser,
} from './types.js';
import { createSession, hashSessionToken } from './session.js';
import { installDefaultAppsForNewTenant } from '../apps/app-service.js';

async function loadUserWithTeams(
  client: pg.PoolClient,
  userId: string,
): Promise<SessionUser | null> {
  const userResult = await client.query<{
    id: string;
    tenant_id: string;
    username: string;
    email: string | null;
    preferred_language: 'de' | 'en' | null;
    default_language: 'de' | 'en';
  }>(
    `SELECT u.id, u.tenant_id, u.username, u.email, u.preferred_language,
            t.default_language
     FROM platform.users u
     JOIN platform.tenants t ON t.id = u.tenant_id
     WHERE u.id = $1 AND u.is_active = true`,
    [userId],
  );

  const row = userResult.rows[0];
  if (!row) return null;

  const teams = await loadUserTeams(client, userId);

  return {
    id: row.id,
    tenantId: row.tenant_id,
    username: row.username,
    email: row.email,
    preferredLanguage: row.preferred_language,
    teams,
    tenantDefaultLanguage: row.default_language,
  };
}

function assertRegisterInput(input: RegisterTenantInput): void {
  if (
    !input.firmName?.trim() ||
    !input.adminUsername?.trim() ||
    !input.adminEmail?.trim() ||
    !input.adminPassword ||
    !input.defaultLanguage
  ) {
    throw badRequest('error.validation_failed');
  }
  if (input.adminPassword.length < 8) {
    throw badRequest('error.validation_failed');
  }
}

export async function registerTenant(
  input: RegisterTenantInput,
): Promise<{ user: SessionUser; sessionToken: string }> {
  assertRegisterInput(input);

  const pool = getPool();
  const tenantSlug = await allocateUniqueTenantSlug(pool, input.firmName.trim());
  const passwordHash = await argon2.hash(input.adminPassword);

  return withTransaction(async (client) => {
    const tenantResult = await client.query<{ id: string }>(
      `INSERT INTO platform.tenants (slug, default_language)
       VALUES ($1, $2)
       RETURNING id`,
      [tenantSlug, input.defaultLanguage],
    );
    const tenantId = tenantResult.rows[0]!.id;
    await setTenantContext(client, tenantId);

    await client.query(
      `INSERT INTO platform.tenant_profiles (tenant_id, firm_name, settings)
       VALUES ($1, $2, $3)`,
      [tenantId, input.firmName.trim(), JSON.stringify({ color_theme: 'classic' })],
    );

    await ensureDefaultTeams(client, tenantId);
    const adminTeamId = await getTeamIdByKey(client, tenantId, TEAM_ADMIN);
    const regularTeamId = await getTeamIdByKey(client, tenantId, TEAM_REGULAR);

    const userResult = await client.query<{ id: string }>(
      `INSERT INTO platform.users
         (tenant_id, username, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [tenantId, input.adminUsername.trim(), input.adminEmail.trim(), passwordHash],
    );
    const userId = userResult.rows[0]!.id;

    for (const teamId of [adminTeamId, regularTeamId]) {
      await client.query(
        `INSERT INTO platform.user_teams (user_id, team_id) VALUES ($1, $2)`,
        [userId, teamId],
      );
    }

    await installDefaultAppsForNewTenant(client, tenantId);

    await getEventService().publish(client, {
      tenantId,
      type: 'tenant.registered',
      aggregateType: 'tenant',
      aggregateId: tenantId,
      actorUserId: userId,
      data: {},
    });

    const sessionToken = await createSession(client, userId, tenantId);
    const user = await loadUserWithTeams(client, userId);
    if (!user) {
      throw badRequest('error.internal');
    }

    return { user, sessionToken };
  });
}

export async function login(
  input: LoginInput,
): Promise<{ user: SessionUser; sessionToken: string }> {
  if (!input.username?.trim() || !input.password) {
    throw badRequest('error.validation_failed');
  }

  const pool = getPool();
  const username = input.username.trim();

  const matches = await pool.query<{
    id: string;
    tenant_id: string;
    password_hash: string;
  }>(
    `SELECT u.id, u.tenant_id, u.password_hash
     FROM platform.users u
     WHERE u.username = $1 AND u.is_active = true`,
    [username],
  );

  if (matches.rows.length === 0) {
    throw unauthorized('error.invalid_credentials');
  }

  if (matches.rows.length > 1) {
    throw conflict('error.login_ambiguous');
  }

  const userRow = matches.rows[0]!;

  const valid = await argon2.verify(userRow.password_hash, input.password);
  if (!valid) {
    throw unauthorized('error.invalid_credentials');
  }

  return withTransaction(async (client) => {
    await setTenantContext(client, userRow.tenant_id);
    const sessionToken = await createSession(client, userRow.id, userRow.tenant_id);
    const user = await loadUserWithTeams(client, userRow.id);
    if (!user) {
      throw unauthorized('error.invalid_credentials');
    }
    return { user, sessionToken };
  });
}

export async function resolveSessionUser(token: string): Promise<SessionUser | null> {
  const tokenHash = hashSessionToken(token);
  const pool = getPool();

  const sessionResult = await pool.query<{ user_id: string; tenant_id: string }>(
    `SELECT user_id, tenant_id FROM platform.sessions
     WHERE token_hash = $1 AND expires_at > now()`,
    [tokenHash],
  );
  const session = sessionResult.rows[0];
  if (!session) return null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await setTenantContext(client, session.tenant_id);
    const user = await loadUserWithTeams(client, session.user_id);
    await client.query('COMMIT');
    return user;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function logout(token: string): Promise<void> {
  const client = await getPool().connect();
  try {
    const { deleteSessionByToken } = await import('./session.js');
    await deleteSessionByToken(client, token);
  } finally {
    client.release();
  }
}
