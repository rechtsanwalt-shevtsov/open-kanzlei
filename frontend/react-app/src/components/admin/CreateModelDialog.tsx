import { FormEvent, useEffect, useState } from 'react';
import { api, apiHeaders } from '../../api/client.js';
import { useI18n } from '../../i18n/I18nContext.js';
import type { ModelKind, TaskModelOption } from '../../types/models.js';

interface CreateModelDialogProps {
  open: boolean;
  taskModels: TaskModelOption[];
  onClose: () => void;
  onCreated: () => void;
}

const KEY_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;

export function CreateModelDialog({
  open,
  taskModels,
  onClose,
  onCreated,
}: CreateModelDialogProps) {
  const { locale, msg } = useI18n();
  const [kind, setKind] = useState<ModelKind>('task_model');
  const [key, setKey] = useState('');
  const [labelDe, setLabelDe] = useState('');
  const [labelEn, setLabelEn] = useState('');
  const [taskModelId, setTaskModelId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKind('task_model');
    setKey('');
    setLabelDe('');
    setLabelEn('');
    setTaskModelId(taskModels[0]?.id ?? '');
    setError(null);
  }, [open, taskModels]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const normalizedKey = key.trim().toLowerCase();
    if (!KEY_PATTERN.test(normalizedKey)) {
      setError(msg('modelsKeyInvalid'));
      return;
    }
    if (!labelDe.trim()) {
      setError(msg('modelsLabelRequired'));
      return;
    }
    if (kind === 'instrument_model' && !taskModelId) {
      setError(msg('modelsTaskRequired'));
      return;
    }

    setSubmitting(true);
    const body = {
      key: normalizedKey,
      translations: {
        de: labelDe.trim(),
        en: labelEn.trim() || labelDe.trim(),
      },
    };
    const headers = apiHeaders(locale);

    let res;
    if (kind === 'case_model') {
      res = await api.POST('/v1/case-models', { headers, body });
    } else if (kind === 'task_model') {
      res = await api.POST('/v1/task-models', { headers, body });
    } else {
      res = await api.POST('/v1/task-models/{id}/instrument-models', {
        headers,
        params: { path: { id: taskModelId } },
        body,
      });
    }

    setSubmitting(false);

    if (res.error) {
      const err = res.error as { message?: string };
      setError(err?.message ?? msg('errorGeneric'));
      return;
    }

    onCreated();
    onClose();
  }

  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-model-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="create-model-title">{msg('modelsCreateTitle')}</h2>
        <form onSubmit={handleSubmit} className="form">
          <label>
            {msg('modelsType')}
            <select value={kind} onChange={(e) => setKind(e.target.value as ModelKind)}>
              <option value="task_model">{msg('modelsTypeTask')}</option>
              <option value="instrument_model">{msg('modelsTypeInstrument')}</option>
            </select>
          </label>

          {kind === 'instrument_model' && (
            <label>
              {msg('modelsParentTask')}
              <select
                value={taskModelId}
                onChange={(e) => setTaskModelId(e.target.value)}
                required
                disabled={taskModels.length === 0}
              >
                {taskModels.length === 0 ? (
                  <option value="">{msg('modelsNoTaskModels')}</option>
                ) : (
                  taskModels.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label} ({t.key})
                    </option>
                  ))
                )}
              </select>
            </label>
          )}

          <label>
            {msg('modelsKey')}
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="fallakte"
              pattern="[a-z][a-z0-9_]*"
              required
            />
            <span className="hint">{msg('modelsKeyHint')}</span>
          </label>

          <label>
            {msg('modelsLabelDe')}
            <input value={labelDe} onChange={(e) => setLabelDe(e.target.value)} required />
          </label>

          <label>
            {msg('modelsLabelEn')}
            <input value={labelEn} onChange={(e) => setLabelEn(e.target.value)} />
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="admin-dialog-actions">
            <button type="button" className="button-secondary" onClick={onClose}>
              {msg('cancel')}
            </button>
            <button
              type="submit"
              className="button-primary"
              disabled={submitting || (kind === 'instrument_model' && taskModels.length === 0)}
            >
              {submitting ? msg('loading') : msg('modelsCreate')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
