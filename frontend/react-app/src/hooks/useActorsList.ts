import { useCallback, useEffect, useState } from 'react';
import { api, apiHeaders } from '../api/client.js';
import type { components } from '../api/schema.js';
import { useI18n } from '../i18n/I18nContext.js';

export type Actor = components['schemas']['Actor'];

export interface ActorOption {
  id: string;
  label: string;
}

function actorLabel(actor: Actor): string {
  const attrs = actor.attributes ?? {};
  const name = typeof attrs.name === 'string' ? attrs.name.trim() : '';
  if (name) return name;
  const first = typeof attrs.first_name === 'string' ? attrs.first_name.trim() : '';
  if (first) return first;
  return actor.id.slice(0, 8);
}

export function useActorsList() {
  const { locale, msg } = useI18n();
  const [items, setItems] = useState<ActorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.GET('/v1/actors', { headers: apiHeaders(locale) });
    setLoading(false);
    if (res.error) {
      const err = res.error as { message?: string };
      setError(err?.message ?? msg('errorGeneric'));
      setItems([]);
      return;
    }
    const actors = res.data?.items ?? [];
    setItems(
      actors
        .map((actor) => ({ id: actor.id, label: actorLabel(actor) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    );
  }, [locale, msg]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, error, refresh };
}
