import { api, apiHeaders } from '@shell/api/client.js';
import type { Locale } from '@shell/i18n/locale.js';
import type { components } from '@shell/api/schema.js';
import { TASKS_KANBAN_APP_KEY } from './settings-schema.js';

export type KanbanBoard = components['schemas']['KanbanBoard'];
export type KanbanMoveDirection = components['schemas']['KanbanMoveRequest']['direction'];

export async function fetchKanbanBoard(
  locale: Locale,
  assigneeUserId: string,
  search?: string,
) {
  return api.GET('/v1/apps/tasks-kanban/board', {
    headers: apiHeaders(locale),
    params: {
      query: {
        assignee_user_id: assigneeUserId,
        ...(search?.trim() ? { search: search.trim() } : {}),
      },
    },
  });
}

export async function postKanbanMove(
  locale: Locale,
  body: {
    assignee_user_id: string;
    task_id: string;
    direction: KanbanMoveDirection;
  },
) {
  return api.POST('/v1/apps/tasks-kanban/moves', {
    headers: apiHeaders(locale),
    body,
  });
}

export async function patchKanbanWipLimit(
  locale: Locale,
  body: {
    assignee_user_id: string;
    column_key: string;
    limit: number | null;
  },
) {
  return api.PATCH('/v1/apps/tasks-kanban/wip-limits', {
    headers: apiHeaders(locale),
    body,
  });
}

export async function fetchEffectiveSettings(locale: Locale) {
  return api.GET('/v1/apps/{appKey}/settings/effective', {
    headers: apiHeaders(locale),
    params: { path: { appKey: TASKS_KANBAN_APP_KEY } },
  });
}

export async function fetchTenantSettings(locale: Locale) {
  return api.GET('/v1/tenant/apps/{appKey}/settings', {
    headers: apiHeaders(locale),
    params: { path: { appKey: TASKS_KANBAN_APP_KEY } },
  });
}

export async function patchTenantSettings(locale: Locale, body: Record<string, unknown>) {
  return api.PATCH('/v1/tenant/apps/{appKey}/settings', {
    headers: apiHeaders(locale),
    params: { path: { appKey: TASKS_KANBAN_APP_KEY } },
    body,
  });
}
