/**
 * Deletes all case models, cases and related instance data (all tenants).
 * Usage: npx tsx foundation/database/clear-case-data.ts
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const { Pool } = pg;

async function main(): Promise<void> {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER ?? 'openkanzlei',
    password: process.env.POSTGRES_PASSWORD ?? 'openkanzlei',
    database: process.env.POSTGRES_DB ?? 'openkanzlei',
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("DELETE FROM legal.documents WHERE owner_type = 'case'");
    await client.query(
      `DELETE FROM meta.attribute_values
       WHERE owner_type IN ('case', 'case_model')`,
    );
    await client.query('DELETE FROM legal.case_assignees');
    await client.query('DELETE FROM legal.cases');
    await client.query("DELETE FROM meta.attribute_definitions WHERE owner_type = 'case_model'");
    await client.query('DELETE FROM legal.case_models');
    await client.query('COMMIT');

    const counts = await client.query<{ tbl: string; n: number }>(`
      SELECT 'case_models' AS tbl, count(*)::int AS n FROM legal.case_models
      UNION ALL SELECT 'cases', count(*)::int FROM legal.cases
    `);
    console.log('Case data cleared. Remaining counts:', counts.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Clear failed:', err);
  process.exit(1);
});
