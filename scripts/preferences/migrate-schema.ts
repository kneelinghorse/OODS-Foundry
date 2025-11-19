#!/usr/bin/env tsx

import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { PreferenceDocument } from '@/schemas/preferences/preference-document.js';
import type { PreferenceMigrationStrategy } from '@/schemas/preferences/preference-metadata.js';
import { analyzeSchemaCompatibility } from '@/traits/preferenceable/compatibility-checker.js';
import { runDualWriteMigration } from '@/traits/preferenceable/dual-write-migrator.js';
import {
  applyPreferenceReadRepair,
  rollbackPreferenceReadRepair,
} from '@/traits/preferenceable/read-repair.js';
import {
  JsonlMigrationLogWriter,
  PreferenceMigrationLogger,
  type PreferenceMigrationChange,
} from '@/traits/preferenceable/migration-logger.js';
import { resolvePreferenceSchema } from '@/traits/preferenceable/schema-registry.js';

interface MigrationInputRecord {
  readonly userId: string;
  readonly tenantId?: string;
  readonly document: PreferenceDocument;
}

interface MigrationArtifactEntry {
  readonly userId: string;
  readonly tenantId?: string;
  readonly strategy: PreferenceMigrationStrategy;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly changeSet: readonly PreferenceMigrationChange[];
  readonly document: PreferenceDocument;
  readonly legacyDocument?: PreferenceDocument;
}

interface MigrationArtifactFile {
  readonly version: number;
  readonly generatedAt: string;
  readonly targetVersion: string;
  readonly entries: readonly MigrationArtifactEntry[];
}

interface CliOptions {
  readonly mode: 'migrate' | 'rollback';
  readonly inputPath: string;
  readonly outputPath: string;
  readonly logPath?: string;
  readonly strategy: 'auto' | PreferenceMigrationStrategy;
  readonly targetVersion?: string;
  readonly dryRun: boolean;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!options.inputPath) {
    throw new Error('Missing required --input <path>.');
  }

  if (options.mode === 'rollback') {
    await runRollback(options);
    return;
  }

  await runMigration(options);
}

async function runMigration(options: CliOptions): Promise<void> {
  const targetDefinition = resolvePreferenceSchema(options.targetVersion);
  const records = await readInputRecords(options.inputPath);
  const entries: MigrationArtifactEntry[] = [];
  const logger = options.logPath
    ? new PreferenceMigrationLogger(new JsonlMigrationLogWriter(options.logPath))
    : undefined;

  for (const record of records) {
    const fromVersion = record.document.metadata.schemaVersion;
    const strategy = selectStrategy(options.strategy, fromVersion, targetDefinition.version);
    const context = {
      userId: record.userId,
      tenantId: record.tenantId,
      strategy,
      fromVersion,
      toVersion: targetDefinition.version,
      appliedBy: 'preferences.migrate-schema',
    } as const;

    logger?.log(context, {
      status: 'started',
      message: `Migrating ${record.userId} via ${strategy}`,
    });

    if (strategy === 'lazy') {
      const result = applyPreferenceReadRepair(record.document, {
        targetVersion: targetDefinition.version,
      });
      logger?.log(context, {
        status: 'completed',
        message: result.changed ? 'Lazy read-repair applied' : 'Document already compliant',
        changeSet: result.applied,
      });

      entries.push({
        userId: record.userId,
        tenantId: record.tenantId,
        strategy: 'lazy',
        fromVersion: result.fromVersion,
        toVersion: result.toVersion,
        changeSet: result.applied,
        document: result.document,
      });
      continue;
    }

    const result = runDualWriteMigration(record.document, {
      targetVersion: targetDefinition.version,
    });
    logger?.log(context, {
      status: 'dual_write',
      message: `Dual-write projection ready for ${record.userId}`,
      changeSet: result.changes,
    });
    logger?.log(context, {
      status: 'completed',
      message: 'Eager migration prepared',
    });

    entries.push({
      userId: record.userId,
      tenantId: record.tenantId,
      strategy: 'eager',
      fromVersion: result.fromVersion,
      toVersion: result.toVersion,
      changeSet: result.changes,
      document: result.nextDocument,
      legacyDocument: result.legacyDocument,
    });
  }

  const artifact: MigrationArtifactFile = {
    version: 1,
    generatedAt: new Date().toISOString(),
    targetVersion: targetDefinition.version,
    entries,
  };

  if (!options.dryRun) {
    await writeJson(options.outputPath, artifact);
  }

  console.log(
    `preferences:migrate-schema → processed ${entries.length} document(s) targeting ${targetDefinition.version} (strategy=${options.strategy})`
  );
  if (options.dryRun) {
    console.log('Dry run: output not written.');
  }
}

