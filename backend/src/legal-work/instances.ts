import type pg from 'pg';
import { badRequest, notFound } from '../api/errors.js';
import { getEventService } from '../foundation/events/event-service.js';
import { withTenantTransaction } from '../foundation/database/tenant-context.js';
import {
  loadInstanceAttributes,
  upsertInstanceAttributes,
} from './attributes.js';
import {
  loadCaseAssignees,
  loadTaskAssignees,
  setCaseAssignees,
  setTaskAssignees,
  type AssigneeDto,
} from './assignments.js';
import { getCaseModel, getTaskModel, getInstrumentModel } from './models.js';
import { assertWorkStatus, DEFAULT_WORK_STATUS } from './work-status.js';
import { toIso } from './validation.js';

export interface CaseDto {
  id: string;
  case_model_id: string;
  status: string;
  encryption_status: string;
  encryption_version: number | null;
  attributes?: Record<string, string | number | boolean | null>;
  assignees: AssigneeDto[];
  created_at: string;
  updated_at: string;
}

export interface TaskDto {
  id: string;
  case_id: string;
  task_model_id: string;
  status: string;
  encryption_status: string;
  encryption_version: number | null;
  attributes?: Record<string, string | number | boolean | null>;
  assignees: AssigneeDto[];
  created_at: string;
  updated_at: string;
}

function withStatusAttribute(
  status: string,
  attributes: Record<string, string | number | boolean | null>,
): Record<string, string | number | boolean | null> {
  return { ...attributes, status };
}

function resolveStatus(
  status: string | undefined,
  attributes?: Record<string, unknown>,
): string {
  const fromAttrs = attributes?.status;
  if (typeof fromAttrs === 'string' && fromAttrs.trim()) {
    assertWorkStatus(fromAttrs);
    return fromAttrs;
  }
  const value = status ?? DEFAULT_WORK_STATUS;
  assertWorkStatus(value);
  return value;
}

