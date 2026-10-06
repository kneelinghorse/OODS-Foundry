#!/usr/bin/env node
import { register } from 'tsx/esm/api';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const tsconfigPath = path.resolve('tsconfig.json');
const unregister = await register({ tsconfig: tsconfigPath });

try {
  const cliPath = new URL('../../src/viz/patterns/suggest-chart-cli.ts', import.meta.url);
  const { runCli } = await import(fileURLToPath(cliPath));
  await runCli(process.argv.slice(2));
} finally {
  await unregister();
}
