#!/usr/bin/env tsx
/**
 * Schema → TypeScript generator.
 *
 * Walks the repository `schemas` directory and emits strongly-typed
 * declarations under `generated/types`. Designed to be idempotent and fast so
 * CI can run it in `--check` mode to detect drift.
 */

import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'json-schema-to-typescript';
import type { JSONSchema } from 'json-schema-to-typescript';

const ROOT_DIR = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

interface CliOptions {
  schemaDir: string;
  outDir: string;
  check: boolean;
  dryRun: boolean;
  silent: boolean;
}

interface GenerationResult {
  readonly file: string;
  readonly relative: string;
  readonly status: 'created' | 'updated' | 'unchanged' | 'skipped';
}

const STATIC_EXPORTS: ReadonlyArray<{ modulePath: string; fileName: string }> = [
  { modulePath: './address', fileName: 'address.ts' },
  { modulePath: './authz.d', fileName: 'authz.d.ts' },
  { modulePath: './preferences.d', fileName: 'preferences.d.ts' },
];

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    schemaDir: 'schemas',
    outDir: 'generated/types',
    check: false,
    dryRun: false,
    silent: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--schema-dir':
        options.schemaDir = argv[i + 1] ?? options.schemaDir;
        i += 1;
        break;
      case '--out-dir':
        options.outDir = argv[i + 1] ?? options.outDir;
        i += 1;
        break;
      case '--check':
        options.check = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--silent':
        options.silent = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        break;
    }
  }

  return {
    ...options,
    schemaDir: path.resolve(ROOT_DIR, options.schemaDir),
    outDir: path.resolve(ROOT_DIR, options.outDir),
  };
}

function printHelp(): void {
  console.log(`
Schema → TypeScript generator
---------------------------------------------
Usage:
  pnpm run generate:schema-types [--check]

Options:
  --schema-dir <path>  Directory containing *.schema.json files (default: schemas)
  --out-dir <path>     Output directory for generated TypeScript (default: generated/types)
  --check              Exit with code 1 if generation would modify files
  --dry-run            Log planned writes without touching the filesystem
  --silent             Suppress per-file logging
  --help, -h           Show this help message
`);
}

async function collectSchemaFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const metadata = await stat(fullPath);

    if (metadata.isDirectory()) {
      files.push(...(await collectSchemaFiles(fullPath)));
      continue;
    }

    if (metadata.isFile() && entry.endsWith('.schema.json')) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

async function writeFileIfChanged(
  filePath: string,
  content: string,
  options: Pick<CliOptions, 'check' | 'dryRun'>
): Promise<'created' | 'updated' | 'unchanged' | 'skipped'> {
  const { check, dryRun } = options;

  const previous = existsSync(filePath) ? await readFile(filePath, 'utf8') : null;
  if (previous === content) {
    return 'unchanged';
  }

  if (check) {
    return 'skipped';
  }

  if (dryRun) {
    return previous ? 'updated' : 'created';
  }

  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, content, 'utf8');
  return previous ? 'updated' : 'created';
}

async function generateTypes(options: CliOptions): Promise<GenerationResult[]> {
  const schemaFiles = await collectSchemaFiles(options.schemaDir);
  if (schemaFiles.length === 0) {
    if (!options.silent) {
      console.warn(`No schema files found under ${options.schemaDir}`);
    }
    return [];
  }

  await ensureDir(options.outDir);

  const results: GenerationResult[] = [];
  let wouldChange = false;

  for (const schemaPath of schemaFiles) {
    const relative = path.relative(options.schemaDir, schemaPath);
    const outputRelative = relative.replace(/\.schema\.json$/i, '.ts');
    const outputPath = path.join(options.outDir, outputRelative);

    const raw = await readFile(schemaPath, 'utf8');
    const parsed = JSON.parse(raw) as JSONSchema;
    const sanitized = sanitizeSchema(parsed);
    const typeName = toTypeName(parsed.title ?? path.basename(relative, '.schema.json'));

    const compiled = await compile(sanitized, typeName, {
      cwd: ROOT_DIR,
      bannerComment: `// Auto-generated from ${relative}. Do not edit manually.\n`,
      style: {
        singleQuote: true,
      },
      enableConstEnums: false,
      unknownAny: true,
      additionalProperties: false,
    });

    const trimmed = `${compiled.trim()}\n`;
    const status = await writeFileIfChanged(outputPath, trimmed, options);

    if (status === 'skipped') {
      wouldChange = true;
    }

    if (!options.silent) {
      const label = status === 'skipped' ? 'would change' : status;
      console.log(`• ${outputRelative} — ${label}`);
    }

    results.push({
      file: outputPath,
      relative: outputRelative,
      status,
    });
  }

  const indexStatus = await writeIndex(results, options);
  if (indexStatus === 'skipped') {
    wouldChange = true;
  }

  if (options.check && wouldChange) {
    throw new Error('Schema-generated types are out of date. Re-run without --check to update.');
  }

  return results;
}

async function writeIndex(
  results: GenerationResult[],
  options: CliOptions
): Promise<'created' | 'updated' | 'unchanged' | 'skipped'> {
  if (results.length === 0) {
    return 'unchanged';
  }

  const dynamicExports = results.map((result) => {
    const modulePath = `./${result.relative.replace(/\.ts$/, '')}`;
    return modulePath.split(path.sep).join('/');
  });

  const exportSet = new Set(dynamicExports);
  const manualExports = STATIC_EXPORTS.filter((entry) => {
    if (exportSet.has(entry.modulePath)) {
      return false;
    }
    const targetPath = path.join(options.outDir, entry.fileName);
    return existsSync(targetPath);
  }).map((entry) => entry.modulePath);

  const exports = [...dynamicExports, ...manualExports]
    .map((modulePath) => `export * from '${modulePath}';`)
    .join('\n');

  const content = `// Auto-generated barrel for schema-derived types.\n${exports}\n`;
  const indexPath = path.join(options.outDir, 'index.ts');
  const status = await writeFileIfChanged(indexPath, content, options);

  if (!options.silent) {
    const label = status === 'skipped' ? 'would change' : status;
    console.log(`• index.ts — ${label}`);
  }

  return status;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  try {
    await generateTypes(options);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  }
}

await main();

function sanitizeSchema(schema: JSONSchema): JSONSchema {
  if (Array.isArray(schema)) {
    return schema.map((item) => sanitizeSchema(item as JSONSchema)) as unknown as JSONSchema;
  }

  if (schema && typeof schema === 'object') {
    const clone: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema)) {
      if (key === 'enum' && !Array.isArray(value)) {
        // json-schema-to-typescript cannot handle $data references, so fall back to the base type.
        continue;
      }

      if (key === '$data') {
        continue;
      }

      if (typeof value === 'object' && value !== null) {
        clone[key] = sanitizeSchema(value as JSONSchema);
      } else {
        clone[key] = value;
      }
    }

    return clone as JSONSchema;
  }

  return schema;
}

function toTypeName(rawName: string): string {
  const cleaned = rawName
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1));

  const fallback = cleaned.length > 0 ? cleaned.join('') : 'GeneratedType';
  return /^[A-Za-z_]/.test(fallback) ? fallback : `T${fallback}`;
}
