import { useCallback, useEffect, useState } from 'react';
import { api, apiHeaders } from '../api/client.js';
import { useI18n } from '../i18n/I18nContext.js';
import { labelFromTranslations } from '../lib/model-label.js';
import type { ModelListItem } from '../types/models.js';

interface UseModelsListResult {
  items: ModelListItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useModelsList(): UseModelsListResult {
  const { locale, msg } = useI18n();
  const [items, setItems] = useState<ModelListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    const headers = apiHeaders(locale);
    const [caseRes, actorRes] = await Promise.all([
      api.GET('/v1/case-models', { headers }),
      api.GET('/v1/actor-models', { headers }),
    ]);

    if (caseRes.error || actorRes.error) {
      const err = (caseRes.error ?? actorRes.error) as { message?: string };
      setError(err?.message ?? msg('errorGeneric'));
      setLoading(false);
      return;
    }

    const caseItems: ModelListItem[] = (caseRes.data?.items ?? []).map((m) => ({
      id: m.id,
      kind: 'case_model' as const,
      key: m.key,
      label: labelFromTranslations(m.translations, m.key, locale),
      status: m.status,
    }));

    const actorItems: ModelListItem[] = (actorRes.data?.items ?? []).map((m) => ({
      id: m.id,
      kind: 'actor_model' as const,
      key: m.key,
      label: m.display_name ?? labelFromTranslations(m.translations, m.key, locale),
      status: m.status,
    }));

    setItems(
      [...caseItems, ...actorItems].sort((a, b) => a.label.localeCompare(b.label, locale)),
    );
    setLoading(false);
  }, [locale, msg]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, error, refresh };
}
