declare module '@apps/case-model-designer/frontend/routes.js' {
  import type { ReactNode } from 'react';

  export const appKey: string;
  export const appRoutes: ReactNode;
}

declare module '@apps/*/frontend/routes.js' {
  import type { ReactNode } from 'react';

  export const appKey: string;
  export const appRoutes: ReactNode;
}

declare module '@apps/case-model-designer/manifest.json' {
  const manifest: {
    app_key: string;
    settings_schema: Record<string, unknown>;
  };
  export default manifest;
}

declare module '@apps/task-model-designer/manifest.json' {
  const manifest: {
    app_key: string;
    settings_schema: Record<string, unknown>;
  };
  export default manifest;
}

declare module '@apps/actor-model-designer/manifest.json' {
  const manifest: {
    app_key: string;
    settings_schema: Record<string, unknown>;
  };
  export default manifest;
}

declare module '@apps/actors/manifest.json' {
  const manifest: {
    app_key: string;
    settings_schema: Record<string, unknown>;
  };
  export default manifest;
}

declare module '@apps/tasks/manifest.json' {
  const manifest: {
    app_key: string;
    settings_schema: Record<string, unknown>;
  };
  export default manifest;
}
