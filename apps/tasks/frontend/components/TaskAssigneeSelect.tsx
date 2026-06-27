import { api, apiJsonHeaders } from '@shell/api/client.js';
import { useI18n } from '@shell/i18n/I18nContext.js';
import type { Locale } from '@shell/i18n/locale.js';
import type { components } from '@shell/api/schema.js';

type Assignee = components['schemas']['Assignee'];
type TaskItem = components['schemas']['Task'];

type ActorOption = { id: string; label: string };

interface TaskAssigneeSelectProps {
  taskId: string;
  assignees: Assignee[];
  actors: ActorOption[];
  locale: Locale;
  disabled?: boolean;
  saving?: boolean;
  onSavingChange?: (saving: boolean) => void;
  onUpdated: (task: TaskItem) => void;
  className?: string;
}

export function TaskAssigneeSelect({
  taskId,
  assignees,
  actors,
  locale,
  disabled,
  saving,
  onSavingChange,
  onUpdated,
  className = 'admin-table-inline-input',
}: TaskAssigneeSelectProps) {
  const { msg } = useI18n();
  const currentUserId = assignees[0]?.actor_id ?? '';

  async function handleChange(nextUserId: string) {
    onSavingChange?.(true);
    const res = await api.PATCH('/v1/tasks/{id}', {
      headers: apiJsonHeaders(locale),
      params: { path: { id: taskId } },
      body: {
        assignee_actor_ids: nextUserId ? [nextUserId] : [],
      },
    });
    onSavingChange?.(false);
    if (!res.error && res.response.ok && res.data) {
      onUpdated(res.data);
    }
  }

  return (
    <select
      className={className}
      value={currentUserId}
      disabled={disabled || saving}
      onChange={(e) => void handleChange(e.target.value)}
      aria-label={msg('tasColAssignee')}
    >
      <option value="">{msg('tasAssigneeNone')}</option>
      {actors.map((actor) => (
        <option key={actor.id} value={actor.id}>
          {actor.label}
        </option>
      ))}
    </select>
  );
}
