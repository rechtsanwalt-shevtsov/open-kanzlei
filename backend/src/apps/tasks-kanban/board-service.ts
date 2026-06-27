import type pg from 'pg';
import { badRequest, notFound } from '../../api/errors.js';
import { displayNameFromTranslations } from '../../foundation/i18n/display-name.js';
import type { Locale } from '../../foundation/i18n/locale.js';
import { withTenantTransaction } from '../../foundation/database/tenant-context.js';
import { listAttributeDefinitions, type AttributeDefinitionDto } from '../../legal-work/attributes.js';
import { updateTask } from '../../legal-work/tasks.js';
import { getAppManifest } from '../../platform/apps/registry.js';
import { getSharedRegistryEntry } from '../../platform/apps/shared-attribute-registry.js';
import { mergeEffectiveSettings } from '../../platform/apps/settings-schema.js';
import { activityColumnKeys, firstActivityKey, swimlaneOptionsKey } from './activity-helpers.js';
import {
  countWipAfterMove,
  countWipForTasks,
  isWipExceeded,
  placementForTask,
  sortKanbanTasks,
  sortCompletedKanbanTasks,
  taskMatchesSearch,
  type KanbanTaskRow,
} from './board-helpers.js';
import {
  ACTIVITY_KEY,
  ACTIVITY_STATUS_KEY,
  TASKS_KANBAN_APP_KEY,
  type KanbanMoveDirection,
  type WipLimitMode,
} from './constants.js';
import { applyKanbanMove, repairKanbanState, type TaskKanbanState } from './move-engine.js';
import {
  ensureWipLimitsForAllUsers,
  getEffectiveUserWipLimits,
  getWipLimitForColumn,
  loadTenantWipLimits,
  saveTenantWipLimits,
  setUserWipLimit,
} from './wip-limits.js';

export interface KanbanCardDto {
  id: string;
  title: string;
  case_id: string;
  case_title: string;
  weight: number | null;
  due_date: string | null;
  assignee_usernames: string[];
  open_dependent_tasks: Array<{ id: string; title: string }>;
}

export interface KanbanWipCellDto {
  count: number;
  limit: number | null;
  over: boolean;
}

export interface KanbanBoardResponse {
  assignee_actor_id: string;
  wip_limit_mode: WipLimitMode;
  layout: 'empty' | 'full';
  wip: {
    started: KanbanWipCellDto;
  };
  not_started: { cards: KanbanCardDto[] };
  completed: { cards: KanbanCardDto[] };
  swimlanes?: Array<{
    id: string;
    task_model_ids: string[];
    activities: Array<{
      key: string;
      label: string;
      labels: Record<string, string>;
      wip: KanbanWipCellDto;
      in_process: { cards: KanbanCardDto[] };
      done: { cards: KanbanCardDto[] };
    }>;
  }>;
}

type TaskRow = {
  id: string;
  case_id: string;
  task_model_id: string;
  status: string;
  dependent_task_ids: string[];
  created_at: Date;
  completed_at: Date | null;
};

async function loadAssigneeTasks(
  client: pg.PoolClient,
  tenantId: string,
  assigneeUserId: string,
): Promise<TaskRow[]> {
  const result = await client.query<TaskRow>(
    `SELECT DISTINCT t.id, t.case_id, t.task_model_id, t.status,
            t.dependent_task_ids, t.created_at, t.completed_at
     FROM legal.tasks t
     JOIN legal.task_assignees ta ON ta.task_id = t.id AND ta.tenant_id = t.tenant_id
     WHERE t.tenant_id = $1 AND ta.actor_id = $2`,
    [tenantId, assigneeUserId],
  );
  return result.rows;
}

async function loadAssigneeMap(
  client: pg.PoolClient,
  tenantId: string,
  taskIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (taskIds.length === 0) return map;
  const result = await client.query<{ task_id: string; username: string }>(
    `SELECT ta.task_id, c.username
     FROM legal.task_assignees ta
     JOIN platform.actor_credentials c ON c.actor_id = ta.actor_id
     WHERE ta.tenant_id = $1 AND ta.task_id = ANY($2::uuid[])
     ORDER BY c.username`,
    [tenantId, taskIds],
  );
  for (const row of result.rows) {
    const list = map.get(row.task_id) ?? [];
    list.push(row.username);
    map.set(row.task_id, list);
  }
  return map;
}

