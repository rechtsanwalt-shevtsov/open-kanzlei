import { api, apiHeaders } from '../api/client.js';
import type { components } from '../api/schema.js';
import type { Locale } from '../i18n/locale.js';
import type { ModelKind } from '../types/models.js';

export type AttributeDefinition = components['schemas']['AttributeDefinition'];
export type DataType = components['schemas']['DataType'];
export type CreateAttributeBody = components['schemas']['CreateAttributeDefinitionRequest'];
export type UpdateAttributeBody = components['schemas']['UpdateAttributeDefinitionRequest'];

function headers(locale: Locale) {
  return apiHeaders(locale);
}

export async function listModelAttributes(
  kind: ModelKind,
  modelId: string,
  locale: Locale,
) {
  const h = headers(locale);
  switch (kind) {
    case 'case_model':
      return api.GET('/v1/case-models/{id}/attributes', {
        headers: h,
        params: { path: { id: modelId } },
      });
    case 'task_model':
      return api.GET('/v1/task-models/{id}/attributes', {
        headers: h,
        params: { path: { id: modelId } },
      });
    case 'instrument_model':
      return api.GET('/v1/instrument-models/{id}/attributes', {
        headers: h,
        params: { path: { id: modelId } },
      });
  }
}

export async function createModelAttribute(
  kind: ModelKind,
  modelId: string,
  locale: Locale,
  body: CreateAttributeBody,
) {
  const h = headers(locale);
  switch (kind) {
    case 'case_model':
      return api.POST('/v1/case-models/{id}/attributes', {
        headers: h,
        params: { path: { id: modelId } },
        body,
      });
    case 'task_model':
      return api.POST('/v1/task-models/{id}/attributes', {
        headers: h,
        params: { path: { id: modelId } },
        body,
      });
    case 'instrument_model':
      return api.POST('/v1/instrument-models/{id}/attributes', {
        headers: h,
        params: { path: { id: modelId } },
        body,
      });
  }
}

export async function updateAttributeDefinition(
  id: string,
  locale: Locale,
  body: UpdateAttributeBody,
) {
  return api.PATCH('/v1/attribute-definitions/{id}', {
    headers: headers(locale),
    params: { path: { id } },
    body,
  });
}

export async function deleteAttributeDefinition(id: string, locale: Locale) {
  return api.DELETE('/v1/attribute-definitions/{id}', {
    headers: headers(locale),
    params: { path: { id } },
  });
}
