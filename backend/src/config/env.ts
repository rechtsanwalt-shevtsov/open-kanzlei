import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  sessionSecret: process.env.SESSION_SECRET ?? 'change-me-in-production',
  sessionCookieName: 'openkanzlei_session',
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS ?? 7),
  storagePath: process.env.STORAGE_PATH ?? './storage',
  /** Max HTTP request body size in bytes (base64 attachments need headroom). */
  maxRequestBytes: Number(process.env.MAX_REQUEST_BYTES ?? 50 * 1024 * 1024),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  /** Directory containing app packages (apps/<app-key>/manifest.json). */
  appsPath: process.env.APPS_PATH ?? path.resolve(__dirname, '../../../apps'),
  postgres: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER ?? 'openkanzlei',
    password: process.env.POSTGRES_PASSWORD ?? 'openkanzlei',
    database: process.env.POSTGRES_DB ?? 'openkanzlei',
  },
};
