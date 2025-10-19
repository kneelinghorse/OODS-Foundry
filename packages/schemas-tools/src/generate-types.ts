#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { compile, type Options } from 'json-schema-to-typescript';

type CliArgs = {
  schemasDir: string;
  outFile: string;
  check: boolean;
};

const DEFAULT_SCHEMAS_DIR = path.resolve(process.cwd(), 'packages/mcp-server/src/schemas');
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
      if (entry.isFile() && entry.name.endsWith('.json')) {
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
    const typeName = toPascalCase(relative);

    const schemaKeys = Object.keys(schema).filter((key) => key !== '$schema');
    if (schemaKeys.length === 1 && typeof schema.$ref === 'string') {
      const targetPath = schema.$ref;
      if (!targetPath.endsWith('.json')) {
        throw new Error(`Unsupported $ref target "${targetPath}" in ${relative}. Expected JSON file reference.`);
      }
      const resolvedTarget = path.resolve(path.dirname(file), targetPath);
      const targetRelative = path.relative(schemasDir, resolvedTarget).replace(/\\/g, '/');
      const refTypeName = toPascalCase(targetRelative);
      declarations.push(`// Source: ${relative}
export type ${typeName} = ${refTypeName};
`);
      continue;
    }

    const contents = await compile(schema, typeName, options);
    declarations.push(
      `// Source: ${relative}
${contents.trim()}
`
    );
  }

  const header = `// @generated
// This file is auto-generated by @oods/schemas-tools.
// Do not edit manually; instead update the source JSON schemas and re-run the generator.

`;

  const nextContent = `${header}${declarations.join('\n')}`.trimEnd() + '\n';

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
