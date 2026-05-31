import { useCallback, useEffect, useState } from 'react';
import { api, apiHeaders, readApiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { useI18n } from '../i18n/I18nContext.js';
import type { components } from '../api/schema.js';

export type TenantAppCatalogEntry = components['schemas']['TenantAppCatalogEntry'];

interface TenantAppsContextValue {
  catalog: TenantAppCatalogEntry[];
  loading: boolean;
  refreshCatalog: () => Promise<void>;
  setAppStatus: (appKey: string, status: 'active' | 'inactive') => Promise<string | null>;
}

// Lightweight hook for admin app catalog — no context provider required yet.
export function useTenantAppCatalog(): TenantAppsContextValue {
  const { locale, msg } = useI18n();
  const { user } = useAuth();
  const [catalog, setCatalog] = useState<TenantAppCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshCatalog = useCallback(async () => {
    if (!user?.roles.includes('admin')) {
      setCatalog([]);
      setLoading(false);
      return;
    }

    setLoading(true);
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

  const setAppStatus = useCallback(
    async (appKey: string, status: 'active' | 'inactive'): Promise<string | null> => {
      const res = await api.PATCH('/v1/tenant/apps/{appKey}', {
        headers: apiHeaders(locale),
        params: { path: { appKey } },
        body: { status },
      });
      if (res.error || !res.response.ok) {
        return readApiError(res.error, msg('errorGeneric'));
      }
      await refreshCatalog();
      return null;
    },
    [locale, msg, refreshCatalog],
  );

  return { catalog, loading, refreshCatalog, setAppStatus };
}
