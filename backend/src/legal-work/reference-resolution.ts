import type pg from 'pg';
import { badRequest, notFound } from '../api/errors.js';
import { instanceTitleFromAttributes } from './instance-title.js';
import { isReferenceTargetType, isReferenceUuid, type ReferenceTargetType } from './reference-target.js';

async function loadTitleAttribute(
  client: pg.PoolClient,
  tenantId: string,
  ownerType: 'actor' | 'case' | 'task',
  ownerId: string,
  preferredKeys: string[],
): Promise<string | null> {
  const result = await client.query<{ key: string; plaintext_value: string | null }>(
    `SELECT d.key, v.plaintext_value
     FROM meta.attribute_values v
     JOIN meta.attribute_definitions d ON d.id = v.attribute_definition_id
     WHERE v.tenant_id = $1 AND v.owner_type = $2 AND v.owner_id = $3
       AND d.key = ANY($4::text[])`,
    [tenantId, ownerType, ownerId, preferredKeys],
  );
  const byKey = new Map(result.rows.map((row) => [row.key, row.plaintext_value]));
  for (const key of preferredKeys) {
    const value = byKey.get(key);
    if (value?.trim()) return value.trim();
  }
  return null;
}

export async function assertReferencedEntityExists(
  client: pg.PoolClient,
  tenantId: string,
  targetType: ReferenceTargetType,
  entityId: string,
  targetModelId?: string | null,
  options?: { asInvalidValue?: boolean },
): Promise<void> {
  if (!isReferenceUuid(entityId)) {
    throw badRequest(
      options?.asInvalidValue ? 'error.invalid_attribute_value' : 'error.validation_failed',
    );
  }

  let query = '';
  const params: unknown[] = [tenantId, entityId];

  switch (targetType) {
    case 'actor':
      query = `SELECT 1 FROM legal.actors
               WHERE tenant_id = $1 AND id = $2
                 AND ($3::uuid IS NULL OR actor_model_id = $3)`;
      params.push(targetModelId ?? null);
      break;
    case 'case':
      query = `SELECT 1 FROM legal.cases
               WHERE tenant_id = $1 AND id = $2
                 AND ($3::uuid IS NULL OR case_model_id = $3)`;
      params.push(targetModelId ?? null);
      break;
    case 'task':
      query = `SELECT 1 FROM legal.tasks
               WHERE tenant_id = $1 AND id = $2
                 AND ($3::uuid IS NULL OR task_model_id = $3)`;
      params.push(targetModelId ?? null);
      break;
    default:
      throw badRequest('error.validation_failed');
  }

  const result = await client.query(query, params);
  if (!result.rowCount) {
    throw options?.asInvalidValue ? badRequest('error.invalid_attribute_value') : notFound();
  }
}

export async function loadReferenceEntityTitle(
  client: pg.PoolClient,
  tenantId: string,
  targetType: ReferenceTargetType,
  entityId: string,
): Promise<string> {
  const fallback = entityId.slice(0, 8);
  switch (targetType) {
    case 'actor': {
      const exists = await client.query(
        `SELECT 1 FROM legal.actors WHERE tenant_id = $1 AND id = $2`,
        [tenantId, entityId],
      );
      if (!exists.rowCount) return fallback;
      const title = await loadTitleAttribute(client, tenantId, 'actor', entityId, [
        'name',
        'first_name',
        'title',
      ]);
      if (title) return title;
      const first = await loadTitleAttribute(client, tenantId, 'actor', entityId, ['first_name']);
      const name = await loadTitleAttribute(client, tenantId, 'actor', entityId, ['name']);
      if (first && name) return `${first} ${name}`;
      return title ?? fallback;
    }
    case 'case': {
      const exists = await client.query(
        `SELECT 1 FROM legal.cases WHERE tenant_id = $1 AND id = $2`,
        [tenantId, entityId],
      );
      if (!exists.rowCount) return fallback;
      const title = await loadTitleAttribute(client, tenantId, 'case', entityId, [
        'title',
        'name',
        'subject',
        'label',
      ]);
      return title ?? fallback;
    }
    case 'task': {
      const exists = await client.query(
        `SELECT 1 FROM legal.tasks WHERE tenant_id = $1 AND id = $2`,
        [tenantId, entityId],
      );
      if (!exists.rowCount) return fallback;
      const title = await loadTitleAttribute(client, tenantId, 'task', entityId, [
        'title',
        'name',
        'subject',
        'label',
      ]);
      return title ?? fallback;
    }
    default:
      return fallback;
  }
}

export function assertReferenceTargetTypeConfigured(
  dataType: string,
  definitionScope: string,
  referenceTargetType: string | null | undefined,
): asserts referenceTargetType is ReferenceTargetType {
  if (dataType !== 'reference') return;
  if (definitionScope !== 'instance') {
    throw badRequest('error.validation_failed');
  }
  if (!referenceTargetType || !isReferenceTargetType(referenceTargetType)) {
    throw badRequest('error.validation_failed');
  }
}

export function titleFromAttributeMap(
  attributes: Record<string, string | number | boolean | string[] | null>,
  fallback: string,
): string {
  return instanceTitleFromAttributes(attributes, fallback);
}
