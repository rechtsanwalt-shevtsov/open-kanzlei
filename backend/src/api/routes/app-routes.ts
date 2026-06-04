import type { FastifyInstance, FastifyRequest } from 'fastify';
import { badRequest, notFound } from '../../api/errors.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import * as appService from '../../platform/apps/app-service.js';
import { getAppManifest, userCanAccessApp } from '../../platform/apps/registry.js';

const auth = { preHandler: requireAuth };
const admin = { preHandler: requireAdmin };

function ctx(request: FastifyRequest) {
  const user = request.user!;
  return { tenantId: user.tenantId, userId: user.id, roles: user.roles };
}

function appKeyParam(request: FastifyRequest): string {
  return (request.params as { appKey: string }).appKey;
}

function assertAppAccess(appKey: string, roles: string[]): void {
  const manifest = getAppManifest(appKey);
  if (!manifest || !userCanAccessApp(manifest, roles)) {
    throw notFound();
  }
}

export async function appRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/apps', auth, async (req) => {
    const { tenantId, roles } = ctx(req);
    const items = await appService.listInstalledAppsForUser(tenantId, roles);
    return { items };
  });

  app.get('/v1/tenant/apps', admin, async (req) => {
    const { tenantId } = ctx(req);
    const items = await appService.listTenantAppCatalog(tenantId);
    return { items };
  });

  app.patch('/v1/tenant/apps/:appKey', admin, async (req) => {
    const { tenantId, userId } = ctx(req);
    const appKey = appKeyParam(req);
    const body = (req.body ?? {}) as { status?: string };
    if (body.status !== 'active' && body.status !== 'inactive') {
      throw badRequest('error.validation_failed');
    }
    const item = await appService.setTenantAppStatus(tenantId, appKey, body.status, userId);
    return item;
  });

  app.get('/v1/apps/:appKey/manifest', auth, async (req) => {
    const { roles } = ctx(req);
    const appKey = appKeyParam(req);
    assertAppAccess(appKey, roles);
    return appService.getManifestForApp(appKey);
  });

  app.get('/v1/apps/:appKey/settings/effective', auth, async (req) => {
    const { tenantId, userId, roles } = ctx(req);
    const appKey = appKeyParam(req);
    assertAppAccess(appKey, roles);
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
    const { tenantId, userId, roles } = ctx(req);
    const appKey = appKeyParam(req);
    assertAppAccess(appKey, roles);
    return appService.getUserAppSettings(tenantId, userId, appKey);
  });

  app.patch('/v1/me/apps/:appKey/settings', auth, async (req) => {
    const { tenantId, userId, roles } = ctx(req);
    const appKey = appKeyParam(req);
    assertAppAccess(appKey, roles);
    const body = (req.body ?? {}) as Record<string, unknown>;
    return appService.patchUserAppSettings(tenantId, userId, appKey, body);
  });
}
