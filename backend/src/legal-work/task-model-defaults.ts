import type pg from 'pg';
import { createAttributeDefinition } from './attributes.js';
import { TASK_MODEL_PLATFORM_INSTANCE_DEFINITIONS } from './task-model-platform-attributes.js';

export {
  TASK_MODEL_PLATFORM_INSTANCE_ATTRIBUTE_KEYS,
  type TaskModelPlatformInstanceAttributeKey,
} from './task-model-platform-attributes.js';

/**
 * Ensures each task model has platform standard instance-scoped attribute definitions.
 */
export async function seedTaskModelStandardInstanceAttributes(
  client: pg.PoolClient,
  tenantId: string,
  taskModelId: string,
  createdBy: string | null,
): Promise<void> {
  for (const def of TASK_MODEL_PLATFORM_INSTANCE_DEFINITIONS) {
    const exists = await client.query(
      `SELECT 1 FROM meta.attribute_definitions
       WHERE tenant_id = $1 AND owner_type = 'task_model' AND owner_id = $2
         AND definition_scope = 'instance' AND key = $3`,
      [tenantId, taskModelId, def.key],
    );
    if (exists.rowCount) continue;

    await createAttributeDefinition(
      client,
      tenantId,
      'task_model',
      taskModelId,
      {
        key: def.key,
        definition_scope: 'instance',
        data_type: def.data_type,
        encryption_mode: def.encryption_mode,
        translations: def.translations,
        is_required: def.is_required,
        select_options: def.select_options,
        select_option_translations: def.select_option_translations,
        default_value: def.default_value,
      },
      createdBy,
      { allowPlatformKeys: true },
    );
  }
}
