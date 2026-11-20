#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readConfig } from './config.js';
import { OnioApi } from './onio-api.js';
import { createServer } from './server.js';

try {
  const server = createServer(new OnioApi(readConfig(process.env)));
  await server.connect(new StdioServerTransport());
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
