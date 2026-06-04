import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LuArrowDown,
  LuArrowUp,
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuSettings,
} from 'react-icons/lu';
import { Link, useNavigate } from 'react-router-dom';
import { api, apiHeaders } from '@shell/api/client.js';
import { useI18n } from '@shell/i18n/I18nContext.js';
import { labelFromTranslations } from '@shell/lib/model-label.js';
import { workStatusLabel } from '@shell/lib/work-status.js';
import type { components } from '@shell/api/schema.js';
import { CreateCaseDialog } from '../components/CreateCaseDialog.js';
import { useEffectiveSettings } from '../hooks/useEffectiveSettings.js';
import {
  caseSearchText,
  caseTitle,
  formatCaseDate,
  type CaseItem,
} from '../lib/case-display.js';

type CaseModel = components['schemas']['CaseModel'];
type SortColumn = 'title' | 'model' | 'status' | 'created';
type SortDirection = 'asc' | 'desc';

export function CasesListPage() {
  const navigate = useNavigate();
  const { locale, msg } = useI18n();
  const { settings, loading: settingsLoading } = useEffectiveSettings();
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [models, setModels] = useState<CaseModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [actionsOpen, setActionsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const actionsRef = useRef<HTMLDivElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const itemsPerPage = Math.max(5, Number(settings.itemsPerPage) || 25);

  const modelLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of models) {
      map.set(
        m.id,
        m.display_name ?? labelFromTranslations(m.translations, m.key, locale),
      );
    }
    return map;
  }, [models, locale]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const headers = apiHeaders(locale);
    const [casesRes, modelsRes] = await Promise.all([
      api.GET('/v1/cases', { headers }),
      api.GET('/v1/case-models', { headers }),
    ]);
    if (casesRes.error || modelsRes.error) {
      setError(msg('errorGeneric'));
      setLoading(false);
      return;
    }
    setCases(casesRes.data?.items ?? []);
    setModels(modelsRes.data?.items ?? []);
    setLoading(false);
  }, [locale, msg]);

  useEffect(() => {
    void load();
  }, [load]);

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
    if (!q) return cases;
    return cases.filter((c) => {
      const modelLabel = modelLabels.get(c.case_model_id) ?? c.case_model_id;
      return caseSearchText(c, modelLabel).includes(q);
    });
  }, [cases, search, modelLabels]);

  const sorted = useMemo(() => {
    if (!sortColumn) return filtered;
    const list = [...filtered];
    const dir = sortDirection === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      const modelA = modelLabels.get(a.case_model_id) ?? '';
      const modelB = modelLabels.get(b.case_model_id) ?? '';
      if (sortColumn === 'title') {
        return (
          dir *
          caseTitle(a, modelA).localeCompare(caseTitle(b, modelB), locale)
        );
      }
      if (sortColumn === 'model') {
        return dir * modelA.localeCompare(modelB, locale);
      }
      if (sortColumn === 'status') {
        return dir * a.status.localeCompare(b.status, locale);
      }
      return dir * a.created_at.localeCompare(b.created_at);
    });
    return list;
  }, [filtered, sortColumn, sortDirection, locale, modelLabels]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / itemsPerPage));
  const pageItems = sorted.slice(page * itemsPerPage, page * itemsPerPage + itemsPerPage);
  const pageIds = useMemo(() => pageItems.map((c) => c.id), [pageItems]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));
  const colCount = 5;
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
        for (const id of pageIds) next.delete(id);
      } else {
        for (const id of pageIds) next.add(id);
      }
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSortColumn(column: SortColumn) {
    setPage(0);
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection(column === 'created' ? 'desc' : 'asc');
      return;
    }
    setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
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

  async function handleBulkDelete() {
    setActionsOpen(false);
    if (selectedIds.size === 0 || deleting) return;
    if (!window.confirm(msg('casBulkDeleteConfirm'))) return;

    setDeleting(true);
    setError(null);
    const ids = [...selectedIds];
    try {
      const results = await Promise.all(
        ids.map((caseId) =>
          api.DELETE('/v1/cases/{id}', {
            headers: apiHeaders(locale),
            params: { path: { id: caseId } },
          }),
        ),
      );
      const failed = results.filter((r) => r.error || !r.response.ok);
      if (failed.length === ids.length) {
        setError(msg('errorGeneric'));
        return;
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const [i, caseId] of ids.entries()) {
          if (!results[i]?.error && results[i]?.response.ok) next.delete(caseId);
        }
        return next;
      });
      await load();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="admin-page admin-page--shell">
      <header className="admin-page-header">
        <h1 className="admin-page-title">{msg('casAppTitle')}</h1>
        <div className="admin-toolbar">
          <button
            type="button"
            className="button-outline"
            onClick={() => setCreateOpen(true)}
          >
            + {msg('casCreate')}
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

      {(loading || settingsLoading) && <p>{msg('loading')}</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && !settingsLoading && (
        <div className="admin-list-card">
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--fixed-cols admin-table--cases-list">
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
                  <th className="admin-table-col-label cas-col-title" aria-sort={sortColumn === 'title' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className="admin-table-sort" onClick={() => handleSortColumn('title')}>
                      {msg('casColTitle')}
                      {sortIcon('title')}
                    </button>
                  </th>
                  <th className="cas-col-model" aria-sort={sortColumn === 'model' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className="admin-table-sort" onClick={() => handleSortColumn('model')}>
                      {msg('casColModel')}
                      {sortIcon('model')}
                    </button>
                  </th>
                  <th className="admin-table-col-status" aria-sort={sortColumn === 'status' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className="admin-table-sort" onClick={() => handleSortColumn('status')}>
                      {msg('workColStatus')}
                      {sortIcon('status')}
                    </button>
                  </th>
                  <th aria-sort={sortColumn === 'created' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className="admin-table-sort" onClick={() => handleSortColumn('created')}>
                      {msg('casColCreated')}
                      {sortIcon('created')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={colCount}>{msg('casEmpty')}</td>
                  </tr>
                ) : (
                  pageItems.map((c) => {
                    const selected = selectedIds.has(c.id);
                    const modelLabel = modelLabels.get(c.case_model_id) ?? '—';
                    const title = caseTitle(c, modelLabel);
                    return (
                      <tr
                        key={c.id}
                        className={selected ? 'admin-table-row--selected' : undefined}
                      >
                        <td className="admin-table-col-check">
                          <input
                            type="checkbox"
                            className="admin-table-checkbox"
                            checked={selected}
                            onChange={() => toggleSelect(c.id)}
                            aria-label={title}
                          />
                        </td>
                        <td className="cas-col-title">
                          <Link to={`/apps/cases/${c.id}`}>{title}</Link>
                        </td>
                        <td className="cas-col-model">{modelLabel}</td>
                        <td className="admin-table-col-status">
                          {workStatusLabel(c.status, msg)}
                        </td>
                        <td>{formatCaseDate(c.created_at, locale)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CreateCaseDialog
        open={createOpen}
        models={models}
        onClose={() => setCreateOpen(false)}
        onCreated={(caseId) => navigate(`/apps/cases/${caseId}`)}
      />
    </div>
  );
}
