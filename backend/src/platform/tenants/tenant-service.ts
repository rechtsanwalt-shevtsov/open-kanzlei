import type pg from 'pg';
import { withTenantTransaction } from '../../foundation/database/tenant-context.js';
import { badRequest } from '../../api/errors.js';
import { isSupportedLocale } from '../../foundation/i18n/locale.js';

export interface TenantProfile {
  tenant_id: string;
  firm_name: string;
  default_language: 'de' | 'en';
  settings: Record<string, unknown>;
}

export interface UpdateTenantProfileInput {
  firmName?: string;
  defaultLanguage?: 'de' | 'en';
  settings?: Record<string, unknown>;
}

export async function getTenantProfile(tenantId: string): Promise<TenantProfile> {
  return withTenantTransaction(tenantId, async (client) => {
    return getTenantProfileInTransaction(client, tenantId);
  });
}

export async function updateTenantProfile(
  tenantId: string,
  input: UpdateTenantProfileInput,
): Promise<TenantProfile> {
  if (input.defaultLanguage && !isSupportedLocale(input.defaultLanguage)) {
    throw badRequest('error.validation_failed');
  }

  return withTenantTransaction(tenantId, async (client) => {
    if (input.defaultLanguage) {
      await client.query(
        `UPDATE platform.tenants SET default_language = $2, updated_at = now()
         WHERE id = $1`,
        [tenantId, input.defaultLanguage],
      );
    }

    if (input.firmName !== undefined || input.settings !== undefined) {
      const sets: string[] = ['updated_at = now()'];
      const values: unknown[] = [tenantId];
      let idx = 2;

      if (input.firmName !== undefined) {
        sets.push(`firm_name = $${idx++}`);
        values.push(input.firmName);
      }
      if (input.settings !== undefined) {
        sets.push(`settings = $${idx++}`);
        values.push(JSON.stringify(input.settings));
      }

      await client.query(
        `UPDATE platform.tenant_profiles SET ${sets.join(', ')} WHERE tenant_id = $1`,
        values,
      );
    }

    return getTenantProfileInTransaction(client, tenantId);
  });
}

async function getTenantProfileInTransaction(
  client: pg.PoolClient,
  tenantId: string,
): Promise<TenantProfile> {
  const result = await client.query<{
    tenant_id: string;
    firm_name: string;
    default_language: 'de' | 'en';
    settings: Record<string, unknown>;
  }>(
    `SELECT tp.tenant_id, tp.firm_name, t.default_language, tp.settings
     FROM platform.tenant_profiles tp
     JOIN platform.tenants t ON t.id = tp.tenant_id
     WHERE tp.tenant_id = $1`,
    [tenantId],
  );
  const row = result.rows[0];
  if (!row) {
    throw badRequest('error.internal');
  }
  return {
    tenant_id: row.tenant_id,
    firm_name: row.firm_name,
    default_language: row.default_language,
    settings: row.settings ?? {},
  };
}
