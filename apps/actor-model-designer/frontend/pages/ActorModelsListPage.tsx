import { useEffect, useMemo, useRef, useState } from 'react';
import { LuArrowDown, LuArrowUp, LuChevronDown, LuChevronLeft, LuChevronRight, LuSettings } from 'react-icons/lu';
import { Link } from 'react-router-dom';
import { api, apiHeaders } from '@shell/api/client.js';
import { useI18n } from '@shell/i18n/I18nContext.js';
import { labelFromTranslations } from '@shell/lib/model-label.js';
import { useEffectiveSettings } from '../hooks/useEffectiveSettings.js';
import { actorModelStatusLabel } from '../lib/actor-model-status.js';
import type { components } from '@shell/api/schema.js';

type ActorModel = components['schemas']['ActorModel'];
type SortColumn = 'name' | 'description' | 'status';
type SortDirection = 'asc' | 'desc';

export function ActorModelsListPage() {
  const { locale, msg } = useI18n();
  const { settings, loading: settingsLoading } = useEffectiveSettings();
  const [items, setItems] = useState<ActorModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [actionsOpen, setActionsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const actionsRef = useRef<HTMLDivElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const itemsPerPage = Math.max(5, Number(settings.itemsPerPage) || 25);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await api.GET('/v1/actor-models', { headers: apiHeaders(locale) });
    if (res.error) {
      const err = res.error as { message?: string };
      setError(err?.message ?? msg('errorGeneric'));
      setLoading(false);
      return;
    }
    setItems(res.data?.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [locale]);

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

  function modelLabel(m: ActorModel): string {
    return m.display_name ?? labelFromTranslations(m.translations, m.key, locale);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((m) => {
      const label = modelLabel(m).toLowerCase();
      const desc = (m.description ?? '').toLowerCase();
      const statusLabel = actorModelStatusLabel(m.status, msg).toLowerCase();
      return (
        label.includes(q) ||
        desc.includes(q) ||
        m.key.toLowerCase().includes(q) ||
        statusLabel.includes(q)
      );
    });
  }, [items, search, locale, msg]);

  const sorted = useMemo(() => {
    if (!sortColumn) return filtered;
    const list = [...filtered];
    const dir = sortDirection === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (sortColumn === 'name') {
        return dir * modelLabel(a).localeCompare(modelLabel(b), locale);
      }
      if (sortColumn === 'status') {
        return (
          dir *
          actorModelStatusLabel(a.status, msg).localeCompare(
            actorModelStatusLabel(b.status, msg),
            locale,
          )
        );
      }
      return dir * (a.description ?? '').localeCompare(b.description ?? '', locale);
    });
    return list;
  }, [filtered, sortColumn, sortDirection, locale, msg]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / itemsPerPage));
  const pageItems = sorted.slice(page * itemsPerPage, page * itemsPerPage + itemsPerPage);
  const pageIds = useMemo(
    () => pageItems.filter((m) => !m.is_system).map((m) => m.id),
    [pageItems],
  );
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));
  const colCount = 4;
  const rangeFrom = sorted.length === 0 ? 0 : page * itemsPerPage + 1;
  const rangeTo = Math.min(sorted.length, page * itemsPerPage + pageItems.length);
  const pageRangeLabel = msg('amdPageRange')
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

  async function handleBulkDelete() {
    setActionsOpen(false);
    if (selectedIds.size === 0 || deleting) return;
    if (!window.confirm(msg('amdBulkDeleteConfirm'))) return;

    setDeleting(true);
    setError(null);
    const ids = [...selectedIds];

    try {
      const results = await Promise.all(
        ids.map((id) =>
          api.DELETE('/v1/actor-models/{id}', {
            headers: apiHeaders(locale),
            params: { path: { id } },
          }),
        ),
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
        for (const [i, id] of ids.entries()) {
          if (!results[i]?.error && results[i]?.response.ok) next.delete(id);
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
        <h1 className="admin-page-title">{msg('amdAppTitle')}</h1>
        <div className="admin-toolbar">
          <Link to="/apps/actor-model-designer/new" className="button-outline">
            + {msg('amdCreate')}
          </Link>
          <Link to="/apps/actor-model-designer/groups" className="button-outline">
            {msg('teamsTitle')}
          </Link>
          <Link
            to="/apps/actor-model-designer/settings"
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
                    {msg('amdActions')}
                    <LuChevronDown size={14} aria-hidden />
                  </button>
                  {actionsOpen && (
                    <div className="admin-bulk-actions-menu" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        className="admin-bulk-actions-menu--danger"
                        disabled={deleting}
                        onClick={handleBulkDelete}
                      >
                        {msg('amdBulkDelete')}
                      </button>
                    </div>
                  )}
                </div>
                <span className="admin-list-toolbar-meta">
                  {msg('amdSelectedCount').replace('{count}', String(selectedIds.size))}
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
              aria-label={msg('amdPrevPage')}
            >
              <LuChevronLeft size={16} aria-hidden />
            </button>
            <span>{pageRangeLabel}</span>
            <button
              type="button"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => p + 1)}
              aria-label={msg('amdNextPage')}
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
            <table className="admin-table admin-table--fixed-cols admin-table--actor-models-list">
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
                        aria-label={msg('amdSelectAll')}
                      />
                    )}
                  </th>
                  <th
                    className="cmd-col-name"
                    aria-sort={sortColumn === 'name' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button
                      type="button"
                      className="admin-table-sort"
                      onClick={() => handleSortColumn('name')}
                    >
                      {msg('amdColName')}
                      {sortIcon('name')}
                    </button>
                  </th>
                  <th
                    className="cmd-col-description"
                    aria-sort={
                      sortColumn === 'description'
                        ? sortDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="admin-table-sort"
                      onClick={() => handleSortColumn('description')}
                    >
                      {msg('amdColDescription')}
                      {sortIcon('description')}
                    </button>
                  </th>
                  <th
                    className="admin-table-col-status"
                    aria-sort={
                      sortColumn === 'status'
                        ? sortDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="admin-table-sort"
                      onClick={() => handleSortColumn('status')}
                    >
                      {msg('workColStatus')}
                      {sortIcon('status')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={colCount}>{msg('amdEmpty')}</td>
                  </tr>
                ) : (
                  pageItems.map((m) => {
                    const selected = selectedIds.has(m.id);
                    return (
                      <tr
                        key={m.id}
                        className={selected ? 'admin-table-row--selected' : undefined}
                      >
                        <td className="admin-table-col-check">
                          {!m.is_system && (
                            <input
                              type="checkbox"
                              className="admin-table-checkbox"
                              checked={selected}
                              onChange={() => toggleSelect(m.id)}
                              aria-label={modelLabel(m)}
                            />
                          )}
                        </td>
                        <td className="cmd-col-name">
                          <Link to={`/apps/actor-model-designer/${m.id}`}>{modelLabel(m)}</Link>
                        </td>
                        <td className="cmd-col-description">{m.description?.trim() || '—'}</td>
                        <td className="admin-table-col-status">
                          {actorModelStatusLabel(m.status, msg)}
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
    </div>
  );
}
