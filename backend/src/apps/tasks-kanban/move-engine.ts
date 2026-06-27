import { badRequest } from '../../api/errors.js';
import {
  ACTIVITY_NOT_SET,
  ACTIVITY_STATUS_DONE,
  ACTIVITY_STATUS_IN_PROCESS,
  type KanbanMoveDirection,
} from './constants.js';
import { activityColumnKeys, firstActivityKey } from './activity-helpers.js';

export interface TaskKanbanState {
  status: string;
  activity: string;
  activity_status: string;
}

export function applyKanbanMove(
  state: TaskKanbanState,
  direction: KanbanMoveDirection,
  selectOptions: string[],
): TaskKanbanState {
  const columns = activityColumnKeys(selectOptions);
  const first = firstActivityKey(selectOptions);
  if (!first) {
    throw badRequest('error.validation_failed');
  }

  if (direction === 'goal') {
    return {
      status: 'completed',
      activity: ACTIVITY_NOT_SET,
      activity_status: ACTIVITY_STATUS_DONE,
    };
  }

  if (state.status === 'not_started') {
    if (direction === 'left') {
      throw badRequest('error.validation_failed');
    }
    return {
      status: 'started',
      activity: first,
      activity_status: ACTIVITY_STATUS_IN_PROCESS,
    };
  }

  if (state.status === 'completed') {
    throw badRequest('error.validation_failed');
  }

  const activityIdx = columns.indexOf(state.activity);
  const resolvedActivity = activityIdx === -1 ? first : state.activity;
  const resolvedIdx = activityIdx === -1 ? 0 : activityIdx;

  if (direction === 'right') {
    if (state.activity_status === ACTIVITY_STATUS_IN_PROCESS) {
      return {
        status: 'started',
        activity: resolvedActivity,
        activity_status: ACTIVITY_STATUS_DONE,
      };
    }
    if (resolvedIdx < columns.length - 1) {
      return {
        status: 'started',
        activity: columns[resolvedIdx + 1]!,
        activity_status: ACTIVITY_STATUS_IN_PROCESS,
      };
    }
    return {
      status: 'completed',
      activity: ACTIVITY_NOT_SET,
      activity_status: ACTIVITY_STATUS_DONE,
    };
  }

  if (state.activity_status === ACTIVITY_STATUS_DONE) {
    return {
      status: 'started',
      activity: resolvedActivity,
      activity_status: ACTIVITY_STATUS_IN_PROCESS,
    };
  }

  if (resolvedIdx > 0) {
    return {
      status: 'started',
      activity: columns[resolvedIdx - 1]!,
      activity_status: ACTIVITY_STATUS_DONE,
    };
  }

  return {
    status: 'not_started',
    activity: ACTIVITY_NOT_SET,
    activity_status: ACTIVITY_STATUS_IN_PROCESS,
  };
}

export function repairKanbanState(
  state: TaskKanbanState,
  selectOptions: string[],
): TaskKanbanState | null {
  const first = firstActivityKey(selectOptions);
  if (!first) return null;

  if (state.status === 'started' && state.activity === ACTIVITY_NOT_SET) {
    return {
      status: 'started',
      activity: first,
      activity_status:
        state.activity_status === ACTIVITY_STATUS_DONE
          ? ACTIVITY_STATUS_DONE
          : ACTIVITY_STATUS_IN_PROCESS,
    };
  }
  return null;
}
