import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreateModelDialog } from '../../components/admin/CreateModelDialog.js';
import type { ModelKind } from '../../types/models.js';
import { useModelsList } from '../../hooks/useModelsList.js';
import { useI18n } from '../../i18n/I18nContext.js';
import type { MessageKey } from '../../i18n/messages.js';

function kindLabel(msg: (k: MessageKey) => string, kind: ModelKind): string {
  switch (kind) {
    case 'case_model':
      return msg('modelsTypeCase');
    case 'task_model':
      return msg('modelsTypeTask');
    case 'instrument_model':
      return msg('modelsTypeInstrument');
  }
}

export function ModelsPage() {
  const { msg } = useI18n();

  function modelPath(kind: ModelKind, id: string): string {
    switch (kind) {
      case 'case_model':
        return `/admin/case-models/${id}`;
      case 'task_model':
        return `/admin/task-models/${id}`;
      case 'instrument_model':
        return `/admin/instrument-models/${id}`;
    }
  }
  const { items, taskModels, loading, error, refresh } = useModelsList();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (row) =>
        row.label.toLowerCase().includes(q) ||
        row.key.toLowerCase().includes(q) ||
        kindLabel(msg, row.kind).toLowerCase().includes(q),
    );
  }, [items, search, msg]);

  return (
    <div className="admin-page">
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">{msg('administration')}</Link>
        <span className="admin-breadcrumb-sep">›</span>
        <span aria-current="page">{msg('modelsTitle')}</span>
      </nav>

      <p className="hint">
        <Link to="/apps/case-model-designer">{msg('cmdOpenInApp')}</Link>
      </p>

      <header className="admin-page-header">
        <h1 className="admin-page-title">{msg('modelsTitle')}</h1>
        <div className="admin-toolbar">
          <button
            type="button"
            className="button-outline"
            onClick={() => setCreateOpen(true)}
          >
            <span className="admin-btn-icon" aria-hidden>
              +
            </span>
            {msg('modelsCreate')}
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
          <table className="admin-table">
            <thead>
              <tr>
                <th>{msg('modelsColLabel')}</th>
                <th>{msg('modelsColName')}</th>
                <th>{msg('modelsColType')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="admin-table-empty">
                    {search ? msg('modelsNoResults') : msg('modelsEmpty')}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={`${row.kind}-${row.id}`}>
                    <td>
                      <Link
                        to={modelPath(row.kind, row.id)}
                        className="admin-table-link admin-table-link--anchor"
                      >
                        {row.label}
                      </Link>
                    </td>
                    <td className="admin-table-muted">{row.key}</td>
                    <td>
                      <span className="admin-type-badge">{kindLabel(msg, row.kind)}</span>
                      {row.taskModelKey && (
                        <span className="admin-table-sub">
                          {' '}
                          → {row.taskModelKey}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <CreateModelDialog
        open={createOpen}
        taskModels={taskModels}
        onClose={() => setCreateOpen(false)}
        onCreated={async () => {
          await refresh();
        }}
      />
    </div>
  );
}