export interface InstrumentDto {
  id: string;
  task_id: string;
  instrument_model_id: string;
  status: string;
  encryption_status: string;
  encryption_version: number | null;
  attributes?: Record<string, string | number | boolean | null>;
  created_at: string;
  updated_at: string;
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
  eventType: string,
  aggregateType: string,
  aggregateId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await getEventService().publish(client, {
    tenantId,
    eventType,
    aggregateType,
    aggregateId,
    payload,
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
  const status = resolveStatus(input.status, input.attributes);

  return withTenantTransaction(tenantId, async (client) => {
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

  const nextStatus =
    input.status !== undefined || input.attributes?.status !== undefined
      ? resolveStatus(input.status ?? existing.status, input.attributes)
      : undefined;

  return withTenantTransaction(tenantId, async (client) => {
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

// —— Tasks ——

async function mapTaskRows(
  client: pg.PoolClient,
  tenantId: string,
  rows: (InstanceRow & { case_id: string; task_model_id: string })[],
): Promise<TaskDto[]> {
  const assigneeMap = await loadTaskAssignees(
    client,
    tenantId,
    rows.map((r) => r.id),
  );
  const items: TaskDto[] = [];
  for (const row of rows) {
    const attrs = await loadInstanceAttributes(
      client,
      tenantId,
      'task',
      row.id,
      'task_model',
      row.task_model_id,
    );
    items.push({
      id: row.id,
      case_id: row.case_id,
      task_model_id: row.task_model_id,
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
}

export async function listAllTasks(tenantId: string): Promise<TaskDto[]> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<InstanceRow & { case_id: string; task_model_id: string }>(
      `SELECT id, case_id, task_model_id, status, encryption_status, encryption_version,
              created_at, updated_at
       FROM legal.tasks WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return mapTaskRows(client, tenantId, result.rows);
  });
}

export async function listTasks(tenantId: string, caseId: string): Promise<TaskDto[]> {
  const caseRow = await getCase(tenantId, caseId);
  if (!caseRow) throw notFound();

  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<InstanceRow & { case_id: string; task_model_id: string }>(
      `SELECT id, case_id, task_model_id, status, encryption_status, encryption_version,
              created_at, updated_at
       FROM legal.tasks WHERE case_id = $1 AND tenant_id = $2 ORDER BY created_at`,
      [caseId, tenantId],
    );
    return mapTaskRows(client, tenantId, result.rows);
  });
}

export async function createTask(
  tenantId: string,
  caseId: string,
  input: {
    task_model_id: string;
    status?: string;
    attributes?: Record<string, unknown>;
    assignee_user_ids?: string[];
  },
): Promise<TaskDto> {
  const caseRow = await getCase(tenantId, caseId);
  if (!caseRow) throw notFound();
  if (!(await getTaskModel(tenantId, input.task_model_id))) throw notFound();
  const status = resolveStatus(input.status, input.attributes);

  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<
      InstanceRow & { case_id: string; task_model_id: string }
    >(
      `INSERT INTO legal.tasks (tenant_id, case_id, task_model_id, status)
       VALUES ($1, $2, $3, $4)
       RETURNING id, case_id, task_model_id, status, encryption_status, encryption_version,
                 created_at, updated_at`,
      [tenantId, caseId, input.task_model_id, status],
    );
    const row = result.rows[0]!;
    if (input.assignee_user_ids?.length) {
      await setTaskAssignees(client, tenantId, row.id, input.assignee_user_ids);
    }
    const changedKeys = await upsertInstanceAttributes(
      client,
      tenantId,
      'task',
      row.id,
      'task_model',
      row.task_model_id,
      input.attributes,
    );
    const attributes = await loadInstanceAttributes(
      client,
      tenantId,
      'task',
      row.id,
      'task_model',
      row.task_model_id,
    );
    await publish(client, tenantId, 'task.created', 'task', row.id, {
      case_id: caseId,
      task_id: row.id,
      ...(changedKeys.length ? { changed_attribute_keys: changedKeys } : {}),
    });
    const assigneeMap = await loadTaskAssignees(client, tenantId, [row.id]);
    return {
      id: row.id,
      case_id: row.case_id,
      task_model_id: row.task_model_id,
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

export async function getTask(tenantId: string, id: string): Promise<TaskDto | null> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<
      InstanceRow & { case_id: string; task_model_id: string }
    >(
      `SELECT id, case_id, task_model_id, status, encryption_status, encryption_version,
              created_at, updated_at
       FROM legal.tasks WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    const row = result.rows[0];
    if (!row) return null;
    const attributes = await loadInstanceAttributes(
      client,
      tenantId,
      'task',
      row.id,
      'task_model',
      row.task_model_id,
    );
    const assigneeMap = await loadTaskAssignees(client, tenantId, [row.id]);
    return {
      id: row.id,
      case_id: row.case_id,
      task_model_id: row.task_model_id,
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

export async function updateTask(
  tenantId: string,
  id: string,
  input: {
    status?: string;
    attributes?: Record<string, unknown>;
    assignee_user_ids?: string[];
  },
): Promise<TaskDto> {
  const existing = await getTask(tenantId, id);
  if (!existing) throw notFound();

  const nextStatus =
    input.status !== undefined || input.attributes?.status !== undefined
      ? resolveStatus(input.status ?? existing.status, input.attributes)
      : undefined;

  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<
      InstanceRow & { case_id: string; task_model_id: string }
    >(
      `UPDATE legal.tasks
       SET status = COALESCE($3, status), updated_at = now()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, case_id, task_model_id, status, encryption_status, encryption_version,
                 created_at, updated_at`,
      [id, tenantId, nextStatus],
    );
    const row = result.rows[0]!;
    if (input.assignee_user_ids !== undefined) {
      await setTaskAssignees(client, tenantId, row.id, input.assignee_user_ids);
    }
    const changedKeys = await upsertInstanceAttributes(
      client,
      tenantId,
      'task',
      row.id,
      'task_model',
      row.task_model_id,
      input.attributes,
    );
    const attributes = await loadInstanceAttributes(
      client,
      tenantId,
      'task',
      row.id,
      'task_model',
      row.task_model_id,
    );
    await publish(client, tenantId, 'task.updated', 'task', row.id, {
      task_id: row.id,
      ...(changedKeys.length ? { changed_attribute_keys: changedKeys } : {}),
    });
    const assigneeMap = await loadTaskAssignees(client, tenantId, [row.id]);
    return {
      id: row.id,
      case_id: row.case_id,
      task_model_id: row.task_model_id,
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

export async function deleteTask(tenantId: string, id: string): Promise<void> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query(
      `DELETE FROM legal.tasks WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (!result.rowCount) throw notFound();
    await publish(client, tenantId, 'task.deleted', 'task', id, { task_id: id });
  });
}

// —— Instruments ——

export async function listInstruments(tenantId: string, taskId: string): Promise<InstrumentDto[]> {
  const task = await getTask(tenantId, taskId);
  if (!task) throw notFound();

  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<
      InstanceRow & { task_id: string; instrument_model_id: string }
    >(
      `SELECT id, task_id, instrument_model_id, status, encryption_status, encryption_version,
              created_at, updated_at
       FROM legal.instruments WHERE task_id = $1 AND tenant_id = $2 ORDER BY created_at`,
      [taskId, tenantId],
    );
    const items: InstrumentDto[] = [];
    for (const row of result.rows) {
      const attributes = await loadInstanceAttributes(
        client,
        tenantId,
        'instrument',
        row.id,
        'instrument_model',
        row.instrument_model_id,
      );
      items.push({
        id: row.id,
        task_id: row.task_id,
        instrument_model_id: row.instrument_model_id,
        status: row.status,
        encryption_status: row.encryption_status,
        encryption_version: row.encryption_version,
        attributes,
        created_at: toIso(row.created_at),
        updated_at: toIso(row.updated_at),
      });
    }
    return items;
  });
}

export async function createInstrument(
  tenantId: string,
  taskId: string,
  input: {
    instrument_model_id: string;
    status?: string;
    attributes?: Record<string, unknown>;
  },
): Promise<InstrumentDto> {
  const task = await getTask(tenantId, taskId);
  if (!task) throw notFound();

  const instrumentModel = await getInstrumentModel(tenantId, input.instrument_model_id);
  if (!instrumentModel) throw notFound();
  if (instrumentModel.task_model_id !== task.task_model_id) {
    throw badRequest('error.validation_failed');
  }

  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<
      InstanceRow & { task_id: string; instrument_model_id: string }
    >(
      `INSERT INTO legal.instruments (tenant_id, task_id, instrument_model_id, status)
       VALUES ($1, $2, $3, $4)
       RETURNING id, task_id, instrument_model_id, status, encryption_status, encryption_version,
                 created_at, updated_at`,
      [tenantId, taskId, input.instrument_model_id, input.status ?? 'open'],
    );
    const row = result.rows[0]!;
    const changedKeys = await upsertInstanceAttributes(
      client,
      tenantId,
      'instrument',
      row.id,
      'instrument_model',
      row.instrument_model_id,
      input.attributes,
    );
    const attributes = await loadInstanceAttributes(
      client,
      tenantId,
      'instrument',
      row.id,
      'instrument_model',
      row.instrument_model_id,
    );
    await publish(client, tenantId, 'instrument.created', 'instrument', row.id, {
      task_id: taskId,
      instrument_id: row.id,
      ...(changedKeys.length ? { changed_attribute_keys: changedKeys } : {}),
    });
    return {
      id: row.id,
      task_id: row.task_id,
      instrument_model_id: row.instrument_model_id,
      status: row.status,
      encryption_status: row.encryption_status,
      encryption_version: row.encryption_version,
      attributes,
      created_at: toIso(row.created_at),
      updated_at: toIso(row.updated_at),
    };
  });
}

export async function getInstrument(tenantId: string, id: string): Promise<InstrumentDto | null> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<
      InstanceRow & { task_id: string; instrument_model_id: string }
    >(
      `SELECT id, task_id, instrument_model_id, status, encryption_status, encryption_version,
              created_at, updated_at
       FROM legal.instruments WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    const row = result.rows[0];
    if (!row) return null;
    const attributes = await loadInstanceAttributes(
      client,
      tenantId,
      'instrument',
      row.id,
      'instrument_model',
      row.instrument_model_id,
    );
    return {
      id: row.id,
      task_id: row.task_id,
      instrument_model_id: row.instrument_model_id,
      status: row.status,
      encryption_status: row.encryption_status,
      encryption_version: row.encryption_version,
      attributes,
      created_at: toIso(row.created_at),
      updated_at: toIso(row.updated_at),
    };
  });
}

export async function updateInstrument(
  tenantId: string,
  id: string,
  input: { status?: string; attributes?: Record<string, unknown> },
): Promise<InstrumentDto> {
  const existing = await getInstrument(tenantId, id);
  if (!existing) throw notFound();

  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<
      InstanceRow & { task_id: string; instrument_model_id: string }
    >(
      `UPDATE legal.instruments
       SET status = COALESCE($3, status), updated_at = now()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, task_id, instrument_model_id, status, encryption_status, encryption_version,
                 created_at, updated_at`,
      [id, tenantId, input.status],
    );
    const row = result.rows[0]!;
    const changedKeys = await upsertInstanceAttributes(
      client,
      tenantId,
      'instrument',
      row.id,
      'instrument_model',
      row.instrument_model_id,
      input.attributes,
    );
    const attributes = await loadInstanceAttributes(
      client,
      tenantId,
      'instrument',
      row.id,
      'instrument_model',
      row.instrument_model_id,
    );
    await publish(client, tenantId, 'instrument.updated', 'instrument', row.id, {
      instrument_id: row.id,
      ...(changedKeys.length ? { changed_attribute_keys: changedKeys } : {}),
    });
    return {
      id: row.id,
      task_id: row.task_id,
      instrument_model_id: row.instrument_model_id,
      status: row.status,
      encryption_status: row.encryption_status,
      encryption_version: row.encryption_version,
      attributes,
      created_at: toIso(row.created_at),
      updated_at: toIso(row.updated_at),
    };
  });
}

export async function deleteInstrument(tenantId: string, id: string): Promise<void> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query(
      `DELETE FROM legal.instruments WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (!result.rowCount) throw notFound();
    await publish(client, tenantId, 'instrument.deleted', 'instrument', id, { instrument_id: id });
  });
}
