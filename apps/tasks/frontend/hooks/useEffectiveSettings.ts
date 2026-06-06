import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@shell/i18n/I18nContext.js';
import { fetchEffectiveSettings } from '../api.js';
import { TASKS_SETTINGS_SCHEMA } from '../settings-schema.js';

function defaultsFromSchema(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(TASKS_SETTINGS_SCHEMA)) {
    out[key] = field.default;
  }
  return out;
}

export function useEffectiveSettings() {
  const { locale, msg } = useI18n();
  const [settings, setSettings] = useState<Record<string, unknown>>(defaultsFromSchema);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchEffectiveSettings(locale);
    if (res.error) {
      const err = res.error as { message?: string };
      setError(err?.message ?? msg('errorGeneric'));
      setLoading(false);
      return;
    }
    setSettings(res.data?.settings ?? defaultsFromSchema());
    setLoading(false);
  }, [locale, msg]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { settings, loading, error, refresh };
}
