import type { TaskKanbanState } from './move-engine.js';

export interface KanbanTaskRow {
  id: string;
  case_id: string;
  task_model_id: string;
  status: string;
  dependent_task_ids: string[];
  created_at: Date;
  completed_at: Date | null;
  title: string;
  weight: number | null;
  due_date: string | null;
  activity: string;
  activity_status: string;
  assignee_usernames: string[];
}

export type KanbanPlacement =
  | { kind: 'not_started' }
  | { kind: 'completed' }
  | { kind: 'activity'; swimlane_id: string; activity: string; sub: 'in_process' | 'done' };

export function placementForTask(
  state: TaskKanbanState,
  swimlaneId: string,
): KanbanPlacement {
  if (state.status === 'not_started') {
    return { kind: 'not_started' };
  }
  if (state.status === 'completed') {
    return { kind: 'completed' };
  }
  return {
    kind: 'activity',
    swimlane_id: swimlaneId,
    activity: state.activity,
    sub: state.activity_status === 'done' ? 'done' : 'in_process',
  };
}

export function sortKanbanTasks<T extends { weight: number | null; created_at: Date; title: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const wa = a.weight;
    const wb = b.weight;
    if (wa !== null && wb !== null && wa !== wb) return wb - wa;
    if (wa !== null && wb === null) return -1;
    if (wa === null && wb !== null) return 1;
    const ta = a.created_at.getTime();
    const tb = b.created_at.getTime();
    if (ta !== tb) return ta - tb;
    return a.title.localeCompare(b.title, 'de');
  });
}

export function sortCompletedKanbanTasks<
  T extends { completed_at: Date | null; title: string },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ca = a.completed_at?.getTime() ?? 0;
    const cb = b.completed_at?.getTime() ?? 0;
    if (ca !== cb) return cb - ca;
    return a.title.localeCompare(b.title, 'de');
  });
}

export function taskMatchesSearch(
  task: KanbanTaskRow,
  caseTitle: string,
  activityLabel: string,
  search: string,
): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    task.title,
    caseTitle,
    ...task.assignee_usernames,
    task.activity,
    activityLabel,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export interface WipCounts {
  started: number;
  activities: Record<string, number>;
}

export function countWipForTasks(
  tasks: Array<{ status: string; activity: string }>,
): WipCounts {
  const counts: WipCounts = { started: 0, activities: {} };
  for (const task of tasks) {
    if (task.status === 'started') {
      counts.started += 1;
      if (task.activity) {
        counts.activities[task.activity] = (counts.activities[task.activity] ?? 0) + 1;
      }
    }
  }
  return counts;
}

export function countWipAfterMove(
  tasks: Array<{ id: string; status: string; activity: string }>,
  taskId: string,
  next: TaskKanbanState,
): WipCounts {
  const simulated = tasks.map((t) =>
    t.id === taskId ? { status: next.status, activity: next.activity } : t,
  );
  return countWipForTasks(simulated);
}

export function isWipExceeded(count: number, limit: number | null): boolean {
  if (limit === null) return false;
  return count > limit;
}
