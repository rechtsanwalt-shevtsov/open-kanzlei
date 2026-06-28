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
  getTeamAssignments,
  listActiveAppsForUser,
  setTeamAppAssignmentsInTx,
  userHasAppAccessFromAssignments,
} from './app-assignment-service.js';
import { EMPTY_APP_GROUP_ASSIGNMENTS, type AppGroupAssignments } from './app-groups.js';
import {
  mergeEffectiveSettings,
  pickValidSettings,
} from './settings-schema.js';
import { parseWipLimits } from '../../apps/tasks-kanban/wip-limits.js';
import { TASKS_KANBAN_APP_KEY } from '../../apps/tasks-kanban/constants.js';

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

export interface GroupAppActivationDto {
  group_id: string;
  status: 'active' | 'inactive';
}

/** @deprecated Use GroupAppActivationDto */
export type TeamAppActivationDto = GroupAppActivationDto;

export interface TenantAppCatalogEntryDto {
  app_key: string;
  name: string;
  version: string;
  has_react_ui: boolean;
  settings_path: string | null;
  app_group: string;
  group_activations: GroupAppActivationDto[];
}

function toIso(date: Date): string {
  return date.toISOString();
}

function applyTeamAppToggle(
  assignments: AppGroupAssignments,
  appKey: string,
  appGroup: string,
  status: 'active' | 'inactive',
): AppGroupAssignments {
  const next: AppGroupAssignments = {
    ...assignments,
    unassigned: [...assignments.unassigned],
  };

  if (appGroup === 'unassigned') {
    const idx = next.unassigned.indexOf(appKey);
    if (status === 'active' && idx < 0) next.unassigned.push(appKey);
    if (status === 'inactive' && idx >= 0) next.unassigned.splice(idx, 1);
    next.unassigned.sort();
    return next;
  }

  if (
    appGroup === 'flight_level_0' ||
    appGroup === 'flight_level_1' ||
    appGroup === 'flight_level_2' ||
    appGroup === 'flight_level_3'
  ) {
    if (status === 'active') next[appGroup] = appKey;
    else if (next[appGroup] === appKey) next[appGroup] = null;
  }

  return next;
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
  actorId: string,
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
    actorId,
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

  for (const team of teams.rows) {
    await client.query(
      `INSERT INTO platform.team_app_assignments (tenant_id, team_id, assignments)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, team_id) DO NOTHING`,
      [tenantId, team.id, JSON.stringify(EMPTY_APP_GROUP_ASSIGNMENTS)],
    );
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

  await client.query(
    `INSERT INTO platform.team_app_assignments (tenant_id, team_id, assignments)
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id, team_id) DO NOTHING`,
    [tenantId, teamId, JSON.stringify(EMPTY_APP_GROUP_ASSIGNMENTS)],
  );
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
  return userHasAppAccessFromAssignments(client, tenantId, userId, appKey);
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
  const activeKeys = await listActiveAppsForUser(tenantId, userId);

  return withTenantTransaction(tenantId, async (client) => {
    const items: AppInstallationDto[] = [];
    for (const appKey of activeKeys) {
      const manifest = getAppManifest(appKey);
      if (!manifest) continue;

      const installation = await client.query<{
        version: string;
        installed_at: Date;
      }>(
        `SELECT version, installed_at FROM platform.app_installations
         WHERE tenant_id = $1 AND app_key = $2`,
        [tenantId, appKey],
      );
      const row = installation.rows[0];
      if (!row) continue;

      items.push({
        app_key: appKey,
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

    const activationByApp = new Map<string, GroupAppActivationDto[]>();
    for (const row of activations.rows) {
      const list = activationByApp.get(row.app_key) ?? [];
      list.push({ group_id: row.team_id, status: row.status });
      activationByApp.set(row.app_key, list);
    }

    const items: TenantAppCatalogEntryDto[] = [];
    for (const appKey of listKnownAppKeys()) {
      const manifest = getAppManifest(appKey);
      if (!manifest) continue;

      await registerAppForTenant(client, tenantId, appKey);

      const existing = activationByApp.get(appKey) ?? [];
      const byGroup = new Map(existing.map((a) => [a.group_id, a.status]));
      const groupActivations: GroupAppActivationDto[] = teams.rows.map((team) => ({
        group_id: team.id,
        status: byGroup.get(team.id) ?? 'inactive',
      }));

      for (const team of teams.rows) {
        if (!byGroup.has(team.id)) {
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
        app_group: manifest.app_group,
        group_activations: groupActivations,
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
  actorId: string,
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

    const assignments = await getTeamAssignments(client, tenantId, teamId);
    const next = applyTeamAppToggle(assignments, appKey, manifest.app_group, status);

    await setTeamAppAssignmentsInTx(client, tenantId, teamId, next, actorId);
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
       WHERE tenant_id = $1 AND actor_id = $2 AND app_key = $3`,
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
  actorId: string,
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
    if (appKey === TASKS_KANBAN_APP_KEY && merged.wipLimits !== undefined) {
      merged.wipLimits = parseWipLimits(merged.wipLimits);
    }

    await client.query(
      `INSERT INTO platform.app_tenant_settings (tenant_id, app_key, settings)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, app_key) DO UPDATE
         SET settings = EXCLUDED.settings, updated_at = now()`,
      [tenantId, appKey, JSON.stringify(merged)],
    );

    await publishSettingsUpdated(client, tenantId, appKey, 'tenant', actorId);
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
       WHERE tenant_id = $1 AND actor_id = $2 AND app_key = $3`,
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
       WHERE tenant_id = $1 AND actor_id = $2 AND app_key = $3`,
      [tenantId, userId, appKey],
    );
    const merged = {
      ...(existing.rows[0]?.settings ?? {}),
      ...validated,
    };

    await client.query(
      `INSERT INTO platform.app_user_settings (tenant_id, actor_id, app_key, settings)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, actor_id, app_key) DO UPDATE
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
