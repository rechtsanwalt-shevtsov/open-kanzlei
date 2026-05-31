import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LuArrowDown,
  LuArrowUp,
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuSettings,
} from 'react-icons/lu';
import { Link, useParams } from 'react-router-dom';
import { AttributeDialog } from '@shell/components/admin/AttributeDialog.js';
import { api, apiHeaders } from '@shell/api/client.js';
import { useI18n } from '@shell/i18n/I18nContext.js';
import type { Locale } from '@shell/i18n/locale.js';
import {
  createModelAttribute,
  deleteAttributeDefinition,
  updateAttributeDefinition,
  type AttributeDefinition,
} from '@shell/lib/attribute-api.js';
import { dataTypeMessageKey } from '@shell/lib/data-type-label.js';
import { encryptionModeMessageKey } from '@shell/lib/encryption-mode-label.js';
import { labelFromTranslations } from '@shell/lib/model-label.js';
import { useEffectiveSettings } from '../hooks/useEffectiveSettings.js';
import { caseModelStatusLabel } from '../lib/case-model-status.js';
import type { components } from '@shell/api/schema.js';

type CaseModel = components['schemas']['CaseModel'];
type SortColumn = 'attribute' | 'type' | 'encryption';
type SortDirection = 'asc' | 'desc';

export function CaseModelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { locale, msg } = useI18n();
  const { settings, loading: settingsLoading } = useEffectiveSettings();
  const showKeys = Boolean(settings.showTechnicalKeys);
  const defaultEncryption =
    settings.defaultAttributeEncryptionMode === 'zero_knowledge'
      ? 'zero_knowledge'
      : 'server_readable';
  const itemsPerPage = Math.max(5, Number(settings.itemsPerPage) || 25);

  const [model, setModel] = useState<CaseModel | null>(null);
  const [items, setItems] = useState<AttributeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [actionsOpen, setActionsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AttributeDefinition | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const actionsRef = useRef<HTMLDivElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    if (!id) return;
    setLoading(true);
    setError(null);
    const headers = apiHeaders(locale);
    const [modelRes, attrRes] = await Promise.all([
      api.GET('/v1/case-models/{id}', { headers, params: { path: { id } } }),
      api.GET('/v1/case-models/{id}/attributes', { headers, params: { path: { id } } }),
    ]);
    setLoading(false);
    if (modelRes.error || attrRes.error) {
      setError(msg('errorGeneric'));
      return;
    }
    setModel(modelRes.data ?? null);
    setItems((attrRes.data?.items ?? []) as AttributeDefinition[]);
  }

  useEffect(() => {
    void refresh();
  }, [id, locale]);

  useEffect(() => {
    if (selectedIds.size === 0) setActionsOpen(false);
  }, [selectedIds.size]);

  useEffect(() => {
    if (!actionsOpen) return;
    function onDocClick(e: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setActionsOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [actionsOpen]);

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

  function attributeName(row: AttributeDefinition): string {
    return row.display_name ?? labelFromTranslations(row.translations, row.key, locale);
  }

  const sorted = useMemo(() => {
    if (!sortColumn) return filtered;
    const list = [...filtered];
    const dir = sortDirection === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (sortColumn === 'attribute') {
        return dir * attributeName(a).localeCompare(attributeName(b), locale);
      }
      if (sortColumn === 'type') {
        const typeA = msg(dataTypeMessageKey(a.data_type));
        const typeB = msg(dataTypeMessageKey(b.data_type));
        return dir * typeA.localeCompare(typeB, locale);
      }
      const encA = msg(encryptionModeMessageKey(a.encryption_mode));
      const encB = msg(encryptionModeMessageKey(b.encryption_mode));
      return dir * encA.localeCompare(encB, locale);
    });
    return list;
  }, [filtered, sortColumn, sortDirection, locale, msg]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / itemsPerPage));
  const pageItems = sorted.slice(page * itemsPerPage, page * itemsPerPage + itemsPerPage);
  const pageIds = useMemo(() => pageItems.map((row) => row.id), [pageItems]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((rowId) => selectedIds.has(rowId));
  const somePageSelected = pageIds.some((rowId) => selectedIds.has(rowId));
  const colCount = showKeys ? 5 : 4;
  const rangeFrom = sorted.length === 0 ? 0 : page * itemsPerPage + 1;
  const rangeTo = Math.min(sorted.length, page * itemsPerPage + pageItems.length);
  const pageRangeLabel = msg('cmdPageRange')
    .replace('{from}', String(rangeFrom))
    .replace('{to}', String(rangeTo))
    .replace('{total}', String(sorted.length));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = somePageSelected && !allPageSelected;
    }
  }, [somePageSelected, allPageSelected]);

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const rowId of pageIds) next.delete(rowId);
      } else {
        for (const rowId of pageIds) next.add(rowId);
      }
      return next;
    });
  }

  function toggleSelect(rowId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }

  function handleSortColumn(column: SortColumn) {
    setPage(0);
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection('asc');
      return;
    }
    setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
  }

  function sortIcon(column: SortColumn) {
    const active = sortColumn === column;
    return (
      <span className="admin-table-sort-icon" aria-hidden>
        {active &&
          (sortDirection === 'asc' ? <LuArrowUp size={14} /> : <LuArrowDown size={14} />)}
      </span>
    );
  }

  function apiErrorMessage(err: unknown): string {
    const e = err as { message?: string };
    return e?.message ?? msg('errorGeneric');
  }

  async function handleCreate(payload: {
    name: string;
    locale: Locale;
    data_type: AttributeDefinition['data_type'];
    encryption_mode: AttributeDefinition['encryption_mode'];
  }): Promise<string | null> {
    if (!id) return msg('errorGeneric');
    const res = await createModelAttribute('case_model', id, locale, {
      name: payload.name,
      locale: payload.locale,
      data_type: payload.data_type,
      encryption_mode: payload.encryption_mode,
    });
    if (res.error) return apiErrorMessage(res.error);
    await refresh();
    return null;
  }

  async function handleEdit(payload: {
    name: string;
    locale: Locale;
    data_type: AttributeDefinition['data_type'];
    encryption_mode: AttributeDefinition['encryption_mode'];
  }): Promise<string | null> {
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

  async function handleBulkDelete() {
    setActionsOpen(false);
    if (selectedIds.size === 0 || deleting) return;
    if (!window.confirm(msg('attributesBulkDeleteConfirm'))) return;

    setDeleting(true);
    setError(null);
    const ids = [...selectedIds];

    try {
      const results = await Promise.all(
        ids.map((attrId) => deleteAttributeDefinition(attrId, locale)),
      );
      const failed = results.filter((r) => r.error || !r.response.ok);

      if (failed.length === ids.length) {
        const err = failed[0]!.error as { message?: string } | undefined;
        setError(err?.message ?? msg('errorGeneric'));
        return;
      }

      if (failed.length > 0) {
        setError(msg('errorGeneric'));
      }

      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const [i, attrId] of ids.entries()) {
          if (!results[i]?.error && results[i]?.response.ok) next.delete(attrId);
        }
        return next;
      });
      await refresh();
    } finally {
      setDeleting(false);
    }
  }

  const title = model
    ? (model.display_name ?? labelFromTranslations(model.translations, model.key, locale))
    : msg('loading');

  return (
    <div className="admin-page admin-page--shell">
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <Link to="/apps/case-model-designer">{msg('cmdAppTitle')}</Link>
        <span className="admin-breadcrumb-sep">›</span>
        <span aria-current="page">{title}</span>
      </nav>

      {model && (
        <>
          <header className="admin-page-header">
            <div>
              <h1 className="admin-page-title">{title}</h1>
              <p className="hint">
                {caseModelStatusLabel(model.status, msg)}
                {showKeys && <> · {model.key}</>}
              </p>
            </div>
            <div className="admin-toolbar">
              <Link to={`/apps/case-model-designer/${id}/edit`} className="button-outline">
                {msg('cmdEditModel')}
              </Link>
              <button type="button" className="button-outline" onClick={() => setCreateOpen(true)}>
                + {msg('attributesAdd')}
              </button>
              <Link
                to="/apps/case-model-designer/settings"
                className="button-icon"
                title="App-Settings"
                aria-label="App-Settings"
              >
                <LuSettings size={18} aria-hidden />
              </Link>
            </div>
          </header>

          <div className="admin-list-controls">
            <div className="admin-list-controls-left">
              <div className="admin-search-wrap">
                <input
                  type="search"
                  className="admin-search"
                  placeholder={msg('search')}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                />
              </div>

              <div className="admin-list-actions-slot">
                {selectedIds.size > 0 && (
                  <div className="admin-list-actions-row">
                    <div className="admin-bulk-actions" ref={actionsRef}>
                      <button
                        type="button"
                        className="button-outline admin-bulk-actions-toggle"
                        aria-expanded={actionsOpen}
                        aria-haspopup="menu"
                        disabled={deleting}
                        onClick={() => setActionsOpen((open) => !open)}
                      >
                        {msg('cmdActions')}
                        <LuChevronDown size={14} aria-hidden />
                      </button>
                      {actionsOpen && (
                        <div className="admin-bulk-actions-menu" role="menu">
                          <button
                            type="button"
                            role="menuitem"
                            className="admin-bulk-actions-menu--danger"
                            disabled={deleting}
                            onClick={() => void handleBulkDelete()}
                          >
                            {msg('cmdBulkDelete')}
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="admin-list-toolbar-meta">
                      {msg('cmdSelectedCount').replace('{count}', String(selectedIds.size))}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {!loading && !settingsLoading && sorted.length > 0 && (
              <div className="admin-list-pagination">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label={msg('cmdPrevPage')}
                >
                  <LuChevronLeft size={16} aria-hidden />
                </button>
                <span>{pageRangeLabel}</span>
                <button
                  type="button"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label={msg('cmdNextPage')}
                >
                  <LuChevronRight size={16} aria-hidden />
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {(loading || settingsLoading) && <p>{msg('loading')}</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && !settingsLoading && !error && model && (
        <div className="admin-list-card">
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--fixed-cols">
              <thead>
                <tr>
                  <th className="admin-table-col-check">
                    {pageItems.length > 0 && (
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        className="admin-table-checkbox"
                        checked={allPageSelected}
                        onChange={toggleSelectAll}
                        aria-label={msg('cmdSelectAll')}
                      />
                    )}
                  </th>
                  <th
                    className="admin-table-col-label"
                    aria-sort={
                      sortColumn === 'attribute'
                        ? sortDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="admin-table-sort"
                      onClick={() => handleSortColumn('attribute')}
                    >
                      {msg('attributesColAttribute')}
                      {sortIcon('attribute')}
                    </button>
                  </th>
                  {showKeys && <th className="admin-table-col-key">{msg('modelsColName')}</th>}
                  <th
                    className="admin-table-col-status"
                    aria-sort={
                      sortColumn === 'type'
                        ? sortDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="admin-table-sort"
                      onClick={() => handleSortColumn('type')}
                    >
                      {msg('modelsColType')}
                      {sortIcon('type')}
                    </button>
                  </th>
                  <th
                    className="admin-table-col-encryption"
                    aria-sort={
                      sortColumn === 'encryption'
                        ? sortDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="admin-table-sort"
                      onClick={() => handleSortColumn('encryption')}
                    >
                      {msg('attributesEncryption')}
                      {sortIcon('encryption')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={colCount} className="admin-table-empty">
                      {search ? msg('modelsNoResults') : msg('attributesEmpty')}
                    </td>
                  </tr>
                ) : (
                  pageItems.map((row) => {
                    const selected = selectedIds.has(row.id);
                    return (
                      <tr
                        key={row.id}
                        className={selected ? 'admin-table-row--selected' : undefined}
                      >
                        <td className="admin-table-col-check">
                          <input
                            type="checkbox"
                            className="admin-table-checkbox"
                            checked={selected}
                            onChange={() => toggleSelect(row.id)}
                            aria-label={attributeName(row)}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="admin-table-link admin-table-link--button"
                            onClick={() => setEditTarget(row)}
                          >
                            {attributeName(row)}
                          </button>
                        </td>
                        {showKeys && <td className="admin-table-col-key">{row.key}</td>}
                        <td className="admin-table-col-status">
                          {msg(dataTypeMessageKey(row.data_type))}
                        </td>
                        <td className="admin-table-col-encryption">
                          {msg(encryptionModeMessageKey(row.encryption_mode))}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AttributeDialog
        open={createOpen}
        mode="create"
        defaultEncryptionMode={defaultEncryption}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
      <AttributeDialog
        open={editTarget !== null}
        mode="edit"
        attribute={editTarget ?? undefined}
        onClose={() => setEditTarget(null)}
        onSubmit={handleEdit}
      />
    </div>
  );
}
