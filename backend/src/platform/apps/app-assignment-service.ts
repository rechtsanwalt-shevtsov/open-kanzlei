import type pg from 'pg';
import { badRequest, notFound } from '../../api/errors.js';
import { getEventService } from '../../foundation/events/event-service.js';
import { withTenantTransaction } from '../../foundation/database/tenant-context.js';
import {
  activeAppKeysFromAssignments,
  EMPTY_APP_GROUP_ASSIGNMENTS,
  FLIGHT_LEVEL_GROUPS,
  isFlightLevelGroup,
  normalizeAppGroupAssignments,
  type AppGroup,
  type AppGroupAssignments,
  type FlightLevelGroup,
} from './app-groups.js';
import { getAppManifest, listKnownAppKeys } from './registry.js';

export interface AppCatalogItemDto {
  app_key: string;
  name: string;
  app_group: AppGroup;
  has_react_ui: boolean;
  settings_path: string | null;
}

export interface TeamAppAssignmentRowDto {
  team_id: string;
  team_name: string;
  assignments: AppGroupAssignments;
}

export interface ActorAppAssignmentRowDto {
  actor_id: string;
  username: string;
  assignments: AppGroupAssignments;
}

/** @deprecated Use ActorAppAssignmentRowDto */
export type UserAppAssignmentRowDto = ActorAppAssignmentRowDto;

export interface TenantAppAssignmentsDto {
  apps: AppCatalogItemDto[];
  teams: TeamAppAssignmentRowDto[];
  actor_overrides: ActorAppAssignmentRowDto[];
  /** @deprecated Use actor_overrides */
  user_overrides: ActorAppAssignmentRowDto[];
}

export interface ActiveAppsByGroupDto extends AppGroupAssignments {
  active_apps: string[];
}

function settingsPathFromManifest(appKey: string): string | null {
  const manifest = getAppManifest(appKey);
  if (!manifest) return null;
  const route = manifest.routes.find((r) => r.path.endsWith('/settings'));
  return route?.path ?? null;
}

/**
 * Re-buckets every referenced app into the group declared in its manifest.
 * Unknown apps and duplicates are dropped; for a flight level the first valid
 * app wins. This keeps assignments self-healing even if persisted data is stale
 * (e.g. legacy rows where flight-level apps ended up in `unassigned`).
 */
function bucketAssignmentsByManifest(assignments: AppGroupAssignments): AppGroupAssignments {
  const result: AppGroupAssignments = {
    flight_level_0: null,
    flight_level_1: null,
    flight_level_2: null,
    flight_level_3: null,
    unassigned: [],
  };
  const seen = new Set<string>();

  const consider = (appKey: string | null): void => {
    if (!appKey || seen.has(appKey)) return;
    const manifest = getAppManifest(appKey);
    if (!manifest) return;
    seen.add(appKey);
    const group = manifest.app_group;
    if (group === 'unassigned') {
      result.unassigned.push(appKey);
    } else if (isFlightLevelGroup(group) && !result[group]) {
      result[group] = appKey;
    }
  };

  for (const group of FLIGHT_LEVEL_GROUPS) consider(assignments[group]);
  for (const appKey of assignments.unassigned) consider(appKey);

  result.unassigned.sort();
  return result;
}

async function syncTeamActivations(
  client: pg.PoolClient,
  tenantId: string,
  teamId: string,
  assignments: AppGroupAssignments,
): Promise<void> {
  const activeKeys = new Set(activeAppKeysFromAssignments(assignments));

  for (const appKey of listKnownAppKeys()) {
    const status = activeKeys.has(appKey) ? 'active' : 'inactive';
    await client.query(
      `INSERT INTO platform.app_team_activations (tenant_id, team_id, app_key, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, team_id, app_key) DO UPDATE
         SET status = EXCLUDED.status, updated_at = now()`,
      [tenantId, teamId, appKey, status],
    );
  }
}

async function provisionActivatedApps(
  client: pg.PoolClient,
  tenantId: string,
  previousKeys: Set<string>,
  nextKeys: Set<string>,
  actorId: string,
): Promise<void> {
  const { provisionAppAttributesForTenant } = await import('./app-attribute-provisioning.js');

  for (const appKey of nextKeys) {
    if (previousKeys.has(appKey)) continue;
    await provisionAppAttributesForTenant(client, tenantId, appKey, actorId);
    if (appKey === 'tasks-kanban') {
      const { seedWipLimitsOnAppActivation } = await import(
        '../../apps/tasks-kanban/board-service.js'
      );
      await seedWipLimitsOnAppActivation(client, tenantId);
    }

    const installation = await client.query<{ id: string }>(
      `SELECT id FROM platform.app_installations WHERE tenant_id = $1 AND app_key = $2`,
      [tenantId, appKey],
    );
    const installationId = installation.rows[0]?.id;
    if (installationId) {
      await getEventService().publish(client, {
        tenantId,
        type: 'app.activated',
        aggregateType: 'app_installation',
        aggregateId: installationId,
        actorId,
        data: { app_key: appKey },
      });
    }
  }

  for (const appKey of previousKeys) {
    if (nextKeys.has(appKey)) continue;
    const installation = await client.query<{ id: string }>(
      `SELECT id FROM platform.app_installations WHERE tenant_id = $1 AND app_key = $2`,
      [tenantId, appKey],
    );
    const installationId = installation.rows[0]?.id;
    if (installationId) {
      await getEventService().publish(client, {
        tenantId,
        type: 'app.deactivated',
        aggregateType: 'app_installation',
        aggregateId: installationId,
        actorId,
        data: { app_key: appKey },
      });
    }
  }
}

