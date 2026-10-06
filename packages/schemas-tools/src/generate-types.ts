#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { compile, type Options } from 'json-schema-to-typescript';

type CliArgs = {
  schemasDir: string;
  outFile: string;
  check: boolean;
};

// Resolve defaults from this file's location (repo-root-relative), NOT the
// current working directory — running the generator from packages/schemas-tools
// used to nest a stray copy at packages/schemas-tools/packages/mcp-server/...
// (s106 review). Explicit --schemas/--out overrides still resolve against cwd.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DEFAULT_SCHEMAS_DIR = path.resolve(REPO_ROOT, 'packages/mcp-server/src/schemas');
const DEFAULT_OUT_FILE = path.resolve(DEFAULT_SCHEMAS_DIR, 'generated.ts');

function printUsage(): void {
  const script = path.relative(process.cwd(), process.argv[1] ?? 'generate-types.ts');
  // eslint-disable-next-line no-console
  console.log(`Usage: ${script} [--schemas <dir>] [--out <file>] [--check]

Options:
  --schemas, -s   Directory containing JSON schema files (default: packages/mcp-server/src/schemas)
  --out, -o       Output TypeScript file (default: <schemas>/generated.ts)
  --check, -c     Do not write files; exit with code 1 if output would change
  --help, -h      Show this message
`);
}

function parseArgs(argv: string[]): CliArgs {
  let schemasDir = DEFAULT_SCHEMAS_DIR;
  let outFile = DEFAULT_OUT_FILE;
  let check = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--schemas':
      case '-s': {
        const next = argv[i + 1];
        if (!next) {
          throw new Error(`Missing value for ${arg}`);
        }
        schemasDir = path.resolve(process.cwd(), next);
        i += 1;
        break;
      }
      case '--out':
      case '-o': {
        const next = argv[i + 1];
        if (!next) {
          throw new Error(`Missing value for ${arg}`);
        }
        outFile = path.resolve(process.cwd(), next);
        i += 1;
        break;
      }
      case '--check':
      case '-c':
        check = true;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('-')) {
          throw new Error(`Unknown option: ${arg}`);
        }
    }
  }

  return { schemasDir, outFile, check };
}

async function readJson(file: string): Promise<Record<string, unknown>> {
  const raw = await fs.readFile(file, 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

// Data artifacts that live alongside the JSON SCHEMAS but must never be compiled
// into generated.ts. measure-registry.json (sprint-117) is a governed-measure DATA
// file; compiling it throws 'Unable to determine root type' and reds generate:check.
// measure-registry.schema.json (sprint-118 m03) IS a valid schema but is used ONLY
// for runtime AJV-validate-at-load — generating a MeasureRegistrySchema type would
// collide with the hand-written MeasureEntry interface (a dual-source-of-truth smell),
// so it is skip-listed too. style-library.json + style-library-artifact.schema.json
// (sprint-123 A1) are the colour-skin counterpart and follow the same recipe: the data
// file has no root type (would red generate:check) and the schema is runtime-validate-
// only (a generated type would collide with the hand-written StyleLibraryArtifact
// interface). Both still bundle to dist/ via the package.json wildcard cp — only the
// type generator skips them; generated.ts stays byte-identical.
// style-library-contribution.schema.json (sprint-124 m02) is the INBOUND counterpart —
// the DRAFT format divergent-inspector sends measured fingerprints back in. It is SPEC-
// ONLY this sprint (no runtime ingestion loader yet; ingestion is deferred until the
// format is ratified with darryl), so it is skip-listed to keep generated.ts a NO-OP for
// an unratified format — emitting a type now would lock a shape that is still being
// co-authored. Same wildcard cp bundles it to dist/.
// component-schema.json is runtime DATA compiled by
// structuredData.fetch at module load, not a tool wire contract. It is copied to
// dist/schemas with the other JSON assets but must not emit a generated type.
const NON_SCHEMA_DATA_FILES = new Set([
  'component-schema.json',
  'measure-registry.json',
  'measure-registry.schema.json',
  'style-library-artifact.schema.json',
  'style-library.json',
  'style-library-contribution.schema.json',
]);

async function collectSchemaFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const nested = await collectSchemaFiles(fullPath);
        files.push(...nested);
        return;
      }
      if (entry.isFile() && entry.name.endsWith('.json') && !NON_SCHEMA_DATA_FILES.has(entry.name)) {
        files.push(fullPath);
      }
    })
  );
  files.sort((a, b) => a.localeCompare(b));
  return files;
}

function toPascalCase(value: string): string {
  const normalized = value
    .replace(/\.json$/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^\w/]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const segments = normalized.split(/[/\-]+/).filter(Boolean);
  return segments
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join('');
}

