import { env } from './config/env.js';
import { buildApp } from './app.js';
import { closePool } from './foundation/database/pool.js';

const app = await buildApp();

const shutdown = async () => {
  await app.close();
  await closePool();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  await app.listen({ port: env.port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
