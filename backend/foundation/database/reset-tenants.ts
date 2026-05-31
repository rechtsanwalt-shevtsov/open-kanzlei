/**
 * Deletes all tenants and dependent data (development reset).
 * Usage: npm run db:reset-tenants
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { Pool } = pg;

async function main(): Promise<void> {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER ?? 'openkanzlei',
    password: process.env.POSTGRES_PASSWORD ?? 'openkanzlei',
    database: process.env.POSTGRES_DB ?? 'openkanzlei',
  });

  try {
    await pool.query('TRUNCATE TABLE platform.tenants CASCADE');
    console.log('All tenants and dependent data removed.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
