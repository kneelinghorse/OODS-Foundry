#!/usr/bin/env tsx

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

import { compileCss, loadDtcgTokens } from '../../src/tooling/tokens/dtcg.js';

interface CliOptions {
  mode: 'write' | 'check';
  mission: string;
  diagnostics: boolean;
}

interface DiagnosticsEntry {
  mission: string;
  phase: string;
  durationMs: number;
  tokensCount: number;
  writtenAt: string;
}

const DEFAULT_OPTIONS: CliOptions = {
  mode: 'write',
  mission: 'unspecified',
  diagnostics: true,
};

const projectRoot = process.cwd();
const tokensRoot = path.resolve(projectRoot, 'tokens');
const outputCssPath = path.resolve(projectRoot, 'apps/explorer/src/styles/tokens.css');
const diagnosticsPath = path.resolve(projectRoot, 'diagnostics.json');

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const start = performance.now();

  const tokens = await loadDtcgTokens(tokensRoot);
  const { css, tokensCount } = compileCss(tokens);

  if (options.mode === 'check') {
    await runCheck(css);
  } else {
    await writeOutput(css);
  }

  const durationMs = Math.round(performance.now() - start);

  if (options.diagnostics && options.mode === 'write') {
    await appendDiagnostics({
      mission: options.mission,
      phase: 'transform',
      durationMs,
      tokensCount,
      writtenAt: new Date().toISOString(),
    });
  }

  const isCheck = options.mode === 'check';
  const action = isCheck ? 'validated' : 'generated';
  console.log(
    `✔︎ DTCG tokens ${action} successfully (${tokensCount} tokens, ${durationMs}ms)`,
  );
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

async function runCheck(generatedCss: string): Promise<void> {
  try {
    const existing = await fs.readFile(outputCssPath, 'utf8');
    if (existing.trim() !== generatedCss.trim()) {
      console.error('⚠︎ Generated CSS does not match the current file. Run without --check to update.');
      process.exitCode = 1;
    }
  } catch (error) {
    if (hasCode(error, 'ENOENT')) {
      console.error('⚠︎ Generated CSS missing on disk. Run the transform without --check to create it.');
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

async function writeOutput(css: string): Promise<void> {
  await fs.mkdir(path.dirname(outputCssPath), { recursive: true });
  await fs.writeFile(outputCssPath, css, 'utf8');
}

async function appendDiagnostics(entry: DiagnosticsEntry): Promise<void> {
  let existing: Record<string, unknown> = {};

  try {
    const content = await fs.readFile(diagnosticsPath, 'utf8');
    existing = JSON.parse(content);
  } catch (error) {
    if (!hasCode(error, 'ENOENT')) {
      throw error;
    }
  }

  const tokensSection = ensureObject(existing, 'tokens');
  const transformHistory = ensureArray(tokensSection, 'transforms');
  transformHistory.push(entry);

  tokensSection.lastRun = {
    mission: entry.mission,
    durationMs: entry.durationMs,
    tokensCount: entry.tokensCount,
    writtenAt: entry.writtenAt,
  };

  await fs.writeFile(diagnosticsPath, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');
}

function ensureObject(container: Record<string, unknown>, key: string): Record<string, unknown> {
  const existing = container[key];
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    return existing as Record<string, unknown>;
  }

  const value: Record<string, unknown> = {};
  container[key] = value;
  return value;
}

function ensureArray(container: Record<string, unknown>, key: string): DiagnosticsEntry[] {
  const existing = container[key];
  if (Array.isArray(existing)) {
    return existing as DiagnosticsEntry[];
  }

  const value: DiagnosticsEntry[] = [];
  container[key] = value;
  return value;
}

function hasCode(value: unknown, code: string): value is { code: string } {
  return Boolean(value && typeof value === 'object' && 'code' in value && (value as { code: unknown }).code === code);
}

main().catch((error) => {
  console.error('❌ tokens transform failed');
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