async function loadTaskAttributeMap(
  client: pg.PoolClient,
  tenantId: string,
  taskIds: string[],
  keys: string[],
): Promise<Map<string, Record<string, string>>> {
  const map = new Map<string, Record<string, string>>();
  if (taskIds.length === 0) return map;
  const result = await client.query<{
    owner_id: string;
    key: string;
    plaintext_value: string | null;
  }>(
    `SELECT v.owner_id, d.key, v.plaintext_value
     FROM meta.attribute_values v
     JOIN meta.attribute_definitions d ON d.id = v.attribute_definition_id
     WHERE v.tenant_id = $1 AND v.owner_type = 'task'
       AND v.owner_id = ANY($2::uuid[])
       AND d.key = ANY($3::text[])`,
    [tenantId, taskIds, keys],
  );
  for (const row of result.rows) {
    const attrs = map.get(row.owner_id) ?? {};
    if (row.plaintext_value !== null) {
      attrs[row.key] = row.plaintext_value;
    }
    map.set(row.owner_id, attrs);
  }
  return map;
}

async function loadCaseTitleMap(
  client: pg.PoolClient,
  tenantId: string,
  caseIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (caseIds.length === 0) return map;
  const result = await client.query<{ owner_id: string; plaintext_value: string | null }>(
    `SELECT v.owner_id, v.plaintext_value
     FROM meta.attribute_values v
     JOIN meta.attribute_definitions d ON d.id = v.attribute_definition_id
     WHERE v.tenant_id = $1 AND v.owner_type = 'case'
       AND v.owner_id = ANY($2::uuid[])
       AND d.key = 'title'`,
    [tenantId, caseIds],
  );
  for (const row of result.rows) {
    if (row.plaintext_value) map.set(row.owner_id, row.plaintext_value);
  }
  return map;
}

