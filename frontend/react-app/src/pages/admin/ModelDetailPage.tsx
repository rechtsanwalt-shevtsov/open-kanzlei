import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AttributeDialog,
  type AttributeDialogPayload,
} from '../../components/admin/AttributeDialog.js';
import { AttributeRowActions } from '../../components/admin/AttributeRowActions.js';
import { api, apiHeaders } from '../../api/client.js';
import { useModelAttributes } from '../../hooks/useModelAttributes.js';
import { useI18n } from '../../i18n/I18nContext.js';
import {
  createModelAttribute,
  deleteAttributeDefinition,
  updateAttributeDefinition,
  type AttributeDefinition,
} from '../../lib/attribute-api.js';
import { dataTypeMessageKey } from '../../lib/data-type-label.js';
import { encryptionModeMessageKey } from '../../lib/encryption-mode-label.js';
import { labelFromTranslations } from '../../lib/model-label.js';
import type { MessageKey } from '../../i18n/messages.js';
import type { ModelKind } from '../../types/models.js';

interface ModelSummary {
  id: string;
  key: string;
  label: string;
}

function kindTitle(msg: (k: MessageKey) => string, kind: ModelKind): string {
  switch (kind) {
    case 'case_model':
      return msg('modelsTypeCase');
    case 'task_model':
      return msg('modelsTypeTask');
    case 'instrument_model':
      return msg('modelsTypeInstrument');
  }
}

function modelListPath(kind: ModelKind, id: string): string {
  switch (kind) {
    case 'case_model':
      return `/admin/case-models/${id}`;
    case 'task_model':
      return `/admin/task-models/${id}`;
    case 'instrument_model':
      return `/admin/instrument-models/${id}`;
  }
}

interface ModelDetailPageProps {
  kind: ModelKind;
}

export function ModelDetailPage({ kind }: ModelDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const { locale, msg } = useI18n();
  const [model, setModel] = useState<ModelSummary | null>(null);
  const { items, loading, error, refresh } = useModelAttributes(kind, id);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const headers = apiHeaders(locale);
      if (kind === 'task_model') {
        const res = await api.GET('/v1/task-models/{id}', {
          headers,
          params: { path: { id } },
        });
        if (res.data) {
          setModel({
            id: res.data.id,
            key: res.data.key,
            label: labelFromTranslations(res.data.translations, res.data.key, locale),
          });
        }
        return;
      }
      const res = await api.GET('/v1/instrument-models/{id}', {
        headers,
        params: { path: { id } },
      });
      if (res.data) {
        setModel({
          id: res.data.id,
          key: res.data.key,
          label: labelFromTranslations(res.data.translations, res.data.key, locale),
        });
      }
    })();
  }, [id, kind, locale]);

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AttributeDefinition | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((row) => {
      const label = (
        row.display_name ?? labelFromTranslations(row.translations, row.key, locale)
      ).toLowerCase();
      return label.includes(q) || row.key.toLowerCase().includes(q);
    });
  }, [items, search, locale]);

  function apiErrorMessage(err: unknown): string {
    const e = err as { message?: string };
    return e?.message ?? msg('errorGeneric');
  }

  async function handleCreate(payload: AttributeDialogPayload): Promise<string | null> {
    if (!id) return msg('errorGeneric');
    const res = await createModelAttribute(kind, id, locale, {
      name: payload.name,
      locale: payload.locale,
      definition_scope: 'instance',
      data_type: payload.data_type,
      encryption_mode: payload.encryption_mode,
    });
    if (res.error) return apiErrorMessage(res.error);
    await refresh();
    return null;
  }

  async function handleEdit(payload: AttributeDialogPayload): Promise<string | null> {
    if (!editTarget) return msg('errorGeneric');
    const res = await updateAttributeDefinition(editTarget.id, locale, {
      name: payload.name,
      locale: payload.locale,
      data_type: payload.data_type,
      encryption_mode: payload.encryption_mode,
    });
    if (res.error) return apiErrorMessage(res.error);
    await refresh();
    return null;
  }

  async function handleDelete(attr: AttributeDefinition) {
    if (!window.confirm(msg('attributesDeleteConfirm'))) return;
    const res = await deleteAttributeDefinition(attr.id, locale);
    if (res.error) return;
    await refresh();
  }

  const modelLabel = model?.label ?? msg('loading');
  const fieldsPath = id ? modelListPath(kind, id) : '/admin/models';

  return (
    <div className="admin-page">
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">{msg('administration')}</Link>
        <span className="admin-breadcrumb-sep">›</span>
        <Link to="/admin/models">{msg('modelsTitle')}</Link>
        <span className="admin-breadcrumb-sep">›</span>
        <Link to={fieldsPath}>{modelLabel}</Link>
        <span className="admin-breadcrumb-sep">›</span>
        <span aria-current="page">{msg('attributesTitle')}</span>
      </nav>

      <header className="admin-page-header">
        <div>
          <h1 className="admin-page-title">{msg('attributesTitle')}</h1>
          {model && (
            <p className="admin-table-muted admin-page-subtitle">
              {kindTitle(msg, kind)} · {msg('modelsColName')}: <code>{model.key}</code>
            </p>
          )}
        </div>
        <div className="admin-toolbar">
          <button
            type="button"
            className="button-outline"
            onClick={() => setCreateOpen(true)}
            disabled={!id}
          >
            <span className="admin-btn-icon" aria-hidden>
              +
            </span>
            {msg('attributesAdd')}
          </button>
        </div>
      </header>

      <div className="admin-search-wrap">
        <input
          type="search"
          className="admin-search"
          placeholder={msg('search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={msg('search')}
        />
      </div>

      {loading && <p className="status">{msg('loading')}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && (
        <div className="admin-table-wrap">
          <table className="admin-table admin-table--with-actions">
            <thead>
              <tr>
                <th>{msg('modelsColLabel')}</th>
                <th>{msg('modelsColName')}</th>
                <th>{msg('modelsColType')}</th>
                <th>{msg('attributesEncryption')}</th>
                <th className="admin-table-actions-col" aria-label={msg('attributesRowActions')} />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="admin-table-empty">
                    {search ? msg('modelsNoResults') : msg('attributesEmpty')}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <button
                        type="button"
                        className="admin-table-link admin-table-link--button"
                        onClick={() => setEditTarget(row)}
                      >
                        {row.display_name ?? labelFromTranslations(row.translations, row.key, locale)}
                      </button>
                    </td>
                    <td className="admin-table-muted">{row.key}</td>
                    <td>{msg(dataTypeMessageKey(row.data_type))}</td>
                    <td>{msg(encryptionModeMessageKey(row.encryption_mode))}</td>
                    <td className="admin-table-actions-cell">
                      <AttributeRowActions
                        onEdit={() => setEditTarget(row)}
                        onDelete={() => void handleDelete(row)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <AttributeDialog
        open={createOpen}
        mode="create"
        definitionScope="instance"
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <AttributeDialog
        open={editTarget !== null}
        mode="edit"
        definitionScope="instance"
        attribute={editTarget ?? undefined}
        onClose={() => setEditTarget(null)}
        onSubmit={handleEdit}
      />
    </div>
  );
}
