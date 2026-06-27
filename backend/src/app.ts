import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import { AppError } from './api/errors.js';
import { t } from './foundation/i18n/messages.js';
import { loadSession, registerAuthMiddleware } from './api/middleware/auth.js';
import { resolveLocale } from './foundation/i18n/locale.js';
import { authRoutes } from './api/routes/auth-routes.js';
import { tenantRoutes } from './api/routes/tenant-routes.js';
import { legalRoutes } from './api/routes/legal-routes.js';
import { platformRoutes } from './api/routes/platform-routes.js';
import { appRoutes } from './api/routes/app-routes.js';
import { tasksKanbanRoutes } from './api/routes/tasks-kanban-routes.js';
import { meRoutes, tenantUiRoutes } from './api/routes/ui-preferences-routes.js';
import { registerAppAssetRoutes } from './platform/apps/app-assets.js';
import { initializeAppRegistry } from './platform/apps/registry.js';

export async function buildApp() {
  initializeAppRegistry();

  const app = Fastify({ logger: true });

  // Accept DELETE/GET clients that send Content-Type: application/json without a body.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    try {
      const text = typeof body === 'string' ? body : body.toString('utf8');
      done(null, text ? JSON.parse(text) : undefined);
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  await app.register(cors, {
    origin: env.corsOrigin,
    credentials: true,
  });

  await app.register(cookie, {
    secret: env.sessionSecret,
    hook: 'onRequest',
  });

  await registerAuthMiddleware(app);

  app.addHook('onRequest', async (request) => {
    await loadSession(request);
    const explicit =
      (request.query as { lang?: string }).lang ?? request.headers['accept-language'];
    request.locale = resolveLocale({
      explicit: typeof explicit === 'string' ? explicit : undefined,
      userPreferred: request.user?.preferredLanguage,
      tenantDefault: request.user?.tenantDefaultLanguage,
    });
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(error.toBody(request.locale));
    }

    request.log.error(error);
    return reply.status(500).send({
      error: 'internal',
      message: t(request.locale, 'error.internal'),
    });
  });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'openkanzlei-backend',
    version: '0.5.0',
  }));

  await app.register(authRoutes);
  await app.register(tenantRoutes);
  await app.register(legalRoutes);
  await app.register(platformRoutes);
  await app.register(appRoutes);
  await app.register(tasksKanbanRoutes);
  await app.register(meRoutes);
  await app.register(tenantUiRoutes);
  await registerAppAssetRoutes(app);

  return app;
}
