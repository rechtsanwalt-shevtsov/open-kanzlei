import type { Assignee } from '../../types/work.js';

function initials(username: string): string {
  const parts = username.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return username.slice(0, 2).toUpperCase();
}

export function AssigneeAvatars({ assignees }: { assignees: Assignee[] }) {
  if (assignees.length === 0) {
    return <span className="work-assignees work-assignees--empty">—</span>;
  }

  return (
    <div className="work-assignees">
      {assignees.map((a) => (
        <span key={a.actor_id} className="work-assignee" title={a.label}>
          <span className="work-assignee-avatar" aria-hidden>
            {initials(a.label)}
          </span>
          <span className="work-assignee-name">{a.label}</span>
        </span>
      ))}
    </div>
  );
}
