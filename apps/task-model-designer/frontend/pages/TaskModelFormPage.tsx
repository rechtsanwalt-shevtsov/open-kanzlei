import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, apiJsonHeaders } from '@shell/api/client.js';
import { useI18n } from '@shell/i18n/I18nContext.js';
import { useEffectiveSettings } from '../hooks/useEffectiveSettings.js';
import { TASK_MODEL_STATUSES, taskModelStatusLabel } from '../lib/task-model-status.js';
import type { TaskModelStatus } from '../lib/task-model-status.js';

export function TaskModelFormPage() {
  const navigate = useNavigate();
  const { locale, msg } = useI18n();
  const { settings } = useEffectiveSettings();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskModelStatus>('draft');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const defaultStatus = settings.defaultTaskModelStatus;
    if (
      typeof defaultStatus === 'string' &&
      TASK_MODEL_STATUSES.includes(defaultStatus as TaskModelStatus)
    ) {
      setStatus(defaultStatus as TaskModelStatus);
    }
  }, [settings.defaultTaskModelStatus]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(msg('tmdModelNameRequired'));
      return;
    }

    setSubmitting(true);
    const res = await api.POST('/v1/task-models', {
      headers: apiJsonHeaders(locale),
      body: {
        name: name.trim(),
        locale,
        status,
        description: description.trim(),
      },
    });
    setSubmitting(false);
    if (res.error) {
      const err = res.error as { message?: string };
      setError(err?.message ?? msg('errorGeneric'));
      return;
    }

    navigate(`/apps/task-model-designer/${res.data!.id}`);
  }

  return (
    <div className="admin-page">
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <Link to="/apps/task-model-designer">{msg('tmdAppTitle')}</Link>
        <span className="admin-breadcrumb-sep">›</span>
        <span aria-current="page">{msg('tmdCreate')}</span>
      </nav>

      <h1>{msg('tmdCreate')}</h1>

      <form onSubmit={handleSubmit} className="form admin-dialog-form">
        <label>
          {msg('tmdModelName')}
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <label>
          {msg('tmdColDescription')}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </label>

        <label>
          {msg('workColStatus')}
          <select value={status} onChange={(e) => setStatus(e.target.value as TaskModelStatus)}>
            {TASK_MODEL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {taskModelStatusLabel(s, msg)}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="admin-dialog-actions">
          <Link to="/apps/task-model-designer">{msg('cancel')}</Link>
          <button type="submit" className="button-primary" disabled={submitting}>
            {submitting ? msg('loading') : msg('submitSave')}
          </button>
        </div>
      </form>
    </div>
  );
}
