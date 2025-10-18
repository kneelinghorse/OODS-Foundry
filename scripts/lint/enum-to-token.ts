#!/usr/bin/env tsx
/**
 * Guardrails for enum→token mapping usage.
 *
 * 1. Validates that the UI status map config mirrors the canonical token manifest.
 * 2. Ensures StatusChip usage never hardcodes status literals or tone maps.
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type StatusMapConfig = {
  domains: Record<
    string,
    {
      source: string;
      path: string;
      statuses: string[];
    }
  >;
  contexts: Record<string, string[]>;
};

type TokensStatusManifest = {
  domains: Record<string, Record<string, unknown>>;
};

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const CONFIG_PATH = path.join(ROOT, 'configs/ui/status-map.json');
const TOKENS_PATH = path.join(ROOT, 'tokens/maps/saas-billing.status-map.json');
const TARGETS = [
  { kind: 'dir', path: 'apps/explorer/src/pages' },
  { kind: 'dir', path: 'apps/explorer/src/stories/Billing' },
  { kind: 'file', path: 'apps/explorer/src/stories/HighContrast.Guardrails-hc.stories.tsx' },
  { kind: 'file', path: 'apps/explorer/src/stories/BrandA.stories.tsx' }
] as const;

async function loadJson<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, 'utf8');
  return JSON.parse(content) as T;
}

async function validateStatusConfig(): Promise<string[]> {
  const errors: string[] = [];
  const config = await loadJson<StatusMapConfig>(CONFIG_PATH);
  const tokensManifest = await loadJson<TokensStatusManifest>(TOKENS_PATH);

  const domainKeys = Object.keys(config.domains ?? {});

  for (const [domain, definition] of Object.entries(config.domains ?? {})) {
    const manifest = tokensManifest.domains?.[domain];
    if (!manifest) {
      errors.push(`Domain "${domain}" is listed in status-map.json but missing from the token manifest.`);
      continue;
    }

    const manifestStatuses = new Set(Object.keys(manifest));
    const configStatuses = new Set(definition.statuses ?? []);

    const missingInManifest = [...configStatuses].filter((status) => !manifestStatuses.has(status));
    if (missingInManifest.length > 0) {
      errors.push(
        `Domain "${domain}" declares statuses not present in the token manifest: ${missingInManifest.join(', ')}.`
      );
    }

    const missingInConfig = [...manifestStatuses].filter((status) => !configStatuses.has(status));
    if (missingInConfig.length > 0) {
      errors.push(`Domain "${domain}" is missing statuses from the token manifest: ${missingInConfig.join(', ')}.`);
    }
  }

  for (const [context, domains] of Object.entries(config.contexts ?? {})) {
    const unknown = domains.filter((domain) => !domainKeys.includes(domain));
    if (unknown.length > 0) {
      errors.push(`Context "${context}" references unknown domains: ${unknown.join(', ')}.`);
    }
  }

  return errors;
}

async function collectSourceFiles(relativeDir: string): Promise<string[]> {
  const files: string[] = [];
  const absoluteDir = path.join(ROOT, relativeDir);
  const entries = await readdir(absoluteDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const nextRelative = path.join(relativeDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(nextRelative)));
      continue;
    }

    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(nextRelative);
    }
  }

  return files;
}

async function gatherTargetFiles(): Promise<string[]> {
  const files: string[] = [];

  for (const target of TARGETS) {
    if (target.kind === 'file') {
      files.push(target.path);
      continue;
    }

    files.push(...(await collectSourceFiles(target.path)));
  }

  return files;
}

async function lintSourceFiles(): Promise<string[]> {
  const errors: string[] = [];
  const files = await gatherTargetFiles();

  const statusLiteralPattern = /<StatusChip[^>]*\sstatus\s*=\s*["'`][^"'`]+["'`]/g;
  const statusLiteralBracePattern = /<StatusChip[^>]*\sstatus\s*=\s*\{\s*["'`][^"'`]+["'`]\s*\}/g;
  const toneMapPattern = /toneByStatus/g;

  for (const relativePath of files) {
    const absolutePath = path.join(ROOT, relativePath);
    const content = await readFile(absolutePath, 'utf8');

    if (statusLiteralPattern.test(content) || statusLiteralBracePattern.test(content)) {
      errors.push(`StatusChip literal statuses detected in ${relativePath}`);
    }

    if (toneMapPattern.test(content)) {
      errors.push(`Manual tone map detected in ${relativePath}; rely on token manifest instead.`);
    }
  }

  return errors;
}

async function main() {
  const configErrors = await validateStatusConfig();
  const sourceErrors = await lintSourceFiles();
  const errors = [...configErrors, ...sourceErrors];

  if (errors.length > 0) {
    console.error('Enum→token mapping lint failed:');
    for (const message of errors) {
      console.error(` - ${message}`);
    }
    process.exit(1);
  }

  console.log('Enum→token mapping lint passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
