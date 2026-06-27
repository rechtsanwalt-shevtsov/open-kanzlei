import {
  LuArrowBigLeft,
  LuArrowBigRight,
  LuGoal,
  LuTrash2,
} from 'react-icons/lu';
import { useI18n } from '@shell/i18n/I18nContext.js';
import type { components } from '@shell/api/schema.js';
import type { KanbanMoveDirection } from '../api.js';

type KanbanCard = components['schemas']['KanbanCard'];

interface KanbanCardProps {
  card: KanbanCard;
  onMove: (taskId: string, direction: KanbanMoveDirection) => void;
  onDelete: (taskId: string) => void;
  busy?: boolean;
  interactive?: boolean;
}

export function KanbanCardView({ card, onMove, onDelete, busy, interactive = true }: KanbanCardProps) {
  const { msg } = useI18n();

  return (
    <article className="kanban-card">
      <div className="kanban-card-side kanban-card-side--left">
        <span className="kanban-card-weight">{card.weight ?? '—'}</span>
        <button
          type="button"
          className="kanban-card-nav"
          title={msg('tkbMoveLeft')}
          aria-label={msg('tkbMoveLeft')}
          disabled={busy || !interactive}
          onClick={() => onMove(card.id, 'left')}
        >
          <LuArrowBigLeft size={20} />
        </button>
      </div>

      <div className="kanban-card-main">
        <div className="kanban-card-titles">
          <strong className="kanban-card-title">{card.title || '—'}</strong>
          <span className="kanban-card-case">{card.case_title || '—'}</span>
          <span className="kanban-card-assignee">
            {card.assignee_usernames.join(', ') || '—'}
          </span>
        </div>
        <div className="kanban-card-actions">
          <button
            type="button"
            className="kanban-card-goal"
            title={msg('tkbMoveGoal')}
            aria-label={msg('tkbMoveGoal')}
            disabled={busy || !interactive}
            onClick={() => onMove(card.id, 'goal')}
          >
            <LuGoal size={18} />
          </button>
          <button
            type="button"
            className="kanban-card-delete"
            title={msg('tkbDeleteTask')}
            aria-label={msg('tkbDeleteTask')}
            disabled={busy}
            onClick={() => onDelete(card.id)}
          >
            <LuTrash2 size={18} />
          </button>
        </div>
      </div>

      <div className="kanban-card-side kanban-card-side--right">
        <span className="kanban-card-due">{card.due_date ?? '—'}</span>
        <button
          type="button"
          className="kanban-card-nav"
          title={msg('tkbMoveRight')}
          aria-label={msg('tkbMoveRight')}
          disabled={busy || !interactive}
          onClick={() => onMove(card.id, 'right')}
        >
          <LuArrowBigRight size={20} />
        </button>
      </div>

      {card.open_dependent_tasks.length > 0 ? (
        <div className="kanban-card-sticker">
          {card.open_dependent_tasks.map((dep) => (
            <div key={dep.id} className="kanban-card-sticker-line">
              {dep.title}
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}
