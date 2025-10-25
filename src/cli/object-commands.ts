#!/usr/bin/env node
import { accessSync, constants, existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { ObjectRegistry, type DiagnosticEntry } from '../registry/registry.js';
import { TraitLoader } from '../registry/trait-loader.js';
import { TraitResolver } from '../registry/resolver.js';
import { ParameterValidator } from '../validation/parameter-validator.js';
import { generateObjectInterface } from '../generators/object-type-generator.js';
import {
  renderBarrelFile,
  getOutputFilePath,
  type BarrelEntry,
} from '../generators/barrel-generator.js';
import { parseObjectDefinitionFromFile } from '../parsers/object-parser.js';
import type { ParseError } from '../core/trait-definition.js';
import { type ValidationIssue, type ValidationResult } from '../validation/index.js';
import { toPascalCase } from '../generators/type-utils.js';
import TimeService from '../services/time/index.js';

type CommandHandler = (args: string[]) => Promise<void> | void;

interface CommandDefinition {
  readonly name: string;
  readonly summary: string;
  readonly usage: string;
  readonly examples?: readonly string[];
  readonly handler: CommandHandler;
}

interface ListOptions {
  readonly roots: string[];
  readonly format: 'table' | 'json';
}

interface ResolveOptions {
  readonly name: string;
  readonly objectRoots: string[];
  readonly traitRoots: string[];
  readonly output: 'summary' | 'json';
  readonly validateParameters: boolean;
}

interface ComposeOptions extends ResolveOptions {
  readonly limit: number;
  readonly showProvenance: boolean;
}

interface ValidateOptions {
  readonly paths: string[];
  readonly objectRoots: string[];
  readonly traitRoots: string[];
  readonly compose: boolean;
  readonly output: 'table' | 'json';
}

interface CreateOptions {
  readonly name: string;
  readonly directory: string;
  readonly trait: string;
  readonly domain: string;
  readonly description: string;
  readonly force: boolean;
}

interface GenerateOptions {
  readonly objectRoots: string[];
  readonly traitRoots: string[];
  readonly outputDir: string;
  readonly dryRun: boolean;
  readonly clean: boolean;
  readonly quiet: boolean;
}

const COMMANDS = new Map<string, CommandDefinition>();

function registerCommand(definition: CommandDefinition): void {
  COMMANDS.set(definition.name, definition);
}

function isParseErrorDiagnostic(
  entry: DiagnosticEntry
): entry is Extract<DiagnosticEntry, { type: 'parse_error' }> {
  return entry.type === 'parse_error';
}

function normalizeCommandName(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const index = trimmed.indexOf(':');
  if (index >= 0) {
    return trimmed.slice(index + 1);
  }
  return trimmed;
}

function printHeader(title: string): void {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
}

function printCommandHelp(definition: CommandDefinition): void {
  printHeader(`object:${definition.name}`);
  console.log(definition.summary);
  console.log('\nUsage:');
  console.log(`  ${definition.usage}`);
  if (definition.examples && definition.examples.length > 0) {
    console.log('\nExamples:');
    for (const example of definition.examples) {
      console.log(`  ${example}`);
    }
  }
  console.log('');
}

function printGlobalHelp(): void {
  console.log('Object Registry CLI');
  console.log('===================');
  console.log('\nAvailable commands:');
  for (const definition of COMMANDS.values()) {
    console.log(`  object:${definition.name.padEnd(10)} ${definition.summary}`);
  }
  console.log('\nUse `object:<command> --help` for detailed usage.\n');
}

function uniquePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const raw of paths) {
    const resolved = path.resolve(raw);
    if (!seen.has(resolved)) {
      seen.add(resolved);
      unique.push(resolved);
    }
  }
  return unique;
}

