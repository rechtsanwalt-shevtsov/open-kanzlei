import { api, apiHeaders } from '../api/client.js';
import type { components } from '../api/schema.js';
import type { Locale } from '../i18n/locale.js';

export type AttributeDefinition = components['schemas']['AttributeDefinition'];
export type DataType = components['schemas']['DataType'];
export type DefinitionScope = components['schemas']['DefinitionScope'];
export type CreateAttributeBody = components['schemas']['CreateAttributeDefinitionRequest'];
export type UpdateAttributeBody = components['schemas']['UpdateAttributeDefinitionRequest'];

function headers(locale: Locale) {
  return apiHeaders(locale);
}

export async function listModelAttributes(
  modelId: string,
  locale: Locale,
  definitionScope?: DefinitionScope,
) {
  const h = headers(locale);
  const query = definitionScope ? { definition_scope: definitionScope } : undefined;
  return api.GET('/v1/case-models/{id}/attributes', {
    headers: h,
    params: { path: { id: modelId }, query },
  });
}

export async function createModelAttribute(
  modelId: string,
  locale: Locale,
  body: CreateAttributeBody,
) {
  return api.POST('/v1/case-models/{id}/attributes', {
    headers: headers(locale),
    params: { path: { id: modelId } },
    body,
  });
}

export async function listTaskModelAttributes(
  modelId: string,
  locale: Locale,
  definitionScope?: DefinitionScope,
) {
  const h = headers(locale);
  const query = definitionScope ? { definition_scope: definitionScope } : undefined;
  return api.GET('/v1/task-models/{id}/attributes', {
    headers: h,
    params: { path: { id: modelId }, query },
  });
}

export async function createTaskModelAttribute(
  modelId: string,
  locale: Locale,
  body: CreateAttributeBody,
) {
  return api.POST('/v1/task-models/{id}/attributes', {
    headers: headers(locale),
    params: { path: { id: modelId } },
    body,
  });
}

export async function listActorModelAttributes(
  modelId: string,
  locale: Locale,
  definitionScope?: DefinitionScope,
) {
  const h = headers(locale);
  const query = definitionScope ? { definition_scope: definitionScope } : undefined;
  return api.GET('/v1/actor-models/{id}/attributes', {
    headers: h,
    params: { path: { id: modelId }, query },
  });
}

export async function createActorModelAttribute(
  modelId: string,
  locale: Locale,
  body: CreateAttributeBody,
) {
  return api.POST('/v1/actor-models/{id}/attributes', {
    headers: headers(locale),
    params: { path: { id: modelId } },
    body,
  });
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
