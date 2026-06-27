import { badRequest } from '../../api/errors.js';
import type { AppManifestDto } from './registry-loader.js';
import {
  getSharedRegistryEntry,
  isKnownRequiredAttributeKey,
  isSharedRegistryKey,
} from './shared-attribute-registry.js';
import type { DataType, DefinitionScope } from '../../legal-work/validation.js';
import { assertDataType, assertDefinitionScope } from '../../legal-work/validation.js';

export type AppAttributeTarget = 'case_model' | 'task_model';

export interface ManifestRequiresAttribute {
  key: string;
  target: AppAttributeTarget;
  definition_scope?: DefinitionScope;
}

export interface ManifestProvidesAttribute {
  key: string;
  target: AppAttributeTarget;
  definition_scope?: DefinitionScope;
  data_type: DataType;
  translations: Record<string, string>;
  encryption_mode?: 'server_readable' | 'zero_knowledge';
  is_required?: boolean;
  select_options?: string[];
  select_option_translations?: Record<string, Record<string, string>>;
  default_value?: unknown;
}

const ATTRIBUTE_KEY_PART = /^[a-z][a-z0-9_]{0,62}$/;
const APP_ATTRIBUTE_KEY = /^[a-z][a-z0-9-]{0,62}\.[a-z][a-z0-9_]{0,62}$/;

export function buildAppProvidedAttributeKey(appKey: string, localKey: string): string {
  if (!ATTRIBUTE_KEY_PART.test(localKey)) {
    throw badRequest('error.validation_failed');
  }
  return `${appKey}.${localKey}`;
}

export function parseAppProvidedAttributeKey(
  fullKey: string,
): { appKey: string; localKey: string } | null {
  if (!APP_ATTRIBUTE_KEY.test(fullKey)) return null;
  const dot = fullKey.indexOf('.');
  return {
    appKey: fullKey.slice(0, dot),
    localKey: fullKey.slice(dot + 1),
  };
}

export function assertManifestAttributeContracts(manifest: AppManifestDto): void {
  for (const ref of manifest.requires_attributes) {
    const scope = ref.definition_scope ?? 'instance';
    assertDefinitionScope(scope);
    if (!ATTRIBUTE_KEY_PART.test(ref.key)) {
      throw new Error(`Invalid manifest for ${manifest.app_key}: requires_attributes key "${ref.key}"`);
    }
    if (!isKnownRequiredAttributeKey(ref.key, ref.target)) {
      throw new Error(
        `Invalid manifest for ${manifest.app_key}: unknown requires_attributes key "${ref.key}" for ${ref.target}`,
      );
    }
    const shared = getSharedRegistryEntry(ref.key);
    if (shared && (shared.target !== ref.target || shared.definition_scope !== scope)) {
      throw new Error(
        `Invalid manifest for ${manifest.app_key}: requires_attributes key "${ref.key}" target/scope mismatch`,
      );
    }
  }

  for (const provided of manifest.provides_attributes) {
    const scope = provided.definition_scope ?? 'instance';
    assertDefinitionScope(scope);
    if (!ATTRIBUTE_KEY_PART.test(provided.key)) {
      throw new Error(
        `Invalid manifest for ${manifest.app_key}: provides_attributes key "${provided.key}" must be a local key without namespace`,
      );
    }
    assertDataType(provided.data_type);
    if (!provided.translations || typeof provided.translations !== 'object') {
      throw new Error(
        `Invalid manifest for ${manifest.app_key}: provides_attributes "${provided.key}" needs translations`,
      );
    }
    if (
      isSharedRegistryKey(provided.key) ||
      isKnownRequiredAttributeKey(provided.key, provided.target)
    ) {
      throw new Error(
        `Invalid manifest for ${manifest.app_key}: provides_attributes key "${provided.key}" conflicts with shared or platform vocabulary`,
      );
    }
  }
}

export function assertAttributeKeyFormat(key: string): void {
  if (ATTRIBUTE_KEY_PART.test(key) || APP_ATTRIBUTE_KEY.test(key)) return;
  throw badRequest('error.validation_failed');
}
