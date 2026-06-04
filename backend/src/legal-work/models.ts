import type pg from 'pg';
import { badRequest, conflict, notFound } from '../api/errors.js';
import { displayNameFromTranslations } from '../foundation/i18n/display-name.js';
import type { Locale } from '../foundation/i18n/locale.js';
import { isSupportedLocale } from '../foundation/i18n/locale.js';
import { getEventService } from '../foundation/events/event-service.js';
import type { PublicEventType } from '../foundation/events/event-types.js';
import { withTenantTransaction } from '../foundation/database/tenant-context.js';
import {
  createAttributeDefinition,
  deleteAttributeDefinition as deleteAttrDef,
  listAttributeDefinitions,
  updateAttributeDefinition as updateAttrDef,
  type AttributeDefinitionDto,
  type CreateAttributeDefinitionInput,
  type UpdateAttributeDefinitionInput,
} from './attributes.js';

export type { CreateAttributeDefinitionInput, UpdateAttributeDefinitionInput };
import { assertCaseModelStatus, assertModelKey, toIso } from './validation.js';
import { allocateUniqueCaseModelKey, slugifyModelKey } from './model-key.js';

export type CreateCaseModelInput = {
  key?: string;
  name?: string;
  locale?: string;
  status?: string;
  translations?: Record<string, string>;
  description?: string;
  /** @deprecated Use description */
  description_translations?: Record<string, string>;
};

export type UpdateCaseModelInput = {
  name?: string;
  locale?: string;
  status?: string;
  translations?: Record<string, string>;
  description?: string;
  /** @deprecated Use description */
  description_translations?: Record<string, string>;
};

export interface CaseModelDto {
  id: string;
  key: string;
  status: string;
  translations: Record<string, string>;
  description: string;
  description_translations: Record<string, string>;
  display_name?: string;
  created_at: string;
  updated_at: string;
}

export interface TaskModelDto {
  id: string;
  key: string;
  status: string;
  translations: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface InstrumentModelDto {
  id: string;
  task_model_id: string;
  key: string;
  status: string;
  translations: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface CaseModelTaskLinkDto {
  task_model_id: string;
  sort_order: number | null;
}

type ModelRow = {
  id: string;
  key: string;
  status: string;
  translations: Record<string, string>;
  description: string;
  description_translations?: Record<string, string>;
  created_at: Date;
  updated_at: Date;
};

function mapCaseModel(row: ModelRow): CaseModelDto {
  return {
    id: row.id,
    key: row.key,
    status: row.status,
    translations: row.translations ?? {},
    description: row.description ?? '',
    description_translations: row.description_translations ?? {},
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

function resolveDescriptionFromInput(input: {
  description?: string;
  description_translations?: Record<string, string>;
}): string | undefined {
  if (input.description !== undefined) return input.description;
  if (input.description_translations) {
    return (
      input.description_translations.de?.trim() ||
      input.description_translations.en?.trim() ||
      ''
    );
  }
  return undefined;
}

export function enrichCaseModel(model: CaseModelDto, locale: Locale): CaseModelDto {
  return {
    ...model,
    display_name: displayNameFromTranslations(model.translations, model.key, locale),
  };
}

function resolveLocale(value: string | undefined, fallback: Locale): Locale {
  return value && isSupportedLocale(value) ? value : fallback;
}

function assertNonEmptyName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw badRequest('error.validation_failed');
  return trimmed;
}

function resolveCreateCaseModelFields(
  input: CreateCaseModelInput,
  defaultLocale: Locale,
): {
  key?: string;
  status: string;
  translations: Record<string, string>;
  description?: string;
  generateKeyFromName?: string;
} {
  const status = input.status ?? 'draft';
  assertCaseModelStatus(status);
  const description = resolveDescriptionFromInput(input);

  if (input.name !== undefined) {
    const name = assertNonEmptyName(input.name);
    const locale = resolveLocale(input.locale, defaultLocale);
    return {
      status,
      translations: { [locale]: name },
      description,
      generateKeyFromName: name,
    };
  }

  if (!input.key || !input.translations) {
    throw badRequest('error.validation_failed');
  }
  assertModelKey(input.key);
  return {
    key: input.key,
    status,
    translations: input.translations,
    description,
  };
}

function resolveUpdateCaseModelTranslations(
  existing: CaseModelDto,
  input: UpdateCaseModelInput,
  defaultLocale: Locale,
): Record<string, string> | undefined {
  if (input.name !== undefined) {
    const name = assertNonEmptyName(input.name);
    const locale = resolveLocale(input.locale, defaultLocale);
    return { ...existing.translations, [locale]: name };
  }
  return input.translations;
}

function mapTaskModel(row: ModelRow): TaskModelDto {
  return mapCaseModel(row);
}

function mapInstrumentModel(
  row: ModelRow & { task_model_id: string },
): InstrumentModelDto {
  return { ...mapCaseModel(row), task_model_id: row.task_model_id };
}

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

// —— Case models ——

export async function listCaseModels(tenantId: string): Promise<CaseModelDto[]> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<ModelRow>(
      `SELECT id, key, status, translations, description, description_translations,
              created_at, updated_at
       FROM legal.case_models WHERE tenant_id = $1 ORDER BY key`,
      [tenantId],
    );
    return result.rows.map(mapCaseModel);
  });
}

