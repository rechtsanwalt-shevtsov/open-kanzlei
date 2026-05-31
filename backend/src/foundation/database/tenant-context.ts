import type pg from 'pg';
import { getPool } from './pool.js';

/** Sets RLS tenant context for the current transaction (Konzept.txt §10). */
export async function setTenantContext(
  client: pg.PoolClient,
  tenantId: string,
): Promise<void> {
  await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
}

export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function withTenantTransaction<T>(
  tenantId: string,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  return withTransaction(async (client) => {
    await setTenantContext(client, tenantId);
    return fn(client);
  });
}
