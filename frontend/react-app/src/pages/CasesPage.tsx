import { useCallback, useMemo, useState } from 'react';
import { CreateCaseDialog } from '../components/work/CreateCaseDialog.js';
import { WorkKanbanView } from '../components/work/WorkKanbanView.js';
import { WorkListView } from '../components/work/WorkListView.js';
import { WorkToolbar } from '../components/work/WorkToolbar.js';
import { useCases } from '../hooks/useCases.js';
import { useModelOptions } from '../hooks/useModelOptions.js';
import { defaultTitle, useWorkFilters } from '../hooks/useWorkFilters.js';
import { useTenantUsers } from '../hooks/useTenantUsers.js';
import { useI18n } from '../i18n/I18nContext.js';
import type { WorkFilter, WorkViewMode } from '../types/work.js';

export function CasesPage() {
  const { msg } = useI18n();
  const { items, loading, error, refresh } = useCases();
  const { options: models } = useModelOptions('case');
  const { items: users } = useTenantUsers();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<WorkFilter>({ kind: 'all' });
  const [view, setView] = useState<WorkViewMode>('list');
  const [createOpen, setCreateOpen] = useState(false);

  const modelLabels = useMemo(() => new Map(models.map((m) => [m.id, m.label])), [models]);

  const titleFor = useCallback(
    (item: (typeof items)[0]) =>
      defaultTitle(item, modelLabels.get(item.case_model_id) ?? msg('workCase')),
    [modelLabels, msg],
  );

  const filtered = useWorkFilters(items, search, filter, titleFor);

  const attributeKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const item of items) {
      if (item.attributes) {
        for (const k of Object.keys(item.attributes)) {
          if (k !== 'status') keys.add(k);
        }
      }
    }
    return [...keys].sort();
  }, [items]);

  const listRows = filtered.map((item) => ({
    id: item.id,
    title: titleFor(item),
    status: item.status,
    assignees: item.assignees ?? [],
  }));

  const kanbanCards = listRows;

  return (
    <div className="work-page">
      <header className="work-page-header">
        <h1>{msg('navCases')}</h1>
        <button type="button" className="button-secondary" onClick={() => setCreateOpen(true)}>
          + {msg('workCreateCase')}
        </button>
      </header>

      <WorkToolbar
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        onFilterChange={setFilter}
        view={view}
        onViewChange={setView}
        users={users}
        attributeKeys={attributeKeys}
        totalCount={items.length}
        filteredCount={filtered.length}
      />

      {loading && <p>{msg('loading')}</p>}
      {error && <p className="form-error">{error}</p>}
      {!loading && !error && view === 'list' && (
        <WorkListView rows={listRows} emptyMessage={msg('workEmptyCases')} />
      )}
      {!loading && !error && view === 'kanban' && (
        <WorkKanbanView cards={kanbanCards} emptyMessage={msg('workEmptyCases')} />
      )}

      <CreateCaseDialog
        open={createOpen}
        models={models}
        users={users}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void refresh()}
      />
    </div>
  );
}
