import { StatusBadge } from './StatusBadge.js';
import { AssigneeAvatars } from './AssigneeAvatars.js';
import type { Assignee } from '../../types/work.js';
import { useI18n } from '../../i18n/I18nContext.js';

export interface WorkListRow {
  id: string;
  title: string;
  status: string;
  subtitle?: string;
  assignees: Assignee[];
}

interface WorkListViewProps {
  rows: WorkListRow[];
  emptyMessage: string;
}

export function WorkListView({ rows, emptyMessage }: WorkListViewProps) {
  const { msg } = useI18n();

  if (rows.length === 0) {
    return <p className="work-empty">{emptyMessage}</p>;
  }

  return (
    <div className="work-table-wrap">
      <table className="work-table">
        <thead>
          <tr>
            <th scope="col">{msg('workColName')}</th>
            <th scope="col">{msg('workColStatus')}</th>
            {rows.some((r) => r.subtitle) && <th scope="col">{msg('workColCase')}</th>}
            <th scope="col">{msg('workColAssignees')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <span className="work-row-title">{row.title}</span>
              </td>
              <td>
                <StatusBadge status={row.status} />
              </td>
              {rows.some((r) => r.subtitle) && (
                <td className="work-muted">{row.subtitle ?? '—'}</td>
              )}
              <td>
                <AssigneeAvatars assignees={row.assignees} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