export async function createCaseModel(
  tenantId: string,
  input: CreateCaseModelInput,
  options?: { defaultLocale?: Locale; actorUserId?: string },
): Promise<CaseModelDto> {
  const defaultLocale = options?.defaultLocale ?? 'de';
  const actorUserId = options?.actorUserId;
  const resolved = resolveCreateCaseModelFields(input, defaultLocale);

  return withTenantTransaction(tenantId, async (client) => {
    const key =
      resolved.key ??
      (await allocateUniqueCaseModelKey(
        client,
        tenantId,
        slugifyModelKey(resolved.generateKeyFromName!),
      ));

    try {
      const result = await client.query<ModelRow>(
        `INSERT INTO legal.case_models
           (tenant_id, key, status, translations, description, description_translations)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, key, status, translations, description, description_translations,
                   created_at, updated_at`,
        [
          tenantId,
          key,
          resolved.status,
          JSON.stringify(resolved.translations),
          resolved.description ?? '',
          JSON.stringify({}),
        ],
      );
      const model = mapCaseModel(result.rows[0]!);
      await publish(
        client,
        tenantId,
        'case_model.created',
        'case_model',
        model.id,
        { case_model_id: model.id },
        actorUserId,
      );
      return model;
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') throw conflict('error.key_conflict');
      throw err;
    }
  });
}

export async function getCaseModel(
  tenantId: string,
  id: string,
): Promise<CaseModelDto | null> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<ModelRow>(
      `SELECT id, key, status, translations, description, description_translations,
              created_at, updated_at
       FROM legal.case_models WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0] ? mapCaseModel(result.rows[0]) : null;
  });
}

export async function updateCaseModel(
  tenantId: string,
  id: string,
  input: UpdateCaseModelInput,
  options?: { defaultLocale?: Locale; actorUserId?: string },
): Promise<CaseModelDto> {
  const existing = await getCaseModel(tenantId, id);
  if (!existing) throw notFound();
  if (input.status !== undefined) assertCaseModelStatus(input.status);

  const translations = resolveUpdateCaseModelTranslations(
    existing,
    input,
    options?.defaultLocale ?? 'de',
  );
  const actorUserId = options?.actorUserId;
  const archiving = input.status === 'archived' && existing.status !== 'archived';

  const description = resolveDescriptionFromInput(input);

  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<ModelRow>(
      `UPDATE legal.case_models
       SET status = COALESCE($3, status),
           translations = COALESCE($4, translations),
           description = COALESCE($5, description),
           updated_at = now()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, key, status, translations, description, description_translations,
                 created_at, updated_at`,
      [
        id,
        tenantId,
        input.status ?? null,
        translations ? JSON.stringify(translations) : null,
        description ?? null,
      ],
    );
    const model = mapCaseModel(result.rows[0]!);
    if (archiving) {
      await publish(
        client,
        tenantId,
        'case_model.archived',
        'case_model',
        model.id,
        { case_model_id: model.id },
        actorUserId,
      );
    } else {
      await publish(
        client,
        tenantId,
        'case_model.updated',
        'case_model',
        model.id,
        { case_model_id: model.id },
        actorUserId,
      );
    }
    return model;
  });
}

export async function deleteCaseModel(
  tenantId: string,
  id: string,
  actorUserId?: string,
): Promise<void> {
  return withTenantTransaction(tenantId, async (client) => {
    const inUse = await client.query(
      `SELECT 1 FROM legal.cases WHERE case_model_id = $1 AND tenant_id = $2 LIMIT 1`,
      [id, tenantId],
    );
    if (inUse.rowCount) throw conflict('error.model_in_use');

    const result = await client.query(
      `DELETE FROM legal.case_models WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (!result.rowCount) throw notFound();
    await publish(
      client,
      tenantId,
      'case_model.deleted',
      'case_model',
      id,
      { case_model_id: id },
      actorUserId,
    );
  });
}

