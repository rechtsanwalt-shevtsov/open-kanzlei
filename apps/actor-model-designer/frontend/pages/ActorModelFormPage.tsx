import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, apiJsonHeaders } from '@shell/api/client.js';
import { useI18n } from '@shell/i18n/I18nContext.js';
import { useEffectiveSettings } from '../hooks/useEffectiveSettings.js';
import { ACTOR_MODEL_STATUSES, actorModelStatusLabel } from '../lib/actor-model-status.js';
import type { ActorModelStatus } from '../lib/actor-model-status.js';

export function ActorModelFormPage() {
  const navigate = useNavigate();
  const { locale, msg } = useI18n();
  const { settings } = useEffectiveSettings();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ActorModelStatus>('draft');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const defaultStatus = settings.defaultActorModelStatus;
    if (
      typeof defaultStatus === 'string' &&
      ACTOR_MODEL_STATUSES.includes(defaultStatus as ActorModelStatus)
    ) {
      setStatus(defaultStatus as ActorModelStatus);
    }
  }, [settings.defaultActorModelStatus]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(msg('amdModelNameRequired'));
      return;
    }

    setSubmitting(true);
    const res = await api.POST('/v1/actor-models', {
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

    navigate(`/apps/actor-model-designer/${res.data!.id}`);
  }

  return (
    <div className="admin-page">
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <Link to="/apps/actor-model-designer">{msg('amdAppTitle')}</Link>
        <span className="admin-breadcrumb-sep">›</span>
        <span aria-current="page">{msg('amdCreate')}</span>
      </nav>

      <h1>{msg('amdCreate')}</h1>

      <form onSubmit={handleSubmit} className="form admin-dialog-form">
        <label>
          {msg('amdModelName')}
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <label>
          {msg('amdColDescription')}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </label>

        <label>
          {msg('workColStatus')}
          <select value={status} onChange={(e) => setStatus(e.target.value as ActorModelStatus)}>
            {ACTOR_MODEL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {actorModelStatusLabel(s, msg)}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="admin-dialog-actions">
          <Link to="/apps/actor-model-designer">{msg('cancel')}</Link>
          <button type="submit" className="button-primary" disabled={submitting}>
            {submitting ? msg('loading') : msg('submitSave')}
          </button>
        </div>
      </form>
    </div>
  );
}
