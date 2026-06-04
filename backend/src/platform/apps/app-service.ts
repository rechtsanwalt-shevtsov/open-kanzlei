import type pg from 'pg';
import { badRequest, notFound } from '../../api/errors.js';
import { getEventService } from '../../foundation/events/event-service.js';
import { withTenantTransaction } from '../../foundation/database/tenant-context.js';
import {
  getAppManifest,
  listKnownAppKeys,
  userCanAccessApp,
  type AppManifestDto,
  type AppMenuCategory,
} from './registry.js';
import {
  buildDefaultSettings,
  mergeEffectiveSettings,
  pickValidSettings,
} from './settings-schema.js';

export interface AppInstallationDto {
  app_key: string;
  name: string;
  version: string;
  status: 'active' | 'inactive';
  installed_at: string;
  has_react_ui: boolean;
  menu_category: AppMenuCategory;
  nav_path: string | null;
  nav_icon: string | null;
}

export interface TenantAppCatalogEntryDto {
  app_key: string;
  name: string;
  version: string;
  description: string;
  has_react_ui: boolean;
  menu_category: AppMenuCategory;
  nav_path: string | null;
  nav_icon: string | null;
  installed: boolean;
  status: 'active' | 'inactive' | null;
  installed_at: string | null;
}

function toIso(date: Date): string {
  return date.toISOString();
}

async function publishSettingsUpdated(
  client: pg.PoolClient,
  tenantId: string,
  appKey: string,
  scope: 'tenant' | 'user',
  actorUserId: string,
  userId?: string,
): Promise<void> {
  const installation = await client.query<{ id: string }>(
    `SELECT id FROM platform.app_installations
     WHERE tenant_id = $1 AND app_key = $2`,
    [tenantId, appKey],
  );
  const installationId = installation.rows[0]?.id;
  if (!installationId) return;

  await getEventService().publish(client, {
    tenantId,
    type: 'app_settings.updated',
    aggregateType: 'app_installation',
    aggregateId: installationId,
    actorUserId,
    data: {
      app_key: appKey,
      scope,
      ...(userId ? { user_id: userId } : {}),
    },
  });
}

async function publishAppLifecycleEvent(
  client: pg.PoolClient,
  tenantId: string,
  type: 'app.installed' | 'app.activated' | 'app.deactivated',
  installationId: string,
  appKey: string,
  actorUserId: string,
): Promise<void> {
  await getEventService().publish(client, {
    tenantId,
    type,
    aggregateType: 'app_installation',
    aggregateId: installationId,
    actorUserId,
    data: { app_key: appKey },
  });
}

export async function installAppForTenant(
  client: pg.PoolClient,
  tenantId: string,
  appKey: string,
): Promise<void> {
  const manifest = getAppManifest(appKey);
  if (!manifest) throw badRequest('error.validation_failed');

  await client.query(
    `INSERT INTO platform.app_installations (tenant_id, app_key, version, status)
     VALUES ($1, $2, $3, 'active')
     ON CONFLICT (tenant_id, app_key) DO UPDATE
       SET version = EXCLUDED.version, status = 'active', updated_at = now()`,
    [tenantId, appKey, manifest.version],
  );
}

export async function installDefaultAppsForNewTenant(
  client: pg.PoolClient,
  tenantId: string,
): Promise<void> {
  for (const appKey of listKnownAppKeys()) {
    await installAppForTenant(client, tenantId, appKey);
  }
}

async function requireInstalled(
  client: pg.PoolClient,
  tenantId: string,
  appKey: string,
): Promise<void> {
  const manifest = getAppManifest(appKey);
  if (!manifest) throw notFound();

  const row = await client.query(
    `SELECT 1 FROM platform.app_installations
     WHERE tenant_id = $1 AND app_key = $2 AND status = 'active'`,
    [tenantId, appKey],
  );
  if (!row.rowCount) throw notFound();
}

export async function listInstalledAppsForUser(
  tenantId: string,
  roles: string[],
): Promise<AppInstallationDto[]> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<{
      app_key: string;
      version: string;
      status: 'active' | 'inactive';
      installed_at: Date;
    }>(
      `SELECT app_key, version, status, installed_at
       FROM platform.app_installations
       WHERE tenant_id = $1 AND status = 'active'
       ORDER BY app_key`,
      [tenantId],
    );

    const items: AppInstallationDto[] = [];
    for (const row of result.rows) {
      const manifest = getAppManifest(row.app_key);
      if (!manifest || !userCanAccessApp(manifest, roles)) continue;
      items.push({
        app_key: row.app_key,
        name: manifest.name,
        version: row.version,
        status: row.status,
        installed_at: toIso(row.installed_at),
        has_react_ui: manifest.has_react_ui,
        menu_category: manifest.menu_category,
        nav_path: manifest.has_react_ui ? manifest.nav_path : null,
        nav_icon: manifest.nav_icon ?? null,
      });
    }
    return items;
  });
}

