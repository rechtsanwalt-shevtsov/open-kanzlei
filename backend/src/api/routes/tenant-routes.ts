import type { FastifyInstance } from 'fastify';
import { getTenantProfile, updateTenantProfile } from '../../platform/tenants/tenant-service.js';
import { requireAuth } from '../middleware/auth.js';

export async function tenantRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/tenant/profile', { preHandler: requireAuth }, async (request) => {
    return getTenantProfile(request.user!.tenantId);
  });

  app.patch('/v1/tenant/profile', { preHandler: requireAuth }, async (request) => {
    const body = request.body as {
      firm_name?: string;
      default_language?: 'de' | 'en';
      settings?: Record<string, unknown>;
    };
    return updateTenantProfile(request.user!.tenantId, {
      firmName: body.firm_name,
      defaultLanguage: body.default_language,
      settings: body.settings,
    }, request.user!.id);
  });
}
