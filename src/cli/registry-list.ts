#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { ObjectRegistry } from '../registry/registry.js';

type OutputFormat = 'table' | 'json';

interface CliOptions {
  roots: string[];
  format: OutputFormat;
}

function parseArgs(argv: string[]): CliOptions {
  const roots: string[] = [];
  let format: OutputFormat = 'table';

  const args = [...argv];
  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) {
      continue;
    }

    switch (arg) {
      case '--root':
      case '-r': {
        const value = args.shift();
        if (!value) {
          throw new Error('Missing value for --root option.');
        }
        roots.push(resolve(value));
        break;
      }
      case '--json':
        format = 'json';
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        roots.push(resolve(arg));
        break;
    }
  }

  if (roots.length === 0) {
    const cwd = process.cwd();
    const canonicalRoot = resolve(cwd, 'objects');
    const coreRoot = resolve(canonicalRoot, 'core');
    const examplesRoot = resolve(cwd, 'examples/objects');

    let canonicalAdded = false;
    if (existsSync(coreRoot)) {
      roots.push(coreRoot);
      canonicalAdded = true;
    } else if (existsSync(canonicalRoot)) {
      roots.push(canonicalRoot);
      canonicalAdded = true;
    }

    if (existsSync(examplesRoot)) {
      roots.push(examplesRoot);
    } else if (!canonicalAdded) {
      roots.push(examplesRoot);
    }
  }

  return { roots, format };
}

function printHelp(): void {
  console.log(`Usage: yarn registry:list [options] [paths...]

Options:
  -r, --root <path>   Root directory containing *.object.yaml files. May be repeated.
      --json          Output results as JSON instead of a table.
  -h, --help          Show this help message.

If no roots are provided, the command defaults to ./objects/core (when present) and ./examples/objects relative to the current working directory.
`);
}

function printTable(records: readonly ReturnType<typeof projectRecord>[]): void {
  if (records.length === 0) {
    console.log('No object definitions found.');
    return;
  }

  const headers = ['Name', 'Domains', 'Tags', 'Traits', 'Source'];
  const rows = records.map((record) => [
    record.name,
    formatList(record.domains),
    formatList(record.tags),
    formatList(record.traits),
    record.source,
  ]);

  const widths = headers.map((header, columnIndex) =>
    Math.max(
      header.length,
      ...rows.map((row) => row[columnIndex].length)
    )
  );

  const formatRow = (row: string[]) =>
    row
      .map((value, index) => value.padEnd(widths[index]))
      .join('  ');

  console.log(formatRow(headers));
  console.log(
    widths
      .map((width) => '-'.repeat(width))
      .join('  ')
  );

  rows.forEach((row) => {
    console.log(formatRow(row));
  });
}

function formatList(values: readonly string[]): string {
  if (!values || values.length === 0) {
    return '-';
  }

  return values.join(', ');
}

function projectRecord(record: ReturnType<ObjectRegistry['list']>[number]) {
  return {
    name: record.name,
    domains: record.domains,
    tags: record.tags,
    traits: record.traits,
    source: record.source.path,
  };
}

async function main(argv: string[]): Promise<void> {
  let options: CliOptions;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
    return;
  }

  const registry = new ObjectRegistry({
    roots: options.roots,
    watch: false,
  });

  try {
    await registry.waitUntilReady();
    const projected = registry.list().map(projectRecord);

    if (options.format === 'json') {
      console.log(JSON.stringify(projected, null, 2));
      return;
    }

    printTable(projected);
  } finally {
    registry.close();
  }
}

main(process.argv.slice(2)).catch((error) => {
  console.error('registry:list failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
