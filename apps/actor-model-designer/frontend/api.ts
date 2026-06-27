import { api, apiHeaders } from '@shell/api/client.js';
import type { Locale } from '@shell/i18n/locale.js';
import { ACTOR_MODEL_DESIGNER_APP_KEY } from './settings-schema.js';

export async function fetchEffectiveSettings(locale: Locale) {
  return api.GET('/v1/apps/{appKey}/settings/effective', {
    headers: apiHeaders(locale),
    params: { path: { appKey: ACTOR_MODEL_DESIGNER_APP_KEY } },
  });
}

export async function fetchTenantSettings(locale: Locale) {
  return api.GET('/v1/tenant/apps/{appKey}/settings', {
    headers: apiHeaders(locale),
    params: { path: { appKey: ACTOR_MODEL_DESIGNER_APP_KEY } },
  });
}

export async function patchTenantSettings(locale: Locale, body: Record<string, unknown>) {
  return api.PATCH('/v1/tenant/apps/{appKey}/settings', {
    headers: apiHeaders(locale),
    params: { path: { appKey: ACTOR_MODEL_DESIGNER_APP_KEY } },
    body,
  });
}

export async function fetchUserSettings(locale: Locale) {
  return api.GET('/v1/me/apps/{appKey}/settings', {
    headers: apiHeaders(locale),
    params: { path: { appKey: ACTOR_MODEL_DESIGNER_APP_KEY } },
  });
}

export async function patchUserSettings(locale: Locale, body: Record<string, unknown>) {
  return api.PATCH('/v1/me/apps/{appKey}/settings', {
    headers: apiHeaders(locale),
    params: { path: { appKey: ACTOR_MODEL_DESIGNER_APP_KEY } },
    body,
  });
}
