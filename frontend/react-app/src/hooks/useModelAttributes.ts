import { useCallback, useEffect, useState } from 'react';
import {
  listModelAttributes,
  type AttributeDefinition,
} from '../lib/attribute-api.js';
import { useI18n } from '../i18n/I18nContext.js';

export function useModelAttributes(modelId: string | undefined) {
  const { locale } = useI18n();
  const [items, setItems] = useState<AttributeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!modelId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await listModelAttributes(modelId, locale);
    setLoading(false);
    if (res.error) {
      const err = res.error as { message?: string };
      setError(err?.message ?? 'error');
      setItems([]);
      return;
    }
    setItems(res.data?.items ?? []);
  }, [modelId, locale]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, error, refresh };
}