export async function listTenantAppCatalog(tenantId: string): Promise<TenantAppCatalogEntryDto[]> {
  return withTenantTransaction(tenantId, async (client) => {
    const installations = await client.query<{
      app_key: string;
      status: 'active' | 'inactive';
      installed_at: Date;
    }>(
      `SELECT app_key, status, installed_at
       FROM platform.app_installations
       WHERE tenant_id = $1`,
      [tenantId],
    );
    const byKey = new Map(installations.rows.map((row) => [row.app_key, row]));

    const items: TenantAppCatalogEntryDto[] = [];
    for (const appKey of listKnownAppKeys()) {
      const manifest = getAppManifest(appKey);
      if (!manifest) continue;

      const installation = byKey.get(appKey);
      items.push({
        app_key: manifest.app_key,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        has_react_ui: manifest.has_react_ui,
        menu_category: manifest.menu_category,
        nav_path: manifest.has_react_ui ? manifest.nav_path : null,
        nav_icon: manifest.nav_icon ?? null,
        installed: Boolean(installation),
        status: installation?.status ?? null,
        installed_at: installation ? toIso(installation.installed_at) : null,
      });
    }

    return items.sort((a, b) => a.name.localeCompare(b.name));
  });
}

export async function setTenantAppStatus(
  tenantId: string,
  appKey: string,
  status: 'active' | 'inactive',
  actorUserId: string,
): Promise<TenantAppCatalogEntryDto> {
  const manifest = getAppManifest(appKey);
  if (!manifest) throw notFound();

  if (status !== 'active' && status !== 'inactive') {
    throw badRequest('error.validation_failed');
  }

  return withTenantTransaction(tenantId, async (client) => {
    const prior = await client.query<{ id: string; status: 'active' | 'inactive' }>(
      `SELECT id, status FROM platform.app_installations
       WHERE tenant_id = $1 AND app_key = $2`,
      [tenantId, appKey],
    );
    const priorRow = prior.rows[0];
    let installedAt: Date;

    if (status === 'active') {
      await installAppForTenant(client, tenantId, appKey);
      const row = await client.query<{ id: string; installed_at: Date }>(
        `SELECT id, installed_at FROM platform.app_installations
         WHERE tenant_id = $1 AND app_key = $2`,
        [tenantId, appKey],
      );
      const installationId = row.rows[0]!.id;
      installedAt = row.rows[0]!.installed_at;

      if (!priorRow) {
        await publishAppLifecycleEvent(
          client,
          tenantId,
          'app.installed',
          installationId,
          appKey,
          actorUserId,
        );
      } else if (priorRow.status === 'inactive') {
        await publishAppLifecycleEvent(
          client,
          tenantId,
          'app.activated',
          installationId,
          appKey,
          actorUserId,
        );
      }
    } else {
      const updated = await client.query<{ id: string; installed_at: Date }>(
        `UPDATE platform.app_installations
         SET status = 'inactive', updated_at = now()
         WHERE tenant_id = $1 AND app_key = $2
         RETURNING id, installed_at`,
        [tenantId, appKey],
      );
      if (updated.rowCount) {
        const installationId = updated.rows[0]!.id;
        installedAt = updated.rows[0]!.installed_at;
        if (priorRow?.status === 'active') {
          await publishAppLifecycleEvent(
            client,
            tenantId,
            'app.deactivated',
            installationId,
            appKey,
            actorUserId,
          );
        }
      } else {
        const inserted = await client.query<{ id: string; installed_at: Date }>(
          `INSERT INTO platform.app_installations (tenant_id, app_key, version, status)
           VALUES ($1, $2, $3, 'inactive')
           RETURNING id, installed_at`,
          [tenantId, appKey, manifest.version],
        );
        installedAt = inserted.rows[0]!.installed_at;
      }
    }

    return {
      app_key: manifest.app_key,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      has_react_ui: manifest.has_react_ui,
      menu_category: manifest.menu_category,
      nav_path: manifest.has_react_ui ? manifest.nav_path : null,
      nav_icon: manifest.nav_icon ?? null,
      installed: true,
      status,
      installed_at: toIso(installedAt),
    };
  });
}

export function getManifestForApp(appKey: string): AppManifestDto {
  const manifest = getAppManifest(appKey);
  if (!manifest) throw notFound();
  return manifest;
}

