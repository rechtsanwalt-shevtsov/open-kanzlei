import argon2 from 'argon2';
import type pg from 'pg';
import { badRequest, conflict, unauthorized } from '../../api/errors.js';
import { getEventService } from '../../foundation/events/event-service.js';
import {
  setTenantContext,
  withTransaction,
} from '../../foundation/database/tenant-context.js';
import { getPool } from '../../foundation/database/pool.js';
import { allocateUniqueTenantSlug } from '../tenants/slug.js';
import { actorHasPlatformLogin, loadActorRightsTeams } from '../teams/team-service.js';
import type {
  LoginInput,
  RegisterTenantInput,
  SessionActor,
} from './types.js';
import { createSession, hashSessionToken } from './session.js';
import { installDefaultAppsForNewTenant } from '../apps/app-service.js';
import { bootstrapActorTenantDataWithClient } from '../../legal-work/actor-tenant-seed.js';
import { createInitialAdminPlatformUser } from '../users/platform-user-service.js';
import { assertUsername } from '../users/validation.js';

async function loadActorEmail(
  client: pg.PoolClient,
  tenantId: string,
  actorId: string,
): Promise<string | null> {
  const result = await client.query<{ plaintext_value: string | null }>(
    `SELECT av.plaintext_value
     FROM meta.attribute_values av
     JOIN meta.attribute_definitions ad ON ad.id = av.attribute_definition_id
     JOIN legal.actors a ON a.id = $2 AND a.actor_model_id = ad.owner_id
     WHERE av.tenant_id = $1
       AND av.owner_type = 'actor'
       AND av.owner_id = $2
       AND ad.owner_type = 'actor_model'
       AND ad.key = 'email'
     LIMIT 1`,
    [tenantId, actorId],
  );
  return result.rows[0]?.plaintext_value ?? null;
}

async function loadSessionActor(
  client: pg.PoolClient,
  actorId: string,
): Promise<SessionActor | null> {
  const result = await client.query<{
    id: string;
    tenant_id: string;
    username: string;
    preferred_language: 'de' | 'en' | null;
    default_language: 'de' | 'en';
  }>(
    `SELECT a.id, a.tenant_id, c.username, c.preferred_language, t.default_language
     FROM legal.actors a
     JOIN platform.actor_credentials c ON c.actor_id = a.id
     JOIN platform.tenants t ON t.id = a.tenant_id
     WHERE a.id = $1`,
    [actorId],
  );

  const row = result.rows[0];
  if (!row) return null;

  const canLogin = await actorHasPlatformLogin(client, actorId);
  if (!canLogin) return null;

  const teams = await loadActorRightsTeams(client, actorId);
  const email = await loadActorEmail(client, row.tenant_id, actorId);

  return {
    id: row.id,
    tenantId: row.tenant_id,
    username: row.username,
    email,
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
): Promise<{ user: SessionActor; sessionToken: string }> {
  assertRegisterInput(input);

  const pool = getPool();
  const tenantSlug = await allocateUniqueTenantSlug(pool, input.firmName.trim());
  const passwordHash = await argon2.hash(input.adminPassword);
  const username = assertUsername(input.adminUsername);

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

    await bootstrapActorTenantDataWithClient(client, tenantId, input.firmName.trim(), null);

    const actorId = await createInitialAdminPlatformUser(client, tenantId, {
      username,
      passwordHash,
      email: input.adminEmail.trim(),
      displayName: input.firmName.trim(),
      preferredLanguage: input.defaultLanguage,
    });

    await installDefaultAppsForNewTenant(client, tenantId);

    await getEventService().publish(client, {
      tenantId,
      type: 'tenant.registered',
      aggregateType: 'tenant',
      aggregateId: tenantId,
      actorId,
      data: {},
    });

    const sessionToken = await createSession(client, actorId, tenantId);
    const user = await loadSessionActor(client, actorId);
    if (!user) {
      throw badRequest('error.internal');
    }

    return { user, sessionToken };
  });
}

export async function login(
  input: LoginInput,
): Promise<{ user: SessionActor; sessionToken: string }> {
  if (!input.username?.trim() || !input.password) {
    throw badRequest('error.validation_failed');
  }

  const pool = getPool();
  const username = input.username.trim();

  const matches = await pool.query<{
    actor_id: string;
    tenant_id: string;
    password_hash: string;
  }>(
    `SELECT c.actor_id, c.tenant_id, c.password_hash
     FROM platform.actor_credentials c
     WHERE c.username = $1`,
    [username],
  );

  if (matches.rows.length === 0) {
    throw unauthorized('error.invalid_credentials');
  }

  if (matches.rows.length > 1) {
    throw conflict('error.login_ambiguous');
  }

  const credRow = matches.rows[0]!;

  const valid = await argon2.verify(credRow.password_hash, input.password);
  if (!valid) {
    throw unauthorized('error.invalid_credentials');
  }

  return withTransaction(async (client) => {
    await setTenantContext(client, credRow.tenant_id);

    const canLogin = await actorHasPlatformLogin(client, credRow.actor_id);
    if (!canLogin) {
      throw unauthorized('error.invalid_credentials');
    }

    const sessionToken = await createSession(client, credRow.actor_id, credRow.tenant_id);
    const user = await loadSessionActor(client, credRow.actor_id);
    if (!user) {
      throw unauthorized('error.invalid_credentials');
    }
    return { user, sessionToken };
  });
}

export async function resolveSessionUser(token: string): Promise<SessionActor | null> {
  const tokenHash = hashSessionToken(token);
  const pool = getPool();

  const sessionResult = await pool.query<{ actor_id: string; tenant_id: string }>(
    `SELECT actor_id, tenant_id FROM platform.sessions
     WHERE token_hash = $1 AND expires_at > now()`,
    [tokenHash],
  );
  const session = sessionResult.rows[0];
  if (!session) return null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await setTenantContext(client, session.tenant_id);
    const user = await loadSessionActor(client, session.actor_id);
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
