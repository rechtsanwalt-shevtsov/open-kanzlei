import manifest from '../manifest.json';

export const TASK_MODEL_DESIGNER_APP_KEY = manifest.app_key;

export type AppSettingFieldSchema = {
  type: 'string' | 'boolean' | 'number';
  default: string | boolean | number;
  allowedValues?: Array<string | boolean | number>;
  tenantConfigurable: boolean;
  userOverridable: boolean;
};

export const TASK_MODEL_DESIGNER_SETTINGS_SCHEMA = manifest.settings_schema as Record<
  string,
  AppSettingFieldSchema
>;
