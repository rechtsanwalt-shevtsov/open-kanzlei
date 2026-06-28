import { useCallback, useEffect, useState } from 'react';
import { api, apiHeaders } from '../api/client.js';
import { useI18n } from '../i18n/I18nContext.js';
import { labelFromTranslations } from '../lib/model-label.js';
import type { ReferenceTargetType } from './useReferenceOptions.js';

export type ReferenceModelOption = {
  id: string;
  label: string;
};

export function useReferenceModelOptions(targetType: ReferenceTargetType | null | undefined) {
  const { locale } = useI18n();
  const [options, setOptions] = useState<ReferenceModelOption[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!targetType) {
      setOptions([]);
      return;
    }
    setLoading(true);
    const headers = apiHeaders(locale);
    if (targetType === 'actor') {
      const res = await api.GET('/v1/actor-models', { headers });
      setLoading(false);
      if (res.error) {
        setOptions([]);
        return;
      }
      const items = (res.data?.items ?? []).map((model) => ({
        id: model.id,
        label:
          model.display_name ??
          labelFromTranslations(model.translations, model.key, locale),
      }));
      setOptions(items.sort((a, b) => a.label.localeCompare(b.label)));
      return;
    }
    if (targetType === 'case') {
      const res = await api.GET('/v1/case-models', { headers });
      setLoading(false);
      if (res.error) {
        setOptions([]);
        return;
      }
      const items = (res.data?.items ?? []).map((model) => ({
        id: model.id,
        label:
          model.display_name ??
          labelFromTranslations(model.translations, model.key, locale),
      }));
      setOptions(items.sort((a, b) => a.label.localeCompare(b.label)));
      return;
    }
    const res = await api.GET('/v1/task-models', { headers });
    setLoading(false);
    if (res.error) {
      setOptions([]);
      return;
    }
    const items = (res.data?.items ?? []).map((model) => ({
      id: model.id,
      label:
        model.display_name ??
        labelFromTranslations(model.translations, model.key, locale),
    }));
    setOptions(items.sort((a, b) => a.label.localeCompare(b.label)));
  }, [locale, targetType]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { options, loading, refresh };
}
