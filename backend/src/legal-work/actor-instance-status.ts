import type pg from 'pg';
import { badRequest } from '../api/errors.js';
import type { AttributeDefinitionDto } from './attributes.js';
import { listAttributeDefinitions } from './attributes.js';
import { isActorInstanceStatusDefinition } from './actor-model-platform-attributes.js';
import { ACTOR_STATUS_SET, DEFAULT_ACTOR_STATUS } from './actor-status.js';

export async function getActorStatusDefinition(
  client: pg.PoolClient,
  tenantId: string,
  actorModelId: string,
): Promise<AttributeDefinitionDto | null> {
  const defs = await listAttributeDefinitions(
    client,
    tenantId,
    'actor_model',
    actorModelId,
    'instance',
  );
  return defs.find((def) => isActorInstanceStatusDefinition(def)) ?? null;
}

export async function resolveActorInstanceStatus(
  client: pg.PoolClient,
  tenantId: string,
  actorModelId: string,
  status: string | undefined,
  attributes?: Record<string, unknown>,
): Promise<string> {
  const statusDef = await getActorStatusDefinition(client, tenantId, actorModelId);
  if (!statusDef) {
    throw badRequest('error.validation_failed');
  }

  const fromAttrs = attributes?.status;
  let raw: string | undefined;
  if (typeof fromAttrs === 'string' && fromAttrs.trim()) {
    raw = fromAttrs.trim();
  } else if (typeof status === 'string' && status.trim()) {
    raw = status.trim();
  } else if (typeof statusDef.default_value === 'string' && statusDef.default_value.trim()) {
    raw = statusDef.default_value.trim();
  } else {
    raw = DEFAULT_ACTOR_STATUS;
  }

  if (!raw || !ACTOR_STATUS_SET.has(raw)) {
    throw badRequest('error.invalid_attribute_value');
  }
  return raw;
}
