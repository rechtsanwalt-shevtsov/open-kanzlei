import {
  loadAppManifestsFromDirectory,
  resolveAppsDirectory,
  type AppManifestDto,
  type AppMenuCategory,
} from './registry-loader.js';
import { env } from '../../config/env.js';

export type { AppManifestDto, AppMenuCategory };

let registry: Record<string, AppManifestDto> = {};

export function initializeAppRegistry(appsDir?: string): void {
  const dir = resolveAppsDirectory(appsDir ?? env.appsPath);
  registry = loadAppManifestsFromDirectory(dir);
}

export function getAppRegistry(): Record<string, AppManifestDto> {
  return registry;
}

export function getAppManifest(appKey: string): AppManifestDto | null {
  return registry[appKey] ?? null;
}

export function listKnownAppKeys(): string[] {
  return Object.keys(registry);
}

export function userCanAccessApp(manifest: AppManifestDto, roles: string[]): boolean {
  if (manifest.required_roles.length === 0) return true;
  return manifest.required_roles.some((role) => roles.includes(role));
}
