import type { FastifyInstance, FastifyRequest } from 'fastify';
import { badRequest } from '../errors.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { isColorTheme } from '../../foundation/ui/color-themes.js';
import * as uiPreferences from '../../platform/ui/ui-preferences-service.js';

const auth = { preHandler: requireAuth };
const admin = { preHandler: requireAdmin };

function ctx(request: FastifyRequest) {
  const user = request.user!;
  return { tenantId: user.tenantId, userId: user.id };
}

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/me/ui-preferences', auth, async (req) => {
    const { tenantId, userId } = ctx(req);
    return uiPreferences.getUiPreferences(tenantId, userId);
  });

  app.patch('/v1/me/ui-preferences', auth, async (req) => {
    const { tenantId, userId } = ctx(req);
    const body = (req.body ?? {}) as { color_theme?: unknown };
    if (!('color_theme' in body)) {
      return uiPreferences.getUiPreferences(tenantId, userId);
    }
    return uiPreferences.patchUserColorTheme(tenantId, userId, body.color_theme ?? null);
  });
}

export async function tenantUiRoutes(app: FastifyInstance): Promise<void> {
  app.patch('/v1/tenant/ui-preferences', admin, async (req) => {
    const { tenantId, userId } = ctx(req);
    const body = (req.body ?? {}) as { color_theme?: unknown };
    if (!isColorTheme(body.color_theme)) {
      throw badRequest('error.validation_failed');
    }
    return uiPreferences.patchTenantColorTheme(tenantId, userId, body.color_theme);
  });
}