export async function listCaseModelTaskLinks(
  tenantId: string,
  caseModelId: string,
): Promise<CaseModelTaskLinkDto[]> {
  const model = await getCaseModel(tenantId, caseModelId);
  if (!model) throw notFound();

  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<CaseModelTaskLinkDto>(
      `SELECT task_model_id, sort_order
       FROM legal.case_model_task_models
       WHERE case_model_id = $1
       ORDER BY sort_order NULLS LAST, task_model_id`,
      [caseModelId],
    );
    return result.rows;
  });
}

export async function setCaseModelTaskLinks(
  tenantId: string,
  caseModelId: string,
  links: CaseModelTaskLinkDto[],
): Promise<CaseModelTaskLinkDto[]> {
  const model = await getCaseModel(tenantId, caseModelId);
  if (!model) throw notFound();

  return withTenantTransaction(tenantId, async (client) => {
    for (const link of links) {
      const taskModel = await client.query(
        `SELECT 1 FROM legal.task_models WHERE id = $1 AND tenant_id = $2`,
        [link.task_model_id, tenantId],
      );
      if (!taskModel.rowCount) throw notFound();
    }

    await client.query(
      `DELETE FROM legal.case_model_task_models WHERE case_model_id = $1`,
      [caseModelId],
    );

    for (const link of links) {
      await client.query(
        `INSERT INTO legal.case_model_task_models (case_model_id, task_model_id, sort_order)
         VALUES ($1, $2, $3)`,
        [caseModelId, link.task_model_id, link.sort_order ?? null],
      );
    }

    return listCaseModelTaskLinks(tenantId, caseModelId);
  });
}

export async function listCaseModelAttributes(
  tenantId: string,
  caseModelId: string,
  definitionScope?: import('./validation.js').DefinitionScope,
): Promise<AttributeDefinitionDto[]> {
  if (!(await getCaseModel(tenantId, caseModelId))) throw notFound();
  return withTenantTransaction(tenantId, (client) =>
    listAttributeDefinitions(client, tenantId, 'case_model', caseModelId, definitionScope),
  );
}

export async function createCaseModelAttribute(
  tenantId: string,
  caseModelId: string,
  userId: string,
  input: CreateAttributeDefinitionInput,
  options?: { defaultLocale?: Locale },
): Promise<AttributeDefinitionDto> {
  if (!(await getCaseModel(tenantId, caseModelId))) throw notFound();
  return withTenantTransaction(tenantId, async (client) => {
    const def = await createAttributeDefinition(
      client,
      tenantId,
      'case_model',
      caseModelId,
      input,
      userId,
      options,
    );
    await publish(
      client,
      tenantId,
      'attribute_definition.created',
      'attribute_definition',
      def.id,
      {
        attribute_definition_id: def.id,
        definition_scope: def.definition_scope,
      },
      userId,
    );
    return def;
  });
}

// —— Task models ——

export async function listTaskModels(tenantId: string): Promise<TaskModelDto[]> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<ModelRow>(
      `SELECT id, key, status, translations, created_at, updated_at
       FROM legal.task_models WHERE tenant_id = $1 ORDER BY key`,
      [tenantId],
    );
    return result.rows.map(mapTaskModel);
  });
}

export async function createTaskModel(
  tenantId: string,
  input: { key: string; status?: string; translations: Record<string, string> },
): Promise<TaskModelDto> {
  assertModelKey(input.key);
  return withTenantTransaction(tenantId, async (client) => {
    try {
      const result = await client.query<ModelRow>(
        `INSERT INTO legal.task_models (tenant_id, key, status, translations)
         VALUES ($1, $2, $3, $4)
         RETURNING id, key, status, translations, created_at, updated_at`,
        [tenantId, input.key, input.status ?? 'active', JSON.stringify(input.translations)],
      );
      const model = mapTaskModel(result.rows[0]!);
      await publish(client, tenantId, 'task_model.created', 'task_model', model.id, {
        task_model_id: model.id,
      });
      return model;
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') throw conflict('error.key_conflict');
      throw err;
    }
  });
}

