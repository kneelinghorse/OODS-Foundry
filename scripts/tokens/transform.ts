#!/usr/bin/env tsx

import path from 'node:path';
import { execFileSync } from 'node:child_process';

interface CliOptions {
  mode: 'write' | 'check';
  mission: string;
  diagnostics: boolean;
}

const DEFAULT_OPTIONS: CliOptions = {
  mode: 'write',
  mission: 'unspecified',
  diagnostics: true,
};

const projectRoot = process.cwd();
const tokenBuilder = path.resolve(projectRoot, 'packages/tokens/scripts/build.mjs');

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  // The legacy explorer transform used a second source tree and could pass while
  // the shipped tokens failed. Both compatibility commands now use the real build.
  execFileSync(process.execPath, [tokenBuilder, ...(options.mode === 'check' ? ['--check'] : [])], {
    cwd: projectRoot, stdio: 'inherit',
  });
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { ...DEFAULT_OPTIONS };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--') {
      continue;
    }

    switch (arg) {
      case '--check':
      case '--validate':
        options.mode = 'check';
        break;
      case '--mission': {
        const next = argv[i + 1];
        if (!next || next.startsWith('--')) {
          throw new Error('Expected mission identifier after --mission');
        }
        options.mission = next;
        i += 1;
        break;
      }
      case '--no-diagnostics':
        options.diagnostics = false;
        break;
      default:
        if (arg.startsWith('--')) {
          throw new Error(`Unknown flag: ${arg}`);
        }
        break;
    }
  }

  return options;
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