function mergeTeamAssignments(teamRows: AppGroupAssignments[]): AppGroupAssignments {
  const merged: AppGroupAssignments = { ...EMPTY_APP_GROUP_ASSIGNMENTS, unassigned: [] };
  const unassigned = new Set<string>();

  for (const row of teamRows) {
    for (const appKey of row.unassigned) unassigned.add(appKey);
    for (const group of FLIGHT_LEVEL_GROUPS) {
      if (!merged[group] && row[group]) merged[group] = row[group];
    }
  }

  merged.unassigned = [...unassigned].sort();
  return merged;
}

export async function getTeamAssignments(
  client: pg.PoolClient,
  tenantId: string,
  teamId: string,
): Promise<AppGroupAssignments> {
  const result = await client.query<{ assignments: unknown }>(
    `SELECT assignments FROM platform.team_app_assignments
     WHERE tenant_id = $1 AND team_id = $2`,
    [tenantId, teamId],
  );
  if (!result.rowCount) return { ...EMPTY_APP_GROUP_ASSIGNMENTS, unassigned: [] };
  return bucketAssignmentsByManifest(normalizeAppGroupAssignments(result.rows[0].assignments));
}

export async function getUserOverrideAssignments(
  client: pg.PoolClient,
  tenantId: string,
  userId: string,
): Promise<AppGroupAssignments | null> {
  const result = await client.query<{ assignments: unknown }>(
    `SELECT assignments FROM platform.actor_app_assignments
     WHERE tenant_id = $1 AND actor_id = $2`,
    [tenantId, userId],
  );
  if (!result.rowCount) return null;
  return bucketAssignmentsByManifest(normalizeAppGroupAssignments(result.rows[0].assignments));
}

export async function resolveEffectiveAssignmentsForUser(
  client: pg.PoolClient,
  tenantId: string,
  userId: string,
): Promise<AppGroupAssignments> {
  const userOverride = await getUserOverrideAssignments(client, tenantId, userId);
  if (userOverride) return userOverride;

  const teams = await client.query<{ team_id: string; team_name: string }>(
    `SELECT t.id AS team_id, t.name AS team_name
     FROM platform.actor_teams ut
     JOIN platform.teams t ON t.id = ut.team_id
     WHERE ut.actor_id = $1 AND t.tenant_id = $2
     ORDER BY t.name`,
    [userId, tenantId],
  );

  const teamAssignments: AppGroupAssignments[] = [];
  for (const team of teams.rows) {
    teamAssignments.push(await getTeamAssignments(client, tenantId, team.team_id));
  }

  return mergeTeamAssignments(teamAssignments);
}

export async function userHasAppAccessFromAssignments(
  client: pg.PoolClient,
  tenantId: string,
  userId: string,
  appKey: string,
): Promise<boolean> {
  const manifest = getAppManifest(appKey);
  if (!manifest) return false;
  const effective = await resolveEffectiveAssignmentsForUser(client, tenantId, userId);
  return activeAppKeysFromAssignments(effective).includes(appKey);
}

export async function listActiveAppsForUser(
  tenantId: string,
  userId: string,
): Promise<string[]> {
  return withTenantTransaction(tenantId, async (client) => {
    const effective = await resolveEffectiveAssignmentsForUser(client, tenantId, userId);
    return activeAppKeysFromAssignments(effective);
  });
}

export async function getActiveAppsByGroupForUser(
  tenantId: string,
  userId: string,
): Promise<ActiveAppsByGroupDto> {
  return withTenantTransaction(tenantId, async (client) => {
    const assignments = await resolveEffectiveAssignmentsForUser(client, tenantId, userId);
    return {
      ...assignments,
      active_apps: activeAppKeysFromAssignments(assignments),
    };
  });
}

