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
import { assertCaseModelStatus, assertModelKey, toIso } from './validation.js';
import { allocateUniqueMessageModelKey, slugifyModelKey } from './model-key.js';
import { deleteAttributeDefinitionsForModel } from './entity-guards.js';
import { provisionAppAttributesOnModel } from '../platform/apps/app-attribute-provisioning.js';

export type { CreateAttributeDefinitionInput, UpdateAttributeDefinitionInput };

export type CreateMessageModelInput = {
  key?: string;
  name?: string;
  locale?: string;
  status?: string;
  translations?: Record<string, string>;
  description?: string;
  description_translations?: Record<string, string>;
};

export type UpdateMessageModelInput = {
  name?: string;
  locale?: string;
  status?: string;
  translations?: Record<string, string>;
  description?: string;
  description_translations?: Record<string, string>;
};

export interface MessageModelDto {
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

function mapMessageModel(row: ModelRow): MessageModelDto {
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

export function enrichMessageModel(model: MessageModelDto, locale: Locale): MessageModelDto {
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

function resolveCreateMessageModelFields(
  input: CreateMessageModelInput,
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

function resolveUpdateMessageModelTranslations(
  existing: MessageModelDto,
  input: UpdateMessageModelInput,
  defaultLocale: Locale,
): Record<string, string> | undefined {
  if (input.name !== undefined) {
    const name = assertNonEmptyName(input.name);
    const locale = resolveLocale(input.locale, defaultLocale);
    return { ...existing.translations, [locale]: name };
  }
  return input.translations;
}

async function publish(
  client: pg.PoolClient,
  tenantId: string,
  type: PublicEventType,
  aggregateType: string,
  aggregateId: string,
  data: Record<string, unknown>,
  actorId?: string,
): Promise<void> {
  await getEventService().publish(client, {
    tenantId,
    type,
    aggregateType,
    aggregateId,
    data,
    actorId,
  });
}

export async function listMessageModels(tenantId: string): Promise<MessageModelDto[]> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<ModelRow>(
      `SELECT id, key, status, translations, description, description_translations,
              created_at, updated_at
       FROM legal.message_models WHERE tenant_id = $1 ORDER BY key`,
      [tenantId],
    );
    return result.rows.map(mapMessageModel);
  });
}

export async function createMessageModel(
  tenantId: string,
  input: CreateMessageModelInput,
  options?: { defaultLocale?: Locale; actorId?: string },
): Promise<MessageModelDto> {
  const defaultLocale = options?.defaultLocale ?? 'de';
  const actorId = options?.actorId;
  const resolved = resolveCreateMessageModelFields(input, defaultLocale);

  return withTenantTransaction(tenantId, async (client) => {
    const key =
      resolved.key ??
      (await allocateUniqueMessageModelKey(
        client,
        tenantId,
        slugifyModelKey(resolved.generateKeyFromName!),
      ));

    try {
      const result = await client.query<ModelRow>(
        `INSERT INTO legal.message_models
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
      const model = mapMessageModel(result.rows[0]!);
      await provisionAppAttributesOnModel(
        client,
        tenantId,
        'message_model',
        model.id,
        actorId ?? null,
      );
      await publish(
        client,
        tenantId,
        'message_model.created',
        'message_model',
        model.id,
        { message_model_id: model.id },
        actorId,
      );
      return model;
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') throw conflict('error.key_conflict');
      throw err;
    }
  });
}

export async function getMessageModel(
  tenantId: string,
  id: string,
): Promise<MessageModelDto | null> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<ModelRow>(
      `SELECT id, key, status, translations, description, description_translations,
              created_at, updated_at
       FROM legal.message_models WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0] ? mapMessageModel(result.rows[0]) : null;
  });
}

export async function updateMessageModel(
  tenantId: string,
  id: string,
  input: UpdateMessageModelInput,
  options?: { defaultLocale?: Locale; actorId?: string },
): Promise<MessageModelDto> {
  const existing = await getMessageModel(tenantId, id);
  if (!existing) throw notFound();
  if (input.status !== undefined) assertCaseModelStatus(input.status);

  const translations = resolveUpdateMessageModelTranslations(
    existing,
    input,
    options?.defaultLocale ?? 'de',
  );
  const actorId = options?.actorId;
  const archiving = input.status === 'archived' && existing.status !== 'archived';
  const description = resolveDescriptionFromInput(input);

  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<ModelRow>(
      `UPDATE legal.message_models
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
    const model = mapMessageModel(result.rows[0]!);
    if (archiving) {
      await publish(
        client,
        tenantId,
        'message_model.archived',
        'message_model',
        model.id,
        { message_model_id: model.id },
        actorId,
      );
    } else {
      await publish(
        client,
        tenantId,
        'message_model.updated',
        'message_model',
        model.id,
        { message_model_id: model.id },
        actorId,
      );
    }
    return model;
  });
}

export async function deleteMessageModel(
  tenantId: string,
  id: string,
  actorId?: string,
): Promise<void> {
  return withTenantTransaction(tenantId, async (client) => {
    const inUse = await client.query(
      `SELECT 1 FROM legal.messages WHERE message_model_id = $1 AND tenant_id = $2 LIMIT 1`,
      [id, tenantId],
    );
    if (inUse.rowCount) throw conflict('error.model_in_use');

    await deleteAttributeDefinitionsForModel(client, tenantId, 'message_model', id);

    const result = await client.query(
      `DELETE FROM legal.message_models WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (!result.rowCount) throw notFound();
    await publish(
      client,
      tenantId,
      'message_model.deleted',
      'message_model',
      id,
      { message_model_id: id },
      actorId,
    );
  });
}

export async function listMessageModelAttributes(
  tenantId: string,
  messageModelId: string,
  definitionScope?: import('./validation.js').DefinitionScope,
): Promise<AttributeDefinitionDto[]> {
  if (!(await getMessageModel(tenantId, messageModelId))) throw notFound();
  return withTenantTransaction(tenantId, (client) =>
    listAttributeDefinitions(client, tenantId, 'message_model', messageModelId, definitionScope),
  );
}

export async function createMessageModelAttribute(
  tenantId: string,
  messageModelId: string,
  userId: string,
  input: CreateAttributeDefinitionInput,
  options?: { defaultLocale?: Locale },
): Promise<AttributeDefinitionDto> {
  if (!(await getMessageModel(tenantId, messageModelId))) throw notFound();
  return withTenantTransaction(tenantId, async (client) => {
    const def = await createAttributeDefinition(
      client,
      tenantId,
      'message_model',
      messageModelId,
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

export async function updateMessageModelAttributeDefinition(
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

export async function deleteMessageModelAttributeDefinition(
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
