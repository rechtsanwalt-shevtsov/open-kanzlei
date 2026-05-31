import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const reactAppRoot = path.dirname(fileURLToPath(import.meta.url));
const appsRoot = path.resolve(reactAppRoot, '../../apps');
const shellResolveAnchor = path.join(reactAppRoot, 'src/main.tsx');

/** Bare imports in apps/ are outside Vite root — resolve them from the shell node_modules. */
function resolveAppDepsFromShell(): Plugin {
  return {
    name: 'resolve-app-deps-from-shell',
    async resolveId(source, importer, options) {
      if (!importer?.includes(`${path.sep}apps${path.sep}`)) return null;
      if (
        source.startsWith('.') ||
        source.startsWith('\0') ||
        source.startsWith('@shell') ||
        source.startsWith('@apps')
      ) {
        return null;
      }

      return this.resolve(source, shellResolveAnchor, { ...options, skipSelf: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), resolveAppDepsFromShell()],
  resolve: {
    alias: {
      '@shell': path.join(reactAppRoot, 'src'),
      '@apps': appsRoot,
    },
    dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom'],
  },
  server: {
    port: 5173,
    proxy: {
      '/v1': { target: 'http://127.0.0.1:3000', changeOrigin: true },
      '/health': { target: 'http://127.0.0.1:3000' },
      '/app-assets': { target: 'http://127.0.0.1:3000', changeOrigin: true },
    },
    fs: {
      allow: [path.resolve(reactAppRoot, '../..'), appsRoot],
    },
  },
});
