import type { FastifyInstance, FastifyRequest } from 'fastify';
import { notFound } from '../errors.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import * as teamService from '../../platform/teams/team-service.js';
import * as platformUserService from '../../platform/users/platform-user-service.js';

const admin = { preHandler: requireAdmin };
const auth = { preHandler: requireAuth };

function ctx(request: FastifyRequest) {
  const user = request.user!;
  return { tenantId: user.tenantId, actorId: user.id };
}

function idParam(request: FastifyRequest): string {
  return (request.params as { id: string }).id;
}

export async function platformRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/groups', admin, async (req) => {
    const items = await teamService.listTeams(ctx(req).tenantId);
    return { items };
  });

  app.get('/v1/groups/assignable', admin, async (req) => {
    const items = await teamService.listAssignableTeams(ctx(req).tenantId);
    return { items };
  });

  app.post('/v1/groups', admin, async (req, reply) => {
    const body = req.body as { name: string };
    const item = await teamService.createTeam(ctx(req).tenantId, body.name ?? '');
    return reply.status(201).send(item);
  });

  app.patch('/v1/groups/:id', admin, async (req) => {
    const body = req.body as { name: string };
    return teamService.updateTeam(ctx(req).tenantId, idParam(req), body.name ?? '');
  });

  app.delete('/v1/groups/:id', admin, async (req, reply) => {
    await teamService.deleteTeam(ctx(req).tenantId, idParam(req));
    return reply.status(204).send();
  });

  app.get('/v1/platform-users', auth, async (req) => {
    const items = await platformUserService.listPlatformUsers(ctx(req).tenantId);
    return { items };
  });

  app.post('/v1/platform-users', admin, async (req, reply) => {
    const body = req.body as {
      username: string;
      password: string;
      email?: string | null;
      first_name?: string | null;
      display_name?: string | null;
      actor_model_id?: string;
      group_ids: string[];
      preferred_language?: 'de' | 'en' | null;
    };
    const { tenantId, actorId } = ctx(req);
    const item = await platformUserService.createPlatformUser(tenantId, actorId, {
      username: body.username,
      password: body.password,
      email: body.email,
      firstName: body.first_name,
      displayName: body.display_name,
      actorModelId: body.actor_model_id,
      teamIds: body.group_ids ?? [],
      preferredLanguage: body.preferred_language,
    });
    return reply.status(201).send(item);
  });

  app.get('/v1/platform-users/:id', admin, async (req) => {
    const item = await platformUserService.getPlatformUser(ctx(req).tenantId, idParam(req));
    if (!item) throw notFound();
    return item;
  });

  app.patch('/v1/platform-users/:id', admin, async (req) => {
    const body = req.body as {
      username?: string;
      password?: string;
      email?: string | null;
      first_name?: string | null;
      display_name?: string | null;
      group_ids?: string[];
      preferred_language?: 'de' | 'en' | null;
      revoke_login?: boolean;
    };
    const { tenantId, actorId } = ctx(req);
    return platformUserService.updatePlatformUser(tenantId, idParam(req), actorId, {
      username: body.username,
      password: body.password,
      email: body.email,
      firstName: body.first_name,
      displayName: body.display_name,
      teamIds: body.group_ids,
      preferredLanguage: body.preferred_language,
      revokeLogin: body.revoke_login,
    });
  });

  app.delete('/v1/platform-users/:id', admin, async (req, reply) => {
    const { tenantId, actorId } = ctx(req);
    await platformUserService.revokePlatformUserLogin(tenantId, idParam(req), actorId);
    return reply.status(204).send();
  });
}
