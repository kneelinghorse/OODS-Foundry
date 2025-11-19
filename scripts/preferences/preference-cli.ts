#!/usr/bin/env tsx

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { PreferenceDocument, PreferenceValue } from '@/schemas/preferences/preference-document.js';
import type { PreferenceMetadata } from '@/schemas/preferences/preference-metadata.js';
import { PreferenceStore } from '@/traits/preferenceable/preference-store.js';

interface UserPreferenceRecord {
  readonly user_id: string;
  readonly display_name?: string;
  preference_document: PreferenceDocument;
  preference_metadata: PreferenceMetadata;
  preference_version: string;
  preference_namespaces: readonly string[];
  preference_mutations: number;
  updated_at?: string;
}

interface PreferenceDataFile {
  version: number;
  updatedAt?: string;
  defaults?: {
    namespaces?: readonly string[];
    schemaVersion?: string;
  };
  records: UserPreferenceRecord[];
}

interface CliOptions {
  readonly dataPath: string;
  readonly command: string;
  readonly args: readonly string[];
}

const DEFAULT_DATA_PATH = resolve(process.cwd(), 'data/user-preferences.json');

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!options.command) {
    throw new Error('Usage: pnpm user:prefs <get|set|reset|export> ...');
  }

  const data = await loadData(options.dataPath);
  const record = findRecord(data, options.args[0]);

  switch (options.command) {
    case 'get': {
      assertArgCount(options.args, 1, 'get <user-id>');
      renderSummary(record);
      break;
    }
    case 'export': {
      assertArgCount(options.args, 1, 'export <user-id>');
      console.log(JSON.stringify(record.preference_document, null, 2));
      break;
    }
    case 'reset': {
      assertArgCount(options.args, 1, 'reset <user-id>');
      await runReset(data, record, options.dataPath);
      break;
    }
    case 'set': {
      assertArgCount(options.args, 3, 'set <user-id> <path> <value>');
      await runSet(data, record, options.args[1]!, options.args[2]!, options.dataPath);
      break;
    }
    default: {
      throw new Error(`Unknown command "${options.command}".`);
    }
  }
}

function parseArgs(argv: readonly string[]): CliOptions {
  const args = [...argv];
  let dataPath = DEFAULT_DATA_PATH;
  while (args.length && args[0]?.startsWith('--')) {
    const flag = args.shift();
    if (flag === '--data') {
      const next = args.shift();
      if (!next) {
        throw new Error('Missing value for --data <path>.');
      }
      dataPath = resolve(process.cwd(), next);
      continue;
    }
    throw new Error(`Unsupported flag ${flag}.`);
  }

  const [command, ...rest] = args;
  return {
    dataPath,
    command: command ?? '',
    args: rest,
  } satisfies CliOptions;
}

async function loadData(dataPath: string): Promise<PreferenceDataFile> {
  const raw = await readFile(dataPath, 'utf8');
  const parsed = JSON.parse(raw) as PreferenceDataFile;
  if (!Array.isArray(parsed.records)) {
    throw new Error(`Preference data at ${dataPath} is missing a records array.`);
  }
  return parsed;
}

