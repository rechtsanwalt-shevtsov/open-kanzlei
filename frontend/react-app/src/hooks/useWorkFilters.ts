import { useMemo } from 'react';
import type { Assignee } from '../types/work.js';
import { attributeSearchText, instanceTitle } from '../lib/work-instance.js';
import { normalizeWorkStatus } from '../lib/work-status.js';
import type { WorkFilter } from '../types/work.js';

interface FilterableItem {
  id: string;
  status: string;
  attributes?: Record<string, unknown>;
  assignees?: Assignee[];
}

export function useWorkFilters<T extends FilterableItem>(
  items: T[],
  search: string,
  filter: WorkFilter,
  titleFor: (item: T) => string,
): T[] {
  return useMemo(() => {
    const q = search.trim().toLowerCase();

    return items.filter((item) => {
      if (filter.kind === 'status' && filter.status) {
        if (normalizeWorkStatus(item.status) !== normalizeWorkStatus(filter.status)) {
          return false;
        }
      }
      if (filter.kind === 'assignee' && filter.assigneeUserId) {
        const ids = (item.assignees ?? []).map((a) => a.user_id);
        if (!ids.includes(filter.assigneeUserId)) return false;
      }
      if (filter.kind === 'attribute' && filter.attributeKey) {
        const val = item.attributes?.[filter.attributeKey];
        const needle = (filter.attributeValue ?? '').trim().toLowerCase();
        if (needle) {
          if (String(val ?? '').toLowerCase() !== needle) return false;
        } else if (val === undefined || val === null || val === '') {
          return false;
        }
      }

      if (!q) return true;

      const title = titleFor(item).toLowerCase();
      const attrs = attributeSearchText(item.attributes);
      const assignees = (item.assignees ?? []).map((a) => a.username).join(' ').toLowerCase();
      return title.includes(q) || attrs.includes(q) || assignees.includes(q);
    });
  }, [items, search, filter, titleFor]);
}

export function defaultTitle(
  item: FilterableItem,
  modelLabel: string,
): string {
  return instanceTitle(item.attributes, `${modelLabel} (${item.id.slice(0, 8)})`);
}
