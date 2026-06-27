import type pg from 'pg';
import { MODEL_KEY_PATTERN } from './validation.js';

export function slugifyModelKey(name: string): string {
  let s = name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

  if (!s) return 'model';
  if (!/^[a-z]/.test(s)) s = `m_${s}`;
  s = s.slice(0, 63);
  if (!MODEL_KEY_PATTERN.test(s)) return 'model';
  return s;
}

export async function allocateUniqueCaseModelKey(
  client: pg.PoolClient,
  tenantId: string,
  baseKey: string,
): Promise<string> {
  let candidate = baseKey;
  let n = 2;
  while (true) {
    const exists = await client.query(
      `SELECT 1 FROM legal.case_models WHERE tenant_id = $1 AND key = $2 LIMIT 1`,
      [tenantId, candidate],
    );
    if (!exists.rowCount) return candidate;
    const suffix = `_${n}`;
    candidate = `${baseKey.slice(0, 63 - suffix.length)}${suffix}`;
    n++;
  }
}

export async function allocateUniqueTaskModelKey(
  client: pg.PoolClient,
  tenantId: string,
  baseKey: string,
): Promise<string> {
  let candidate = baseKey;
  let n = 2;
  while (true) {
    const exists = await client.query(
      `SELECT 1 FROM legal.task_models WHERE tenant_id = $1 AND key = $2 LIMIT 1`,
      [tenantId, candidate],
    );
    if (!exists.rowCount) return candidate;
    const suffix = `_${n}`;
    candidate = `${baseKey.slice(0, 63 - suffix.length)}${suffix}`;
    n++;
  }
}

export async function allocateUniqueActorModelKey(
  client: pg.PoolClient,
  tenantId: string,
  baseKey: string,
): Promise<string> {
  let candidate = baseKey;
  let n = 2;
  while (true) {
    const exists = await client.query(
      `SELECT 1 FROM legal.actor_models WHERE tenant_id = $1 AND key = $2 LIMIT 1`,
      [tenantId, candidate],
    );
    if (!exists.rowCount) return candidate;
    const suffix = `_${n}`;
    candidate = `${baseKey.slice(0, 63 - suffix.length)}${suffix}`;
    n++;
  }
}

export async function allocateUniqueAttributeKey(
  client: pg.PoolClient,
  tenantId: string,
  ownerType: string,
  ownerId: string,
  definitionScope: string,
  baseKey: string,
): Promise<string> {
  let candidate = baseKey;
  let n = 2;
  while (true) {
    const exists = await client.query(
      `SELECT 1 FROM meta.attribute_definitions
       WHERE tenant_id = $1 AND owner_type = $2 AND owner_id = $3
         AND definition_scope = $4 AND key = $5
       LIMIT 1`,
      [tenantId, ownerType, ownerId, definitionScope, candidate],
    );
    if (!exists.rowCount) return candidate;
    const suffix = `_${n}`;
    candidate = `${baseKey.slice(0, 63 - suffix.length)}${suffix}`;
    n++;
  }
}
