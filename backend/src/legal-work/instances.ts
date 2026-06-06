import type pg from 'pg';
import { notFound } from '../api/errors.js';
import { getEventService } from '../foundation/events/event-service.js';
import type { PublicEventType } from '../foundation/events/event-types.js';
import { withTenantTransaction } from '../foundation/database/tenant-context.js';
import {
  loadInstanceAttributes,
  upsertInstanceAttributes,
} from './attributes.js';
import {
  loadCaseAssignees,
  setCaseAssignees,
  type AssigneeDto,
} from './assignments.js';
import { getCaseModel } from './models.js';
import { resolveCaseInstanceStatus } from './case-instance-status.js';
import { toIso } from './validation.js';

export interface CaseDto {
  id: string;
  case_model_id: string;
  status: string;
  encryption_status: string;
  encryption_version: number | null;
  attributes?: Record<string, string | number | boolean | string[] | null>;
  assignees: AssigneeDto[];
  created_at: string;
  updated_at: string;
}

function withStatusAttribute(
  status: string,
  attributes: Record<string, string | number | boolean | string[] | null>,
): Record<string, string | number | boolean | string[] | null> {
  return { ...attributes, status };
}

type InstanceRow = {
  id: string;
  status: string;
  encryption_status: string;
  encryption_version: number | null;
  created_at: Date;
  updated_at: Date;
};

async function publish(
  client: pg.PoolClient,
  tenantId: string,
  type: PublicEventType,
  aggregateType: string,
  aggregateId: string,
  data: Record<string, unknown>,
  actorUserId?: string,
): Promise<void> {
  await getEventService().publish(client, {
    tenantId,
    type,
    aggregateType,
    aggregateId,
    data,
    actorUserId,
  });
}

// —— Cases ——

export async function listCases(
  tenantId: string,
  caseModelId?: string,
): Promise<CaseDto[]> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = caseModelId
      ? await client.query<InstanceRow & { case_model_id: string }>(
          `SELECT id, case_model_id, status, encryption_status, encryption_version,
                  created_at, updated_at
           FROM legal.cases
           WHERE case_model_id = $1 AND tenant_id = $2
           ORDER BY created_at DESC`,
          [caseModelId, tenantId],
        )
      : await client.query<InstanceRow & { case_model_id: string }>(
          `SELECT id, case_model_id, status, encryption_status, encryption_version,
                  created_at, updated_at
           FROM legal.cases WHERE tenant_id = $1 ORDER BY created_at DESC`,
          [tenantId],
        );

    const assigneeMap = await loadCaseAssignees(
      client,
      tenantId,
      result.rows.map((r) => r.id),
    );
    const items: CaseDto[] = [];
    for (const row of result.rows) {
      const attrs = await loadInstanceAttributes(
        client,
        tenantId,
        'case',
        row.id,
        'case_model',
        row.case_model_id,
      );
      items.push({
        id: row.id,
        case_model_id: row.case_model_id,
        status: row.status,
        encryption_status: row.encryption_status,
        encryption_version: row.encryption_version,
        attributes: withStatusAttribute(row.status, attrs),
        assignees: assigneeMap.get(row.id) ?? [],
        created_at: toIso(row.created_at),
        updated_at: toIso(row.updated_at),
      });
    }
    return items;
  });
}

export async function createCase(
  tenantId: string,
  input: {
    case_model_id: string;
    status?: string;
    attributes?: Record<string, unknown>;
    assignee_user_ids?: string[];
  },
): Promise<CaseDto> {
  if (!(await getCaseModel(tenantId, input.case_model_id))) throw notFound();

  return withTenantTransaction(tenantId, async (client) => {
    const status = await resolveCaseInstanceStatus(
      client,
      tenantId,
      input.case_model_id,
      input.status,
      input.attributes,
    );
    const result = await client.query<InstanceRow & { case_model_id: string }>(
      `INSERT INTO legal.cases (tenant_id, case_model_id, status)
       VALUES ($1, $2, $3)
       RETURNING id, case_model_id, status, encryption_status, encryption_version,
                 created_at, updated_at`,
      [tenantId, input.case_model_id, status],
    );
    const row = result.rows[0]!;
    if (input.assignee_user_ids?.length) {
      await setCaseAssignees(client, tenantId, row.id, input.assignee_user_ids);
    }
    const changedKeys = await upsertInstanceAttributes(
      client,
      tenantId,
      'case',
      row.id,
      'case_model',
      row.case_model_id,
      input.attributes,
    );
    const attributes = await loadInstanceAttributes(
      client,
      tenantId,
      'case',
      row.id,
      'case_model',
      row.case_model_id,
    );
    await publish(client, tenantId, 'case.created', 'case', row.id, {
      case_id: row.id,
      ...(changedKeys.length ? { changed_attribute_keys: changedKeys } : {}),
    });
    const assigneeMap = await loadCaseAssignees(client, tenantId, [row.id]);
    return {
      id: row.id,
      case_model_id: row.case_model_id,
      status: row.status,
      encryption_status: row.encryption_status,
      encryption_version: row.encryption_version,
      attributes: withStatusAttribute(row.status, attributes),
      assignees: assigneeMap.get(row.id) ?? [],
      created_at: toIso(row.created_at),
      updated_at: toIso(row.updated_at),
    };
  });
}

