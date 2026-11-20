import { createRequire } from 'node:module';

const packageJson = createRequire(import.meta.url)('../package.json') as { version: string };

export const SERVER_NAME = 'onio-mcp-server';
export const PACKAGE_VERSION = packageJson.version;