export async function getTaskModel(
  tenantId: string,
  id: string,
): Promise<TaskModelDto | null> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<ModelRow>(
      `SELECT id, key, status, translations, created_at, updated_at
       FROM legal.task_models WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0] ? mapTaskModel(result.rows[0]) : null;
  });
}

export async function updateTaskModel(
  tenantId: string,
  id: string,
  input: { status?: string; translations?: Record<string, string> },
): Promise<TaskModelDto> {
  if (!(await getTaskModel(tenantId, id))) throw notFound();
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<ModelRow>(
      `UPDATE legal.task_models
       SET status = COALESCE($3, status),
           translations = COALESCE($4, translations),
           updated_at = now()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, key, status, translations, created_at, updated_at`,
      [
        id,
        tenantId,
        input.status,
        input.translations ? JSON.stringify(input.translations) : null,
      ],
    );
    const model = mapTaskModel(result.rows[0]!);
    await publish(client, tenantId, 'task_model.updated', 'task_model', model.id, {
      task_model_id: model.id,
    });
    return model;
  });
}

export async function deleteTaskModel(tenantId: string, id: string): Promise<void> {
  return withTenantTransaction(tenantId, async (client) => {
    const inUse = await client.query(
      `SELECT 1 FROM legal.tasks WHERE task_model_id = $1 AND tenant_id = $2
       UNION ALL
       SELECT 1 FROM legal.instrument_models WHERE task_model_id = $1 AND tenant_id = $2
       LIMIT 1`,
      [id, tenantId],
    );
    if (inUse.rowCount) throw conflict('error.model_in_use');

    const result = await client.query(
      `DELETE FROM legal.task_models WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (!result.rowCount) throw notFound();
    await publish(client, tenantId, 'task_model.deleted', 'task_model', id, {
      task_model_id: id,
    });
  });
}

export async function listTaskModelAttributes(
  tenantId: string,
  taskModelId: string,
): Promise<AttributeDefinitionDto[]> {
  if (!(await getTaskModel(tenantId, taskModelId))) throw notFound();
  return withTenantTransaction(tenantId, (client) =>
    listAttributeDefinitions(client, tenantId, 'task_model', taskModelId),
  );
}

export async function createTaskModelAttribute(
  tenantId: string,
  taskModelId: string,
  userId: string,
  input: CreateAttributeDefinitionInput,
  options?: { defaultLocale?: Locale },
): Promise<AttributeDefinitionDto> {
  if (!(await getTaskModel(tenantId, taskModelId))) throw notFound();
  return withTenantTransaction(tenantId, (client) =>
    createAttributeDefinition(client, tenantId, 'task_model', taskModelId, input, userId, options),
  );
}

// —— Task models ——

export async function listInstrumentModels(
  tenantId: string,
  taskModelId: string,
): Promise<InstrumentModelDto[]> {
  if (!(await getTaskModel(tenantId, taskModelId))) throw notFound();
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<ModelRow & { task_model_id: string }>(
      `SELECT id, task_model_id, key, status, translations, created_at, updated_at
       FROM legal.instrument_models WHERE task_model_id = $1 AND tenant_id = $2 ORDER BY key`,
      [taskModelId, tenantId],
    );
    return result.rows.map(mapInstrumentModel);
  });
}

export async function createInstrumentModel(
  tenantId: string,
  taskModelId: string,
  input: { key: string; status?: string; translations: Record<string, string> },
): Promise<InstrumentModelDto> {
  assertModelKey(input.key);
  if (!(await getTaskModel(tenantId, taskModelId))) throw notFound();

  return withTenantTransaction(tenantId, async (client) => {
    try {
      const result = await client.query<ModelRow & { task_model_id: string }>(
        `INSERT INTO legal.instrument_models (tenant_id, task_model_id, key, status, translations)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, task_model_id, key, status, translations, created_at, updated_at`,
        [
          tenantId,
          taskModelId,
          input.key,
          input.status ?? 'active',
          JSON.stringify(input.translations),
        ],
      );
      const model = mapInstrumentModel(result.rows[0]!);
      await publish(client, tenantId, 'instrument_model.created', 'instrument_model', model.id, {
        instrument_model_id: model.id,
        task_model_id: taskModelId,
      });
      return model;
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') throw conflict('error.key_conflict');
      throw err;
    }
  });
}