export async function getCase(tenantId: string, id: string): Promise<CaseDto | null> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<InstanceRow & { case_model_id: string }>(
      `SELECT id, case_model_id, status, encryption_status, encryption_version,
              created_at, updated_at
       FROM legal.cases WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    const row = result.rows[0];
    if (!row) return null;
    const attributes = await loadInstanceAttributes(
      client,
      tenantId,
      'case',
      row.id,
      'case_model',
      row.case_model_id,
    );
    const assigneeMap = await loadCaseAssignees(client, tenantId, [row.id]);
    return {
      id: row.id,
      case_model_id: row.case_model_id,
      status: row.status,
      encryption_status: row.encryption_status,
      encryption_version: row.encryption_version,
      attributes: withStatusAttribute(row.status, attributes),
      assignees: assigneeMap.get(row.id) ?? [],
      created_at: toIso(row.created_at),
      updated_at: toIso(row.updated_at),
    };
  });
}

export async function updateCase(
  tenantId: string,
  id: string,
  input: {
    status?: string;
    attributes?: Record<string, unknown>;
    assignee_user_ids?: string[];
  },
): Promise<CaseDto> {
  const existing = await getCase(tenantId, id);
  if (!existing) throw notFound();

  return withTenantTransaction(tenantId, async (client) => {
    let nextStatus: string | undefined;
    if (input.status !== undefined || input.attributes?.status !== undefined) {
      nextStatus = await resolveCaseInstanceStatus(
        client,
        tenantId,
        existing.case_model_id,
        input.status ?? existing.status,
        input.attributes,
      );
    }

    const result = await client.query<InstanceRow & { case_model_id: string }>(
      `UPDATE legal.cases
       SET status = COALESCE($3, status), updated_at = now()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, case_model_id, status, encryption_status, encryption_version,
                 created_at, updated_at`,
      [id, tenantId, nextStatus],
    );
    const row = result.rows[0]!;
    if (input.assignee_user_ids !== undefined) {
      await setCaseAssignees(client, tenantId, row.id, input.assignee_user_ids);
    }
    const changedKeys = await upsertInstanceAttributes(
      client,
      tenantId,
      'case',
      row.id,
      'case_model',
      row.case_model_id,
      input.attributes,
    );
    const attributes = await loadInstanceAttributes(
      client,
      tenantId,
      'case',
      row.id,
      'case_model',
      row.case_model_id,
    );
    await publish(client, tenantId, 'case.updated', 'case', row.id, {
      case_id: row.id,
      ...(changedKeys.length ? { changed_attribute_keys: changedKeys } : {}),
    });
    const assigneeMap = await loadCaseAssignees(client, tenantId, [row.id]);
    return {
      id: row.id,
      case_model_id: row.case_model_id,
      status: row.status,
      encryption_status: row.encryption_status,
      encryption_version: row.encryption_version,
      attributes: withStatusAttribute(row.status, attributes),
      assignees: assigneeMap.get(row.id) ?? [],
      created_at: toIso(row.created_at),
      updated_at: toIso(row.updated_at),
    };
  });
}

export async function deleteCase(tenantId: string, id: string): Promise<void> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query(
      `DELETE FROM legal.cases WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (!result.rowCount) throw notFound();
    await publish(client, tenantId, 'case.deleted', 'case', id, { case_id: id });
  });
}
