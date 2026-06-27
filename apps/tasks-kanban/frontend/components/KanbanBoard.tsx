import { LuPencil, LuSiren } from 'react-icons/lu';
import type { CSSProperties } from 'react';
import { useI18n } from '@shell/i18n/I18nContext.js';
import type { components } from '@shell/api/schema.js';
import { KanbanCardView } from './KanbanCard.js';
import type { KanbanMoveDirection } from '../api.js';
import {
  createKanbanHeaderColorCounter,
  kanbanHeaderColorClass,
  nextKanbanHeaderColor,
  type KanbanHeaderColorCounter,
} from '../lib/kanban-header-colors.js';

type KanbanBoard = components['schemas']['KanbanBoard'];
type KanbanWipCell = components['schemas']['KanbanWipCell'];
type KanbanActivityColumn = components['schemas']['KanbanActivityColumn'];

function laneGridWidth(activityCount: number): string {
  const columns = Math.max(activityCount, 1) * 2;
  return `calc(${columns} * var(--kanban-col-width))`;
}

function WipBadge({
  wip,
  onEdit,
  editable,
}: {
  wip: KanbanWipCell;
  onEdit?: () => void;
  editable?: boolean;
}) {
  const { msg } = useI18n();
  const label =
    wip.limit !== null && wip.limit !== undefined
      ? `${wip.count}/${wip.limit}`
      : String(wip.count);

  return (
    <span className={`kanban-wip${wip.over ? ' kanban-wip--over' : ''}`}>
      <span className="kanban-wip-value">{label}</span>
      {wip.over ? <LuSiren size={14} className="kanban-wip-alert" aria-hidden /> : null}
      {editable ? (
        <button
          type="button"
          className="kanban-wip-edit"
          title={msg('tkbEditWip')}
          aria-label={msg('tkbEditWip')}
          onClick={onEdit}
        >
          <LuPencil size={14} />
        </button>
      ) : null}
    </span>
  );
}

