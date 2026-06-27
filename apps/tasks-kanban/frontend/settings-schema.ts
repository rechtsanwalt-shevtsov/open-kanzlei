import manifest from '../manifest.json';
import type { AppSettingFieldSchema } from '@shell/lib/app-settings-schema.js';

export const TASKS_KANBAN_APP_KEY = manifest.app_key;

export type { AppSettingFieldSchema } from '@shell/lib/app-settings-schema.js';

export const TASKS_KANBAN_SETTINGS_SCHEMA = manifest.settings_schema as Record<
  string,
  AppSettingFieldSchema
>;
