import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AppError, notFound } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { enrichAttributeDefinition } from '../../legal-work/attributes.js';
import * as models from '../../legal-work/models.js';
import * as instances from '../../legal-work/instances.js';

function ctx(request: FastifyRequest) {
  const user = request.user!;
  return { tenantId: user.tenantId, userId: user.id };
}

function idParam(request: FastifyRequest): string {
  return (request.params as { id: string }).id;
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
      models.createCaseModel(tenantId, body, { defaultLocale: req.locale, actorUserId: userId }),
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
        actorUserId: userId,
      }),
    );
    return models.enrichCaseModel(item, req.locale);
  });

  app.delete('/v1/case-models/:id', auth, async (req, reply) => {
    const { tenantId, userId } = ctx(req);
    await handle(() => models.deleteCaseModel(tenantId, idParam(req), userId));
    return reply.status(204).send();
  });

  app.get('/v1/case-models/:id/task-models', auth, async (req) => {
    const items = await handle(() =>
      models.listCaseModelTaskLinks(ctx(req).tenantId, idParam(req)),
    );
    return { items };
  });

  app.put('/v1/case-models/:id/task-models', auth, async (req) => {
    const body = req.body as { links: models.CaseModelTaskLinkDto[] };
    const items = await handle(() =>
      models.setCaseModelTaskLinks(ctx(req).tenantId, idParam(req), body.links ?? []),
    );
    return { items };
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

  // Task models
  app.get('/v1/task-models', auth, async (req) => {
    const items = await handle(() => models.listTaskModels(ctx(req).tenantId));
    return { items };
  });

  app.post('/v1/task-models', auth, async (req, reply) => {
    const body = req.body as {
      key: string;
      status?: string;
      translations: Record<string, string>;
    };
    const item = await handle(() =>
      models.createTaskModel(ctx(req).tenantId, body),
    );
    return reply.status(201).send(item);
  });

  app.get('/v1/task-models/:id', auth, async (req) => {
    const item = await handle(() => models.getTaskModel(ctx(req).tenantId, idParam(req)));
    if (!item) throw notFound();
    return item;
  });

  app.patch('/v1/task-models/:id', auth, async (req) => {
    const body = req.body as { status?: string; translations?: Record<string, string> };
    return handle(() => models.updateTaskModel(ctx(req).tenantId, idParam(req), body));
  });

  app.delete('/v1/task-models/:id', auth, async (req, reply) => {
    await handle(() => models.deleteTaskModel(ctx(req).tenantId, idParam(req)));
    return reply.status(204).send();
  });

  app.get('/v1/task-models/:id/instrument-models', auth, async (req) => {
    const items = await handle(() =>
      models.listInstrumentModels(ctx(req).tenantId, idParam(req)),
    );
    return { items };
  });

  app.post('/v1/task-models/:id/instrument-models', auth, async (req, reply) => {
    const body = req.body as {
      key: string;
      status?: string;
      translations: Record<string, string>;
    };
    const item = await handle(() =>
      models.createInstrumentModel(ctx(req).tenantId, idParam(req), body),
    );
    return reply.status(201).send(item);
  });

  app.get('/v1/task-models/:id/attributes', auth, async (req) => {
    const items = await handle(() =>
      models.listTaskModelAttributes(ctx(req).tenantId, idParam(req)),
    );
    return { items: items.map((item) => enrichAttributeDefinition(item, req.locale)) };
  });

  app.post('/v1/task-models/:id/attributes', auth, async (req, reply) => {
    const { tenantId, userId } = ctx(req);
    const body = req.body as models.CreateAttributeDefinitionInput;
    const item = await handle(() =>
      models.createTaskModelAttribute(tenantId, idParam(req), userId, body, {
        defaultLocale: req.locale,
      }),
    );
    return reply.status(201).send(enrichAttributeDefinition(item, req.locale));
  });

  // Instrument models
  app.get('/v1/instrument-models/:id', auth, async (req) => {
    const item = await handle(() => models.getInstrumentModel(ctx(req).tenantId, idParam(req)));
    if (!item) throw notFound();
    return item;
  });

  app.patch('/v1/instrument-models/:id', auth, async (req) => {
    const body = req.body as { status?: string; translations?: Record<string, string> };
    return handle(() => models.updateInstrumentModel(ctx(req).tenantId, idParam(req), body));
  });

  app.delete('/v1/instrument-models/:id', auth, async (req, reply) => {
    await handle(() => models.deleteInstrumentModel(ctx(req).tenantId, idParam(req)));
    return reply.status(204).send();
  });

  app.get('/v1/instrument-models/:id/attributes', auth, async (req) => {
    const items = await handle(() =>
      models.listInstrumentModelAttributes(ctx(req).tenantId, idParam(req)),
    );
    return { items: items.map((item) => enrichAttributeDefinition(item, req.locale)) };
  });

  app.post('/v1/instrument-models/:id/attributes', auth, async (req, reply) => {
    const { tenantId, userId } = ctx(req);
    const body = req.body as models.CreateAttributeDefinitionInput;
    const item = await handle(() =>
      models.createInstrumentModelAttribute(tenantId, idParam(req), userId, body, {
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
      assignee_user_ids?: string[];
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
      assignee_user_ids?: string[];
    };
    return handle(() => instances.updateCase(ctx(req).tenantId, idParam(req), body));
  });

  app.delete('/v1/cases/:id', auth, async (req, reply) => {
    await handle(() => instances.deleteCase(ctx(req).tenantId, idParam(req)));
    return reply.status(204).send();
  });

  app.get('/v1/cases/:id/tasks', auth, async (req) => {
    const items = await handle(() =>
      instances.listTasks(ctx(req).tenantId, idParam(req)),
    );
    return { items };
  });

  app.post('/v1/cases/:id/tasks', auth, async (req, reply) => {
    const body = req.body as {
      task_model_id: string;
      status?: string;
      attributes?: Record<string, unknown>;
    };
    const item = await handle(() =>
      instances.createTask(ctx(req).tenantId, idParam(req), body),
    );
    return reply.status(201).send(item);
  });

  // Tasks (instances)
  app.get('/v1/tasks', auth, async (req) => {
    const items = await handle(() => instances.listAllTasks(ctx(req).tenantId));
    return { items };
  });

  app.get('/v1/tasks/:id', auth, async (req) => {
    const item = await handle(() => instances.getTask(ctx(req).tenantId, idParam(req)));
    if (!item) throw notFound();
    return item;
  });

  app.patch('/v1/tasks/:id', auth, async (req) => {
    const body = req.body as {
      status?: string;
      attributes?: Record<string, unknown>;
      assignee_user_ids?: string[];
    };
    return handle(() => instances.updateTask(ctx(req).tenantId, idParam(req), body));
  });

  app.delete('/v1/tasks/:id', auth, async (req, reply) => {
    await handle(() => instances.deleteTask(ctx(req).tenantId, idParam(req)));
    return reply.status(204).send();
  });

  app.get('/v1/tasks/:id/instruments', auth, async (req) => {
    const items = await handle(() =>
      instances.listInstruments(ctx(req).tenantId, idParam(req)),
    );
    return { items };
  });

  app.post('/v1/tasks/:id/instruments', auth, async (req, reply) => {
    const body = req.body as {
      instrument_model_id: string;
      status?: string;
      attributes?: Record<string, unknown>;
    };
    const item = await handle(() =>
      instances.createInstrument(ctx(req).tenantId, idParam(req), body),
    );
    return reply.status(201).send(item);
  });

  // Instruments (instances)
  app.get('/v1/instruments/:id', auth, async (req) => {
    const item = await handle(() => instances.getInstrument(ctx(req).tenantId, idParam(req)));
    if (!item) throw notFound();
    return item;
  });

  app.patch('/v1/instruments/:id', auth, async (req) => {
    const body = req.body as {
      status?: string;
      attributes?: Record<string, unknown>;
    };
    return handle(() => instances.updateInstrument(ctx(req).tenantId, idParam(req), body));
  });

  app.delete('/v1/instruments/:id', auth, async (req, reply) => {
    await handle(() => instances.deleteInstrument(ctx(req).tenantId, idParam(req)));
    return reply.status(204).send();
  });
}
