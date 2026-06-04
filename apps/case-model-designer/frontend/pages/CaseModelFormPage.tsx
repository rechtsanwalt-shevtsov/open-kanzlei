import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, apiJsonHeaders } from '@shell/api/client.js';
import { useI18n } from '@shell/i18n/I18nContext.js';
import { createModelAttribute } from '@shell/lib/attribute-api.js';
import {
  CaseFieldsEditor,
  caseFieldDraftsToCreateBodies,
  createEmptyCaseFieldDraft,
  validateCaseFieldDrafts,
  type CaseFieldDraft,
} from '../components/CaseFieldsEditor.js';
import { useEffectiveSettings } from '../hooks/useEffectiveSettings.js';
import { CASE_MODEL_STATUSES, caseModelStatusLabel } from '../lib/case-model-status.js';
import type { CaseModelStatus } from '../lib/case-model-status.js';

export function CaseModelFormPage() {
  const navigate = useNavigate();
  const { locale, msg } = useI18n();
  const { settings } = useEffectiveSettings();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<CaseModelStatus>('draft');
  const [caseFields, setCaseFields] = useState<CaseFieldDraft[]>(() => [
    createEmptyCaseFieldDraft(),
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const defaultStatus = settings.defaultCaseModelStatus;
    if (
      typeof defaultStatus === 'string' &&
      CASE_MODEL_STATUSES.includes(defaultStatus as CaseModelStatus)
    ) {
      setStatus(defaultStatus as CaseModelStatus);
    }
  }, [settings.defaultCaseModelStatus]);

  const defaultEncryption =
    settings.defaultAttributeEncryptionMode === 'zero_knowledge'
      ? 'zero_knowledge'
      : 'server_readable';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(msg('cmdModelNameRequired'));
      return;
    }

    const fieldError = validateCaseFieldDrafts(caseFields, msg);
    if (fieldError) {
      setError(fieldError);
      return;
    }

    setSubmitting(true);
    const res = await api.POST('/v1/case-models', {
      headers: apiJsonHeaders(locale),
      body: {
        name: name.trim(),
        locale,
        status,
        description: description.trim(),
      },
    });
    if (res.error) {
      setSubmitting(false);
      const err = res.error as { message?: string };
      setError(err?.message ?? msg('errorGeneric'));
      return;
    }

    const modelId = res.data!.id;
    const attributeBodies = caseFieldDraftsToCreateBodies(
      caseFields,
      locale,
      defaultEncryption,
    );

    for (const body of attributeBodies) {
      const attrRes = await createModelAttribute('case_model', modelId, locale, body);
      if (attrRes.error) {
        setSubmitting(false);
        const err = attrRes.error as { message?: string };
        setError(err?.message ?? msg('errorGeneric'));
        navigate(`/apps/case-model-designer/${modelId}`, { replace: true });
        return;
      }
    }

    setSubmitting(false);
    navigate(`/apps/case-model-designer/${modelId}`);
  }

  return (
    <div className="admin-page">
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <Link to="/apps/case-model-designer">{msg('cmdAppTitle')}</Link>
        <span className="admin-breadcrumb-sep">›</span>
        <span aria-current="page">{msg('cmdCreate')}</span>
      </nav>

      <h1>{msg('cmdCreate')}</h1>

      <form onSubmit={handleSubmit} className="form admin-dialog-form">
        <label>
          {msg('cmdModelName')}
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <label>
          {msg('cmdColDescription')}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </label>

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

        <CaseFieldsEditor fields={caseFields} onChange={setCaseFields} />

        {error && <p className="form-error">{error}</p>}

        <div className="admin-dialog-actions">
          <Link to="/apps/case-model-designer">{msg('cancel')}</Link>
          <button type="submit" className="button-primary" disabled={submitting}>
            {submitting ? msg('loading') : msg('submitSave')}
          </button>
        </div>
      </form>
    </div>
  );
}
