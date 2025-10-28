#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = resolve(__dirname, '..');
const tailwindPath = join(packageRoot, 'dist', 'tailwind', 'tokens.json');
const esmEntryPath = join(packageRoot, 'dist', 'index.js');
const cjsEntryPath = join(packageRoot, 'dist', 'index.cjs');
const dtsEntryPath = join(packageRoot, 'dist', 'index.d.ts');

const ensureDirectory = async (filePath) => {
  await fs.mkdir(dirname(filePath), { recursive: true });
};

const readTokensJson = async () => {
  try {
    const raw = await fs.readFile(tailwindPath, 'utf-8');
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('tokens.json must export an object');
    }

    const { tokens, flat, cssVariables, meta, prefix } = parsed;

    if (!tokens || !flat || !cssVariables) {
      throw new Error(
        'tokens.json is missing one of "tokens", "flat", or "cssVariables" keys',
      );
    }

    return {
      tokens,
      flatTokens: flat,
      cssVariables,
      meta: meta ?? {},
      prefix: typeof prefix === 'string' ? prefix : 'oods',
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(
        'tokens.json not found. Run "pnpm --filter @oods/tokens run build" before packaging.',
      );
    }

    throw error;
  }
};

const buildEsmModule = () =>
  [
    "import tokensJson from './tailwind/tokens.json' assert { type: 'json' };",
    'const source = tokensJson ?? {};',
    'const tokens = source.tokens ?? {};',
    'const flatTokens = source.flat ?? {};',
    'const cssVariables = source.cssVariables ?? {};',
    'const meta = source.meta ?? {};',
    "const prefix = source.prefix ?? 'oods';",
    '',
    'export { tokens, flatTokens, cssVariables, meta, prefix };',
    'export default { tokens, flatTokens, cssVariables, meta, prefix };',
    '',
  ].join('\n');

const buildCjsModule = () =>
  [
    "'use strict';",
    '',
    "const tokensJson = require('./tailwind/tokens.json');",
    '',
    'const tokens = tokensJson.tokens;',
    'const flatTokens = tokensJson.flat;',
    'const cssVariables = tokensJson.cssVariables;',
    'const meta = tokensJson.meta ?? {};',
    "const prefix = tokensJson.prefix ?? 'oods';",
    '',
    'module.exports = {',
    '  tokens,',
    '  flatTokens,',
    '  cssVariables,',
    '  meta,',
    '  prefix,',
    '  default: { tokens, flatTokens, cssVariables, meta, prefix },',
    '};',
    '',
  ].join('\n');

const buildTypeDefinitions = () =>
  [
    'export interface TokenMeta {',
    "  generatedAt: string;",
    "  tool: string;",
    "  version: string;",
    "  platform: string;",
    '}',
    '',
    'export interface FlatTokenEntry {',
    '  name?: string;',
    '  value: unknown;',
    '  type?: string;',
    '  path?: string[];',
    '  cssVariable: string;',
    '  originalValue?: unknown;',
    '  description?: string;',
    '  [key: string]: unknown;',
    '}',
    '',
    'export type TokenTree = Record<string, unknown>;',
    '',
    'export declare const tokens: TokenTree;',
    'export declare const flatTokens: Record<string, FlatTokenEntry>;',
    'export declare const cssVariables: Record<string, string>;',
    'export declare const meta: Partial<TokenMeta>;',
    'export declare const prefix: string;',
    'declare const bundle: {',
    '  tokens: typeof tokens;',
    '  flatTokens: typeof flatTokens;',
    '  cssVariables: typeof cssVariables;',
    '  meta: typeof meta;',
    '  prefix: typeof prefix;',
    '};',
    'export default bundle;',
    '',
  ].join('\n');

const main = async () => {
  const tokensJson = await readTokensJson();

  await ensureDirectory(esmEntryPath);
  await ensureDirectory(cjsEntryPath);
  await ensureDirectory(dtsEntryPath);

  await Promise.all([
    fs.writeFile(esmEntryPath, buildEsmModule(), 'utf-8'),
    fs.writeFile(cjsEntryPath, buildCjsModule(tokensJson), 'utf-8'),
    fs.writeFile(dtsEntryPath, buildTypeDefinitions(), 'utf-8'),
  ]);
};

main().catch((error) => {
  console.error('[@oods/tokens] Failed to build entry points');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
