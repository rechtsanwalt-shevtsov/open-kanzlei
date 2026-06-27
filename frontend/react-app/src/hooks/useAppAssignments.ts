import { useCallback, useEffect, useState } from 'react';
import { api, apiHeaders, readApiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { useI18n } from '../i18n/I18nContext.js';
import type { components } from '../api/schema.js';
import { userIsAdmin } from '../lib/is-admin.js';
import type { SaveAssignmentsResult } from './useAutoSaveAssignmentRow.js';

export type TenantAppAssignments = components['schemas']['TenantAppAssignments'];
export type AppGroupAssignments = components['schemas']['AppGroupAssignments'];
export type AppCatalogItem = components['schemas']['AppCatalogItem'];
export type TeamAppAssignmentRow = components['schemas']['TeamAppAssignmentRow'];
export type ActorAppAssignmentRow = components['schemas']['ActorAppAssignmentRow'];
/** @deprecated Use ActorAppAssignmentRow */
export type UserAppAssignmentRow = ActorAppAssignmentRow;

const EMPTY_ASSIGNMENTS: AppGroupAssignments = {
  flight_level_0: null,
  flight_level_1: null,
  flight_level_2: null,
  flight_level_3: null,
  unassigned: [],
};

interface AppAssignmentsContextValue {
  data: TenantAppAssignments | null;
  loading: boolean;
  refresh: (opts?: { silent?: boolean }) => Promise<void>;
  saveTeamAssignments: (
    teamId: string,
    assignments: AppGroupAssignments,
  ) => Promise<SaveAssignmentsResult>;
  saveUserAssignments: (
    userId: string,
    assignments: AppGroupAssignments,
  ) => Promise<SaveAssignmentsResult>;
  clearUserAssignments: (userId: string) => Promise<string | null>;
}

export function useAppAssignments(): AppAssignmentsContextValue {
  const { locale, msg } = useI18n();
  const { user } = useAuth();
  const [data, setData] = useState<TenantAppAssignments | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!user || !userIsAdmin(user.teams)) {
      setData(null);
      setLoading(false);
      return;
    }

    if (!opts?.silent) setLoading(true);
    const res = await api.GET('/v1/tenant/app-assignments', { headers: apiHeaders(locale) });
    if (res.error || !res.response.ok) {
      setData(null);
      setLoading(false);
      return;
    }

    setData(res.data ?? null);
    setLoading(false);
  }, [locale, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveTeamAssignments = useCallback(
    async (teamId: string, assignments: AppGroupAssignments): Promise<SaveAssignmentsResult> => {
      const res = await api.PUT('/v1/tenant/teams/{teamId}/app-assignments', {
        headers: apiHeaders(locale),
        params: { path: { teamId } },
        body: assignments,
      });
      if (res.error || !res.response.ok) {
        return { ok: false, error: await readApiError(res.error, msg('errorGeneric')) };
      }
      const saved = res.data;
      if (saved) {
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            teams: prev.teams.map((team) =>
              team.team_id === teamId ? saved : team,
            ),
          };
        });
        return { ok: true, assignments: saved.assignments };
      }
      await refresh({ silent: true });
      return { ok: true, assignments };
    },
    [locale, msg, refresh],
  );

  const saveUserAssignments = useCallback(
    async (userId: string, assignments: AppGroupAssignments): Promise<SaveAssignmentsResult> => {
      const res = await api.PUT('/v1/tenant/actors/{actorId}/app-assignments', {
        headers: apiHeaders(locale),
        params: { path: { actorId: userId } },
        body: assignments,
      });
      if (res.error || !res.response.ok) {
        return { ok: false, error: await readApiError(res.error, msg('errorGeneric')) };
      }
      const saved = res.data;
      if (saved) {
        setData((prev) => {
          if (!prev) return prev;
          const overrides = prev.actor_overrides ?? prev.user_overrides ?? [];
          const existing = overrides.some((row) => row.actor_id === userId);
          return {
            ...prev,
            actor_overrides: existing
              ? overrides.map((row) => (row.actor_id === userId ? saved : row))
              : [...overrides, saved],
            user_overrides: existing
              ? overrides.map((row) => (row.actor_id === userId ? saved : row))
              : [...overrides, saved],
          };
        });
        return { ok: true, assignments: saved.assignments };
      }
      await refresh({ silent: true });
      return { ok: true, assignments };
    },
    [locale, msg, refresh],
  );

  const clearUserAssignments = useCallback(
    async (userId: string): Promise<string | null> => {
      const res = await api.DELETE('/v1/tenant/actors/{actorId}/app-assignments', {
        headers: apiHeaders(locale),
        params: { path: { actorId: userId } },
      });
      if (res.error || !res.response.ok) {
        return readApiError(res.error, msg('errorGeneric'));
      }
      await refresh({ silent: true });
      return null;
    },
    [locale, msg, refresh],
  );

  return { data, loading, refresh, saveTeamAssignments, saveUserAssignments, clearUserAssignments };
}

export { EMPTY_ASSIGNMENTS };
