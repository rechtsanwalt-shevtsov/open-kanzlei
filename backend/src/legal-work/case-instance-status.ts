import type pg from 'pg';
import { badRequest } from '../api/errors.js';
import type { AttributeDefinitionDto } from './attributes.js';
import { listAttributeDefinitions } from './attributes.js';
import { isCaseInstanceStatusDefinition } from './case-model-platform-attributes.js';

export async function getCaseStatusDefinition(
  client: pg.PoolClient,
  tenantId: string,
  caseModelId: string,
): Promise<AttributeDefinitionDto | null> {
  const defs = await listAttributeDefinitions(
    client,
    tenantId,
    'case_model',
    caseModelId,
    'instance',
  );
  return defs.find((def) => isCaseInstanceStatusDefinition(def)) ?? null;
}

export async function resolveCaseInstanceStatus(
  client: pg.PoolClient,
  tenantId: string,
  caseModelId: string,
  status: string | undefined,
  attributes?: Record<string, unknown>,
): Promise<string> {
  const statusDef = await getCaseStatusDefinition(client, tenantId, caseModelId);
  if (!statusDef) {
    throw badRequest('error.validation_failed');
  }

  const options = statusDef.select_options ?? [];
  if (options.length === 0) {
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
    raw = options[0];
  }

  if (!raw || !options.includes(raw)) {
    throw badRequest('error.invalid_attribute_value');
  }
  return raw;
}
