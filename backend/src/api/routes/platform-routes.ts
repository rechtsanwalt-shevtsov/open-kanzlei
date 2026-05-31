import type { FastifyInstance, FastifyRequest } from 'fastify';
import { notFound } from '../errors.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import * as teamService from '../../platform/teams/team-service.js';
import * as userService from '../../platform/users/user-service.js';
import type { TenantRoleKey } from '../../platform/roles/role-keys.js';

const admin = { preHandler: requireAdmin };
const auth = { preHandler: requireAuth };

function ctx(request: FastifyRequest) {
  const user = request.user!;
  return { tenantId: user.tenantId, userId: user.id };
}

function idParam(request: FastifyRequest): string {
  return (request.params as { id: string }).id;
}

export async function platformRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/teams', admin, async (req) => {
    const items = await teamService.listTeams(ctx(req).tenantId);
    return { items };
  });

  app.post('/v1/teams', admin, async (req, reply) => {
    const body = req.body as { name: string };
    const item = await teamService.createTeam(ctx(req).tenantId, body.name ?? '');
    return reply.status(201).send(item);
  });

  app.patch('/v1/teams/:id', admin, async (req) => {
    const body = req.body as { name: string };
    return teamService.updateTeam(ctx(req).tenantId, idParam(req), body.name ?? '');
  });

  app.delete('/v1/teams/:id', admin, async (req, reply) => {
    await teamService.deleteTeam(ctx(req).tenantId, idParam(req));
    return reply.status(204).send();
  });

  app.get('/v1/users', auth, async (req) => {
    const items = await userService.listTenantUsers(ctx(req).tenantId);
    return { items };
  });

  app.post('/v1/users', admin, async (req, reply) => {
    const body = req.body as {
      username: string;
      email?: string | null;
      password: string;
      role: TenantRoleKey;
      team_id?: string | null;
      preferred_language?: 'de' | 'en' | null;
    };
    const { tenantId, userId } = ctx(req);
    const item = await userService.createTenantUser(tenantId, userId, {
      username: body.username,
      email: body.email,
      password: body.password,
      role: body.role,
      teamId: body.team_id,
      preferredLanguage: body.preferred_language,
    });
    return reply.status(201).send(item);
  });

  app.get('/v1/users/:id', admin, async (req) => {
    const item = await userService.getTenantUser(ctx(req).tenantId, idParam(req));
    if (!item) throw notFound();
    return item;
  });

  app.patch('/v1/users/:id', admin, async (req) => {
    const body = req.body as {
      email?: string | null;
      password?: string;
      role?: TenantRoleKey;
      team_id?: string | null;
      is_active?: boolean;
      preferred_language?: 'de' | 'en' | null;
    };
    const { tenantId, userId } = ctx(req);
    return userService.updateTenantUser(tenantId, idParam(req), userId, {
      email: body.email,
      password: body.password,
      role: body.role,
      teamId: body.team_id,
      isActive: body.is_active,
      preferredLanguage: body.preferred_language,
    });
  });
}
