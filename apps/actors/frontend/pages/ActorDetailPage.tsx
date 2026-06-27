import { useCallback, useEffect, useMemo, useState } from 'react';
import { LuSettings, LuTrash2 } from 'react-icons/lu';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, apiHeaders, apiJsonHeaders } from '@shell/api/client.js';
import { useI18n } from '@shell/i18n/I18nContext.js';
import { listActorModelAttributes, type AttributeDefinition } from '@shell/lib/attribute-api.js';
import { dataTypeMessageKey } from '@shell/lib/data-type-label.js';
import { labelFromTranslations } from '@shell/lib/model-label.js';
import { findActorStatusDefinition } from '@shell/lib/actor-instance-status.js';
import { selectOptionLabel } from '@shell/lib/select-option-labels.js';
import type { components } from '@shell/api/schema.js';
import { ActorFieldValueCell } from '../components/ActorFieldValueCell.js';
import { actorTitle } from '../lib/actor-display.js';

type ActorItem = components['schemas']['Actor'];

export function ActorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { locale, msg } = useI18n();
  const [actorItem, setActorItem] = useState<ActorItem | null>(null);
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
    const actorRes = await api.GET('/v1/actors/{id}', { headers, params: { path: { id } } });
    if (actorRes.error || !actorRes.data) {
      setError(msg('errorGeneric'));
      setLoading(false);
      return;
    }
    const item = actorRes.data;
    setActorItem(item);

    const modelRes = await api.GET('/v1/actor-models/{id}', {
      headers,
      params: { path: { id: item.actor_model_id } },
    });
    if (modelRes.data) {
      setModelLabel(
        modelRes.data.display_name ??
          labelFromTranslations(modelRes.data.translations, modelRes.data.key, locale),
      );
    } else {
      setModelLabel(item.actor_model_id);
    }

    const attrsRes = await listActorModelAttributes(item.actor_model_id, locale, 'instance');
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
    if (!actorItem) return msg('loading');
    return actorTitle(actorItem, modelLabel);
  }, [actorItem, modelLabel, msg]);

  async function patchStatus(nextStatus: string) {
    if (!id) return;
    setFieldSaving(true);
    setError(null);
    const res = await api.PATCH('/v1/actors/{id}', {
      headers: apiJsonHeaders(locale),
      params: { path: { id } },
      body: { status: nextStatus },
    });
    setFieldSaving(false);
    if (res.error || !res.response.ok) {
      setError(msg('errorGeneric'));
      return;
    }
    setActorItem(res.data ?? null);
  }

  async function handleDelete() {
    if (!id || deleting) return;
    if (!window.confirm(msg('actDeleteActorConfirm'))) return;

    setDeleting(true);
    setError(null);
    const res = await api.DELETE('/v1/actors/{id}', {
      headers: apiHeaders(locale),
      params: { path: { id } },
    });
    setDeleting(false);
    if (res.error || !res.response.ok) {
      setError(msg('errorGeneric'));
      return;
    }
    navigate('/apps/actors');
  }

  function fieldName(def: AttributeDefinition): string {
    return def.display_name ?? labelFromTranslations(def.translations, def.key, locale);
  }

  const statusDefinition = useMemo(
    () => findActorStatusDefinition(fields),
    [fields],
  );

  const sortedFields = useMemo(
    () =>
      [...fields]
        .filter((def) => def.key !== 'status')
        .sort((a, b) => fieldName(a).localeCompare(fieldName(b), locale)),
    [fields, locale],
  );

  return (
    <div className="admin-page admin-page--shell">
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <Link to="/apps/actors">{msg('actAppTitle')}</Link>
        <span className="admin-breadcrumb-sep">›</span>
        <span aria-current="page">{title}</span>
      </nav>

      {actorItem && (
        <header className="admin-page-header">
          <h1 className="admin-page-title">{title}</h1>
          <div className="admin-toolbar">
            {!actorItem.is_tenant_root && (
              <button
                type="button"
                className="button-icon button-icon--danger"
                title={msg('actDeleteActor')}
                aria-label={msg('actDeleteActor')}
                disabled={deleting}
                onClick={() => void handleDelete()}
              >
                <LuTrash2 size={18} aria-hidden />
              </button>
            )}
            <Link
              to="/apps/actors/settings"
              className="button-icon"
              title={msg('actSettingsTitle')}
              aria-label={msg('actSettingsTitle')}
            >
              <LuSettings size={18} aria-hidden />
            </Link>
          </div>
        </header>
      )}

      {loading && <p>{msg('loading')}</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && !error && actorItem && (
        <>
          <p className="admin-table-muted admin-page-subtitle">
            {msg('actColModel')}: {modelLabel}
          </p>

          <div className="admin-list-card">
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--fixed-cols">
                <thead>
                  <tr>
                    <th className="admin-table-col-label">{msg('actColField')}</th>
                    <th className="admin-table-col-status">{msg('modelsColType')}</th>
                    <th>{msg('actColFieldValue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {statusDefinition && (
                    <tr className="admin-table-row--system">
                      <td>
                        {statusDefinition.display_name ?? fieldName(statusDefinition)}
                        <span className="admin-table-sub"> ({msg('cmdSystemField')})</span>
                      </td>
                      <td className="admin-table-col-status">{msg('cmdFieldTypeEnum')}</td>
                      <td>
                        <select
                          className="admin-table-inline-input"
                          value={actorItem.status}
                          disabled={fieldSaving}
                          onChange={(e) => void patchStatus(e.target.value)}
                          aria-label={statusDefinition.display_name ?? fieldName(statusDefinition)}
                        >
                          {(statusDefinition.select_options ?? []).map((optionKey) => (
                            <option key={optionKey} value={optionKey}>
                              {selectOptionLabel(optionKey, statusDefinition)}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )}
                  {sortedFields.length === 0 ? (
                    <tr>
                      <td colSpan={3}>{msg('actFieldsEmpty')}</td>
                    </tr>
                  ) : (
                    sortedFields.map((def) => (
                      <tr key={def.id}>
                        <td>{fieldName(def)}</td>
                        <td className="admin-table-col-status">
                          {msg(dataTypeMessageKey(def.data_type))}
                        </td>
                        <td>
                          <ActorFieldValueCell
                            actorId={actorItem.id}
                            fieldKey={def.key}
                            definition={def}
                            value={actorItem.attributes?.[def.key]}
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
