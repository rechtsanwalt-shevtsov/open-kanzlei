import { createHash, randomBytes } from 'node:crypto';
import type pg from 'pg';
import { env } from '../../config/env.js';

export const SESSION_COOKIE = env.sessionCookieName;

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function sessionExpiresAt(): Date {
  const expires = new Date();
  expires.setDate(expires.getDate() + env.sessionTtlDays);
  return expires;
}

export async function createSession(
  client: pg.PoolClient,
  actorId: string,
  tenantId: string,
): Promise<string> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = sessionExpiresAt();

  await client.query(
    `INSERT INTO platform.sessions (actor_id, tenant_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [actorId, tenantId, tokenHash, expiresAt],
  );

  return token;
}

export async function deleteSessionByToken(
  client: pg.PoolClient,
  token: string,
): Promise<void> {
  const tokenHash = hashSessionToken(token);
  await client.query(`DELETE FROM platform.sessions WHERE token_hash = $1`, [tokenHash]);
}
