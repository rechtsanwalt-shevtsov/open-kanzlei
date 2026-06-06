import { useCallback, useEffect, useState } from 'react';
import { api, apiHeaders } from '../api/client.js';
import { labelFromTranslations } from '../lib/model-label.js';
import { useI18n } from '../i18n/I18nContext.js';

export interface ModelOption {
  id: string;
  key: string;
  label: string;
}

export function useModelOptions() {
  const { locale } = useI18n();
  const [options, setOptions] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const headers = apiHeaders(locale);
    const res = await api.GET('/v1/case-models', { headers });
    setLoading(false);
    if (res.error) {
      setOptions([]);
      return;
    }
    const items = res.data?.items ?? [];
    setOptions(
      items.map((m) => ({
        id: m.id,
        key: m.key,
        label: labelFromTranslations(m.translations, m.key, locale),
      })),
    );
  }, [locale]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { options, loading, refresh };
}
