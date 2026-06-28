import { useCallback, useEffect, useState } from 'react';
import { api, apiHeaders, readApiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { useI18n } from '../i18n/I18nContext.js';
import type { components } from '../api/schema.js';
import { userIsAdmin } from '../lib/is-admin.js';

export type TenantAppCatalogEntry = components['schemas']['TenantAppCatalogEntry'];

interface TenantAppsContextValue {
  catalog: TenantAppCatalogEntry[];
  loading: boolean;
  refreshCatalog: (opts?: { silent?: boolean }) => Promise<void>;
  setTeamAppStatus: (
    appKey: string,
    teamId: string,
    status: 'active' | 'inactive',
  ) => Promise<string | null>;
}

export function useTenantAppCatalog(): TenantAppsContextValue {
  const { locale, msg } = useI18n();
  const { user } = useAuth();
  const [catalog, setCatalog] = useState<TenantAppCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshCatalog = useCallback(async (opts?: { silent?: boolean }) => {
    if (!user || !userIsAdmin(user.groups)) {
      setCatalog([]);
      setLoading(false);
      return;
    }

    if (!opts?.silent) setLoading(true);
    const res = await api.GET('/v1/tenant/apps', { headers: apiHeaders(locale) });
    if (res.error || !res.response.ok) {
      setCatalog([]);
      setLoading(false);
      return;
    }

    setCatalog(res.data?.items ?? []);
    setLoading(false);
  }, [locale, user]);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  const setTeamAppStatus = useCallback(
    async (
      appKey: string,
      teamId: string,
      status: 'active' | 'inactive',
    ): Promise<string | null> => {
      const res = await api.PATCH('/v1/tenant/apps/{appKey}/groups/{groupId}', {
        headers: apiHeaders(locale),
        params: { path: { appKey, groupId: teamId } },
        body: { status },
      });
      if (res.error || !res.response.ok) {
        return readApiError(res.error, msg('errorGeneric'));
      }
      await refreshCatalog({ silent: true });
      return null;
    },
    [locale, msg, refreshCatalog],
  );

  return { catalog, loading, refreshCatalog, setTeamAppStatus };
}
