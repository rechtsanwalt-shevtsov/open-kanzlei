import fs from 'node:fs';
import path from 'node:path';
import type { AppSettingsSchema } from './settings-schema.js';
import { assertAppSettingsSchema } from './settings-schema.js';
import {
  assertManifestAttributeContracts,
  type ManifestProvidesAttribute,
  type ManifestRequiresAttribute,
} from './app-attribute-contract.js';
import { isAppGroup, type AppGroup } from './app-groups.js';

export type { ManifestProvidesAttribute, ManifestRequiresAttribute };

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
  required_teams: string[];
  requires_attributes: ManifestRequiresAttribute[];
  provides_attributes: ManifestProvidesAttribute[];
  settings_schema: AppSettingsSchema;
  supported_locales: readonly string[];
  event_subscriptions: string[];
  app_group: AppGroup;
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
  required_teams?: string[];
  required_roles?: string[];
  settings_schema?: AppSettingsSchema;
  requires_attributes?: ManifestRequiresAttribute[];
  provides_attributes?: ManifestProvidesAttribute[];
  supported_locales?: string[];
  event_subscriptions?: string[];
  app_group?: string;
}

function normalizeManifest(raw: RawManifest, appDir: string): AppManifestDto {
  if (!raw.app_key || !raw.name || !raw.version) {
    throw new Error(`Invalid manifest in ${appDir}: app_key, name and version are required`);
  }
  if (!raw.settings_schema || typeof raw.settings_schema !== 'object') {
    throw new Error(`Invalid manifest in ${appDir}: settings_schema is required`);
  }
  const appGroup = raw.app_group ?? 'unassigned';
  if (!isAppGroup(appGroup)) {
    throw new Error(`Invalid manifest in ${appDir}: unknown app_group "${appGroup}"`);
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
    required_teams: raw.required_teams ?? raw.required_roles ?? [],
    requires_attributes: raw.requires_attributes ?? [],
    provides_attributes: raw.provides_attributes ?? [],
    settings_schema: raw.settings_schema,
    supported_locales: raw.supported_locales ?? ['de', 'en'],
    event_subscriptions: raw.event_subscriptions ?? [],
    app_group: appGroup,
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
    assertAppSettingsSchema(raw.settings_schema ?? {});
    const manifest = normalizeManifest(raw, appDir);
    assertManifestAttributeContracts(manifest);
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
