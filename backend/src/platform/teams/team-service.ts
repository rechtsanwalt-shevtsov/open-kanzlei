import type pg from 'pg';
import { badRequest, conflict, notFound } from '../../api/errors.js';
import { withTenantTransaction } from '../../foundation/database/tenant-context.js';
import {
  DEFAULT_TEAM_NAMES,
  isAssignableTeamKey,
  TEAM_ADMIN,
  TEAM_PLATFORMUSER,
  TEAM_REGULAR,
  type SystemTeamKey,
} from './team-keys.js';

export interface TeamDto {
  id: string;
  key: string | null;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ActorTeamDto {
  id: string;
  key: string | null;
  name: string;
}

type TeamRow = {
  id: string;
  key: string | null;
  name: string;
  created_at: Date;
  updated_at: Date;
};

function mapTeam(row: TeamRow): TeamDto {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function ensureDefaultTeams(
  client: pg.PoolClient,
  tenantId: string,
): Promise<void> {
  for (const key of [TEAM_ADMIN, TEAM_REGULAR, TEAM_PLATFORMUSER] as const) {
    await client.query(
      `INSERT INTO platform.teams (tenant_id, name, key)
       SELECT $1, $2, $3
       WHERE NOT EXISTS (
         SELECT 1 FROM platform.teams WHERE tenant_id = $1 AND key = $3
       )`,
      [tenantId, DEFAULT_TEAM_NAMES[key], key],
    );
  }
}

export async function getTeamIdByKey(
  client: pg.PoolClient,
  tenantId: string,
  teamKey: SystemTeamKey,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `SELECT id FROM platform.teams WHERE tenant_id = $1 AND key = $2`,
    [tenantId, teamKey],
  );
  const row = result.rows[0];
  if (!row) {
    throw badRequest('error.internal');
  }
  return row.id;
}

export async function listTeams(tenantId: string): Promise<TeamDto[]> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<TeamRow>(
      `SELECT id, key, name, created_at, updated_at
       FROM platform.teams
       WHERE tenant_id = $1
       ORDER BY key NULLS LAST, name`,
      [tenantId],
    );
    return result.rows.map(mapTeam);
  });
}

/** Teams visible in normal team assignment UI (excludes plattformuser). */
export async function listAssignableTeams(tenantId: string): Promise<TeamDto[]> {
  const teams = await listTeams(tenantId);
  return teams.filter((t) => isAssignableTeamKey(t.key));
}

export async function createTeam(tenantId: string, name: string): Promise<TeamDto> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw badRequest('error.validation_failed');
  }

  return withTenantTransaction(tenantId, async (client) => {
    try {
      const result = await client.query<TeamRow>(
        `INSERT INTO platform.teams (tenant_id, name)
         VALUES ($1, $2)
         RETURNING id, key, name, created_at, updated_at`,
        [tenantId, trimmed],
      );
      const team = mapTeam(result.rows[0]!);
      const { seedTeamActivationsForTeam } = await import('../apps/app-service.js');
      await seedTeamActivationsForTeam(client, tenantId, team.id);
      return team;
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') {
        throw conflict('error.key_conflict');
      }
      throw err;
    }
  });
}

export async function getTeam(tenantId: string, teamId: string): Promise<TeamDto | null> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<TeamRow>(
      `SELECT id, key, name, created_at, updated_at
       FROM platform.teams
       WHERE id = $1 AND tenant_id = $2`,
      [teamId, tenantId],
    );
    return result.rows[0] ? mapTeam(result.rows[0]) : null;
  });
}

export async function updateTeam(
  tenantId: string,
  teamId: string,
  name: string,
): Promise<TeamDto> {
  const existing = await getTeam(tenantId, teamId);
  if (!existing) throw notFound();

  if (existing.key === TEAM_ADMIN || existing.key === TEAM_PLATFORMUSER) {
    throw conflict('error.team_protected');
  }

  const trimmed = name.trim();
  if (!trimmed) {
    throw badRequest('error.validation_failed');
  }

  return withTenantTransaction(tenantId, async (client) => {
    try {
      const result = await client.query<TeamRow>(
        `UPDATE platform.teams
         SET name = $3, updated_at = now()
         WHERE id = $1 AND tenant_id = $2
         RETURNING id, key, name, created_at, updated_at`,
        [teamId, tenantId, trimmed],
      );
      return mapTeam(result.rows[0]!);
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') {
        throw conflict('error.key_conflict');
      }
      throw err;
    }
  });
}

