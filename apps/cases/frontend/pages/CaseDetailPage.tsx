import { useCallback, useEffect, useMemo, useState } from 'react';
import { LuSettings, LuTrash2 } from 'react-icons/lu';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, apiHeaders, apiJsonHeaders } from '@shell/api/client.js';
import { useI18n } from '@shell/i18n/I18nContext.js';
import { listModelAttributes, type AttributeDefinition } from '@shell/lib/attribute-api.js';
import { dataTypeMessageKey } from '@shell/lib/data-type-label.js';
import { labelFromTranslations } from '@shell/lib/model-label.js';
import { WORK_STATUSES, workStatusLabel } from '@shell/lib/work-status.js';
import type { components } from '@shell/api/schema.js';
import { CaseFieldValueCell } from '../components/CaseFieldValueCell.js';
import { caseTitle } from '../lib/case-display.js';

type CaseItem = components['schemas']['Case'];

export function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { locale, msg } = useI18n();
  const [caseItem, setCaseItem] = useState<CaseItem | null>(null);
  const [modelLabel, setModelLabel] = useState('');
  const [fields, setFields] = useState<AttributeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldSaving, setFieldSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const headers = apiHeaders(locale);
    const caseRes = await api.GET('/v1/cases/{id}', { headers, params: { path: { id } } });
    if (caseRes.error || !caseRes.data) {
      setError(msg('errorGeneric'));
      setLoading(false);
      return;
    }
    const item = caseRes.data;
    setCaseItem(item);

    const modelRes = await api.GET('/v1/case-models/{id}', {
      headers,
      params: { path: { id: item.case_model_id } },
    });
    if (modelRes.data) {
      setModelLabel(
        modelRes.data.display_name ??
          labelFromTranslations(modelRes.data.translations, modelRes.data.key, locale),
      );
    } else {
      setModelLabel(item.case_model_id);
    }

    const attrsRes = await listModelAttributes(
      'case_model',
      item.case_model_id,
      locale,
      'instance',
    );
    if (attrsRes.error) {
      setError(msg('errorGeneric'));
      setLoading(false);
      return;
    }
    setFields((attrsRes.data?.items ?? []) as AttributeDefinition[]);
    setLoading(false);
  }, [id, locale, msg]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const title = useMemo(() => {
    if (!caseItem) return msg('loading');
    return caseTitle(caseItem, modelLabel);
  }, [caseItem, modelLabel, msg]);

  async function patchStatus(nextStatus: string) {
    if (!id) return;
    setFieldSaving(true);
    setError(null);
    const res = await api.PATCH('/v1/cases/{id}', {
      headers: apiJsonHeaders(locale),
      params: { path: { id } },
      body: { status: nextStatus },
    });
    setFieldSaving(false);
    if (res.error || !res.response.ok) {
      setError(msg('errorGeneric'));
      return;
    }
    setCaseItem(res.data ?? null);
  }

  async function handleDelete() {
    if (!id || deleting) return;
    if (!window.confirm(msg('casDeleteCaseConfirm'))) return;

    setDeleting(true);
    setError(null);
    const res = await api.DELETE('/v1/cases/{id}', {
      headers: apiHeaders(locale),
      params: { path: { id } },
    });
    setDeleting(false);
    if (res.error || !res.response.ok) {
      setError(msg('errorGeneric'));
      return;
    }
    navigate('/apps/cases');
  }

  function fieldName(def: AttributeDefinition): string {
    return def.display_name ?? labelFromTranslations(def.translations, def.key, locale);
  }

  const sortedFields = useMemo(
    () => [...fields].sort((a, b) => fieldName(a).localeCompare(fieldName(b), locale)),
    [fields, locale],
  );

  return (
    <div className="admin-page admin-page--shell">
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <Link to="/apps/cases">{msg('casAppTitle')}</Link>
        <span className="admin-breadcrumb-sep">›</span>
        <span aria-current="page">{title}</span>
      </nav>

      {caseItem && (
        <header className="admin-page-header">
          <h1 className="admin-page-title">{title}</h1>
          <div className="admin-toolbar">
            <button
              type="button"
              className="button-icon button-icon--danger"
              title={msg('casDeleteCase')}
              aria-label={msg('casDeleteCase')}
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              <LuTrash2 size={18} aria-hidden />
            </button>
            <Link
              to="/apps/cases/settings"
              className="button-icon"
              title={msg('casSettingsTitle')}
              aria-label={msg('casSettingsTitle')}
            >
              <LuSettings size={18} aria-hidden />
            </Link>
          </div>
        </header>
      )}

      {loading && <p>{msg('loading')}</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && !error && caseItem && (
        <>
          <p className="admin-table-muted admin-page-subtitle">
            {msg('casColModel')}: {modelLabel}
          </p>

          <div className="admin-list-card">
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--fixed-cols">
                <thead>
                  <tr>
                    <th className="admin-table-col-label">{msg('casColField')}</th>
                    <th className="admin-table-col-status">{msg('modelsColType')}</th>
                    <th>{msg('casColFieldValue')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="admin-table-row--system">
                    <td>
                      {msg('workColStatus')}
                      <span className="admin-table-sub"> ({msg('cmdSystemField')})</span>
                    </td>
                    <td className="admin-table-col-status">{msg('cmdFieldTypeEnum')}</td>
                    <td>
                      <select
                        className="admin-table-inline-input"
                        value={caseItem.status}
                        disabled={fieldSaving}
                        onChange={(e) => void patchStatus(e.target.value)}
                        aria-label={msg('workColStatus')}
                      >
                        {WORK_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {workStatusLabel(s, msg)}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                  {sortedFields.length === 0 ? (
                    <tr>
                      <td colSpan={3}>{msg('casFieldsEmpty')}</td>
                    </tr>
                  ) : (
                    sortedFields.map((def) => (
                      <tr key={def.id}>
                        <td>{fieldName(def)}</td>
                        <td className="admin-table-col-status">
                          {msg(dataTypeMessageKey(def.data_type))}
                        </td>
                        <td>
                          <CaseFieldValueCell
                            caseId={caseItem.id}
                            fieldKey={def.key}
                            definition={def}
                            value={caseItem.attributes?.[def.key]}
                            locale={locale}
                            saving={fieldSaving}
                            onSavingChange={setFieldSaving}
                            onUpdated={() => void refresh()}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
