export type KanbanHeaderColorCounter = { n: number };

export function createKanbanHeaderColorCounter(): KanbanHeaderColorCounter {
  return { n: 0 };
}

/** Returns 1–10, cycling when more than 10 column headers are rendered. */
export function nextKanbanHeaderColor(counter: KanbanHeaderColorCounter): number {
  const slot = counter.n % 10;
  counter.n += 1;
  return slot + 1;
}

export function kanbanHeaderColorClass(colorIndex: number): string {
  return `kanban-header-accent kanban-header--c${colorIndex}`;
}
