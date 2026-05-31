import { useCallback, useEffect, useState } from 'react';
import { api, apiHeaders } from '../api/client.js';
import { useI18n } from '../i18n/I18nContext.js';
import { labelFromTranslations } from '../lib/model-label.js';
import type { ModelListItem, TaskModelOption } from '../types/models.js';

interface UseModelsListResult {
  items: ModelListItem[];
  taskModels: TaskModelOption[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useModelsList(): UseModelsListResult {
  const { locale, msg } = useI18n();
  const [items, setItems] = useState<ModelListItem[]>([]);
  const [taskModels, setTaskModels] = useState<TaskModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    const headers = apiHeaders(locale);

    const taskRes = await api.GET('/v1/task-models', { headers });

    if (taskRes.error) {
      const err = taskRes.error as { message?: string };
      setError(err?.message ?? msg('errorGeneric'));
      setLoading(false);
      return;
    }

    const taskItems: ModelListItem[] = (taskRes.data?.items ?? []).map((m) => ({
      id: m.id,
      kind: 'task_model' as const,
      key: m.key,
      label: labelFromTranslations(m.translations, m.key, locale),
      status: m.status,
    }));

    const taskOptions: TaskModelOption[] = (taskRes.data?.items ?? []).map((m) => ({
      id: m.id,
      key: m.key,
      label: labelFromTranslations(m.translations, m.key, locale),
    }));

    const instrumentResults = await Promise.all(
      taskOptions.map(async (task) => {
        const res = await api.GET('/v1/task-models/{id}/instrument-models', {
          headers,
          params: { path: { id: task.id } },
        });
        return { task, instruments: res.data?.items ?? [], error: res.error };
      }),
    );

    const instrumentItems: ModelListItem[] = [];
    for (const { task, instruments, error: instrumentErr } of instrumentResults) {
      if (instrumentErr) continue;
      for (const t of instruments) {
        instrumentItems.push({
          id: t.id,
          kind: 'instrument_model',
          key: t.key,
          label: labelFromTranslations(t.translations, t.key, locale),
          status: t.status,
          taskModelId: task.id,
          taskModelKey: task.key,
        });
      }
    }

    const combined = [...taskItems, ...instrumentItems].sort((a, b) =>
      a.label.localeCompare(b.label, locale),
    );

    setItems(combined);
    setTaskModels(taskOptions);
    setLoading(false);
  }, [locale, msg]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, taskModels, loading, error, refresh };
}
