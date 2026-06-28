import { useCallback, useEffect, useState } from 'react';
import { api, apiHeaders } from '../api/client.js';
import { useI18n } from '../i18n/I18nContext.js';
import { instanceTitle } from '../lib/work-instance.js';
import type { components } from '../api/schema.js';

export type ReferenceTargetType = components['schemas']['ReferenceTargetType'];

export type ReferenceOption = {
  id: string;
  label: string;
};

type Actor = components['schemas']['Actor'];
type Case = components['schemas']['Case'];
type Task = components['schemas']['Task'];

function actorOptionLabel(actor: Actor): string {
  const attrs = actor.attributes ?? {};
  const name = typeof attrs.name === 'string' ? attrs.name.trim() : '';
  const first = typeof attrs.first_name === 'string' ? attrs.first_name.trim() : '';
  if (first && name) return `${first} ${name}`;
  if (name) return name;
  if (first) return first;
  return actor.id.slice(0, 8);
}

export function useReferenceOptions(
  targetType: ReferenceTargetType | null | undefined,
  modelId?: string | null,
) {
  const { locale } = useI18n();
  const [options, setOptions] = useState<ReferenceOption[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!targetType) {
      setOptions([]);
      return;
    }
    setLoading(true);
    const headers = apiHeaders(locale);
    if (targetType === 'actor') {
      const res = await api.GET('/v1/actors', {
        headers,
        params: {
          query: modelId ? { actor_model_id: modelId } : undefined,
        },
      });
      setLoading(false);
      if (res.error) {
        setOptions([]);
        return;
      }
      const items = (res.data?.items ?? []).map((actor) => ({
        id: actor.id,
        label: actorOptionLabel(actor),
      }));
      setOptions(items.sort((a, b) => a.label.localeCompare(b.label)));
      return;
    }
    if (targetType === 'case') {
      const res = await api.GET('/v1/cases', {
        headers,
        params: {
          query: modelId ? { case_model_id: modelId } : undefined,
        },
      });
      setLoading(false);
      if (res.error) {
        setOptions([]);
        return;
      }
      const items = (res.data?.items ?? []).map((item: Case) => ({
        id: item.id,
        label: instanceTitle(item.attributes as Record<string, unknown>, item.id.slice(0, 8)),
      }));
      setOptions(items.sort((a, b) => a.label.localeCompare(b.label)));
      return;
    }
    const res = await api.GET('/v1/tasks', {
      headers,
      params: {
        query: modelId ? { task_model_id: modelId } : undefined,
      },
    });
    setLoading(false);
    if (res.error) {
      setOptions([]);
      return;
    }
    const items = (res.data?.items ?? []).map((item: Task) => ({
      id: item.id,
      label: instanceTitle(item.attributes as Record<string, unknown>, item.id.slice(0, 8)),
    }));
    setOptions(items.sort((a, b) => a.label.localeCompare(b.label)));
  }, [locale, modelId, targetType]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { options, loading, refresh };
}
