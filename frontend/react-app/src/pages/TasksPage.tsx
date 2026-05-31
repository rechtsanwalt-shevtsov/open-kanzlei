import { useCallback, useMemo, useState } from 'react';
import { CreateTaskDialog } from '../components/work/CreateTaskDialog.js';
import { WorkKanbanView } from '../components/work/WorkKanbanView.js';
import { WorkListView } from '../components/work/WorkListView.js';
import { WorkToolbar } from '../components/work/WorkToolbar.js';
import { useCases } from '../hooks/useCases.js';
import { useModelOptions } from '../hooks/useModelOptions.js';
import { useTasks } from '../hooks/useTasks.js';
import { defaultTitle, useWorkFilters } from '../hooks/useWorkFilters.js';
import { useTenantUsers } from '../hooks/useTenantUsers.js';
import { useI18n } from '../i18n/I18nContext.js';
import type { CaseInstance } from '../types/work.js';
import type { WorkFilter, WorkViewMode } from '../types/work.js';

export function TasksPage() {
  const { msg } = useI18n();
  const { items, loading, error, refresh } = useTasks();
  const { items: cases, refresh: refreshCases } = useCases();
  const { options: taskModels } = useModelOptions('task');
  const { options: caseModels } = useModelOptions('case');
  const { items: users } = useTenantUsers();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<WorkFilter>({ kind: 'all' });
  const [view, setView] = useState<WorkViewMode>('list');
  const [createOpen, setCreateOpen] = useState(false);

  const caseModelLabels = useMemo(
    () => new Map(caseModels.map((m) => [m.id, m.label])),
    [caseModels],
  );
  const taskModelLabels = useMemo(
    () => new Map(taskModels.map((m) => [m.id, m.label])),
    [taskModels],
  );

  const caseTitleFor = useCallback(
    (c: CaseInstance) =>
      defaultTitle(c, caseModelLabels.get(c.case_model_id) ?? msg('workCase')),
    [caseModelLabels, msg],
  );

  const caseTitles = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of cases) map.set(c.id, caseTitleFor(c));
    return map;
  }, [cases, caseTitleFor]);

  const titleFor = useCallback(
    (item: (typeof items)[0]) =>
      defaultTitle(item, taskModelLabels.get(item.task_model_id) ?? msg('navTasks')),
    [taskModelLabels, msg],
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
    subtitle: caseTitles.get(item.case_id),
    assignees: item.assignees ?? [],
  }));

  return (
    <div className="work-page">
      <header className="work-page-header">
        <h1>{msg('navTasks')}</h1>
        <button type="button" className="button-secondary" onClick={() => setCreateOpen(true)}>
          + {msg('workCreateTask')}
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
        <WorkListView rows={listRows} emptyMessage={msg('workEmptyTasks')} />
      )}
      {!loading && !error && view === 'kanban' && (
        <WorkKanbanView cards={listRows} emptyMessage={msg('workEmptyTasks')} />
      )}

      <CreateTaskDialog
        open={createOpen}
        models={taskModels}
        cases={cases}
        caseTitleFor={caseTitleFor}
        users={users}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          void refresh();
          void refreshCases();
        }}
      />
    </div>
  );
}