export async function getInstrumentModel(
  tenantId: string,
  id: string,
): Promise<InstrumentModelDto | null> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<ModelRow & { task_model_id: string }>(
      `SELECT id, task_model_id, key, status, translations, created_at, updated_at
       FROM legal.instrument_models WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0] ? mapInstrumentModel(result.rows[0]) : null;
  });
}

export async function updateInstrumentModel(
  tenantId: string,
  id: string,
  input: { status?: string; translations?: Record<string, string> },
): Promise<InstrumentModelDto> {
  if (!(await getInstrumentModel(tenantId, id))) throw notFound();
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<ModelRow & { task_model_id: string }>(
      `UPDATE legal.instrument_models
       SET status = COALESCE($3, status),
           translations = COALESCE($4, translations),
           updated_at = now()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, task_model_id, key, status, translations, created_at, updated_at`,
      [
        id,
        tenantId,
        input.status,
        input.translations ? JSON.stringify(input.translations) : null,
      ],
    );
    const model = mapInstrumentModel(result.rows[0]!);
    await publish(client, tenantId, 'instrument_model.updated', 'instrument_model', model.id, {
      instrument_model_id: model.id,
    });
    return model;
  });
}

export async function deleteInstrumentModel(tenantId: string, id: string): Promise<void> {
  return withTenantTransaction(tenantId, async (client) => {
    const inUse = await client.query(
      `SELECT 1 FROM legal.instruments WHERE instrument_model_id = $1 AND tenant_id = $2 LIMIT 1`,
      [id, tenantId],
    );
    if (inUse.rowCount) throw conflict('error.model_in_use');

    const result = await client.query(
      `DELETE FROM legal.instrument_models WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (!result.rowCount) throw notFound();
    await publish(client, tenantId, 'instrument_model.deleted', 'instrument_model', id, {
      instrument_model_id: id,
    });
  });
}

export async function listInstrumentModelAttributes(
  tenantId: string,
  instrumentModelId: string,
): Promise<AttributeDefinitionDto[]> {
  if (!(await getInstrumentModel(tenantId, instrumentModelId))) throw notFound();
  return withTenantTransaction(tenantId, (client) =>
    listAttributeDefinitions(client, tenantId, 'instrument_model', instrumentModelId),
  );
}

export async function createInstrumentModelAttribute(
  tenantId: string,
  instrumentModelId: string,
  userId: string,
  input: CreateAttributeDefinitionInput,
  options?: { defaultLocale?: Locale },
): Promise<AttributeDefinitionDto> {
  if (!(await getInstrumentModel(tenantId, instrumentModelId))) throw notFound();
  return withTenantTransaction(tenantId, (client) =>
    createAttributeDefinition(
      client,
      tenantId,
      'instrument_model',
      instrumentModelId,
      input,
      userId,
      options,
    ),
  );
}

export async function updateAttributeDefinition(
  tenantId: string,
  id: string,
  input: UpdateAttributeDefinitionInput,
  options?: { defaultLocale?: Locale },
): Promise<AttributeDefinitionDto> {
  return withTenantTransaction(tenantId, async (client) => {
    const def = await updateAttrDef(client, tenantId, id, input, options);
    await publish(
      client,
      tenantId,
      'attribute_definition.updated',
      'attribute_definition',
      def.id,
      {
        attribute_definition_id: def.id,
        definition_scope: def.definition_scope,
      },
    );
    return def;
  });
}

export async function deleteAttributeDefinition(
  tenantId: string,
  id: string,
): Promise<void> {
  return withTenantTransaction(tenantId, async (client) => {
    const existing = await client.query<{ definition_scope: string }>(
      `SELECT definition_scope FROM meta.attribute_definitions WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
    );
    const scope = existing.rows[0]?.definition_scope ?? 'instance';
    await deleteAttrDef(client, tenantId, id);
    await publish(client, tenantId, 'attribute_definition.deleted', 'attribute_definition', id, {
      attribute_definition_id: id,
      definition_scope: scope,
    });
  });
}
