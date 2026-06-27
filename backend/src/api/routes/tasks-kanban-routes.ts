import type { FastifyInstance, FastifyRequest } from 'fastify';
import { badRequest, notFound } from '../../api/errors.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import * as appService from '../../platform/apps/app-service.js';
import {
  executeKanbanMove,
  getKanbanBoard,
  patchUserWipLimit,
} from '../../apps/tasks-kanban/board-service.js';
import { TASKS_KANBAN_APP_KEY, type KanbanMoveDirection } from '../../apps/tasks-kanban/constants.js';

const auth = { preHandler: requireAuth };
const admin = { preHandler: requireAdmin };

function ctx(request: FastifyRequest) {
  const user = request.user!;
  return { tenantId: user.tenantId, userId: user.id };
}

async function assertKanbanAccess(tenantId: string, userId: string): Promise<void> {
  await appService.assertUserCanAccessApp(tenantId, userId, TASKS_KANBAN_APP_KEY);
}

export async function tasksKanbanRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/apps/tasks-kanban/board', auth, async (req) => {
    const { tenantId, userId } = ctx(req);
    await assertKanbanAccess(tenantId, userId);
    const query = req.query as { assignee_actor_id?: string; search?: string };
    const assigneeUserId = query.assignee_actor_id?.trim() || userId;
    return getKanbanBoard(tenantId, userId, assigneeUserId, query.search, req.locale);
  });

  app.post('/v1/apps/tasks-kanban/moves', auth, async (req) => {
    const { tenantId, userId } = ctx(req);
    await assertKanbanAccess(tenantId, userId);
    const body = (req.body ?? {}) as {
      assignee_actor_id?: string;
      task_id?: string;
      direction?: string;
    };
    if (!body.task_id || !body.direction) {
      throw badRequest('error.validation_failed');
    }
    if (body.direction !== 'left' && body.direction !== 'right' && body.direction !== 'goal') {
      throw badRequest('error.validation_failed');
    }
    const assigneeUserId = body.assignee_actor_id?.trim() || userId;
    return executeKanbanMove(
      tenantId,
      assigneeUserId,
      body.task_id,
      body.direction as KanbanMoveDirection,
      req.locale,
    );
  });

  app.patch('/v1/apps/tasks-kanban/wip-limits', admin, async (req) => {
    const { tenantId } = ctx(req);
    const body = (req.body ?? {}) as {
      assignee_actor_id?: string;
      column_key?: string;
      limit?: number | null;
    };
    if (!body.assignee_actor_id || !body.column_key) {
      throw badRequest('error.validation_failed');
    }
    const manifest = await import('../../platform/apps/registry.js').then((m) =>
      m.getAppManifest(TASKS_KANBAN_APP_KEY),
    );
    if (!manifest) throw notFound();

    await appService.assertUserCanAccessApp(tenantId, req.user!.id, TASKS_KANBAN_APP_KEY);

    const limit =
      body.limit === null || body.limit === undefined ? null : Number(body.limit);
    if (limit !== null && (!Number.isFinite(limit) || limit < 0)) {
      throw badRequest('error.validation_failed');
    }

    const limits = await patchUserWipLimit(
      tenantId,
      body.assignee_actor_id,
      body.column_key,
      limit,
    );
    return { assignee_actor_id: body.assignee_actor_id, limits };
  });
}