function SwimlaneGrid({
  activities,
  admin,
  movingTaskId,
  deletingTaskId,
  headerColors,
  onMove,
  onDelete,
  onEditWip,
}: {
  activities: KanbanActivityColumn[];
  admin: boolean;
  movingTaskId: string | null;
  deletingTaskId: string | null;
  headerColors: KanbanHeaderColorCounter;
  onMove: (taskId: string, direction: KanbanMoveDirection) => void;
  onDelete: (taskId: string) => void;
  onEditWip: (columnKey: string, currentLimit: number | null) => void;
}) {
  const { msg } = useI18n();
  const activityCount = activities.length;
  const gridColumns = `repeat(${activityCount}, var(--kanban-col-width) var(--kanban-col-width))`;
  const laneWidth = laneGridWidth(activityCount);
  const rowStyle = { gridTemplateColumns: gridColumns, width: laneWidth } as CSSProperties;

  return (
    <div className="kanban-swimlane-grid" style={{ width: laneWidth }}>
      <div className="kanban-activity-headers" style={rowStyle}>
        {activities.map((activity) => (
          <header
            key={activity.key}
            className={`kanban-activity-header ${kanbanHeaderColorClass(nextKanbanHeaderColor(headerColors))}`}
          >
            <span>{activity.label}</span>
            <WipBadge
              wip={activity.wip}
              editable={admin}
              onEdit={() => onEditWip(activity.key, activity.wip.limit ?? null)}
            />
          </header>
        ))}
      </div>

      <div className="kanban-subheader-row" style={rowStyle}>
        {activities.map((activity) => (
          <div key={`${activity.key}-sub`} className="kanban-subheader-pair">
            <div className="kanban-subheader">{msg('tkbSubInProcess')}</div>
            <div className="kanban-subheader">{msg('tkbSubDone')}</div>
          </div>
        ))}
      </div>

      <div className="kanban-card-row" style={rowStyle}>
        {activities.map((activity) => (
          <div key={`${activity.key}-cells`} className="kanban-subcell-pair">
            <div className="kanban-subcell">
              {activity.in_process.cards.map((card) => (
                <KanbanCardView
                  key={card.id}
                  card={card}
                  onMove={onMove}
                  onDelete={onDelete}
                  busy={movingTaskId === card.id || deletingTaskId === card.id}
                />
              ))}
            </div>
            <div className="kanban-subcell">
              {activity.done.cards.map((card) => (
                <KanbanCardView
                  key={card.id}
                  card={card}
                  onMove={onMove}
                  onDelete={onDelete}
                  busy={movingTaskId === card.id || deletingTaskId === card.id}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface KanbanBoardViewProps {
  board: KanbanBoard;
  admin: boolean;
  movingTaskId: string | null;
  deletingTaskId: string | null;
  onMove: (taskId: string, direction: KanbanMoveDirection) => void;
  onDelete: (taskId: string) => void;
  onEditWip: (columnKey: string, currentLimit: number | null) => void;
}

export function KanbanBoardView({
  board,
  admin,
  movingTaskId,
  deletingTaskId,
  onMove,
  onDelete,
  onEditWip,
}: KanbanBoardViewProps) {
  const { msg } = useI18n();
  const headerColors = createKanbanHeaderColorCounter();
  const maxActivityCount =
    board.swimlanes?.reduce((max, lane) => Math.max(max, lane.activities.length), 0) ?? 0;
  const startedWrapStyle = { width: laneGridWidth(maxActivityCount) } as CSSProperties;

  if (board.layout === 'empty') {
    return (
      <div className="kanban-board kanban-board--empty">
        <section className="kanban-col">
          <header
            className={`kanban-col-header ${kanbanHeaderColorClass(nextKanbanHeaderColor(headerColors))}`}
          >
            <span>{msg('tkbColNotStarted')}</span>
            <WipBadge wip={{ count: board.not_started.cards.length, limit: null, over: false }} />
          </header>
          <div className="kanban-col-body" />
        </section>
        <section className="kanban-started">
          <div className="kanban-started-wrap" style={{ width: laneGridWidth(1) }}>
            <header
              className={`kanban-started-header ${kanbanHeaderColorClass(nextKanbanHeaderColor(headerColors))}`}
            >
              <span>{msg('tkbColStarted')}</span>
              <WipBadge
                wip={board.wip.started}
                editable={admin}
                onEdit={() => onEditWip('started', board.wip.started.limit ?? null)}
              />
            </header>
            <div className="kanban-swimlanes" />
          </div>
        </section>
        <section className="kanban-col kanban-col--completed">
          <header
            className={`kanban-col-header ${kanbanHeaderColorClass(nextKanbanHeaderColor(headerColors))}`}
          >
            <span>{msg('tkbColCompleted')}</span>
            <WipBadge wip={{ count: board.completed.cards.length, limit: null, over: false }} />
          </header>
          <div className="kanban-col-body" />
        </section>
      </div>
    );
  }

  return (
    <div className="kanban-board">
      <section className="kanban-col kanban-col--not-started">
        <header
          className={`kanban-col-header ${kanbanHeaderColorClass(nextKanbanHeaderColor(headerColors))}`}
        >
          <span>{msg('tkbColNotStarted')}</span>
          <WipBadge wip={{ count: board.not_started.cards.length, limit: null, over: false }} />
        </header>
        <div className="kanban-col-body">
          {board.not_started.cards.map((card) => (
            <KanbanCardView
              key={card.id}
              card={card}
              onMove={onMove}
              onDelete={onDelete}
              busy={movingTaskId === card.id || deletingTaskId === card.id}
            />
          ))}
        </div>
      </section>

      <section className="kanban-started">
        <div className="kanban-started-wrap" style={startedWrapStyle}>
          <header
            className={`kanban-started-header ${kanbanHeaderColorClass(nextKanbanHeaderColor(headerColors))}`}
          >
            <span>{msg('tkbColStarted')}</span>
            <WipBadge
              wip={board.wip.started}
              editable={admin}
              onEdit={() => onEditWip('started', board.wip.started.limit ?? null)}
            />
          </header>

          <div className="kanban-swimlanes">
            {board.swimlanes?.map((lane) => (
              <div key={lane.id} className="kanban-swimlane">
                <SwimlaneGrid
                  activities={lane.activities}
                  admin={admin}
                  movingTaskId={movingTaskId}
                  deletingTaskId={deletingTaskId}
                  headerColors={headerColors}
                  onMove={onMove}
                  onDelete={onDelete}
                  onEditWip={onEditWip}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="kanban-col kanban-col--completed">
        <header
          className={`kanban-col-header ${kanbanHeaderColorClass(nextKanbanHeaderColor(headerColors))}`}
        >
          <span>{msg('tkbColCompleted')}</span>
          <WipBadge wip={{ count: board.completed.cards.length, limit: null, over: false }} />
        </header>
        <div className="kanban-col-body">
          {board.completed.cards.map((card) => (
            <KanbanCardView
              key={card.id}
              card={card}
              onMove={onMove}
              onDelete={onDelete}
              busy={movingTaskId === card.id || deletingTaskId === card.id}
              interactive={false}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
