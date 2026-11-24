// Builds the Claude Desktop extension `build/onio.mcpb` from `mcpb/` and `src/`.
// The server is bundled into one file, so the archive needs no `node_modules`.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const STAGING = 'build/mcpb';

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path: string, value: unknown) =>
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

const { version } = readJson('package.json');

rmSync('build', { recursive: true, force: true });
mkdirSync(`${STAGING}/server`, { recursive: true });

// `package.json` is the only source of the version.
writeJson(`${STAGING}/manifest.json`, { ...readJson('mcpb/manifest.json'), version });
// `src/version.ts` reads this file at run time. `type: module` lets Node run the ESM bundle.
writeJson(`${STAGING}/package.json`, { version, type: 'module' });
copyFileSync('mcpb/icon.png', `${STAGING}/icon.png`);
copyFileSync('LICENSE', `${STAGING}/LICENSE`);

execFileSync(
  'bun',
  ['build', 'src/index.ts', '--target=node', `--outfile=${STAGING}/server/index.js`],
  { stdio: 'inherit' },
);
execFileSync('mcpb', ['pack', STAGING, 'build/onio.mcpb'], { stdio: 'inherit' });