async function runRollback(options: CliOptions): Promise<void> {
  const artifact = await readArtifact(options.inputPath);
  const entries: MigrationArtifactEntry[] = [];
  const logger = options.logPath
    ? new PreferenceMigrationLogger(new JsonlMigrationLogWriter(options.logPath))
    : undefined;

  for (const entry of artifact.entries) {
    const context = {
      userId: entry.userId,
      tenantId: entry.tenantId,
      strategy: entry.strategy,
      fromVersion: entry.toVersion,
      toVersion: entry.fromVersion,
      appliedBy: 'preferences.migrate-schema',
    } as const;

    logger?.log(context, {
      status: 'rollback',
      message: `Rolling back ${entry.userId} to ${entry.fromVersion}`,
    });

    if (entry.strategy === 'lazy') {
      const reverted = rollbackPreferenceReadRepair(entry.document, entry.changeSet, entry.fromVersion);
      entries.push({
        userId: entry.userId,
        tenantId: entry.tenantId,
        strategy: 'lazy',
        fromVersion: entry.toVersion,
        toVersion: entry.fromVersion,
        changeSet: [],
        document: reverted,
      });
      continue;
    }

    if (!entry.legacyDocument) {
      throw new Error(`Missing legacy document for eager migration rollback (user ${entry.userId}).`);
    }

    entries.push({
      userId: entry.userId,
      tenantId: entry.tenantId,
      strategy: 'eager',
      fromVersion: entry.toVersion,
      toVersion: entry.fromVersion,
      changeSet: [],
      document: entry.legacyDocument,
    });
  }

  const payload: MigrationArtifactFile = {
    version: artifact.version,
    generatedAt: new Date().toISOString(),
    targetVersion: `rollback:${artifact.targetVersion}`,
    entries,
  };

  if (!options.dryRun) {
    await writeJson(options.outputPath, payload);
  }

  console.log(`preferences:migrate-schema → rolled back ${entries.length} document(s).`);
  if (options.dryRun) {
    console.log('Dry run: output not written.');
  }
}

function parseArgs(argv: readonly string[]): CliOptions {
  const cwd = process.cwd();
  let inputPath = '';
  let outputPath = path.resolve(cwd, 'tmp/preferences-migration.json');
  let logPath: string | undefined;
  let strategy: 'auto' | PreferenceMigrationStrategy = 'auto';
  let targetVersion: string | undefined;
  let dryRun = false;
  let mode: 'migrate' | 'rollback' = 'migrate';

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === '--') {
      break;
    }
    switch (arg) {
      case '--input':
        inputPath = path.resolve(cwd, requireValue(argv, ++index, '--input'));
        break;
      case '--output':
        outputPath = path.resolve(cwd, requireValue(argv, ++index, '--output'));
        break;
      case '--log':
        logPath = path.resolve(cwd, requireValue(argv, ++index, '--log'));
        break;
      case '--to':
        targetVersion = requireValue(argv, ++index, '--to');
        break;
      case '--strategy':
        strategy = parseStrategy(requireValue(argv, ++index, '--strategy'));
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--rollback':
        mode = 'rollback';
        break;
      default:
        if (arg.startsWith('--')) {
          throw new Error(`Unknown flag ${arg}`);
        }
        break;
    }
  }

  return {
    mode,
    inputPath,
    outputPath,
    logPath,
    strategy,
    targetVersion,
    dryRun,
  };
}

function parseStrategy(value: string): 'auto' | PreferenceMigrationStrategy {
  if (value === 'auto') {
    return 'auto';
  }
  if (value === 'lazy' || value === 'eager') {
    return value;
  }
  throw new Error(`Unknown strategy: ${value}`);
}

function requireValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`Expected value after ${flag}`);
  }
  return value;
}

async function readInputRecords(filePath: string): Promise<MigrationInputRecord[]> {
  const text = await fs.readFile(filePath, 'utf8');
  const payload = JSON.parse(text);
  if (Array.isArray(payload)) {
    return payload as MigrationInputRecord[];
  }
  if (Array.isArray(payload.records)) {
    return payload.records as MigrationInputRecord[];
  }
  throw new Error('Input file must be an array of { userId, document } entries.');
}

async function readArtifact(filePath: string): Promise<MigrationArtifactFile> {
  const text = await fs.readFile(filePath, 'utf8');
  const payload = JSON.parse(text);
  if (!Array.isArray(payload.entries)) {
    throw new Error('Migration artifact missing entries array.');
  }
  return payload as MigrationArtifactFile;
}

async function writeJson(filePath: string, payload: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function selectStrategy(
  requested: 'auto' | PreferenceMigrationStrategy,
  fromVersion: string,
  toVersion: string
): PreferenceMigrationStrategy {
  if (requested !== 'auto') {
    return requested;
  }
  const report = analyzeSchemaCompatibility(fromVersion, toVersion);
  return report.level === 'breaking' ? 'eager' : 'lazy';
}

void main().catch((error) => {
  console.error('preferences:migrate-schema failed');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