export async function listTenantAppAssignments(tenantId: string): Promise<TenantAppAssignmentsDto> {
  return withTenantTransaction(tenantId, async (client) => {
    const teams = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM platform.teams WHERE tenant_id = $1 ORDER BY key NULLS LAST, name`,
      [tenantId],
    );

    const teamRows: TeamAppAssignmentRowDto[] = [];
    for (const team of teams.rows) {
      const existing = await client.query(
        `SELECT 1 FROM platform.team_app_assignments WHERE tenant_id = $1 AND team_id = $2`,
        [tenantId, team.id],
      );
      if (!existing.rowCount) {
        await client.query(
          `INSERT INTO platform.team_app_assignments (tenant_id, team_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [tenantId, team.id],
        );
      }

      teamRows.push({
        team_id: team.id,
        team_name: team.name,
        assignments: await getTeamAssignments(client, tenantId, team.id),
      });
    }

    const actorOverrides = await client.query<{
      actor_id: string;
      username: string;
      assignments: unknown;
    }>(
      `SELECT c.actor_id, c.username, ua.assignments
       FROM platform.actor_app_assignments ua
       JOIN platform.actor_credentials c ON c.actor_id = ua.actor_id
       WHERE ua.tenant_id = $1
       ORDER BY c.username`,
      [tenantId],
    );

    const apps: AppCatalogItemDto[] = [];
    for (const appKey of listKnownAppKeys()) {
      const manifest = getAppManifest(appKey);
      if (!manifest) continue;
      apps.push({
        app_key: manifest.app_key,
        name: manifest.name,
        app_group: manifest.app_group,
        has_react_ui: manifest.has_react_ui,
        settings_path: settingsPathFromManifest(appKey),
      });
    }

    const mappedOverrides = actorOverrides.rows.map((row) => ({
      actor_id: row.actor_id,
      username: row.username,
      assignments: normalizeAppGroupAssignments(row.assignments),
    }));

    return {
      apps: apps.sort((a, b) => a.name.localeCompare(b.name)),
      teams: teamRows,
      actor_overrides: mappedOverrides,
      user_overrides: mappedOverrides,
    };
  });
}

export async function setTeamAppAssignments(
  tenantId: string,
  teamId: string,
  assignments: AppGroupAssignments,
  actorId: string,
): Promise<TeamAppAssignmentRowDto> {
  const repaired = bucketAssignmentsByManifest(assignments);

  return withTenantTransaction(tenantId, async (client) => {
    return setTeamAppAssignmentsInTx(client, tenantId, teamId, repaired, actorId);
  });
}

export async function setTeamAppAssignmentsInTx(
  client: pg.PoolClient,
  tenantId: string,
  teamId: string,
  assignments: AppGroupAssignments,
  actorId: string,
): Promise<TeamAppAssignmentRowDto> {
  const team = await client.query<{ name: string }>(
    `SELECT name FROM platform.teams WHERE id = $1 AND tenant_id = $2`,
    [teamId, tenantId],
  );
  if (!team.rowCount) throw notFound();

  const previous = await getTeamAssignments(client, tenantId, teamId);
  const previousKeys = new Set(activeAppKeysFromAssignments(previous));
  const nextKeys = new Set(activeAppKeysFromAssignments(assignments));

  await client.query(
    `INSERT INTO platform.team_app_assignments (tenant_id, team_id, assignments)
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id, team_id) DO UPDATE
       SET assignments = EXCLUDED.assignments, updated_at = now()`,
    [tenantId, teamId, JSON.stringify(assignments)],
  );

  await syncTeamActivations(client, tenantId, teamId, assignments);
  await provisionActivatedApps(client, tenantId, previousKeys, nextKeys, actorId);

  return {
    team_id: teamId,
    team_name: team.rows[0].name,
    assignments,
  };
}

export async function setActorAppAssignments(
  tenantId: string,
  actorId: string,
  assignments: AppGroupAssignments,
  _actingActorId: string,
): Promise<ActorAppAssignmentRowDto> {
  const repaired = bucketAssignmentsByManifest(assignments);

  return withTenantTransaction(tenantId, async (client) => {
    const cred = await client.query<{ username: string }>(
      `SELECT username FROM platform.actor_credentials WHERE actor_id = $1 AND tenant_id = $2`,
      [actorId, tenantId],
    );
    if (!cred.rowCount) throw notFound();

    await client.query(
      `INSERT INTO platform.actor_app_assignments (tenant_id, actor_id, assignments)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, actor_id) DO UPDATE
         SET assignments = EXCLUDED.assignments, updated_at = now()`,
      [tenantId, actorId, JSON.stringify(repaired)],
    );

    return {
      actor_id: actorId,
      username: cred.rows[0].username,
      assignments: repaired,
    };
  });
}

/** @deprecated Use setActorAppAssignments */
export const setUserAppAssignments = setActorAppAssignments;

export async function clearActorAppAssignments(
  tenantId: string,
  actorId: string,
): Promise<void> {
  await withTenantTransaction(tenantId, async (client) => {
    const cred = await client.query(
      `SELECT 1 FROM platform.actor_credentials WHERE actor_id = $1 AND tenant_id = $2`,
      [actorId, tenantId],
    );
    if (!cred.rowCount) throw notFound();

    await client.query(
      `DELETE FROM platform.actor_app_assignments WHERE tenant_id = $1 AND actor_id = $2`,
      [tenantId, actorId],
    );
  });
}

/** @deprecated Use clearActorAppAssignments */
export const clearUserAppAssignments = clearActorAppAssignments;

export function flightLevelGroupKey(group: FlightLevelGroup): keyof AppGroupAssignments {
  if (!isFlightLevelGroup(group)) throw badRequest('error.validation_failed');
  return group;
}
