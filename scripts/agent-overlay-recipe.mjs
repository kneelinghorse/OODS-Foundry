#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const DEFAULT_TOOL = 'brand.apply';
const DEFAULT_ROLE = process.env.OODS_AGENT_ROLE || 'designer';
const DEFAULT_BASE_URL = process.env.OODS_AGENT_BASE_URL || 'http://127.0.0.1:4466';
const DEFAULT_TIMEOUT = Number(process.env.OODS_AGENT_TIMEOUT_MS || 180_000);

const args = parseArgs(process.argv.slice(2));

if (!args.execute) {
  printRecipe(args);
  process.exit(0);
}

runApproval(args)
  .then(() => {
    process.exitCode = 0;
  })
  .catch((error) => {
    console.error('overlay approval recipe failed');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = error?.exitCode ?? 1;
  });

function parseArgs(argv) {
  const options = {
    apply: false,
    execute: false,
    baseUrl: DEFAULT_BASE_URL,
    role: DEFAULT_ROLE,
    tool: DEFAULT_TOOL,
    token: process.env.OODS_AGENT_TOKEN || null,
    approval: process.env.OODS_AGENT_APPROVAL || null,
    timeout: DEFAULT_TIMEOUT,
    input: {
      recipe: 'overlays.tokens',
      checks: [
        { command: 'pnpm overlays:proof', status: 'required' },
        { command: 'pnpm pkg:compat', status: 'required' },
      ],
    },
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') {
      options.apply = true;
      continue;
    }
    if (arg === '--execute') {
      options.execute = true;
      continue;
    }
    if (arg === '--base-url' && argv[i + 1]) {
      options.baseUrl = argv[++i];
      continue;
    }
    if (arg.startsWith('--base-url=')) {
      options.baseUrl = arg.split('=', 2)[1];
      continue;
    }
    if (arg === '--token' && argv[i + 1]) {
      options.token = argv[++i];
      continue;
    }
    if (arg.startsWith('--token=')) {
      options.token = arg.split('=', 2)[1];
      continue;
    }
    if (arg === '--approval' && argv[i + 1]) {
      options.approval = argv[++i];
      continue;
    }
    if (arg.startsWith('--approval=')) {
      options.approval = arg.split('=', 2)[1];
      continue;
    }
    if (arg === '--role' && argv[i + 1]) {
      options.role = argv[++i];
      continue;
    }
    if (arg.startsWith('--role=')) {
      options.role = arg.split('=', 2)[1];
      continue;
    }
    if (arg === '--tool' && argv[i + 1]) {
      options.tool = argv[++i];
      continue;
    }
    if (arg.startsWith('--tool=')) {
      options.tool = arg.split('=', 2)[1];
      continue;
    }
    if (arg === '--timeout' && argv[i + 1]) {
      options.timeout = Number(argv[++i]) || DEFAULT_TIMEOUT;
      continue;
    }
    if (arg.startsWith('--timeout=')) {
      options.timeout = Number(arg.split('=', 2)[1]) || DEFAULT_TIMEOUT;
      continue;
    }
    if (arg === '--input' && argv[i + 1]) {
      options.input = mergeInput(options.input, argv[++i]);
      continue;
    }
    if (arg.startsWith('--input=')) {
      options.input = mergeInput(options.input, arg.split('=', 2)[1] ?? '{}');
      continue;
    }
  }

  return options;
}

function mergeInput(base, raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Input payload must be a JSON object.');
    }
    return { ...base, ...parsed };
  } catch (error) {
    throw new Error(`Failed to parse --input payload: ${(error instanceof Error && error.message) || String(error)}`);
  }
}

function printRecipe(options) {
  const lines = [
    'Overlay token deployment recipe (dry-run by default)',
    '',
    '1. Run overlay proof checks:',
    '   pnpm overlays:proof',
    '',
    '2. Run packaging compatibility:',
    '   pnpm pkg:compat',
    '',
    '3. Request approval-backed token apply:',
    '   pnpm agent:overlays --execute --apply',
    '',
    'Environment variables:',
    `  - OODS_AGENT_BASE_URL (default ${DEFAULT_BASE_URL})`,
    '  - OODS_AGENT_TOKEN (bridge auth token)',
    '  - OODS_AGENT_APPROVAL (approval header value when apply is requested)',
    '',
    'Use --execute to perform the dry-run automatically, and add --apply to escalate once approval is granted.',
  ];
  lines.forEach((line) => process.stdout.write(`${line}\n`));

  if (options.apply) {
    process.stdout.write(
      '\nNote: --apply is ignored without --execute; provide both to trigger an approval-backed run.\n'
    );
  }
}

async function runApproval(options) {
  const args = [
    'exec',
    'tsx',
    path.join('scripts', 'agent', 'approval.ts'),
    '--tool',
    options.tool,
    '--role',
    options.role,
    '--base-url',
    options.baseUrl,
    '--timeout',
    String(options.timeout),
    '--input',
    JSON.stringify(options.input),
  ];

  if (options.token) {
    args.push('--token', options.token);
  }

  if (options.approval) {
    args.push('--approval', options.approval);
  }

  if (options.apply) {
    args.push('--apply');
  }

  await new Promise((resolve, reject) => {
    const child = spawn(PNPM_CMD, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        const error = new Error(`Agent approval script exited with code ${code}`);
        error.exitCode = typeof code === 'number' ? code : 1;
        reject(error);
      }
    });
  });
}
