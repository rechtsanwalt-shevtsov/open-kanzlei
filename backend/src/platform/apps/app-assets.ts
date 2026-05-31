import fs from 'node:fs';
import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { env } from '../../config/env.js';
import { getAppFrontendDistPath } from './registry-loader.js';
import { listKnownAppKeys } from './registry.js';

export async function registerAppAssetRoutes(app: FastifyInstance): Promise<void> {
  const appsDir = env.appsPath;

  if (!fs.existsSync(appsDir)) {
    app.log.warn({ appsDir }, 'Apps directory not found; app asset serving disabled');
    return;
  }

  for (const appKey of listKnownAppKeys()) {
    const distPath = getAppFrontendDistPath(appsDir, appKey);
    if (!distPath || !fs.existsSync(distPath)) continue;

    await app.register(fastifyStatic, {
      root: distPath,
      prefix: `/app-assets/${appKey}/`,
      decorateReply: false,
    });

    app.log.info({ appKey, distPath }, 'Serving app frontend assets');
  }
}

export function listAvailableAppAssetKeys(): string[] {
  const appsDir = env.appsPath;
  if (!fs.existsSync(appsDir)) return [];

  return listKnownAppKeys().filter((appKey) => {
    const distPath = getAppFrontendDistPath(appsDir, appKey);
    return Boolean(distPath && fs.existsSync(distPath));
  });
}
