import { useCallback, useEffect, useState } from 'react';
import { api, apiHeaders } from '../api/client.js';
import type { components } from '../api/schema.js';
import { useI18n } from '../i18n/I18nContext.js';

export type Group = components['schemas']['Group'];

/** @deprecated Use Group */
export type Team = Group;

export function useGroups() {
  const { locale, msg } = useI18n();
  const [items, setItems] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.GET('/v1/groups', { headers: apiHeaders(locale) });
    setLoading(false);
    if (res.error) {
      const err = res.error as { message?: string };
      setError(err?.message ?? msg('errorGeneric'));
      setItems([]);
      return;
    }
    setItems(res.data?.items ?? []);
  }, [locale, msg]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, error, refresh };
}

/** @deprecated Use useGroups */
export const useTeams = useGroups;
