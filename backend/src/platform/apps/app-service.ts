import type pg from 'pg';
import { badRequest, notFound } from '../../api/errors.js';
import { getEventService } from '../../foundation/events/event-service.js';
import { withTenantTransaction } from '../../foundation/database/tenant-context.js';
import {
  getAppManifest,
  listKnownAppKeys,
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
  status: 'active';
  installed_at: string;
  has_react_ui: boolean;
  menu_category: AppMenuCategory;
  nav_path: string | null;
  nav_icon: string | null;
}

export interface TeamAppActivationDto {
  team_id: string;
  status: 'active' | 'inactive';
}

export interface TenantAppCatalogEntryDto {
  app_key: string;
  name: string;
  version: string;
  has_react_ui: boolean;
  settings_path: string | null;
  team_activations: TeamAppActivationDto[];
}

function toIso(date: Date): string {
  return date.toISOString();
}

function settingsPathFromManifest(manifest: AppManifestDto): string | null {
  const route = manifest.routes.find((r) => r.path.endsWith('/settings'));
  return route?.path ?? null;
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

export async function registerAppForTenant(
  client: pg.PoolClient,
  tenantId: string,
  appKey: string,
): Promise<void> {
  const manifest = getAppManifest(appKey);
  if (!manifest) throw badRequest('error.validation_failed');

  await client.query(
    `INSERT INTO platform.app_installations (tenant_id, app_key, version, status)
     VALUES ($1, $2, $3, 'inactive')
     ON CONFLICT (tenant_id, app_key) DO UPDATE
       SET version = EXCLUDED.version, updated_at = now()`,
    [tenantId, appKey, manifest.version],
  );
}

export async function seedTeamActivationsForTenant(
  client: pg.PoolClient,
  tenantId: string,
): Promise<void> {
  const teams = await client.query<{ id: string }>(
    `SELECT id FROM platform.teams WHERE tenant_id = $1`,
    [tenantId],
  );

  for (const appKey of listKnownAppKeys()) {
    await registerAppForTenant(client, tenantId, appKey);
    for (const team of teams.rows) {
      await client.query(
        `INSERT INTO platform.app_team_activations (tenant_id, team_id, app_key, status)
         VALUES ($1, $2, $3, 'inactive')
         ON CONFLICT (tenant_id, team_id, app_key) DO NOTHING`,
        [tenantId, team.id, appKey],
      );
    }
  }
}

export async function seedTeamActivationsForTeam(
  client: pg.PoolClient,
  tenantId: string,
  teamId: string,
): Promise<void> {
  for (const appKey of listKnownAppKeys()) {
    await registerAppForTenant(client, tenantId, appKey);
    await client.query(
      `INSERT INTO platform.app_team_activations (tenant_id, team_id, app_key, status)
       VALUES ($1, $2, $3, 'inactive')
       ON CONFLICT (tenant_id, team_id, app_key) DO NOTHING`,
      [tenantId, teamId, appKey],
    );
  }
}

export async function installDefaultAppsForNewTenant(
  client: pg.PoolClient,
  tenantId: string,
): Promise<void> {
  await seedTeamActivationsForTenant(client, tenantId);
}

async function userHasAppAccess(
  client: pg.PoolClient,
  tenantId: string,
  userId: string,
  appKey: string,
): Promise<boolean> {
  const manifest = getAppManifest(appKey);
  if (!manifest) return false;

  const result = await client.query(
    `SELECT 1
     FROM platform.app_team_activations ata
     JOIN platform.user_teams ut ON ut.team_id = ata.team_id AND ut.user_id = $3
     WHERE ata.tenant_id = $1 AND ata.app_key = $2 AND ata.status = 'active'
     LIMIT 1`,
    [tenantId, appKey, userId],
  );
  return Boolean(result.rowCount);
}

async function requireAppAccess(
  client: pg.PoolClient,
  tenantId: string,
  userId: string,
  appKey: string,
): Promise<void> {
  const manifest = getAppManifest(appKey);
  if (!manifest) throw notFound();

  const allowed = await userHasAppAccess(client, tenantId, userId, appKey);
  if (!allowed) throw notFound();
}

export async function assertUserCanAccessApp(
  tenantId: string,
  userId: string,
  appKey: string,
): Promise<void> {
  return withTenantTransaction(tenantId, async (client) => {
    await requireAppAccess(client, tenantId, userId, appKey);
  });
}

export async function listInstalledAppsForUser(
  tenantId: string,
  userId: string,
): Promise<AppInstallationDto[]> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<{
      app_key: string;
      version: string;
      installed_at: Date;
    }>(
      `SELECT DISTINCT ai.app_key, ai.version, ai.installed_at
       FROM platform.app_team_activations ata
       JOIN platform.user_teams ut ON ut.team_id = ata.team_id AND ut.user_id = $2
       JOIN platform.app_installations ai
         ON ai.tenant_id = ata.tenant_id AND ai.app_key = ata.app_key
       WHERE ata.tenant_id = $1 AND ata.status = 'active'
       ORDER BY ai.app_key`,
      [tenantId, userId],
    );

    const items: AppInstallationDto[] = [];
    for (const row of result.rows) {
      const manifest = getAppManifest(row.app_key);
      if (!manifest) continue;
      items.push({
        app_key: row.app_key,
        name: manifest.name,
        version: row.version,
        status: 'active',
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
    const teams = await client.query<{ id: string }>(
      `SELECT id FROM platform.teams WHERE tenant_id = $1 ORDER BY key NULLS LAST, name`,
      [tenantId],
    );

    const activations = await client.query<{
      app_key: string;
      team_id: string;
      status: 'active' | 'inactive';
    }>(
      `SELECT app_key, team_id, status
       FROM platform.app_team_activations
       WHERE tenant_id = $1`,
      [tenantId],
    );

    const activationByApp = new Map<string, TeamAppActivationDto[]>();
    for (const row of activations.rows) {
      const list = activationByApp.get(row.app_key) ?? [];
      list.push({ team_id: row.team_id, status: row.status });
      activationByApp.set(row.app_key, list);
    }

    const items: TenantAppCatalogEntryDto[] = [];
    for (const appKey of listKnownAppKeys()) {
      const manifest = getAppManifest(appKey);
      if (!manifest) continue;

      await registerAppForTenant(client, tenantId, appKey);

      const existing = activationByApp.get(appKey) ?? [];
      const byTeam = new Map(existing.map((a) => [a.team_id, a.status]));
      const teamActivations: TeamAppActivationDto[] = teams.rows.map((team) => ({
        team_id: team.id,
        status: byTeam.get(team.id) ?? 'inactive',
      }));

      for (const team of teams.rows) {
        if (!byTeam.has(team.id)) {
          await client.query(
            `INSERT INTO platform.app_team_activations (tenant_id, team_id, app_key, status)
             VALUES ($1, $2, $3, 'inactive')
             ON CONFLICT DO NOTHING`,
            [tenantId, team.id, appKey],
          );
        }
      }

      items.push({
        app_key: manifest.app_key,
        name: manifest.name,
        version: manifest.version,
        has_react_ui: manifest.has_react_ui,
        settings_path: settingsPathFromManifest(manifest),
        team_activations: teamActivations,
      });
    }

    return items.sort((a, b) => a.name.localeCompare(b.name));
  });
}

export async function setTeamAppStatus(
  tenantId: string,
  appKey: string,
  teamId: string,
  status: 'active' | 'inactive',
  actorUserId: string,
): Promise<TenantAppCatalogEntryDto> {
  const manifest = getAppManifest(appKey);
  if (!manifest) throw notFound();

  if (status !== 'active' && status !== 'inactive') {
    throw badRequest('error.validation_failed');
  }

  await withTenantTransaction(tenantId, async (client) => {
    const team = await client.query(
      `SELECT 1 FROM platform.teams WHERE id = $1 AND tenant_id = $2`,
      [teamId, tenantId],
    );
    if (!team.rowCount) throw notFound();

    await registerAppForTenant(client, tenantId, appKey);

    await client.query(
      `INSERT INTO platform.app_team_activations (tenant_id, team_id, app_key, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, team_id, app_key) DO UPDATE
         SET status = EXCLUDED.status, updated_at = now()`,
      [tenantId, teamId, appKey, status],
    );

    const installation = await client.query<{ id: string }>(
      `SELECT id FROM platform.app_installations WHERE tenant_id = $1 AND app_key = $2`,
      [tenantId, appKey],
    );
    const installationId = installation.rows[0]?.id;
    if (installationId) {
      await getEventService().publish(client, {
        tenantId,
        type: status === 'active' ? 'app.activated' : 'app.deactivated',
        aggregateType: 'app_installation',
        aggregateId: installationId,
        actorUserId,
        data: { app_key: appKey, team_id: teamId },
      });
    }
  });

  const catalog = await listTenantAppCatalog(tenantId);
  const entry = catalog.find((item) => item.app_key === appKey);
  if (!entry) throw notFound();
  return entry;
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
    await requireAppAccess(client, tenantId, userId, appKey);

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
  getManifestForApp(appKey);
  return withTenantTransaction(tenantId, async (client) => {
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
    await registerAppForTenant(client, tenantId, appKey);

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
    await requireAppAccess(client, tenantId, userId, appKey);
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
    await requireAppAccess(client, tenantId, userId, appKey);

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
    await seedTeamActivationsForTenant(client, tenantId);
  });
}
