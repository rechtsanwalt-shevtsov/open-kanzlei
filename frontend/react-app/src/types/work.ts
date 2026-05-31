import type { components } from '../api/schema.js';

export type CaseInstance = components['schemas']['Case'];
export type TaskInstance = components['schemas']['Task'];
export type Assignee = components['schemas']['Assignee'];

export type WorkViewMode = 'list' | 'kanban';

export type WorkFilterKind = 'all' | 'status' | 'assignee' | 'attribute';

export interface WorkFilter {
  kind: WorkFilterKind;
  status?: string;
  assigneeUserId?: string;
  attributeKey?: string;
  attributeValue?: string;
}
