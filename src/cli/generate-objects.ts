#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { ObjectRegistry } from '../registry/registry.js';
import { generateObjectInterface } from '../generators/object-type-generator.js';
import {
  getOutputFilePath,
  renderBarrelFile,
  type BarrelEntry,
} from '../generators/barrel-generator.js';

interface CliOptions {
  readonly objectRoots: string[];
  readonly traitRoots: string[];
  readonly outputDir: string;
  readonly dryRun: boolean;
  readonly clean: boolean;
  readonly quiet: boolean;
}

interface CliParseState {
  readonly argv: string[];
  position: number;
}

function parseArgs(argv: string[]): CliOptions {
  const state: CliParseState = { argv: [...argv], position: 0 };

  const objectRoots: string[] = [];
  const traitRoots: string[] = [];
  let outputDir: string | undefined;
  let dryRun = false;
  let clean = true;
  let quiet = false;

  while (state.position < state.argv.length) {
    const token = state.argv[state.position++];
    if (!token) {
      continue;
    }

    switch (token) {
      case '--objects':
      case '--object':
      case '-o': {
        const value = nextValue(state, token);
        objectRoots.push(resolve(value));
        break;
      }

      case '--traits':
      case '--trait':
      case '-t': {
        const value = nextValue(state, token);
        traitRoots.push(resolve(value));
        break;
      }

      case '--out':
      case '--output': {
        const value = nextValue(state, token);
        outputDir = resolve(value);
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
        printHelp();
        process.exit(0);
        break;

      default:
        objectRoots.push(resolve(token));
        break;
    }
  }

  const cwd = process.cwd();

  if (objectRoots.length === 0) {
    const objectsRootCandidates = [
      resolve(cwd, 'objects'),
      resolve(cwd, '..', 'objects'),
    ];
    const coreRootCandidates = [
      resolve(cwd, 'objects', 'core'),
      resolve(cwd, '..', 'objects', 'core'),
    ];
    const objectsRoot = objectsRootCandidates.find((candidate) => existsSync(candidate));
    const coreRoot = coreRootCandidates.find((candidate) => existsSync(candidate));
    const examplesRoot = resolve(cwd, 'examples/objects');

    if (objectsRoot) {
      objectRoots.push(objectsRoot);
    } else if (coreRoot) {
      objectRoots.push(coreRoot);
    } else {
      objectRoots.push(examplesRoot);
    }
  }

  if (traitRoots.length === 0) {
    traitRoots.push(resolve(cwd, 'traits'));
    traitRoots.push(resolve(cwd, 'examples/traits'));
  }

  return {
    objectRoots,
    traitRoots,
    outputDir: outputDir ?? resolve(cwd, 'generated/objects'),
    dryRun,
    clean,
    quiet,
  };
}

function nextValue(state: CliParseState, flag: string): string {
  const value = state.argv[state.position++];
  if (!value) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function printHelp(): void {
  console.log(`Usage: yarn generate:objects [options]

Options:
  --objects <path>   Add an object definitions root (repeatable).
  --traits <path>    Add a trait definitions root (repeatable).
  --out <path>       Output directory for generated files (default: ./generated/objects).
  --dry-run          Compute outputs without writing to disk.
  --no-clean         Do not remove orphaned generated files.
  --quiet            Suppress status logging.
  -h, --help         Show this help message.

Positional arguments are treated as additional object roots.
`);
}

async function main(argv: string[]): Promise<void> {
  const options = parseArgs(argv);
  const registry = new ObjectRegistry({
    roots: options.objectRoots,
    watch: false,
  });

  const log = (...args: unknown[]) => {
    if (!options.quiet) {
      console.log(...args);
    }
  };

  try {
    await registry.waitUntilReady();
    const records = registry.list();

    if (records.length === 0) {
      log('No object definitions found. Nothing to generate.');
      return;
    }

    if (!options.dryRun) {
      mkdirSync(options.outputDir, { recursive: true });
    }

    const barrelEntries: BarrelEntry[] = [];
    const generatedFiles = new Set<string>();

    for (const record of records) {
      const resolved = await registry.resolve(record.name, {
        traitRoots: options.traitRoots,
      });

      const generated = generateObjectInterface(resolved);
      barrelEntries.push({
        interfaceName: generated.interfaceName,
        fileName: generated.fileName,
      });

      generatedFiles.add(generated.fileName);
      const outputPath = join(options.outputDir, generated.fileName);

      if (options.dryRun) {
        log(`[dry-run] ${record.name} -> ${outputPath}`);
        continue;
      }

      const updated = writeFileIfChanged(outputPath, generated.code);
      if (updated) {
        log(`Wrote ${outputPath}`);
      }
    }

    const barrelPath = getOutputFilePath({ outputDir: options.outputDir });
    const barrelContent = renderBarrelFile(barrelEntries);
    if (options.dryRun) {
      log(`[dry-run] Barrel -> ${barrelPath}`);
    } else {
      const updated = writeFileIfChanged(barrelPath, barrelContent);
      if (updated) {
        log(`Wrote ${barrelPath}`);
      }
    }

    if (options.clean && !options.dryRun) {
      cleanOrphanFiles(options.outputDir, generatedFiles, log);
    }
  } finally {
    registry.close();
  }
}

function writeFileIfChanged(filePath: string, contents: string): boolean {
  if (existsSync(filePath)) {
    const current = readFileSync(filePath, 'utf8');
    if (current === contents) {
      return false;
    }
  }

  writeFileSync(filePath, contents, 'utf8');
  return true;
}

function cleanOrphanFiles(
  outputDir: string,
  generated: Set<string>,
  log: (...args: unknown[]) => void
): void {
  const entries = readdirSync(outputDir);

  for (const entry of entries) {
    if (entry === 'index.ts') {
      continue;
    }
    if (!entry.endsWith('.d.ts')) {
      continue;
    }
    if (generated.has(entry)) {
      continue;
    }

    const fullPath = join(outputDir, entry);
    const stats = statSync(fullPath);
    if (!stats.isFile()) {
      continue;
    }

    unlinkSync(fullPath);
    log(`Removed stale file ${fullPath}`);
  }
}

main(process.argv.slice(2)).catch((error) => {
  console.error('generate:objects failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