async function saveData(data: PreferenceDataFile, dataPath: string): Promise<void> {
  data.updatedAt = new Date().toISOString();
  await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function findRecord(data: PreferenceDataFile, userId: string | undefined): UserPreferenceRecord {
  if (!userId) {
    throw new Error('Missing <user-id> argument.');
  }
  const record = data.records.find((entry) => entry.user_id === userId);
  if (!record) {
    throw new Error(`No preference record found for ${userId}.`);
  }
  return record;
}

async function runReset(
  data: PreferenceDataFile,
  record: UserPreferenceRecord,
  dataPath: string
): Promise<void> {
  const store = createStore(record, data);
  store.resetToDefaults();
  record.preference_mutations = record.preference_mutations + 1;
  updateRecordFromStore(record, store);
  await saveData(data, dataPath);
  console.log(`Preferences for ${record.display_name ?? record.user_id} reset to defaults.`);
}

async function runSet(
  data: PreferenceDataFile,
  record: UserPreferenceRecord,
  rawPath: string,
  rawValue: string,
  dataPath: string
): Promise<void> {
  const store = createStore(record, data);
  const pathSegments = normalizePath(rawPath);
  if (!pathSegments.length) {
    throw new Error('Preference path must contain at least one segment.');
  }
  const value = parsePreferenceValue(rawValue);
  store.setPreference(pathSegments, value);
  record.preference_mutations = record.preference_mutations + 1;
  updateRecordFromStore(record, store);
  await saveData(data, dataPath);
  console.log(`Updated ${pathSegments.join('.')} for ${record.display_name ?? record.user_id}.`);
}

function createStore(record: UserPreferenceRecord, data: PreferenceDataFile): PreferenceStore {
  return new PreferenceStore(
    {
      document: record.preference_document,
    },
    {
      namespaces: record.preference_namespaces.length
        ? record.preference_namespaces
        : data.defaults?.namespaces,
      schemaVersion: record.preference_metadata.schemaVersion ?? data.defaults?.schemaVersion,
      version: record.preference_version,
    }
  );
}

function updateRecordFromStore(record: UserPreferenceRecord, store: PreferenceStore): void {
  const document = store.toDocument();
  record.preference_document = document;
  record.preference_metadata = document.metadata;
  record.preference_version = document.version;
  record.preference_namespaces = store.getNamespaces();
  record.updated_at = new Date().toISOString();
}

function normalizePath(path: string): readonly string[] {
  return path
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function parsePreferenceValue(raw: string): PreferenceValue {
  const trimmed = raw.trim();
  if (!trimmed.length) {
    return '';
  }
  if (trimmed === 'true') {
    return true;
  }
  if (trimmed === 'false') {
    return false;
  }
  if (trimmed === 'null') {
    return null;
  }
  if (!Number.isNaN(Number(trimmed)) && Number.parseFloat(trimmed).toString() === trimmed) {
    return Number(trimmed);
  }
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed) as PreferenceValue;
    } catch (error) {
      throw new Error(`Unable to parse JSON value: ${(error as Error).message}`);
    }
  }
  return trimmed;
}

function renderSummary(record: UserPreferenceRecord): void {
  const header = `${record.display_name ?? 'User'} (${record.user_id})`;
  console.log(header);
  console.log(`version=${record.preference_version} · namespaces=${record.preference_namespaces.join(', ')}`);
  console.log(`lastUpdated=${record.preference_metadata.lastUpdated} · mutations=${record.preference_mutations}`);

  const rows = flattenPreferences(record.preference_document.preferences);
  if (!rows.length) {
    console.log('No preferences recorded yet.');
    return;
  }

  for (const row of rows) {
    console.log(`- ${row.path} = ${row.value}`);
  }
}

function flattenPreferences(preferences: PreferenceDocument['preferences']): { path: string; value: string }[] {
  const rows: { path: string; value: string }[] = [];
  const visit = (value: PreferenceValue, trail: string[]): void => {
    if (value == null) {
      rows.push({ path: trail.join('.'), value: 'null' });
      return;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      rows.push({ path: trail.join('.'), value: String(value) });
      return;
    }
    if (typeof value === 'boolean') {
      rows.push({ path: trail.join('.'), value: value ? 'true' : 'false' });
      return;
    }
    if (Array.isArray(value)) {
      rows.push({ path: trail.join('.'), value: `[${value.map((entry) => JSON.stringify(entry)).join(', ')}]` });
      return;
    }
    const entries = Object.entries(value);
    if (!entries.length) {
      rows.push({ path: trail.join('.'), value: '{}' });
      return;
    }
    for (const [key, child] of entries) {
      visit(child, [...trail, key]);
    }
  };

  for (const [namespace, value] of Object.entries(preferences)) {
    visit(value, [namespace]);
  }

  return rows;
}

function assertArgCount(args: readonly string[], count: number, usage: string): void {
  if ((args.length ?? 0) < count) {
    throw new Error(`Usage: ${usage}`);
  }
}

main().catch((error) => {
  console.error(`[preferences-cli] ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
