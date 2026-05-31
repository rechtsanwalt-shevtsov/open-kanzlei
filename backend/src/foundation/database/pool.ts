import pg from 'pg';
import { env } from '../../config/env.js';

const { Pool } = pg;

let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      host: env.postgres.host,
      port: env.postgres.port,
      user: env.postgres.user,
      password: env.postgres.password,
      database: env.postgres.database,
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
