import fs from 'node:fs';
import path from 'node:path';
import type { AppSettingsSchema } from './settings-schema.js';

export type AppMenuCategory = 'administration' | 'work';

export interface AppManifestDto {
  app_key: string;
  name: string;
  version: string;
  description: string;
  has_react_ui: boolean;
  menu_category: AppMenuCategory;
  nav_path: string;
  nav_icon: string;
  routes: Array<{ path: string; label: string }>;
  required_roles: string[];
  settings_schema: AppSettingsSchema;
  supported_locales: readonly string[];
  event_subscriptions: string[];
}

interface RawManifest {
  app_key: string;
  name: string;
  version: string;
  description?: string;
  has_react_ui?: boolean;
  menu_category?: AppMenuCategory;
  nav_path?: string;
  nav_icon?: string;
  routes?: Array<{ path: string; label: string }>;
  required_roles?: string[];
  settings_schema?: AppSettingsSchema;
  supported_locales?: string[];
  event_subscriptions?: string[];
}

function normalizeManifest(raw: RawManifest, appDir: string): AppManifestDto {
  if (!raw.app_key || !raw.name || !raw.version) {
    throw new Error(`Invalid manifest in ${appDir}: app_key, name and version are required`);
  }
  if (!raw.settings_schema || typeof raw.settings_schema !== 'object') {
    throw new Error(`Invalid manifest in ${appDir}: settings_schema is required`);
  }

  return {
    app_key: raw.app_key,
    name: raw.name,
    version: raw.version,
    description: raw.description ?? '',
    has_react_ui: raw.has_react_ui ?? false,
    menu_category: raw.menu_category ?? 'administration',
    nav_path: raw.nav_path ?? `/apps/${raw.app_key}`,
    nav_icon: raw.nav_icon ?? 'LuPuzzle',
    routes: raw.routes ?? [],
    required_roles: raw.required_roles ?? [],
    settings_schema: raw.settings_schema,
    supported_locales: raw.supported_locales ?? ['de', 'en'],
    event_subscriptions: raw.event_subscriptions ?? [],
  };
}

export function loadAppManifestsFromDirectory(appsDir: string): Record<string, AppManifestDto> {
  const registry: Record<string, AppManifestDto> = {};

  if (!fs.existsSync(appsDir)) {
    return registry;
  }

  const entries = fs.readdirSync(appsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const appDir = path.join(appsDir, entry.name);
    const manifestPath = path.join(appDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;

    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as RawManifest;
    const manifest = normalizeManifest(raw, appDir);
    registry[manifest.app_key] = manifest;
  }

  return registry;
}

export function resolveAppsDirectory(customPath?: string): string {
  if (customPath) return path.resolve(customPath);
  return path.resolve(process.cwd(), '../apps');
}

export function getAppFrontendDistPath(appsDir: string, appKey: string): string | null {
  const entries = fs.readdirSync(appsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(appsDir, entry.name, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as RawManifest;
    if (raw.app_key !== appKey) continue;
    return path.join(appsDir, entry.name, 'frontend', 'dist');
  }
  return null;
}
