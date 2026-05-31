import { WORK_STATUSES, workStatusLabel } from '../../lib/work-status.js';
import { useI18n } from '../../i18n/I18nContext.js';
import type { Assignee } from '../../types/work.js';
import { normalizeWorkStatus } from '../../lib/work-status.js';

export interface WorkKanbanCard {
  id: string;
  title: string;
  status: string;
  subtitle?: string;
  assignees: Assignee[];
}

interface WorkKanbanViewProps {
  cards: WorkKanbanCard[];
  emptyMessage: string;
}

export function WorkKanbanView({ cards, emptyMessage }: WorkKanbanViewProps) {
  const { msg } = useI18n();

  if (cards.length === 0) {
    return <p className="work-empty">{emptyMessage}</p>;
  }

  const byStatus = new Map<string, WorkKanbanCard[]>();
  for (const s of WORK_STATUSES) byStatus.set(s, []);
  for (const card of cards) {
    const key = normalizeWorkStatus(card.status);
    const list = byStatus.get(key) ?? byStatus.get('not_started')!;
    list.push(card);
  }

  return (
    <div className="work-kanban">
      {WORK_STATUSES.map((status) => {
        const columnCards = byStatus.get(status) ?? [];
        return (
          <section key={status} className={`work-kanban-col work-kanban-col--${status}`}>
            <header className="work-kanban-col-header">
              <h3>{workStatusLabel(status, msg)}</h3>
              <span className="work-kanban-count">{columnCards.length}</span>
            </header>
            <ul className="work-kanban-cards">
              {columnCards.map((card) => (
                <li key={card.id} className="work-kanban-card">
                  <p className="work-kanban-card-title">{card.title}</p>
                  {card.subtitle && <p className="work-kanban-card-sub">{card.subtitle}</p>}
                  {card.assignees.length > 0 && (
                    <p className="work-kanban-card-meta">
                      {card.assignees.map((a) => a.username).join(', ')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
