import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, apiJsonHeaders } from '@shell/api/client.js';
import { useI18n } from '@shell/i18n/I18nContext.js';
import { useEffectiveSettings } from '../hooks/useEffectiveSettings.js';
import { TASK_MODEL_STATUSES, messageModelStatusLabel } from '../lib/message-model-status.js';
import type { MessageModelStatus } from '../lib/message-model-status.js';

export function MessageModelFormPage() {
  const navigate = useNavigate();
  const { locale, msg } = useI18n();
  const { settings } = useEffectiveSettings();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<MessageModelStatus>('draft');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const defaultStatus = settings.defaultMessageModelStatus;
    if (
      typeof defaultStatus === 'string' &&
      TASK_MODEL_STATUSES.includes(defaultStatus as MessageModelStatus)
    ) {
      setStatus(defaultStatus as MessageModelStatus);
    }
  }, [settings.defaultMessageModelStatus]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(msg('mmdModelNameRequired'));
      return;
    }

    setSubmitting(true);
    const res = await api.POST('/v1/message-models', {
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

    navigate(`/apps/message-model-designer/${res.data!.id}`);
  }

  return (
    <div className="admin-page">
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <Link to="/apps/message-model-designer">{msg('mmdAppTitle')}</Link>
        <span className="admin-breadcrumb-sep">›</span>
        <span aria-current="page">{msg('mmdCreate')}</span>
      </nav>

      <h1>{msg('mmdCreate')}</h1>

      <form onSubmit={handleSubmit} className="form admin-dialog-form">
        <label>
          {msg('mmdModelName')}
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <label>
          {msg('mmdColDescription')}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </label>

        <label>
          {msg('workColStatus')}
          <select value={status} onChange={(e) => setStatus(e.target.value as MessageModelStatus)}>
            {TASK_MODEL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {messageModelStatusLabel(s, msg)}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="admin-dialog-actions">
          <Link to="/apps/message-model-designer">{msg('cancel')}</Link>
          <button type="submit" className="button-primary" disabled={submitting}>
            {submitting ? msg('loading') : msg('submitSave')}
          </button>
        </div>
      </form>
    </div>
  );
}