export async function deleteTeam(tenantId: string, teamId: string): Promise<void> {
  return withTenantTransaction(tenantId, async (client) => {
    const teamResult = await client.query<{ key: string | null }>(
      `SELECT key FROM platform.teams WHERE id = $1 AND tenant_id = $2`,
      [teamId, tenantId],
    );
    const team = teamResult.rows[0];
    if (!team) throw notFound();

    if (team.key === TEAM_ADMIN || team.key === TEAM_PLATFORMUSER) {
      throw conflict('error.team_protected');
    }

    const members = await client.query<{ count: string }>(
      `SELECT COUNT(DISTINCT at.actor_id)::text AS count
       FROM platform.actor_teams at
       JOIN legal.actors a ON a.id = at.actor_id
       WHERE a.tenant_id = $1 AND at.team_id = $2`,
      [tenantId, teamId],
    );
    if (Number(members.rows[0]?.count ?? 0) > 0) {
      throw conflict('error.team_has_members');
    }

    const result = await client.query(
      `DELETE FROM platform.teams WHERE id = $1 AND tenant_id = $2`,
      [teamId, tenantId],
    );
    if (!result.rowCount) throw notFound();
  });
}

export async function assertTeamsInTenant(
  client: pg.PoolClient,
  tenantId: string,
  teamIds: string[],
  options?: { allowPlatformUser?: boolean },
): Promise<void> {
  if (teamIds.length === 0) {
    throw badRequest('error.validation_failed');
  }

  const result = await client.query<{ id: string; key: string | null }>(
    `SELECT id, key FROM platform.teams WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
    [tenantId, teamIds],
  );
  if (result.rows.length !== teamIds.length) {
    throw notFound();
  }
  if (!options?.allowPlatformUser) {
    for (const row of result.rows) {
      if (row.key === TEAM_PLATFORMUSER) {
        throw badRequest('error.validation_failed');
      }
    }
  }
}

export async function loadActorTeams(
  client: pg.PoolClient,
  actorId: string,
  options?: { includePlatformUser?: boolean },
): Promise<ActorTeamDto[]> {
  const result = await client.query<ActorTeamDto>(
    `SELECT t.id, t.key, t.name
     FROM platform.actor_teams at
     JOIN platform.teams t ON t.id = at.team_id
     WHERE at.actor_id = $1
     ORDER BY t.key NULLS LAST, t.name`,
    [actorId],
  );
  if (options?.includePlatformUser) {
    return result.rows;
  }
  return result.rows.filter((t) => isAssignableTeamKey(t.key));
}

export async function loadActorRightsTeams(
  client: pg.PoolClient,
  actorId: string,
): Promise<ActorTeamDto[]> {
  return loadActorTeams(client, actorId, { includePlatformUser: false });
}

export async function actorHasPlatformLogin(
  client: pg.PoolClient,
  actorId: string,
): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM platform.actor_teams at
       JOIN platform.teams t ON t.id = at.team_id
       WHERE at.actor_id = $1 AND t.key = $2
     ) AS exists`,
    [actorId, TEAM_PLATFORMUSER],
  );
  return result.rows[0]?.exists ?? false;
}

export async function setActorTeams(
  client: pg.PoolClient,
  tenantId: string,
  actorId: string,
  teamIds: string[],
  options?: { preservePlatformUser?: boolean },
): Promise<void> {
  const uniqueTeamIds = [...new Set(teamIds)];
  await assertTeamsInTenant(client, tenantId, uniqueTeamIds);

  let platformUserTeamId: string | null = null;
  if (options?.preservePlatformUser) {
    const hadLogin = await actorHasPlatformLogin(client, actorId);
    if (hadLogin) {
      platformUserTeamId = await getTeamIdByKey(client, tenantId, TEAM_PLATFORMUSER);
    }
  }

  await client.query(`DELETE FROM platform.actor_teams WHERE actor_id = $1`, [actorId]);

  const finalTeamIds = platformUserTeamId
    ? [...new Set([...uniqueTeamIds, platformUserTeamId])]
    : uniqueTeamIds;

  for (const teamId of finalTeamIds) {
    await client.query(
      `INSERT INTO platform.actor_teams (actor_id, team_id) VALUES ($1, $2)`,
      [actorId, teamId],
    );
  }
}

export async function addActorToTeam(
  client: pg.PoolClient,
  actorId: string,
  teamId: string,
): Promise<void> {
  await client.query(
    `INSERT INTO platform.actor_teams (actor_id, team_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [actorId, teamId],
  );
}

export function actorTeamKeys(teams: ActorTeamDto[]): string[] {
  return teams.flatMap((t) => (t.key ? [t.key] : []));
}

export function actorIsAdmin(teams: ActorTeamDto[]): boolean {
  return teams.some((t) => t.key === TEAM_ADMIN);
}

/** @deprecated Use actorTeamKeys */
export const userTeamKeys = actorTeamKeys;

/** @deprecated Use actorIsAdmin */
export const userIsAdmin = actorIsAdmin;

/** @deprecated Use ActorTeamDto */
export type UserTeamDto = ActorTeamDto;

/** @deprecated Use loadActorRightsTeams */
export const loadUserTeams = loadActorRightsTeams;
