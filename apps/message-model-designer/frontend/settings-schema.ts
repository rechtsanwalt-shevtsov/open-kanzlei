import manifest from '../manifest.json';
import type { AppSettingFieldSchema } from '@shell/lib/app-settings-schema.js';

export const MESSAGE_MODEL_DESIGNER_APP_KEY = manifest.app_key;

export type { AppSettingFieldSchema } from '@shell/lib/app-settings-schema.js';

export const MESSAGE_MODEL_DESIGNER_SETTINGS_SCHEMA = manifest.settings_schema as Record<
  string,
  AppSettingFieldSchema
>;
