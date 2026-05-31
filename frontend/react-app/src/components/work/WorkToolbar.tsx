import { useMemo } from 'react';
import { useI18n } from '../../i18n/I18nContext.js';
import { WORK_STATUSES, workStatusLabel } from '../../lib/work-status.js';
import type { WorkFilter, WorkFilterKind, WorkViewMode } from '../../types/work.js';
import type { components } from '../../api/schema.js';

type TenantUser = components['schemas']['TenantUser'];

interface WorkToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filter: WorkFilter;
  onFilterChange: (filter: WorkFilter) => void;
  view: WorkViewMode;
  onViewChange: (view: WorkViewMode) => void;
  users: TenantUser[];
  attributeKeys: string[];
  totalCount: number;
  filteredCount: number;
}

export function WorkToolbar({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  view,
  onViewChange,
  users,
  attributeKeys,
  totalCount,
  filteredCount,
}: WorkToolbarProps) {
  const { msg } = useI18n();

  const filterSelectValue = useMemo(() => {
    if (filter.kind === 'status' && filter.status) return `status:${filter.status}`;
    if (filter.kind === 'assignee' && filter.assigneeUserId) {
      return `assignee:${filter.assigneeUserId}`;
    }
    if (filter.kind === 'attribute') return 'attribute';
    return 'all';
  }, [filter]);

  function onFilterSelect(value: string) {
    if (value === 'all') {
      onFilterChange({ kind: 'all' });
      return;
    }
    if (value === 'attribute') {
      onFilterChange({
        kind: 'attribute',
        attributeKey: attributeKeys[0] ?? '',
        attributeValue: '',
      });
      return;
    }
    if (value.startsWith('status:')) {
      onFilterChange({ kind: 'status', status: value.slice(7) });
      return;
    }
    if (value.startsWith('assignee:')) {
      onFilterChange({ kind: 'assignee', assigneeUserId: value.slice(9) });
    }
  }

  return (
    <div className="work-toolbar">
      <div className="work-toolbar-row">
        <select
          className="work-filter-select"
          value={filterSelectValue}
          onChange={(e) => onFilterSelect(e.target.value)}
          aria-label={msg('workFilter')}
        >
          <option value="all">{msg('workFilterAll')}</option>
          <optgroup label={msg('workFilterStatus')}>
            {WORK_STATUSES.map((s) => (
              <option key={s} value={`status:${s}`}>
                {workStatusLabel(s, msg)}
              </option>
            ))}
          </optgroup>
          {users.length > 0 && (
            <optgroup label={msg('workFilterAssignee')}>
              {users.map((u) => (
                <option key={u.id} value={`assignee:${u.id}`}>
                  {u.username}
                </option>
              ))}
            </optgroup>
          )}
          {attributeKeys.length > 0 && (
            <optgroup label={msg('workFilterAttribute')}>
              <option value="attribute">{msg('workFilterByAttribute')}</option>
            </optgroup>
          )}
        </select>

        <div className="work-search-wrap">
          <input
            type="search"
            className="work-search"
            placeholder={msg('search')}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="work-view-toggle" role="group" aria-label={msg('workViewMode')}>
          <button
            type="button"
            className={`work-view-btn${view === 'list' ? ' work-view-btn--active' : ''}`}
            onClick={() => onViewChange('list')}
            title={msg('workViewList')}
            aria-pressed={view === 'list'}
          >
            <span className="work-view-icon" aria-hidden>
              ☰
            </span>
          </button>
          <button
            type="button"
            className={`work-view-btn${view === 'kanban' ? ' work-view-btn--active' : ''}`}
            onClick={() => onViewChange('kanban')}
            title={msg('workViewKanban')}
            aria-pressed={view === 'kanban'}
          >
            <span className="work-view-icon" aria-hidden>
              ▦
            </span>
          </button>
        </div>
      </div>

      {filter.kind === 'attribute' && (
        <div className="work-toolbar-row work-toolbar-row--secondary">
          <select
            className="work-filter-select"
            value={filter.attributeKey ?? ''}
            onChange={(e) =>
              onFilterChange({ ...filter, kind: 'attribute' as WorkFilterKind, attributeKey: e.target.value })
            }
          >
            {attributeKeys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <input
            type="text"
            className="work-search"
            placeholder={msg('workAttributeValue')}
            value={filter.attributeValue ?? ''}
            onChange={(e) =>
              onFilterChange({ ...filter, kind: 'attribute', attributeValue: e.target.value })
            }
          />
        </div>
      )}

      <p className="work-count" aria-live="polite">
        {filteredCount === totalCount
          ? `${totalCount}`
          : `${filteredCount} / ${totalCount}`}
      </p>
    </div>
  );
}
