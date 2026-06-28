import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AppError, notFound } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { enrichAttributeDefinition } from '../../legal-work/attributes.js';
import * as models from '../../legal-work/models.js';
import * as instances from '../../legal-work/instances.js';
import * as taskModels from '../../legal-work/task-models.js';
import * as tasks from '../../legal-work/tasks.js';
import * as actorModels from '../../legal-work/actor-models.js';
import * as actors from '../../legal-work/actors.js';
import * as messageModels from '../../legal-work/message-models.js';
import * as messages from '../../legal-work/messages.js';
import * as exclusions from '../../legal-work/case-model-task-exclusions.js';
import { bootstrapActorTenantData } from '../../legal-work/actor-tenant-seed.js';

function ctx(request: FastifyRequest) {
  const user = request.user!;
  return { tenantId: user.tenantId, userId: user.id };
}

function idParam(request: FastifyRequest): string {
  return (request.params as { id: string }).id;
}

function caseIdParam(request: FastifyRequest): string {
  return (request.params as { caseId: string }).caseId;
}

async function handle<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw err;
  }
}

export async function legalRoutes(app: FastifyInstance): Promise<void> {
  const auth = { preHandler: requireAuth };

  // Case models
  app.get('/v1/case-models', auth, async (req) => {
    const items = await handle(() => models.listCaseModels(ctx(req).tenantId));
    return { items: items.map((item) => models.enrichCaseModel(item, req.locale)) };
  });

  app.post('/v1/case-models', auth, async (req, reply) => {
    const { tenantId, userId } = ctx(req);
    const body = req.body as models.CreateCaseModelInput;
    const item = await handle(() =>
      models.createCaseModel(tenantId, body, { defaultLocale: req.locale, actorId: userId }),
    );
    return reply.status(201).send(models.enrichCaseModel(item, req.locale));
  });

  app.get('/v1/case-models/:id', auth, async (req) => {
    const item = await handle(() => models.getCaseModel(ctx(req).tenantId, idParam(req)));
    if (!item) throw notFound();
    return models.enrichCaseModel(item, req.locale);
  });

  app.patch('/v1/case-models/:id', auth, async (req) => {
    const { tenantId, userId } = ctx(req);
    const body = req.body as models.UpdateCaseModelInput;
    const item = await handle(() =>
      models.updateCaseModel(tenantId, idParam(req), body, {
        defaultLocale: req.locale,
        actorId: userId,
      }),
    );
    return models.enrichCaseModel(item, req.locale);
  });

  app.delete('/v1/case-models/:id', auth, async (req, reply) => {
    const { tenantId, userId } = ctx(req);
    await handle(() => models.deleteCaseModel(tenantId, idParam(req), userId));
    return reply.status(204).send();
  });

  app.get('/v1/case-models/:id/attributes', auth, async (req) => {
    const q = req.query as { definition_scope?: string };
    const scope =
      q.definition_scope === 'model' || q.definition_scope === 'instance'
        ? q.definition_scope
        : undefined;
    const items = await handle(() =>
      models.listCaseModelAttributes(ctx(req).tenantId, idParam(req), scope),
    );
    return { items: items.map((item) => enrichAttributeDefinition(item, req.locale)) };
  });

  app.post('/v1/case-models/:id/attributes', auth, async (req, reply) => {
    const { tenantId, userId } = ctx(req);
    const body = req.body as models.CreateAttributeDefinitionInput;
    const item = await handle(() =>
      models.createCaseModelAttribute(tenantId, idParam(req), userId, body, {
        defaultLocale: req.locale,
      }),
    );
    return reply.status(201).send(enrichAttributeDefinition(item, req.locale));
  });

  app.get('/v1/case-models/:id/task-model-exclusions', auth, async (req) => {
    const taskModelIds = await handle(() =>
      exclusions.listCaseModelTaskModelExclusions(ctx(req).tenantId, idParam(req)),
    );
    return { task_model_ids: taskModelIds };
  });

  app.put('/v1/case-models/:id/task-model-exclusions', auth, async (req) => {
    const body = req.body as { task_model_ids?: string[] };
    const taskModelIds = await handle(() =>
      exclusions.setCaseModelTaskModelExclusions(
        ctx(req).tenantId,
        idParam(req),
        body.task_model_ids ?? [],
      ),
    );
    return { task_model_ids: taskModelIds };
  });

  // Task models
  app.get('/v1/task-models', auth, async (req) => {
    const items = await handle(() => taskModels.listTaskModels(ctx(req).tenantId));
    return { items: items.map((item) => taskModels.enrichTaskModel(item, req.locale)) };
  });

  app.post('/v1/task-models', auth, async (req, reply) => {
    const { tenantId, userId } = ctx(req);
    const body = req.body as taskModels.CreateTaskModelInput;
    const item = await handle(() =>
      taskModels.createTaskModel(tenantId, body, {
        defaultLocale: req.locale,
        actorId: userId,
      }),
    );
    return reply.status(201).send(taskModels.enrichTaskModel(item, req.locale));
  });

  app.get('/v1/task-models/:id', auth, async (req) => {
    const item = await handle(() => taskModels.getTaskModel(ctx(req).tenantId, idParam(req)));
    if (!item) throw notFound();
    return taskModels.enrichTaskModel(item, req.locale);
  });

  app.patch('/v1/task-models/:id', auth, async (req) => {
    const { tenantId, userId } = ctx(req);
    const body = req.body as taskModels.UpdateTaskModelInput;
    const item = await handle(() =>
      taskModels.updateTaskModel(tenantId, idParam(req), body, {
        defaultLocale: req.locale,
        actorId: userId,
      }),
    );
    return taskModels.enrichTaskModel(item, req.locale);
  });

  app.delete('/v1/task-models/:id', auth, async (req, reply) => {
    const { tenantId, userId } = ctx(req);
    await handle(() => taskModels.deleteTaskModel(tenantId, idParam(req), userId));
    return reply.status(204).send();
  });

  app.get('/v1/task-models/:id/attributes', auth, async (req) => {
    const q = req.query as { definition_scope?: string };
    const scope =
      q.definition_scope === 'model' || q.definition_scope === 'instance'
        ? q.definition_scope
        : undefined;
    const items = await handle(() =>
      taskModels.listTaskModelAttributes(ctx(req).tenantId, idParam(req), scope),
    );
    return { items: items.map((item) => enrichAttributeDefinition(item, req.locale)) };
  });

  app.post('/v1/task-models/:id/attributes', auth, async (req, reply) => {
    const { tenantId, userId } = ctx(req);
    const body = req.body as taskModels.CreateAttributeDefinitionInput;
    const item = await handle(() =>
      taskModels.createTaskModelAttribute(tenantId, idParam(req), userId, body, {
        defaultLocale: req.locale,
      }),
    );
    return reply.status(201).send(enrichAttributeDefinition(item, req.locale));
  });

  // Attribute definitions (generic)
  app.patch('/v1/attribute-definitions/:id', auth, async (req) => {
    const body = req.body as models.UpdateAttributeDefinitionInput;
    const item = await handle(() =>
      models.updateAttributeDefinition(ctx(req).tenantId, idParam(req), body, {
        defaultLocale: req.locale,
      }),
    );
    return enrichAttributeDefinition(item, req.locale);
  });

  app.delete('/v1/attribute-definitions/:id', auth, async (req, reply) => {
    await handle(() =>
      models.deleteAttributeDefinition(ctx(req).tenantId, idParam(req)),
    );
    return reply.status(204).send();
  });

  // Cases
  app.get('/v1/cases', auth, async (req) => {
    const q = req.query as { case_model_id?: string };
    const items = await handle(() =>
      instances.listCases(ctx(req).tenantId, q.case_model_id),
    );
    return { items };
  });

  app.post('/v1/cases', auth, async (req, reply) => {
    const body = req.body as {
      case_model_id: string;
      status?: string;
      attributes?: Record<string, unknown>;
      assignee_actor_ids?: string[];
    };
    const item = await handle(() =>
      instances.createCase(ctx(req).tenantId, body),
    );
    return reply.status(201).send(item);
  });

  app.get('/v1/cases/:id', auth, async (req) => {
    const item = await handle(() => instances.getCase(ctx(req).tenantId, idParam(req)));
    if (!item) throw notFound();
    return item;
  });

  app.patch('/v1/cases/:id', auth, async (req) => {
    const body = req.body as {
      status?: string;
      attributes?: Record<string, unknown>;
      assignee_actor_ids?: string[];
    };
    return handle(() => instances.updateCase(ctx(req).tenantId, idParam(req), body));
  });

  app.delete('/v1/cases/:id', auth, async (req, reply) => {
    await handle(() => instances.deleteCase(ctx(req).tenantId, idParam(req)));
    return reply.status(204).send();
  });

  // Tasks
  app.get('/v1/tasks', auth, async (req) => {
    const q = req.query as { case_id?: string; task_model_id?: string };
    const items = await handle(() =>
      tasks.listTasks(ctx(req).tenantId, {
        case_id: q.case_id,
        task_model_id: q.task_model_id,
      }),
    );
    return { items };
  });

  app.post('/v1/tasks', auth, async (req, reply) => {
    const body = req.body as tasks.CreateTaskBody;
    const item = await handle(() => tasks.createTask(ctx(req).tenantId, body));
    return reply.status(201).send(item);
  });

  app.get('/v1/cases/:caseId/tasks', auth, async (req) => {
    const q = req.query as { task_model_id?: string };
    const items = await handle(() =>
      tasks.listTasks(ctx(req).tenantId, {
        case_id: caseIdParam(req),
        task_model_id: q.task_model_id,
      }),
    );
    return { items };
  });

  app.post('/v1/cases/:caseId/tasks', auth, async (req, reply) => {
    const body = req.body as Omit<tasks.CreateTaskBody, 'case_id'>;
    const item = await handle(() =>
      tasks.createTask(ctx(req).tenantId, {
        case_id: caseIdParam(req),
        task_model_id: body.task_model_id,
        status: body.status,
        predecessor_task_ids: body.predecessor_task_ids,
        dependent_task_ids: body.dependent_task_ids,
        attributes: body.attributes,
        assignee_actor_ids: body.assignee_actor_ids,
      }),
    );
    return reply.status(201).send(item);
  });

  app.get('/v1/tasks/:id', auth, async (req) => {
    const item = await handle(() => tasks.getTask(ctx(req).tenantId, idParam(req)));
    if (!item) throw notFound();
    return item;
  });

  app.patch('/v1/tasks/:id', auth, async (req) => {
    const body = req.body as tasks.UpdateTaskBody;
    return handle(() => tasks.updateTask(ctx(req).tenantId, idParam(req), body));
  });

  app.delete('/v1/tasks/:id', auth, async (req, reply) => {
    await handle(() => tasks.deleteTask(ctx(req).tenantId, idParam(req)));
    return reply.status(204).send();
  });

  // Actor models
  app.get('/v1/actor-models', auth, async (req) => {
    const { tenantId, userId } = ctx(req);
    await handle(() => bootstrapActorTenantData(tenantId, undefined, userId, req.locale));
    const items = await handle(() => actorModels.listActorModels(tenantId));
    return { items: items.map((item) => actorModels.enrichActorModel(item, req.locale)) };
  });

  app.post('/v1/actor-models', auth, async (req, reply) => {
    const { tenantId, userId } = ctx(req);
    const body = req.body as actorModels.CreateActorModelInput;
    const item = await handle(() =>
      actorModels.createActorModel(tenantId, body, {
        defaultLocale: req.locale,
        actorId: userId,
      }),
    );
    return reply.status(201).send(actorModels.enrichActorModel(item, req.locale));
  });

  app.get('/v1/actor-models/:id', auth, async (req) => {
    const item = await handle(() => actorModels.getActorModel(ctx(req).tenantId, idParam(req)));
    if (!item) throw notFound();
    return actorModels.enrichActorModel(item, req.locale);
  });

  app.patch('/v1/actor-models/:id', auth, async (req) => {
    const { tenantId, userId } = ctx(req);
    const body = req.body as actorModels.UpdateActorModelInput;
    const item = await handle(() =>
      actorModels.updateActorModel(tenantId, idParam(req), body, {
        defaultLocale: req.locale,
        actorId: userId,
      }),
    );
    return actorModels.enrichActorModel(item, req.locale);
  });

  app.delete('/v1/actor-models/:id', auth, async (req, reply) => {
    const { tenantId, userId } = ctx(req);
    await handle(() => actorModels.deleteActorModel(tenantId, idParam(req), userId));
    return reply.status(204).send();
  });

  app.get('/v1/actor-models/:id/attributes', auth, async (req) => {
    const q = req.query as { definition_scope?: string };
    const scope =
      q.definition_scope === 'model' || q.definition_scope === 'instance'
        ? q.definition_scope
        : undefined;
    const items = await handle(() =>
      actorModels.listActorModelAttributes(ctx(req).tenantId, idParam(req), scope),
    );
    return { items: items.map((item) => enrichAttributeDefinition(item, req.locale)) };
  });

  app.post('/v1/actor-models/:id/attributes', auth, async (req, reply) => {
    const { tenantId, userId } = ctx(req);
    const body = req.body as actorModels.CreateAttributeDefinitionInput;
    const item = await handle(() =>
      actorModels.createActorModelAttribute(tenantId, idParam(req), userId, body, {
        defaultLocale: req.locale,
      }),
    );
    return reply.status(201).send(enrichAttributeDefinition(item, req.locale));
  });

  // Actors
  app.get('/v1/actors', auth, async (req) => {
    const { tenantId, userId } = ctx(req);
    const q = req.query as { actor_model_id?: string };
    await handle(() => bootstrapActorTenantData(tenantId, undefined, userId, req.locale));
    const items = await handle(() =>
      actors.listActors(tenantId, q.actor_model_id),
    );
    return { items };
  });

  app.post('/v1/actors', auth, async (req, reply) => {
    const { tenantId, userId } = ctx(req);
    const body = req.body as {
      actor_model_id: string;
      status?: string;
      attributes?: Record<string, unknown>;
    };
    const item = await handle(() =>
      actors.createActor(tenantId, body, { actorId: userId }),
    );
    return reply.status(201).send(item);
  });

  app.get('/v1/actors/:id', auth, async (req) => {
    const item = await handle(() => actors.getActor(ctx(req).tenantId, idParam(req)));
    if (!item) throw notFound();
    return item;
  });

  app.patch('/v1/actors/:id', auth, async (req) => {
    const { tenantId, userId } = ctx(req);
    const body = req.body as {
      status?: string;
      attributes?: Record<string, unknown>;
    };
    return handle(() => actors.updateActor(tenantId, idParam(req), body, userId));
  });

  app.delete('/v1/actors/:id', auth, async (req, reply) => {
    const { tenantId, userId } = ctx(req);
    await handle(() => actors.deleteActor(tenantId, idParam(req), userId));
    return reply.status(204).send();
  });

  // Message models
  app.get('/v1/message-models', auth, async (req) => {
    const items = await handle(() => messageModels.listMessageModels(ctx(req).tenantId));
    return { items: items.map((item) => messageModels.enrichMessageModel(item, req.locale)) };
  });

  app.post('/v1/message-models', auth, async (req, reply) => {
    const { tenantId, userId } = ctx(req);
    const body = req.body as messageModels.CreateMessageModelInput;
    const item = await handle(() =>
      messageModels.createMessageModel(tenantId, body, {
        defaultLocale: req.locale,
        actorId: userId,
      }),
    );
    return reply.status(201).send(messageModels.enrichMessageModel(item, req.locale));
  });

  app.get('/v1/message-models/:id', auth, async (req) => {
    const item = await handle(() => messageModels.getMessageModel(ctx(req).tenantId, idParam(req)));
    if (!item) throw notFound();
    return messageModels.enrichMessageModel(item, req.locale);
  });

  app.patch('/v1/message-models/:id', auth, async (req) => {
    const { tenantId, userId } = ctx(req);
    const body = req.body as messageModels.UpdateMessageModelInput;
    const item = await handle(() =>
      messageModels.updateMessageModel(tenantId, idParam(req), body, {
        defaultLocale: req.locale,
        actorId: userId,
      }),
    );
    return messageModels.enrichMessageModel(item, req.locale);
  });

  app.delete('/v1/message-models/:id', auth, async (req, reply) => {
    const { tenantId, userId } = ctx(req);
    await handle(() => messageModels.deleteMessageModel(tenantId, idParam(req), userId));
    return reply.status(204).send();
  });

  app.get('/v1/message-models/:id/attributes', auth, async (req) => {
    const q = req.query as { definition_scope?: string };
    const scope =
      q.definition_scope === 'model' || q.definition_scope === 'instance'
        ? q.definition_scope
        : undefined;
    const items = await handle(() =>
      messageModels.listMessageModelAttributes(ctx(req).tenantId, idParam(req), scope),
    );
    return { items: items.map((item) => enrichAttributeDefinition(item, req.locale)) };
  });

  app.post('/v1/message-models/:id/attributes', auth, async (req, reply) => {
    const { tenantId, userId } = ctx(req);
    const body = req.body as messageModels.CreateAttributeDefinitionInput;
    const item = await handle(() =>
      messageModels.createMessageModelAttribute(tenantId, idParam(req), userId, body, {
        defaultLocale: req.locale,
      }),
    );
    return reply.status(201).send(enrichAttributeDefinition(item, req.locale));
  });

  // Messages
  app.get('/v1/messages', auth, async (req) => {
    const q = req.query as messages.ListMessagesQuery;
    const items = await handle(() => messages.listMessages(ctx(req).tenantId, q));
    return { items };
  });

  app.post('/v1/messages', auth, async (req, reply) => {
    const { tenantId, userId } = ctx(req);
    const body = req.body as messages.CreateMessageInput;
    const item = await handle(() => messages.createMessage(tenantId, body, { actorId: userId }));
    return reply.status(201).send(item);
  });

  app.get('/v1/messages/:id', auth, async (req) => {
    const item = await handle(() => messages.getMessage(ctx(req).tenantId, idParam(req)));
    if (!item) throw notFound();
    return item;
  });

  app.delete('/v1/messages/:id', auth, async (req, reply) => {
    const { tenantId, userId } = ctx(req);
    await handle(() => messages.deleteMessage(tenantId, idParam(req), userId));
    return reply.status(204).send();
  });

  app.get('/v1/message-files/:id', auth, async (req, reply) => {
    const file = await handle(() => messages.getMessageFileContent(ctx(req).tenantId, idParam(req)));
    if (!file) throw notFound();
    const filename = file.filename ?? 'attachment';
    const contentType = file.content_type ?? 'application/octet-stream';
    return reply
      .header('Content-Type', contentType)
      .header('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '')}"`)
      .send(file.data);
  });
}
