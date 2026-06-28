import type { FastifyInstance, FastifyRequest } from 'fastify';
import { badRequest, forbidden, notFound } from '../../api/errors.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import * as appService from '../../platform/apps/app-service.js';
import * as assignmentService from '../../platform/apps/app-assignment-service.js';
import { normalizeAppGroupAssignments } from '../../platform/apps/app-groups.js';
import { getAppManifest } from '../../platform/apps/registry.js';
import { userIsAdmin } from '../../platform/teams/team-service.js';

const auth = { preHandler: requireAuth };
const admin = { preHandler: requireAdmin };

function ctx(request: FastifyRequest) {
  const user = request.user!;
  return { tenantId: user.tenantId, userId: user.id };
}

function appKeyParam(request: FastifyRequest): string {
  return (request.params as { appKey: string }).appKey;
}

function groupIdParam(request: FastifyRequest): string {
  return (request.params as { groupId: string }).groupId;
}

function userIdParam(request: FastifyRequest): string {
  return (request.params as { userId: string }).userId;
}

async function assertAppAccess(
  tenantId: string,
  userId: string,
  appKey: string,
): Promise<void> {
  const manifest = getAppManifest(appKey);
  if (!manifest) throw notFound();
  await appService.assertUserCanAccessApp(tenantId, userId, appKey);
}

export async function appRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/apps', auth, async (req) => {
    const { tenantId, userId } = ctx(req);
    const items = await appService.listInstalledAppsForUser(tenantId, userId);
    return { items };
  });

  app.get('/v1/tenant/apps', admin, async (req) => {
    const { tenantId } = ctx(req);
    const items = await appService.listTenantAppCatalog(tenantId);
    return { items };
  });

  app.patch('/v1/tenant/apps/:appKey/groups/:groupId', admin, async (req) => {
    const { tenantId, userId } = ctx(req);
    const appKey = appKeyParam(req);
    const groupId = groupIdParam(req);
    const body = (req.body ?? {}) as { status?: string };
    if (body.status !== 'active' && body.status !== 'inactive') {
      throw badRequest('error.validation_failed');
    }
    const item = await appService.setTeamAppStatus(
      tenantId,
      appKey,
      groupId,
      body.status,
      userId,
    );
    return item;
  });

  app.get('/v1/apps/:appKey/manifest', auth, async (req) => {
    const { tenantId, userId } = ctx(req);
    const appKey = appKeyParam(req);
    await assertAppAccess(tenantId, userId, appKey);
    return appService.getManifestForApp(appKey);
  });

  app.get('/v1/apps/:appKey/settings/effective', auth, async (req) => {
    const { tenantId, userId } = ctx(req);
    const appKey = appKeyParam(req);
    await assertAppAccess(tenantId, userId, appKey);
    const settings = await appService.getEffectiveAppSettings(tenantId, userId, appKey);
    return { app_key: appKey, settings };
  });

  app.get('/v1/tenant/apps/:appKey/settings', admin, async (req) => {
    const { tenantId } = ctx(req);
    const appKey = appKeyParam(req);
    const settings = await appService.getTenantAppSettings(tenantId, appKey);
    return settings;
  });

  app.patch('/v1/tenant/apps/:appKey/settings', admin, async (req) => {
    const { tenantId, userId } = ctx(req);
    const appKey = appKeyParam(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const settings = await appService.patchTenantAppSettings(tenantId, appKey, body, userId);
    return settings;
  });

  app.get('/v1/me/apps/:appKey/settings', auth, async (req) => {
    const { tenantId, userId } = ctx(req);
    const appKey = appKeyParam(req);
    await assertAppAccess(tenantId, userId, appKey);
    return appService.getUserAppSettings(tenantId, userId, appKey);
  });

  app.patch('/v1/me/apps/:appKey/settings', auth, async (req) => {
    const { tenantId, userId } = ctx(req);
    const appKey = appKeyParam(req);
    await assertAppAccess(tenantId, userId, appKey);
    const body = (req.body ?? {}) as Record<string, unknown>;
    return appService.patchUserAppSettings(tenantId, userId, appKey, body);
  });

  app.get('/v1/tenant/app-assignments', admin, async (req) => {
    const { tenantId } = ctx(req);
    return assignmentService.listTenantAppAssignments(tenantId);
  });

  app.put('/v1/tenant/groups/:groupId/app-assignments', admin, async (req) => {
    const { tenantId, userId } = ctx(req);
    const groupId = groupIdParam(req);
    const assignments = normalizeAppGroupAssignments(req.body);
    return assignmentService.setTeamAppAssignments(tenantId, groupId, assignments, userId);
  });

  app.put('/v1/tenant/actors/:actorId/app-assignments', admin, async (req) => {
    const { tenantId, userId: actingActorId } = ctx(req);
    const actorId = (req.params as { actorId: string }).actorId;
    const assignments = normalizeAppGroupAssignments(req.body);
    return assignmentService.setActorAppAssignments(tenantId, actorId, assignments, actingActorId);
  });

  app.delete('/v1/tenant/actors/:actorId/app-assignments', admin, async (req) => {
    const { tenantId } = ctx(req);
    const actorId = (req.params as { actorId: string }).actorId;
    await assignmentService.clearActorAppAssignments(tenantId, actorId);
    return { ok: true };
  });

  app.get('/v1/me/active-apps-by-group', auth, async (req) => {
    const { tenantId, userId } = ctx(req);
    return assignmentService.getActiveAppsByGroupForUser(tenantId, userId);
  });

  app.get('/v1/actors/:actorId/active-apps-by-group', auth, async (req) => {
    const { tenantId, userId: actingActorId, groups } = {
      ...ctx(req),
      groups: req.user!.groups,
    };
    const actorId = (req.params as { actorId: string }).actorId;
    if (actingActorId !== actorId && !userIsAdmin(groups)) {
      throw forbidden();
    }
    return assignmentService.getActiveAppsByGroupForUser(tenantId, actorId);
  });
}
