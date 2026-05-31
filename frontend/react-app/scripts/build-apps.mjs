import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const appsDir = path.join(repoRoot, 'apps');

if (!fs.existsSync(appsDir)) {
  console.log('No apps directory found; skipping app builds.');
  process.exit(0);
}

const appDirs = fs
  .readdirSync(appsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(appsDir, entry.name, 'frontend'))
  .filter((frontendDir) => fs.existsSync(path.join(frontendDir, 'vite.config.ts')));

if (appDirs.length === 0) {
  console.log('No app frontend builds configured.');
  process.exit(0);
}

for (const frontendDir of appDirs) {
  console.log(`Building app frontend: ${frontendDir}`);
  const reactAppDir = path.join(repoRoot, 'frontend/react-app');
  const viteBin = path.join(reactAppDir, 'node_modules/vite/bin/vite.js');
  const result = spawnSync(
    'node',
    [viteBin, 'build', '--config', path.join(frontendDir, 'vite.config.ts')],
    {
      cwd: reactAppDir,
      stdio: 'inherit',
      env: { ...process.env, NODE_PATH: path.join(reactAppDir, 'node_modules') },
    },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('App frontend builds completed.');
