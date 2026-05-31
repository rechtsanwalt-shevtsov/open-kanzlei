import type { FastifyInstance } from 'fastify';
import {
  login,
  logout,
  registerTenant,
} from '../../platform/auth/auth-service.js';
import { toCurrentUserResponse } from '../../platform/auth/types.js';
import {
  clearSessionCookie,
  loadSession,
  requireAuth,
  setSessionCookie,
} from '../middleware/auth.js';
import { SESSION_COOKIE } from '../../platform/auth/session.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/auth/register-tenant', async (request, reply) => {
    const body = request.body as {
      firm_name?: string;
      admin_username?: string;
      admin_email?: string;
      admin_password?: string;
      default_language?: 'de' | 'en';
    };

    const { user, sessionToken } = await registerTenant({
      firmName: body.firm_name ?? '',
      adminUsername: body.admin_username ?? '',
      adminEmail: body.admin_email ?? '',
      adminPassword: body.admin_password ?? '',
      defaultLanguage: body.default_language ?? 'de',
    });

    setSessionCookie(reply, sessionToken);
    return reply.status(201).send({ user: toCurrentUserResponse(user) });
  });

  app.post('/v1/auth/login', async (request, reply) => {
    const body = request.body as {
      username?: string;
      password?: string;
    };

    const { user, sessionToken } = await login({
      username: body.username ?? '',
      password: body.password ?? '',
    });

    setSessionCookie(reply, sessionToken);
    return { user: toCurrentUserResponse(user) };
  });

  app.post('/v1/auth/logout', { preHandler: loadSession }, async (request, reply) => {
    const unsigned = request.cookies[SESSION_COOKIE];
    if (unsigned) {
      const token = request.unsignCookie(unsigned);
      if (token.valid && token.value) {
        await logout(token.value);
      }
    }
    clearSessionCookie(reply);
    return reply.status(204).send();
  });

  app.get('/v1/auth/me', { preHandler: requireAuth }, async (request) => {
    return { user: toCurrentUserResponse(request.user!) };
  });
}
