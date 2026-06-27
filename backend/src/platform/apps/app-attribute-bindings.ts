import type pg from 'pg';
import { forbidden } from '../../api/errors.js';
import type { DefinitionScope, ModelOwnerType } from '../../legal-work/validation.js';

export type AppAttributeBindingRole = 'requires' | 'provides';

export async function isAppActiveForTenant(
  client: pg.PoolClient,
  tenantId: string,
  appKey: string,
): Promise<boolean> {
  const result = await client.query(
    `SELECT 1 FROM platform.app_team_activations
     WHERE tenant_id = $1 AND app_key = $2 AND status = 'active'
     LIMIT 1`,
    [tenantId, appKey],
  );
  return Boolean(result.rowCount);
}

export async function recordAppAttributeBinding(
  client: pg.PoolClient,
  tenantId: string,
  appKey: string,
  ownerType: ModelOwnerType,
  ownerId: string,
  definitionScope: DefinitionScope,
  attributeKey: string,
  bindingRole: AppAttributeBindingRole,
): Promise<void> {
  await client.query(
    `INSERT INTO platform.app_model_attribute_bindings
       (tenant_id, app_key, owner_type, owner_id, definition_scope, attribute_key, binding_role)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (tenant_id, app_key, owner_type, owner_id, definition_scope, attribute_key)
     DO UPDATE SET binding_role = EXCLUDED.binding_role`,
    [tenantId, appKey, ownerType, ownerId, definitionScope, attributeKey, bindingRole],
  );
}

export async function deleteAppAttributeBindings(
  client: pg.PoolClient,
  tenantId: string,
  ownerType: ModelOwnerType,
  ownerId: string,
  definitionScope: DefinitionScope,
  attributeKey: string,
): Promise<void> {
  await client.query(
    `DELETE FROM platform.app_model_attribute_bindings
     WHERE tenant_id = $1 AND owner_type = $2 AND owner_id = $3
       AND definition_scope = $4 AND attribute_key = $5`,
    [tenantId, ownerType, ownerId, definitionScope, attributeKey],
  );
}

export async function assertAppAttributeDefinitionDeletable(
  client: pg.PoolClient,
  tenantId: string,
  ownerType: ModelOwnerType,
  ownerId: string,
  definitionScope: DefinitionScope,
  attributeKey: string,
): Promise<void> {
  const bindings = await client.query<{ app_key: string }>(
    `SELECT app_key
     FROM platform.app_model_attribute_bindings
     WHERE tenant_id = $1 AND owner_type = $2 AND owner_id = $3
       AND definition_scope = $4 AND attribute_key = $5`,
    [tenantId, ownerType, ownerId, definitionScope, attributeKey],
  );

  for (const row of bindings.rows) {
    if (await isAppActiveForTenant(client, tenantId, row.app_key)) {
      throw forbidden('error.attribute_definition_reserved');
    }
  }
}

export async function listActiveAppKeysForTenant(
  client: pg.PoolClient,
  tenantId: string,
): Promise<string[]> {
  const result = await client.query<{ app_key: string }>(
    `SELECT DISTINCT app_key
     FROM platform.app_team_activations
     WHERE tenant_id = $1 AND status = 'active'
     ORDER BY app_key`,
    [tenantId],
  );
  return result.rows.map((row) => row.app_key);
}
