/**
 * Minimal event dispatcher — marks outbox entries as delivered.
 * Webhook delivery will be added in a later step.
 */
import { getPool, closePool } from '../foundation/database/pool.js';

const BATCH_SIZE = 50;
const INTERVAL_MS = Number(process.env.EVENT_DISPATCHER_INTERVAL_MS ?? 5000);

async function processBatch(): Promise<number> {
  const pool = getPool();
  const client = await pool.connect();
  let processed = 0;

  try {
    await client.query('BEGIN');

    const pending = await client.query<{ id: string }>(
      `SELECT id FROM events.outbox_events
       WHERE status IN ('pending', 'failed')
       ORDER BY created_at
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [BATCH_SIZE],
    );

    for (const row of pending.rows) {
      await client.query(
        `UPDATE events.outbox_events
         SET status = 'delivered', last_attempt_at = now(), last_error = NULL
         WHERE id = $1`,
        [row.id],
      );
      processed += 1;
    }

    await client.query('COMMIT');
    if (processed > 0) {
      console.log(`Delivered ${processed} outbox event(s)`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Dispatcher batch failed:', err);
  } finally {
    client.release();
  }

  return processed;
}

async function run(): Promise<void> {
  console.log(`Event dispatcher started (interval ${INTERVAL_MS}ms)`);
  const tick = async () => {
    await processBatch();
    setTimeout(tick, INTERVAL_MS);
  };
  await tick();
}

run().catch(async (err) => {
  console.error(err);
  await closePool();
  process.exit(1);
});
