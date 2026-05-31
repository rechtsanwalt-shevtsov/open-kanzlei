import type pg from 'pg';
import { badRequest } from '../../api/errors.js';
import type { TenantRoleKey } from './role-keys.js';

export async function ensureTenantRole(
  client: pg.PoolClient,
  tenantId: string,
  roleKey: TenantRoleKey,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO platform.roles (tenant_id, key)
     VALUES ($1, $2)
     ON CONFLICT (tenant_id, key) DO UPDATE SET key = EXCLUDED.key
     RETURNING id`,
    [tenantId, roleKey],
  );
  const row = result.rows[0];
  if (!row) {
    throw badRequest('error.internal');
  }
  return row.id;
}

export async function getRoleIdByKey(
  client: pg.PoolClient,
  tenantId: string,
  roleKey: TenantRoleKey,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `SELECT id FROM platform.roles WHERE tenant_id = $1 AND key = $2`,
    [tenantId, roleKey],
  );
  const row = result.rows[0];
  if (!row) {
    throw badRequest('error.internal');
  }
  return row.id;
}
