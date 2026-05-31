import type pg from 'pg';
import { conflict, notFound } from '../../api/errors.js';
import { withTenantTransaction } from '../../foundation/database/tenant-context.js';

export interface TeamDto {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

type TeamRow = {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
};

function mapTeam(row: TeamRow): TeamDto {
  return {
    id: row.id,
    name: row.name,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function listTeams(tenantId: string): Promise<TeamDto[]> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<TeamRow>(
      `SELECT id, name, created_at, updated_at
       FROM platform.teams
       WHERE tenant_id = $1
       ORDER BY name`,
      [tenantId],
    );
    return result.rows.map(mapTeam);
  });
}

export async function createTeam(tenantId: string, name: string): Promise<TeamDto> {
  const trimmed = name.trim();
  if (!trimmed) {
    const { badRequest } = await import('../../api/errors.js');
    throw badRequest('error.validation_failed');
  }

  return withTenantTransaction(tenantId, async (client) => {
    try {
      const result = await client.query<TeamRow>(
        `INSERT INTO platform.teams (tenant_id, name)
         VALUES ($1, $2)
         RETURNING id, name, created_at, updated_at`,
        [tenantId, trimmed],
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

export async function getTeam(tenantId: string, teamId: string): Promise<TeamDto | null> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<TeamRow>(
      `SELECT id, name, created_at, updated_at
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

  const trimmed = name.trim();
  if (!trimmed) {
    const { badRequest } = await import('../../api/errors.js');
    throw badRequest('error.validation_failed');
  }

  return withTenantTransaction(tenantId, async (client) => {
    try {
      const result = await client.query<TeamRow>(
        `UPDATE platform.teams
         SET name = $3, updated_at = now()
         WHERE id = $1 AND tenant_id = $2
         RETURNING id, name, created_at, updated_at`,
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
    const result = await client.query(
      `DELETE FROM platform.teams WHERE id = $1 AND tenant_id = $2`,
      [teamId, tenantId],
    );
    if (!result.rowCount) throw notFound();
  });
}

export async function assertTeamInTenant(
  client: pg.PoolClient,
  tenantId: string,
  teamId: string | null | undefined,
): Promise<void> {
  if (!teamId) return;
  const result = await client.query(
    `SELECT 1 FROM platform.teams WHERE id = $1 AND tenant_id = $2`,
    [teamId, tenantId],
  );
  if (!result.rowCount) throw notFound();
}