async function loadDependentTitles(
  client: pg.PoolClient,
  tenantId: string,
  dependentIds: string[],
): Promise<Map<string, { title: string; status: string }>> {
  const map = new Map<string, { title: string; status: string }>();
  if (dependentIds.length === 0) return map;
  const tasks = await client.query<{ id: string; status: string }>(
    `SELECT id, status FROM legal.tasks
     WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
    [tenantId, dependentIds],
  );
  const titles = await loadTaskAttributeMap(
    client,
    tenantId,
    dependentIds,
    ['title'],
  );
  for (const row of tasks.rows) {
    map.set(row.id, {
      status: row.status,
      title: titles.get(row.id)?.title ?? row.id,
    });
  }
  return map;
}

async function getActivityOptionsForModel(
  client: pg.PoolClient,
  tenantId: string,
  taskModelId: string,
): Promise<string[]> {
  const defs = await listAttributeDefinitions(
    client,
    tenantId,
    'task_model',
    taskModelId,
    'instance',
  );
  const activity = defs.find((d) => d.key === ACTIVITY_KEY);
  return activity?.select_options ?? [];
}

function parseWipLimitMode(settings: Record<string, unknown>): WipLimitMode {
  return settings.wipLimitMode === 'hard' ? 'hard' : 'soft';
}

function wipCell(count: number, limit: number | null): KanbanWipCellDto {
  return {
    count,
    limit,
    over: isWipExceeded(count, limit),
  };
}

function buildKanbanTaskRow(
  row: TaskRow,
  attrs: Record<string, string>,
  assignees: string[],
  activityDef: { select_option_labels?: Record<string, string> } | undefined,
): KanbanTaskRow {
  return {
    id: row.id,
    case_id: row.case_id,
    task_model_id: row.task_model_id,
    status: row.status,
    dependent_task_ids: row.dependent_task_ids ?? [],
    created_at: row.created_at,
    completed_at: row.completed_at,
    title: attrs.title ?? '',
    weight: attrs.weight ? Number(attrs.weight) : null,
    due_date: attrs.due_date ?? null,
    activity: attrs.activity ?? 'not_set',
    activity_status: attrs.activity_status ?? 'in_process',
    assignee_usernames: assignees,
  };
}

async function repairTasksIfNeeded(
  tenantId: string,
  tasks: KanbanTaskRow[],
  optionsByModel: Map<string, string[]>,
): Promise<void> {
  for (const task of tasks) {
    const options = optionsByModel.get(task.task_model_id) ?? [];
    const repaired = repairKanbanState(
      {
        status: task.status,
        activity: task.activity,
        activity_status: task.activity_status,
      },
      options,
    );
    if (!repaired) continue;
    await updateTask(tenantId, task.id, {
      status: repaired.status,
      attributes: {
        activity: repaired.activity,
        activity_status: repaired.activity_status,
      },
    });
    task.status = repaired.status;
    task.activity = repaired.activity;
    task.activity_status = repaired.activity_status;
  }
}

function activityOptionLabels(
  def: Pick<AttributeDefinitionDto, 'select_option_translations'> | undefined,
  activityKey: string,
): Record<string, string> {
  const fromDef = def?.select_option_translations?.[activityKey];
  if (fromDef) return { ...fromDef };
  const registry = getSharedRegistryEntry(ACTIVITY_KEY);
  const fromRegistry = registry?.select_option_translations?.[activityKey];
  if (fromRegistry) return { ...fromRegistry };
  return { de: activityKey, en: activityKey };
}

function resolveActivityLabel(
  def: Pick<AttributeDefinitionDto, 'select_option_translations'> | undefined,
  activityKey: string,
  locale: Locale,
): string {
  const labels = activityOptionLabels(def, activityKey);
  return displayNameFromTranslations(labels, activityKey, locale);
}

export async function getKanbanBoard(
  tenantId: string,
  viewerUserId: string,
  assigneeUserId: string,
  search?: string,
  locale: Locale = 'de',
): Promise<KanbanBoardResponse> {
  return withTenantTransaction(tenantId, async (client) => {
    const userCheck = await client.query(
      `SELECT 1 FROM legal.actors WHERE tenant_id = $1 AND id = $2`,
      [tenantId, assigneeUserId],
    );
    if (!userCheck.rowCount) throw notFound();

    await ensureWipLimitsForAllUsers(client, tenantId);
    const wipLimits = await loadTenantWipLimits(client, tenantId);
    const userWip = getEffectiveUserWipLimits(wipLimits, assigneeUserId);

    const manifest = getAppManifest(TASKS_KANBAN_APP_KEY);
    if (!manifest) throw notFound();

    const tenantRow = await client.query<{ settings: Record<string, unknown> }>(
      `SELECT settings FROM platform.app_tenant_settings
       WHERE tenant_id = $1 AND app_key = $2`,
      [tenantId, TASKS_KANBAN_APP_KEY],
    );
    const userRow = await client.query<{ settings: Record<string, unknown> }>(
      `SELECT settings FROM platform.app_user_settings
       WHERE tenant_id = $1 AND actor_id = $2 AND app_key = $3`,
      [tenantId, viewerUserId, TASKS_KANBAN_APP_KEY],
    );
    const effectiveSettings = mergeEffectiveSettings(
      manifest.settings_schema,
      tenantRow.rows[0]?.settings ?? {},
      userRow.rows[0]?.settings ?? {},
    );
    const wipLimitMode = parseWipLimitMode(effectiveSettings);

    const rows = await loadAssigneeTasks(client, tenantId, assigneeUserId);
    const taskIds = rows.map((r) => r.id);
    const assigneeMap = await loadAssigneeMap(client, tenantId, taskIds);
    const attrMap = await loadTaskAttributeMap(client, tenantId, taskIds, [
      'title',
      'weight',
      'due_date',
      ACTIVITY_KEY,
      ACTIVITY_STATUS_KEY,
    ]);

    const modelIds = [...new Set(rows.map((r) => r.task_model_id))];
    const optionsByModel = new Map<string, string[]>();
    const activityDefsByModel = new Map<string, Awaited<ReturnType<typeof listAttributeDefinitions>>[number]>();
    for (const modelId of modelIds) {
      const defs = await listAttributeDefinitions(
        client,
        tenantId,
        'task_model',
        modelId,
        'instance',
      );
      const activityDef = defs.find((d) => d.key === ACTIVITY_KEY);
      if (activityDef) {
        optionsByModel.set(modelId, activityDef.select_options);
        activityDefsByModel.set(modelId, activityDef);
      }
    }

    const kanbanTasks: KanbanTaskRow[] = rows.map((row) =>
      buildKanbanTaskRow(
        row,
        attrMap.get(row.id) ?? {},
        assigneeMap.get(row.id) ?? [],
        activityDefsByModel.get(row.task_model_id),
      ),
    );

    await repairTasksIfNeeded(tenantId, kanbanTasks, optionsByModel);

    const caseIds = [...new Set(kanbanTasks.map((t) => t.case_id))];
    const caseTitles = await loadCaseTitleMap(client, tenantId, caseIds);

    const allDependentIds = [
      ...new Set(kanbanTasks.flatMap((t) => t.dependent_task_ids)),
    ];
    const dependentInfo = await loadDependentTitles(client, tenantId, allDependentIds);

    const counts = countWipForTasks(kanbanTasks);
    const startedWip = wipCell(counts.started, getWipLimitForColumn(userWip, 'started'));

    const buildCard = (task: KanbanTaskRow): KanbanCardDto | null => {
      const activityDef = activityDefsByModel.get(task.task_model_id);
      const activityLabel = resolveActivityLabel(activityDef, task.activity, locale);
      if (search && !taskMatchesSearch(task, caseTitles.get(task.case_id) ?? '', activityLabel, search)) {
        return null;
      }
      const openDeps = task.dependent_task_ids
        .map((id) => {
          const info = dependentInfo.get(id);
          if (!info || info.status === 'completed') return null;
          return { id, title: info.title };
        })
        .filter((x): x is { id: string; title: string } => x !== null);

      return {
        id: task.id,
        title: task.title,
        case_id: task.case_id,
        case_title: caseTitles.get(task.case_id) ?? '',
        weight: task.weight,
        due_date: task.due_date,
        assignee_usernames: task.assignee_usernames,
        open_dependent_tasks: openDeps,
      };
    };

    if (kanbanTasks.length === 0) {
      return {
        assignee_actor_id: assigneeUserId,
        wip_limit_mode: wipLimitMode,
        layout: 'empty',
        wip: { started: startedWip },
        not_started: { cards: [] },
        completed: { cards: [] },
      };
    }

    const swimlaneGroups = new Map<
      string,
      { id: string; task_model_ids: string[]; select_options: string[] }
    >();
    for (const modelId of modelIds) {
      const options = optionsByModel.get(modelId) ?? [];
      const key = swimlaneOptionsKey(options);
      const existing = swimlaneGroups.get(key);
      if (existing) {
        existing.task_model_ids.push(modelId);
      } else {
        swimlaneGroups.set(key, {
          id: key,
          task_model_ids: [modelId],
          select_options: options,
        });
      }
    }

    const modelToSwimlane = new Map<string, string>();
    for (const group of swimlaneGroups.values()) {
      for (const modelId of group.task_model_ids) {
        modelToSwimlane.set(modelId, group.id);
      }
    }

    const notStartedCards: KanbanCardDto[] = [];
    const completedTasks: KanbanTaskRow[] = [];
    const swimlaneBuckets = new Map<
      string,
      {
        activities: Map<string, { in_process: KanbanCardDto[]; done: KanbanCardDto[] }>;
      }
    >();

    for (const group of swimlaneGroups.values()) {
      const activityMap = new Map<string, { in_process: KanbanCardDto[]; done: KanbanCardDto[] }>();
      for (const act of activityColumnKeys(group.select_options)) {
        activityMap.set(act, { in_process: [], done: [] });
      }
      swimlaneBuckets.set(group.id, { activities: activityMap });
    }

    for (const task of sortKanbanTasks(kanbanTasks)) {
      const swimlaneId = modelToSwimlane.get(task.task_model_id);
      if (!swimlaneId) continue;
      const card = buildCard(task);
      if (!card) continue;

      const state: TaskKanbanState = {
        status: task.status,
        activity: task.activity,
        activity_status: task.activity_status,
      };
      const placement = placementForTask(state, swimlaneId);

      if (placement.kind === 'not_started') {
        notStartedCards.push(card);
        continue;
      }
      if (placement.kind === 'completed') {
        completedTasks.push(task);
        continue;
      }
      const bucket = swimlaneBuckets.get(swimlaneId);
      if (!bucket) continue;
      const actBucket = bucket.activities.get(placement.activity);
      if (!actBucket) continue;
      actBucket[placement.sub].push(card);
    }

    const completedCards = sortCompletedKanbanTasks(completedTasks)
      .map((task) => buildCard(task))
      .filter((card): card is KanbanCardDto => card !== null);

    const swimlanes = [...swimlaneGroups.values()].map((group) => {
      const bucket = swimlaneBuckets.get(group.id)!;
      return {
        id: group.id,
        task_model_ids: group.task_model_ids,
        activities: activityColumnKeys(group.select_options).map((key) => {
          const primaryModelId = group.task_model_ids[0];
          const def = primaryModelId ? activityDefsByModel.get(primaryModelId) : undefined;
          const actCount = counts.activities[key] ?? 0;
          return {
            key,
            label: resolveActivityLabel(def, key, locale),
            labels: activityOptionLabels(def, key),
            wip: wipCell(actCount, getWipLimitForColumn(userWip, key)),
            in_process: { cards: bucket.activities.get(key)?.in_process ?? [] },
            done: { cards: bucket.activities.get(key)?.done ?? [] },
          };
        }),
      };
    });

    return {
      assignee_actor_id: assigneeUserId,
      wip_limit_mode: wipLimitMode,
      layout: 'full',
      wip: { started: startedWip },
      not_started: { cards: notStartedCards },
      completed: { cards: completedCards },
      swimlanes,
    };
  });
}

export async function executeKanbanMove(
  tenantId: string,
  assigneeUserId: string,
  taskId: string,
  direction: KanbanMoveDirection,
  locale: Locale = 'de',
): Promise<KanbanBoardResponse> {
  await withTenantTransaction(tenantId, async (client) => {
    const assigned = await client.query(
      `SELECT 1 FROM legal.task_assignees
       WHERE tenant_id = $1 AND task_id = $2 AND actor_id = $3`,
      [tenantId, taskId, assigneeUserId],
    );
    if (!assigned.rowCount) throw notFound();

    const taskRow = await client.query<TaskRow>(
      `SELECT id, case_id, task_model_id, status, dependent_task_ids, created_at
       FROM legal.tasks WHERE tenant_id = $1 AND id = $2`,
      [tenantId, taskId],
    );
    const row = taskRow.rows[0];
    if (!row) throw notFound();

    const options = await getActivityOptionsForModel(client, tenantId, row.task_model_id);
    const attrs = await loadTaskAttributeMap(client, tenantId, [taskId], [
      ACTIVITY_KEY,
      ACTIVITY_STATUS_KEY,
    ]);
    const taskAttrs = attrs.get(taskId) ?? {};

    const current: TaskKanbanState = {
      status: row.status,
      activity: taskAttrs.activity ?? 'not_set',
      activity_status: taskAttrs.activity_status ?? 'in_process',
    };

    const repaired = repairKanbanState(current, options);
    const baseState = repaired ?? current;
    const next = applyKanbanMove(baseState, direction, options);

    const allRows = await loadAssigneeTasks(client, tenantId, assigneeUserId);
    const attrMap = await loadTaskAttributeMap(
      client,
      tenantId,
      allRows.map((r) => r.id),
      [ACTIVITY_KEY],
    );
    await ensureWipLimitsForAllUsers(client, tenantId);
    const wipLimits = await loadTenantWipLimits(client, tenantId);
    const userWip = getEffectiveUserWipLimits(wipLimits, assigneeUserId);

    const manifest = getAppManifest(TASKS_KANBAN_APP_KEY)!;
    const tenantRow = await client.query<{ settings: Record<string, unknown> }>(
      `SELECT settings FROM platform.app_tenant_settings WHERE tenant_id = $1 AND app_key = $2`,
      [tenantId, TASKS_KANBAN_APP_KEY],
    );
    const effectiveSettings = mergeEffectiveSettings(
      manifest.settings_schema,
      tenantRow.rows[0]?.settings ?? {},
      {},
    );
    const wipLimitMode = parseWipLimitMode(effectiveSettings);

    if (wipLimitMode === 'hard') {
      const after = countWipAfterMove(
        allRows.map((r) => ({
          id: r.id,
          status: r.status,
          activity: attrMap.get(r.id)?.activity ?? 'not_set',
        })),
        taskId,
        next,
      );
      const startedLimit = getWipLimitForColumn(userWip, 'started');
      if (isWipExceeded(after.started, startedLimit)) {
        throw badRequest('error.kanban_wip_limit');
      }
      if (next.status === 'started' && next.activity) {
        const actLimit = getWipLimitForColumn(userWip, next.activity);
        const actCount = after.activities[next.activity] ?? 0;
        if (isWipExceeded(actCount, actLimit)) {
          throw badRequest('error.kanban_wip_limit');
        }
      }
    }

    await updateTask(tenantId, taskId, {
      status: next.status,
      attributes: {
        activity: next.activity,
        activity_status: next.activity_status,
      },
    });
  });

  return getKanbanBoard(tenantId, assigneeUserId, assigneeUserId, undefined, locale);
}

export async function patchUserWipLimit(
  tenantId: string,
  assigneeUserId: string,
  columnKey: string,
  value: number | null,
): Promise<Record<string, number>> {
  return withTenantTransaction(tenantId, async (client) => {
    let wipLimits = await ensureWipLimitsForAllUsers(client, tenantId);
    wipLimits = setUserWipLimit(wipLimits, assigneeUserId, columnKey, value);
    await saveTenantWipLimits(client, tenantId, wipLimits);
    return wipLimits.users[assigneeUserId] ?? {};
  });
}

export async function seedWipLimitsOnAppActivation(
  client: pg.PoolClient,
  tenantId: string,
): Promise<void> {
  await ensureWipLimitsForAllUsers(client, tenantId);
}
