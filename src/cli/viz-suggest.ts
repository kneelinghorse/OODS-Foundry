#!/usr/bin/env node
import { runCli as runVizSuggestCli } from '@/viz/patterns/suggest-chart-cli.js';
import { fileURLToPath } from 'node:url';

export async function runVizSuggest(argv: string[] = process.argv.slice(2)): Promise<void> {
  await runVizSuggestCli(argv);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  void runVizSuggest();
}