function pathExists(candidate: string): boolean {
  try {
    accessSync(candidate, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function toJsonPointer(field?: string): string {
  if (!field) {
    return '/';
  }

  const normalized = field
    .replace(/\[(\d+)\]/g, '/$1')
    .replace(/\./g, '/')
    .replace(/\/{2,}/g, '/')
    .replace(/^\//, '');

  return normalized.length === 0 ? '/' : `/${normalized}`;
}

function normalizeParseErrors(
  errors: readonly ParseError[] | undefined,
  fallbackFile: string
): ValidationIssue[] {
  if (!errors || errors.length === 0) {
    return [];
  }

  return errors.map((error) => ({
    severity: 'error' as const,
    code: error.code ?? 'PARSE_ERROR',
    message: error.message,
    domain: 'trait',
    source: 'cli',
    fixHint: null,
    location: {
      file: error.file ?? fallbackFile,
      path: toJsonPointer(error.field),
      line: error.line,
      column: error.column,
    },
  }));
}

function buildCompositionFailureIssue(message: string, filePath: string): ValidationIssue {
  return {
    severity: 'error',
    code: 'COMPOSITION_FAILURE',
    message,
    domain: 'composition',
    source: 'cli',
    fixHint: null,
    location: {
      file: filePath,
      path: '/',
    },
  };
}

function defaultObjectRoots(): string[] {
  const cwd = process.cwd();
  const roots: string[] = [];
  const core = path.resolve(cwd, 'objects', 'core');
  const canonical = path.resolve(cwd, 'objects');
  const parent = path.resolve(cwd, '..', 'objects');
  if (pathExists(core)) {
    roots.push(core);
  } else if (pathExists(canonical)) {
    roots.push(canonical);
  } else if (pathExists(parent)) {
    roots.push(parent);
  }
  const examples = path.resolve(cwd, 'examples', 'objects');
  if (roots.length === 0 && pathExists(examples)) {
    roots.push(examples);
  }
  if (roots.length === 0) {
    roots.push(canonical);
  }
  return uniquePaths(roots);
}

function defaultTraitRoots(): string[] {
  const cwd = process.cwd();
  const roots: string[] = [];
  const canonical = path.resolve(cwd, 'traits');
  const parent = path.resolve(cwd, '..', 'traits');
  if (pathExists(canonical)) {
    roots.push(canonical);
  } else if (pathExists(parent)) {
    roots.push(parent);
  }
  const examples = path.resolve(cwd, 'examples', 'traits');
  if (pathExists(examples)) {
    roots.push(examples);
  }
  if (roots.length === 0) {
    roots.push(canonical);
  }
  return uniquePaths(roots);
}

async function withRegistry<T>(
  objectRoots: readonly string[],
  fn: (registry: ObjectRegistry) => Promise<T>
): Promise<T> {
  if (!objectRoots || objectRoots.length === 0) {
    throw new Error('At least one object root must be provided. Use --root to specify a directory.');
  }
  const registry = new ObjectRegistry({
    roots: objectRoots,
    watch: false,
  });
  try {
    await registry.waitUntilReady();
    return await fn(registry);
  } finally {
    registry.close();
  }
}

function buildTraitResolver(traitRoots: readonly string[], validateParameters: boolean): TraitResolver {
  if (!traitRoots || traitRoots.length === 0) {
    throw new Error('Trait resolution requires at least one trait root. Use --traits to provide directories.');
  }
  const loader = new TraitLoader({ roots: traitRoots });
  return new TraitResolver({
    loader,
    validator: new ParameterValidator(),
    validateParameters,
  });
}

function formatTable(headers: string[], rows: string[][]): void {
  if (rows.length === 0) {
    console.log('No results.');
    return;
  }
  const widths = headers.map((header, index) =>
    Math.max(
      header.length,
      ...rows.map((row) => (row[index] ? row[index]!.length : 0))
    )
  );
  const renderRow = (row: string[]) =>
    row.map((cell, index) => (cell ?? '').padEnd(widths[index]!)).join('  ');
  console.log(renderRow(headers));
  console.log(widths.map((width) => '-'.repeat(width)).join('  '));
  for (const row of rows) {
    console.log(renderRow(row));
  }
}

function formatDuration(ms: number): string {
  if (Number.isNaN(ms)) {
    return 'n/a';
  }
  if (ms < 1) {
    return `${(ms * 1000).toFixed(0)}µs`;
  }
  return `${ms.toFixed(1)}ms`;
}

function sanitizeDescription(value: string | undefined): string {
  if (!value) {
    return '-';
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return '-';
  }
  const maxLength = 80;
  return trimmed.length <= maxLength ? trimmed : `${trimmed.slice(0, maxLength - 3)}...`;
}

function kebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .replace(/[^A-Za-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function todayIso(): string {
  return TimeService.nowSystem().toFormat('yyyy-LL-dd');
}

function ensureDirectory(pathname: string): void {
  mkdirSync(pathname, { recursive: true });
}

function parseListOptions(args: string[]): ListOptions {
  const roots: string[] = [];
  let format: 'table' | 'json' = 'table';
  const queue = [...args];
  while (queue.length > 0) {
    const token = queue.shift();
    if (!token) {
      continue;
    }
    switch (token) {
      case '--root':
      case '-r': {
        const value = queue.shift();
        if (!value) {
          throw new Error('Missing value for --root option.');
        }
        roots.push(path.resolve(value));
        break;
      }
      case '--json':
        format = 'json';
        break;
      case '--help':
      case '-h':
        throw new Error('help:list');
      default:
        roots.push(path.resolve(token));
        break;
    }
  }
  return {
    roots: roots.length > 0 ? uniquePaths(roots) : defaultObjectRoots(),
    format,
  };
}

function parseResolveOptions(args: string[], defaults: { includeSchema?: boolean }): ResolveOptions {
  const queue = [...args];
  const roots: string[] = [];
  const traitRoots: string[] = [];
  let name: string | undefined;
  let output: 'summary' | 'json' = 'summary';
  let validateParameters = true;
  while (queue.length > 0) {
    const token = queue.shift();
    if (!token) {
      continue;
    }
    switch (token) {
      case '--root':
      case '-r': {
        const value = queue.shift();
        if (!value) {
          throw new Error('Missing value for --root option.');
        }
        roots.push(path.resolve(value));
        break;
      }
      case '--traits':
      case '-t': {
        const value = queue.shift();
        if (!value) {
          throw new Error('Missing value for --traits option.');
        }
        traitRoots.push(path.resolve(value));
        break;
      }
      case '--json':
        output = 'json';
        break;
      case '--no-validate':
        validateParameters = false;
        break;
      case '--help':
      case '-h':
        throw new Error(defaults.includeSchema ? 'help:compose' : 'help:resolve');
      default:
        if (!name) {
          name = token;
        } else {
          roots.push(path.resolve(token));
        }
        break;
    }
  }
  if (!name) {
    throw new Error('Object name is required. Usage: object:resolve <name>');
  }
  return {
    name,
    objectRoots: roots.length > 0 ? uniquePaths(roots) : defaultObjectRoots(),
    traitRoots: traitRoots.length > 0 ? uniquePaths(traitRoots) : defaultTraitRoots(),
    output,
    validateParameters,
  };
}

function parseComposeOptions(args: string[]): ComposeOptions {
  const queue = [...args];
  const passthrough: string[] = [];
  let limit = 20;
  let showProvenance = true;
  while (queue.length > 0) {
    const token = queue.shift();
    if (!token) {
      continue;
    }
    switch (token) {
      case '--limit': {
        const value = queue.shift();
        if (!value) {
          throw new Error('Missing value for --limit option.');
        }
        const parsed = Number.parseInt(value, 10);
        if (Number.isNaN(parsed) || parsed <= 0) {
          throw new Error('The --limit option must be a positive integer.');
        }
        limit = parsed;
        break;
      }
      case '--no-provenance':
        showProvenance = false;
        break;
      default:
        passthrough.push(token);
        break;
    }
  }
  const base = parseResolveOptions(passthrough, { includeSchema: true });
  return {
    ...base,
    limit,
    showProvenance,
  };
}

function parseValidateOptions(args: string[]): ValidateOptions {
  const queue = [...args];
  const paths: string[] = [];
  const objectRoots: string[] = [];
  const traitRoots: string[] = [];
  let compose = false;
  let output: 'table' | 'json' = 'table';
  while (queue.length > 0) {
    const token = queue.shift();
    if (!token) {
      continue;
    }
    switch (token) {
      case '--root':
      case '-r': {
        const value = queue.shift();
        if (!value) {
          throw new Error('Missing value for --root option.');
        }
        objectRoots.push(path.resolve(value));
        break;
      }
      case '--traits':
      case '-t': {
        const value = queue.shift();
        if (!value) {
          throw new Error('Missing value for --traits option.');
        }
        traitRoots.push(path.resolve(value));
        break;
      }
      case '--compose':
        compose = true;
        break;
      case '--json':
        output = 'json';
        break;
      case '--help':
      case '-h':
        throw new Error('help:validate');
      default:
        paths.push(path.resolve(token));
        break;
    }
  }
  return {
    paths,
    objectRoots: objectRoots.length > 0 ? uniquePaths(objectRoots) : defaultObjectRoots(),
    traitRoots: traitRoots.length > 0 ? uniquePaths(traitRoots) : defaultTraitRoots(),
    compose,
    output,
  };
}

function parseCreateOptions(args: string[]): CreateOptions {
  const queue = [...args];
  let name: string | undefined;
  let directory: string | undefined;
  let trait = 'content/Labelled';
  let domain = 'custom.drafts';
  let description = 'TODO: Describe this object.';
  let force = false;
  while (queue.length > 0) {
    const token = queue.shift();
    if (!token) {
      continue;
    }
    switch (token) {
      case '--dir':
      case '-d': {
        const value = queue.shift();
        if (!value) {
          throw new Error('Missing value for --dir option.');
        }
        directory = path.resolve(value);
        break;
      }
      case '--trait':
      case '-t': {
        const value = queue.shift();
        if (!value) {
          throw new Error('Missing value for --trait option.');
        }
        trait = value;
        break;
      }
      case '--domain':
        domain = queue.shift() ?? domain;
        break;
      case '--description':
      case '-s': {
        const value = queue.shift();
        if (!value) {
          throw new Error('Missing value for --description option.');
        }
        description = value;
        break;
      }
      case '--force':
        force = true;
        break;
      case '--help':
      case '-h':
        throw new Error('help:create');
      default:
        if (!name) {
          name = token;
        } else {
          directory = path.resolve(token);
        }
        break;
    }
  }
  if (!name) {
    throw new Error('Object name is required. Usage: object:create <name>');
  }
  return {
    name,
    directory: directory ?? path.resolve('objects', 'drafts'),
    trait,
    domain,
    description,
    force,
  };
}

function parseGenerateOptions(args: string[]): GenerateOptions {
  const queue = [...args];
  const objectRoots: string[] = [];
  const traitRoots: string[] = [];
  let outputDir: string | undefined;
  let dryRun = false;
  let clean = true;
  let quiet = false;
  while (queue.length > 0) {
    const token = queue.shift();
    if (!token) {
      continue;
    }
    switch (token) {
      case '--root':
      case '-r': {
        const value = queue.shift();
        if (!value) {
          throw new Error('Missing value for --root option.');
        }
        objectRoots.push(path.resolve(value));
        break;
      }
      case '--traits':
      case '-t': {
        const value = queue.shift();
        if (!value) {
          throw new Error('Missing value for --traits option.');
        }
        traitRoots.push(path.resolve(value));
        break;
      }
      case '--out':
      case '--output': {
        const value = queue.shift();
        if (!value) {
          throw new Error('Missing value for --out option.');
        }
        outputDir = path.resolve(value);
        break;
      }
      case '--dry-run':
        dryRun = true;
        break;
      case '--no-clean':
        clean = false;
        break;
      case '--quiet':
        quiet = true;
        break;
      case '--help':
      case '-h':
        throw new Error('help:generate');
      default:
        objectRoots.push(path.resolve(token));
        break;
    }
  }
  return {
    objectRoots: objectRoots.length > 0 ? uniquePaths(objectRoots) : defaultObjectRoots(),
    traitRoots: traitRoots.length > 0 ? uniquePaths(traitRoots) : defaultTraitRoots(),
    outputDir: outputDir ?? path.resolve('generated', 'objects'),
    dryRun,
    clean,
    quiet,
  };
}

// Command handlers will be registered below. Implementation is deferred until after helper definitions.

async function main(): Promise<void> {
  registerCommands();
  const [, , ...argv] = process.argv;
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    printGlobalHelp();
    return;
  }

  const commandName = normalizeCommandName(argv[0]);
  if (!commandName) {
    printGlobalHelp();
    return;
  }

  const definition = COMMANDS.get(commandName);
  if (!definition) {
    console.error(`Unknown command: ${commandName}`);
    printGlobalHelp();
    process.exitCode = 1;
    return;
  }

  const args = argv.slice(1);
  if (args.includes('--help') || args.includes('-h')) {
    printCommandHelp(definition);
    return;
  }

  try {
    await definition.handler(args);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';
    if (message.startsWith('help:')) {
      const [, command] = message.split(':');
      const target = command ? COMMANDS.get(command) : undefined;
      if (target) {
        printCommandHelp(target);
      } else {
        printGlobalHelp();
      }
      return;
    }
    console.error(message);
    process.exitCode = 1;
  }
}

function registerCommands(): void {
  registerCommand({
    name: 'list',
    summary: 'List objects in the registry with domains, tags, and traits.',
    usage: 'object:list [--root <path>] [--json]',
    examples: [
      'yarn object:list',
      'yarn object:list --root ./objects/core --json',
      'yarn object:list --root ./examples/objects',
    ],
    handler: async (args) => {
      const options = parseListOptions(args);
      await withRegistry(options.roots, async (registry) => {
        const records = registry.list();
        const projected = records.map((record) => ({
          name: record.name,
          domain: record.definition.object.domain ?? '-',
          tags: record.tags.join(', ') || '-',
          traits: record.traits.join(', ') || '-',
          source: record.source.path,
          description: sanitizeDescription(record.definition.object.description),
        }));
        if (options.format === 'json') {
          console.log(JSON.stringify(projected, null, 2));
          return;
        }
        formatTable(
          ['Name', 'Domain', 'Tags', 'Traits', 'Source'],
          projected.map((entry) => [
            entry.name,
            entry.domain,
            entry.tags,
            entry.traits,
            path.relative(process.cwd(), entry.source),
          ])
        );
      });
    },
  });

  registerCommand({
    name: 'resolve',
    summary: 'Resolve an object and display trait metadata, tags, and performance.',
    usage: 'object:resolve <name> [--root <path>] [--traits <path>] [--json] [--no-validate]',
    examples: [
      'yarn object:resolve User',
      'yarn object:resolve Product --json',
      'yarn object:resolve Relationship --traits ./traits --traits ./examples/traits',
      'yarn object:resolve User --root ./examples/objects',
    ],
    handler: async (args) => {
      const options = parseResolveOptions(args, { includeSchema: false });
      const traitResolver = buildTraitResolver(options.traitRoots, options.validateParameters);
      await withRegistry(options.objectRoots, async (registry) => {
        const resolved = await registry.resolve(options.name, {
          traitResolver,
          validateParameters: options.validateParameters,
        });
        if (options.output === 'json') {
          console.log(
            JSON.stringify(
              {
                object: resolved.definition.object,
                traits: resolved.resolvedTraits.map((trait) => ({
                  name: trait.reference.name,
                  alias: trait.reference.alias,
                  parameters: trait.parameters,
                  source: trait.sourcePath,
                })),
                fields: Object.keys(resolved.composed.schema),
                metrics: resolved.metadata,
                composed: {
                  traitOrder: resolved.composed.metadata.traitOrder,
                  traitCount: resolved.composed.metadata.traitCount,
                  warnings: resolved.composed.metadata.warnings,
                  performance: resolved.composed.metadata.performance,
                },
              },
              null,
              2
            )
          );
          return;
        }

        printHeader(resolved.definition.object.name);
        console.log(sanitizeDescription(resolved.definition.object.description));
        console.log('');
        console.log(`Domain: ${resolved.definition.object.domain ?? '-'}`);
        console.log(`Tags: ${resolved.definition.object.tags?.join(', ') ?? '-'}`);
        console.log(
          `Traits (${resolved.resolvedTraits.length}): ${resolved.resolvedTraits
            .map((trait) => trait.reference.alias ?? trait.reference.name)
            .join(', ')}`
        );
        console.log(`Fields: ${Object.keys(resolved.composed.schema).length}`);
        console.log(
          `Performance: resolve ${formatDuration(resolved.metadata.resolutionMs)} | compose ${formatDuration(
            resolved.metadata.compositionMs
          )} | total ${formatDuration(resolved.metadata.totalMs)}`
        );
        if (resolved.composed.metadata.warnings.length > 0) {
          console.log('\nWarnings:');
          for (const warning of resolved.composed.metadata.warnings) {
            console.log(`  - ${warning}`);
          }
        }
        console.log('');
      });
    },
  });

  registerCommand({
    name: 'compose',
    summary: 'Compose an object and show field provenance details.',
    usage: 'object:compose <name> [--limit <n>] [--no-provenance] [--json] [--root <path>] [--traits <path>]',
    examples: [
      'yarn object:compose Transaction',
      'yarn object:compose User --limit 10',
      'yarn object:compose Product --json',
    ],
    handler: async (args) => {
      const options = parseComposeOptions(args);
      const traitResolver = buildTraitResolver(options.traitRoots, options.validateParameters);
      await withRegistry(options.objectRoots, async (registry) => {
        const resolved = await registry.resolve(options.name, {
          traitResolver,
          validateParameters: options.validateParameters,
        });
        if (options.output === 'json') {
          const provenanceEntries = Array.from(resolved.composed.metadata.provenance.entries()).map(
            ([field, provenance]) => ({
              field,
              layer: provenance.layer,
              source: provenance.source,
              previousSources: provenance.previousSources,
              overridden: provenance.overridden,
            })
          );
          console.log(
            JSON.stringify(
              {
                object: resolved.definition.object,
                schema: resolved.composed.schema,
                provenance: provenanceEntries,
                metrics: resolved.metadata,
              },
              null,
              2
            )
          );
          return;
        }

        printHeader(`${resolved.definition.object.name} — Schema`);
        const fields = Object.entries(resolved.composed.schema)
          .map(([fieldName, field]) => {
            const provenance = resolved.composed.metadata.provenance.get(fieldName);
            return {
              name: fieldName,
              type: field.type ?? 'unknown',
              required: field.required !== false,
              description: field.description ?? '',
              provenance,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));

        const rows = fields.slice(0, options.limit).map((field) => [
          field.name,
          `${field.type}${field.required ? '' : '?'}`,
          options.showProvenance
            ? field.provenance
              ? `${field.provenance.source} (${field.provenance.layer})`
              : '-'
            : sanitizeDescription(field.description),
        ]);

        const headers = options.showProvenance ? ['Field', 'Type', 'Provenance'] : ['Field', 'Type', 'Description'];
        formatTable(headers, rows);

        if (fields.length > options.limit) {
          console.log(`\nShowing ${options.limit} of ${fields.length} fields. Use --limit to adjust.`);
        }

        console.log(
          `\nPerformance: resolve ${formatDuration(resolved.metadata.resolutionMs)} | compose ${formatDuration(
            resolved.metadata.compositionMs
          )} | total ${formatDuration(resolved.metadata.totalMs)}`
        );
      });
    },
  });

  registerCommand({
    name: 'validate',
    summary: 'Validate object definitions and optionally run full composition checks.',
    usage: 'object:validate [paths...] [--compose] [--root <path>] [--traits <path>] [--json]',
    examples: [
      'yarn object:validate objects/core/User.object.yaml',
      'yarn object:validate --compose',
      'yarn object:validate drafts/*.object.yaml --json',
    ],
    handler: async (args) => {
      const options = parseValidateOptions(args);
      const results: {
        path: string;
        status: 'ok' | 'error';
        issues: ValidationResult['issues'];
        reason?: string;
      }[] = [];

      const traitResolver = options.compose
        ? buildTraitResolver(options.traitRoots, true)
        : undefined;

      if (options.paths.length > 0) {
        for (const target of options.paths) {
          const parseResult = parseObjectDefinitionFromFile(target);
          if (!parseResult.success || !parseResult.data) {
            results.push({
              path: target,
              status: 'error',
              issues: normalizeParseErrors(parseResult.errors, target),
              reason: 'parse',
            });
            continue;
          }

          const definition = parseResult.data;
          const filename = path.basename(target, path.extname(target));
          const objectName =
            definition.object?.name && definition.object.name.trim().length > 0
              ? definition.object.name
              : toPascalCase(filename);

          if (options.compose && traitResolver) {
            try {
              await withRegistry([path.dirname(target)], async (registry) => {
                await registry.resolve(objectName, {
                  traitResolver,
                  validateParameters: true,
                });
              });
              results.push({ path: target, status: 'ok', issues: [] });
            } catch (error) {
              results.push({
                path: target,
                status: 'error',
                issues: [
                  buildCompositionFailureIssue(
                    error instanceof Error ? error.message : String(error),
                    target
                  ),
                ],
                reason: 'compose',
              });
            }
          } else {
            results.push({ path: target, status: 'ok', issues: [] });
          }
        }
      } else {
        await withRegistry(options.objectRoots, async (registry) => {
          const diagnostics = registry.getDiagnostics();
          for (const [filePath, entries] of diagnostics.entries()) {
            const parseEntries = entries.filter(isParseErrorDiagnostic);
            const parseIssues = parseEntries.flatMap((entry) =>
              normalizeParseErrors(entry.errors, filePath)
            );

            results.push({
              path: filePath,
              status: entries.some((entry) => entry.type === 'parse_error') ? 'error' : 'ok',
              issues: parseIssues,
              reason: 'parse',
            });
          }

          for (const record of registry.list()) {
            if (!options.compose || !traitResolver) {
              results.push({
                path: record.source.path,
                status: 'ok',
                issues: [],
              });
              continue;
            }
            try {
              await registry.resolve(record.name, {
                traitResolver,
                validateParameters: true,
              });
              results.push({
                path: record.source.path,
                status: 'ok',
                issues: [],
              });
            } catch (error) {
              results.push({
                path: record.source.path,
                status: 'error',
                issues: [
                  buildCompositionFailureIssue(
                    error instanceof Error ? error.message : String(error),
                    record.source.path
                  ),
                ],
                reason: 'compose',
              });
            }
          }
        });
      }

      const errors = results.filter((result) => result.status === 'error');

      if (options.output === 'json') {
        console.log(JSON.stringify({ results, errors: errors.length }, null, 2));
      } else {
        formatTable(
          ['Status', 'Path', 'Issues'],
          results.map((result) => [
            result.status === 'ok' ? 'OK' : 'ERROR',
            path.relative(process.cwd(), result.path),
            result.issues.length > 0
              ? result.issues.map((issue) => `[${issue.code}] ${issue.message}`).join('; ')
              : '-',
          ])
        );
        console.log(`\nValidated ${results.length} object(s). Errors: ${errors.length}`);
      }

      if (errors.length > 0) {
        process.exitCode = 1;
      }
    },
  });

  registerCommand({
    name: 'create',
    summary: 'Scaffold a new object definition with a starter trait.',
    usage: 'object:create <name> [--dir <path>] [--trait <name>] [--domain <domain>] [--description <text>] [--force]',
    examples: [
      'yarn object:create InventoryItem',
      'yarn object:create MarketingCampaign --dir objects/custom',
      'yarn object:create SupportTicket --trait lifecycle/Stateful --domain operations.support',
    ],
    handler: (args) => {
      const options = parseCreateOptions(args);
      ensureDirectory(options.directory);
      const pascalName = toPascalCase(options.name);
      const fileName = `${kebabCase(pascalName)}.object.yaml`;
      const targetPath = path.join(options.directory, fileName);

      if (!options.force && existsSync(targetPath)) {
        throw new Error(`File already exists: ${targetPath}. Use --force to overwrite.`);
      }

      const content = [
        'object:',
        `  name: ${pascalName}`,
        '  version: 0.1.0',
        `  domain: ${options.domain}`,
        `  description: ${options.description}`,
        '  tags:',
        '    - draft',
        '    - experimental',
        '',
        'traits:',
        `  - name: ${options.trait}`,
        '',
        'schema:',
        '  id:',
        '    type: uuid',
        '    required: true',
        '    description: Canonical identifier for this object.',
        '  name:',
        '    type: string',
        '    required: true',
        '    description: Human-readable label shown in UI contexts.',
        '',
        'metadata:',
        '  owners:',
        '    - TODO: add owner emails',
        '  changelog:',
        '    - version: 0.1.0',
        `      date: "${todayIso()}"`,
        '      description: Initial scaffolding via object:create CLI.',
        '',
      ].join('\n');

      writeFileSync(targetPath, content, 'utf8');

      console.log(`Created ${path.relative(process.cwd(), targetPath)}`);
      console.log('Next steps: update traits, schema, and metadata to match the domain requirements.');
    },
  });

  registerCommand({
    name: 'generate',
    summary: 'Generate TypeScript definitions for all objects in the registry.',
    usage: 'object:generate [--root <path>] [--traits <path>] [--out <dir>] [--dry-run] [--no-clean] [--quiet]',
    examples: [
      'yarn object:generate',
      'yarn object:generate --out ./generated/objects --no-clean',
      'yarn object:generate --dry-run --quiet',
    ],
    handler: async (args) => {
      const options = parseGenerateOptions(args);
      const traitResolver = buildTraitResolver(options.traitRoots, true);
      const generatedEntries: BarrelEntry[] = [];
      const emittedFiles = new Set<string>();

      await withRegistry(options.objectRoots, async (registry) => {
        const records = registry.list();
        if (!options.quiet) {
          console.log(`Generating definitions for ${records.length} object(s).`);
        }

        if (!options.dryRun) {
          ensureDirectory(options.outputDir);
        }

        for (const record of records) {
          const resolved = await registry.resolve(record.name, {
            traitResolver,
            validateParameters: true,
          });
          const generated = generateObjectInterface(resolved);
          generatedEntries.push({
            interfaceName: generated.interfaceName,
            fileName: generated.fileName,
          });
          emittedFiles.add(generated.fileName);

          if (options.dryRun) {
            if (!options.quiet) {
              console.log(` • ${generated.interfaceName} (dry-run)`);
            }
            continue;
          }

          const outputPath = path.join(options.outputDir, generated.fileName);
          writeFileSync(outputPath, generated.code, 'utf8');
          if (!options.quiet) {
            console.log(` • ${path.relative(process.cwd(), outputPath)}`);
          }
        }

        if (options.dryRun) {
          return;
        }

        const barrel = renderBarrelFile(generatedEntries);
        const barrelPath = getOutputFilePath({ outputDir: options.outputDir });
        writeFileSync(barrelPath, barrel, 'utf8');
        emittedFiles.add(path.basename(barrelPath));

        if (options.clean) {
          const existing = readdirSync(options.outputDir, { withFileTypes: true })
            .filter((entry) => entry.isFile())
            .map((entry) => entry.name);
          for (const file of existing) {
            if (!emittedFiles.has(file)) {
              unlinkSync(path.join(options.outputDir, file));
              if (!options.quiet) {
                console.log(` - Removed stale file ${file}`);
              }
            }
          }
        }
      });

      if (!options.quiet) {
        console.log(
          options.dryRun
            ? '\nDry run complete. No files were written.'
            : `\nGenerated ${generatedEntries.length} definition(s) into ${path.relative(process.cwd(), options.outputDir)}.`
        );
      }
    },
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
