import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, apiHeaders } from '@shell/api/client.js';
import { useI18n } from '@shell/i18n/I18nContext.js';
import { useEffectiveSettings } from '../hooks/useEffectiveSettings.js';
import { CASE_MODEL_STATUSES, caseModelStatusLabel } from '../lib/case-model-status.js';
import type { CaseModelStatus } from '../lib/case-model-status.js';

export function CaseModelFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { locale, msg } = useI18n();
  const { settings } = useEffectiveSettings();
  const advanced = settings.editorLayout === 'advanced';

  const [name, setName] = useState('');
  const [descDe, setDescDe] = useState('');
  const [descEn, setDescEn] = useState('');
  const [status, setStatus] = useState<CaseModelStatus>('draft');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isEdit || !id) return;
    void (async () => {
      setLoading(true);
      const res = await api.GET('/v1/case-models/{id}', {
        headers: apiHeaders(locale),
        params: { path: { id } },
      });
      setLoading(false);
      if (res.error || !res.data) {
        setError(msg('errorGeneric'));
        return;
      }
      const m = res.data;
      setName(m.translations?.[locale] ?? m.display_name ?? '');
      setDescDe(m.description_translations?.de ?? '');
      setDescEn(m.description_translations?.en ?? '');
      setStatus((m.status as CaseModelStatus) || 'draft');
    })();
  }, [id, isEdit, locale, msg]);

  useEffect(() => {
    if (!isEdit) {
      const defaultStatus = settings.defaultCaseModelStatus;
      if (typeof defaultStatus === 'string' && CASE_MODEL_STATUSES.includes(defaultStatus as CaseModelStatus)) {
        setStatus(defaultStatus as CaseModelStatus);
      }
    }
  }, [isEdit, settings.defaultCaseModelStatus]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(msg('cmdModelNameRequired'));
      return;
    }

    setSubmitting(true);
    const headers = apiHeaders(locale);
    const description_translations = advanced
      ? { de: descDe.trim(), en: descEn.trim() || descDe.trim() }
      : undefined;
    const body = {
      name: name.trim(),
      locale,
      status,
      description_translations,
    };

    if (isEdit && id) {
      const res = await api.PATCH('/v1/case-models/{id}', {
        headers,
        params: { path: { id } },
        body,
      });
      setSubmitting(false);
      if (res.error) {
        const err = res.error as { message?: string };
        setError(err?.message ?? msg('errorGeneric'));
        return;
      }
      navigate(`/apps/case-model-designer/${id}`);
      return;
    }

    const res = await api.POST('/v1/case-models', {
      headers,
      body,
    });
    setSubmitting(false);
    if (res.error) {
      const err = res.error as { message?: string };
      setError(err?.message ?? msg('errorGeneric'));
      return;
    }
    navigate(`/apps/case-model-designer/${res.data!.id}`);
  }

  if (loading) return <p>{msg('loading')}</p>;

  return (
    <div className="admin-page">
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <Link to="/apps/case-model-designer">{msg('cmdAppTitle')}</Link>
        {isEdit && id ? (
          <>
            <span className="admin-breadcrumb-sep">›</span>
            <Link to={`/apps/case-model-designer/${id}`}>{name}</Link>
            <span className="admin-breadcrumb-sep">›</span>
            <span aria-current="page">{msg('cmdEdit')}</span>
          </>
        ) : (
          <>
            <span className="admin-breadcrumb-sep">›</span>
            <span aria-current="page">{msg('cmdCreate')}</span>
          </>
        )}
      </nav>

      <h1>{isEdit ? msg('cmdEdit') : msg('cmdCreate')}</h1>

      <form onSubmit={handleSubmit} className="form admin-dialog-form">
        <label>
          {msg('cmdModelName')}
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        {advanced && (
          <>
            <label>
              {msg('cmdDescDe')}
              <textarea value={descDe} onChange={(e) => setDescDe(e.target.value)} rows={3} />
            </label>
            <label>
              {msg('cmdDescEn')}
              <textarea value={descEn} onChange={(e) => setDescEn(e.target.value)} rows={3} />
            </label>
          </>
        )}

        <label>
          {msg('workColStatus')}
          <select value={status} onChange={(e) => setStatus(e.target.value as CaseModelStatus)}>
            {CASE_MODEL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {caseModelStatusLabel(s, msg)}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="admin-dialog-actions">
          <Link to={isEdit && id ? `/apps/case-model-designer/${id}` : '/apps/case-model-designer'}>
            {msg('cancel')}
          </Link>
          <button type="submit" className="button-primary" disabled={submitting}>
            {submitting ? msg('loading') : msg('submitSave')}
          </button>
        </div>
      </form>
    </div>
  );
}
