import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { forbidden, unauthorized } from '../errors.js';
import { resolveSessionUser } from '../../platform/auth/auth-service.js';
import { SESSION_COOKIE } from '../../platform/auth/session.js';

export async function registerAuthMiddleware(app: FastifyInstance): Promise<void> {
  app.decorateRequest('user', undefined);
}

export function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    signed: true,
    maxAge: env.sessionTtlDays * 24 * 60 * 60,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}

export async function loadSession(
  request: FastifyRequest,
): Promise<void> {
  const unsigned = request.cookies[SESSION_COOKIE];
  if (!unsigned) return;

  const token = request.unsignCookie(unsigned);
  if (!token.valid || !token.value) return;

  const user = await resolveSessionUser(token.value);
  if (user) {
    request.user = user;
  }
}

export async function requireAuth(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  await loadSession(request);
  if (!request.user) {
    throw unauthorized();
  }
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await requireAuth(request, reply);
  if (!request.user!.roles.includes('admin')) {
    throw forbidden();
  }
}
