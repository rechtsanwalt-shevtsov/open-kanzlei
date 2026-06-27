import { useEffect, useState } from 'react';
import { readApiError } from '@shell/api/client.js';
import { useI18n } from '@shell/i18n/I18nContext.js';
import { fetchEffectiveSettings } from '../api.js';

export function useEffectiveSettings() {
  const { locale, msg } = useI18n();
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: apiError, response } = await fetchEffectiveSettings(locale);
      if (cancelled) return;
      if (apiError || !response.ok) {
        setError(await readApiError(apiError, msg('errorGeneric')));
        setLoading(false);
        return;
      }
      setSettings((data?.settings as Record<string, unknown>) ?? {});
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  return { settings, loading, error };
}