async function ensureDirectory(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

const TYPE_OVERRIDES: Record<string, string> = {
  'repl.ui.schema.json': 'UiSchema',
  'repl.patch.json': 'ReplPatch',
  'repl.render.input.json': 'ReplRenderInput',
  'repl.render.output.json': 'ReplRenderOutput',
  'repl.validate.input.json': 'ReplValidateInput',
  'repl.validate.output.json': 'ReplValidateOutput',
};

function rootNameFor(relative: string): string {
  return TYPE_OVERRIDES[relative] ?? toPascalCase(relative);
}

function indentBlock(block: string, spaces = 2): string {
  const pad = ' '.repeat(spaces);
  return block
    .split('\n')
    .map((line) => (line.length ? `${pad}${line}` : line))
    .join('\n');
}

function findRootExportName(contents: string, preferredName: string, relative: string): string {
  const matches = Array.from(contents.matchAll(/export\s+(?:interface|type|enum)\s+([A-Za-z0-9_]+)/g));
  if (matches.length === 0) {
    throw new Error(`Unable to determine root type for ${relative}.`);
  }
  const exportNames = matches.map((match) => match[1]).filter(Boolean);
  const preferredLower = preferredName.toLowerCase();
  const preferred = exportNames.find((name) => name.toLowerCase() === preferredLower);
  return preferred ?? exportNames[0] ?? preferredName;
}

async function generateTypes({ schemasDir, outFile, check }: CliArgs): Promise<void> {
  const stat = await fs.stat(schemasDir).catch(() => {
    throw new Error(`Schema directory not found: ${schemasDir}`);
  });
  if (!stat.isDirectory()) {
    throw new Error(`Schema path is not a directory: ${schemasDir}`);
  }

  const files = await collectSchemaFiles(schemasDir);
  if (!files.length) {
    throw new Error(`No schema files found under ${schemasDir}`);
  }

  const rootNames = new Map<string, string>();
  for (const file of files) {
    const relative = path.relative(schemasDir, file).replace(/\\/g, '/');
    rootNames.set(relative, rootNameFor(relative));
  }

  const options: Partial<Options> = {
    bannerComment: '',
    cwd: schemasDir,
    format: true,
    style: {
      singleQuote: true,
    },
    unknownAny: false,
  };

  const declarations: string[] = [];
  for (const file of files) {
    const schema = await readJson(file);
    const relative = path.relative(schemasDir, file).replace(/\\/g, '/');
    const typeName = rootNames.get(relative) ?? rootNameFor(relative);
    const namespaceName = `${typeName}Schema`;

    const schemaKeys = Object.keys(schema).filter((key) => key !== '$schema');
    if (schemaKeys.length === 1 && typeof schema.$ref === 'string') {
      const targetPath = schema.$ref;
      if (!targetPath.endsWith('.json')) {
        throw new Error(`Unsupported $ref target "${targetPath}" in ${relative}. Expected JSON file reference.`);
      }
      const resolvedTarget = path.resolve(path.dirname(file), targetPath);
      const targetRelative = path.relative(schemasDir, resolvedTarget).replace(/\\/g, '/');
      const refTypeName = rootNames.get(targetRelative) ?? rootNameFor(targetRelative);
      declarations.push(`// Source: ${relative}
export namespace ${namespaceName} {
  export type ${typeName} = ${refTypeName};
}
export type ${typeName} = ${namespaceName}.${typeName};
`);
      continue;
    }

    const schemaCopy = JSON.parse(JSON.stringify(schema)) as Record<string, unknown>;
    schemaCopy.title = typeName;
    const contents = await compile(schemaCopy, typeName, options);
    const rootExport = findRootExportName(contents, typeName, relative);
    declarations.push(
      `// Source: ${relative}
export namespace ${namespaceName} {
${indentBlock(contents.trim(), 2)}
}
export type ${typeName} = ${namespaceName}.${rootExport};
`
    );
  }

  const header = `// @generated
// This file is auto-generated by @oods/schemas-tools.
// Do not edit manually; instead update the source JSON schemas and re-run the generator.

`;

  const aliases = `
// Canonical aliases for shared REPL/UI schema shapes.
export type UiElement = UiSchemaSchema.UiElement;
export type UiLayout = UiSchemaSchema.Layout;
export type UiStyle = UiSchemaSchema.Style;
export type UiProps = UiSchemaSchema.Props;
export type UiBindings = UiSchemaSchema.Bindings;
export type UiMeta = UiSchemaSchema.Meta;
export type FieldSchemaEntry = UiSchemaSchema.FieldSchemaEntry;

export type ReplJsonPatchOperation = ReplPatchSchema.JsonPatchOp;
export type ReplNodePatch = ReplPatchSchema.NodePatch;

export type ReplIssue = ReplRenderOutputSchema.Issue;
export type ReplRenderPreview = NonNullable<ReplRenderOutput['preview']>;
export type ReplValidationMeta = NonNullable<ReplRenderOutput['meta']>;
export type ReplRenderFormat = NonNullable<NonNullable<ReplRenderOutput['output']>['format']>;
`;

  const nextContent = `${header}${declarations.join('\n')}${aliases}`.trimEnd() + '\n';

  const existingContent = await fs.readFile(outFile, 'utf8').catch(() => null);

  if (check) {
    if (existingContent === null) {
      // eslint-disable-next-line no-console
      console.error(`Schema type output missing at ${outFile}`);
      process.exitCode = 1;
      return;
    }
    if (existingContent !== nextContent) {
      // eslint-disable-next-line no-console
      console.error('Schema type definitions are out of date. Run the generator to update them.');
      process.exitCode = 1;
    }
    return;
  }

  if (existingContent === nextContent) {
    return;
  }

  await ensureDirectory(outFile);
  await fs.writeFile(outFile, nextContent, 'utf8');
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2));
    await generateTypes(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(message);
    process.exit(1);
  }
}

void main();