export async function getEffectiveAppSettings(
  tenantId: string,
  userId: string,
  appKey: string,
): Promise<Record<string, unknown>> {
  const manifest = getManifestForApp(appKey);
  return withTenantTransaction(tenantId, async (client) => {
    await requireInstalled(client, tenantId, appKey);

    const tenantRow = await client.query<{ settings: Record<string, unknown> }>(
      `SELECT settings FROM platform.app_tenant_settings
       WHERE tenant_id = $1 AND app_key = $2`,
      [tenantId, appKey],
    );
    const userRow = await client.query<{ settings: Record<string, unknown> }>(
      `SELECT settings FROM platform.app_user_settings
       WHERE tenant_id = $1 AND user_id = $2 AND app_key = $3`,
      [tenantId, userId, appKey],
    );

    return mergeEffectiveSettings(
      manifest.settings_schema,
      tenantRow.rows[0]?.settings ?? {},
      userRow.rows[0]?.settings ?? {},
    );
  });
}

export async function getTenantAppSettings(
  tenantId: string,
  appKey: string,
): Promise<Record<string, unknown>> {
  const manifest = getManifestForApp(appKey);
  return withTenantTransaction(tenantId, async (client) => {
    await requireInstalled(client, tenantId, appKey);
    const result = await client.query<{ settings: Record<string, unknown> }>(
      `SELECT settings FROM platform.app_tenant_settings
       WHERE tenant_id = $1 AND app_key = $2`,
      [tenantId, appKey],
    );
    return result.rows[0]?.settings ?? {};
  });
}

export async function patchTenantAppSettings(
  tenantId: string,
  appKey: string,
  patch: Record<string, unknown>,
  actorUserId: string,
): Promise<Record<string, unknown>> {
  const manifest = getManifestForApp(appKey);
  let validated: Record<string, unknown>;
  try {
    validated = pickValidSettings(manifest.settings_schema, patch, {
      tenantConfigurable: true,
    });
  } catch {
    throw badRequest('error.validation_failed');
  }
  if (Object.keys(validated).length === 0) {
    throw badRequest('error.validation_failed');
  }

  return withTenantTransaction(tenantId, async (client) => {
    await requireInstalled(client, tenantId, appKey);

    const existing = await client.query<{ settings: Record<string, unknown> }>(
      `SELECT settings FROM platform.app_tenant_settings
       WHERE tenant_id = $1 AND app_key = $2`,
      [tenantId, appKey],
    );
    const merged = {
      ...(existing.rows[0]?.settings ?? {}),
      ...validated,
    };

    await client.query(
      `INSERT INTO platform.app_tenant_settings (tenant_id, app_key, settings)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, app_key) DO UPDATE
         SET settings = EXCLUDED.settings, updated_at = now()`,
      [tenantId, appKey, JSON.stringify(merged)],
    );

    await publishSettingsUpdated(client, tenantId, appKey, 'tenant', actorUserId);
    return merged;
  });
}

export async function getUserAppSettings(
  tenantId: string,
  userId: string,
  appKey: string,
): Promise<Record<string, unknown>> {
  getManifestForApp(appKey);
  return withTenantTransaction(tenantId, async (client) => {
    await requireInstalled(client, tenantId, appKey);
    const result = await client.query<{ settings: Record<string, unknown> }>(
      `SELECT settings FROM platform.app_user_settings
       WHERE tenant_id = $1 AND user_id = $2 AND app_key = $3`,
      [tenantId, userId, appKey],
    );
    return result.rows[0]?.settings ?? {};
  });
}

export async function patchUserAppSettings(
  tenantId: string,
  userId: string,
  appKey: string,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const manifest = getManifestForApp(appKey);
  let validated: Record<string, unknown>;
  try {
    validated = pickValidSettings(manifest.settings_schema, patch, {
      userOverridable: true,
    });
  } catch {
    throw badRequest('error.validation_failed');
  }
  if (Object.keys(validated).length === 0) {
    throw badRequest('error.validation_failed');
  }

  return withTenantTransaction(tenantId, async (client) => {
    await requireInstalled(client, tenantId, appKey);

    const existing = await client.query<{ settings: Record<string, unknown> }>(
      `SELECT settings FROM platform.app_user_settings
       WHERE tenant_id = $1 AND user_id = $2 AND app_key = $3`,
      [tenantId, userId, appKey],
    );
    const merged = {
      ...(existing.rows[0]?.settings ?? {}),
      ...validated,
    };

    await client.query(
      `INSERT INTO platform.app_user_settings (tenant_id, user_id, app_key, settings)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, user_id, app_key) DO UPDATE
         SET settings = EXCLUDED.settings, updated_at = now()`,
      [tenantId, userId, appKey, JSON.stringify(merged)],
    );

    await publishSettingsUpdated(client, tenantId, appKey, 'user', userId, userId);
    return merged;
  });
}

/** Ensures registry apps missing from old tenants can be backfilled (dev helper). */
export async function ensureKnownAppsInstalled(tenantId: string): Promise<void> {
  return withTenantTransaction(tenantId, async (client) => {
    for (const appKey of listKnownAppKeys()) {
      await installAppForTenant(client, tenantId, appKey);
    }
  });
}
