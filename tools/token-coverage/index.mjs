#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { performance } from 'node:perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');

const schemaPath = path.join(appRoot, 'schemas', 'token-mapping.schema.json');
const mappingDir = path.join(appRoot, 'examples', 'mapping');
const domainDir = path.join(appRoot, 'examples', 'domain');

function formatPercent(numerator, denominator) {
  if (denominator === 0) {
    return '100.0';
  }
  return ((numerator / denominator) * 100).toFixed(1);
}

async function readJsonFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse JSON file ${filePath}: ${error.message}`);
  }
}

async function loadSchema() {
  const schema = await readJsonFile(schemaPath);
  const ajv = new Ajv2020({
    allErrors: true,
    verbose: false,
    strict: false,
  });
  addFormats(ajv);
  const validator = ajv.compile(schema);
  return { schema, validator };
}

async function collectDomainFiles() {
  let entries = [];
  try {
    entries = await fs.readdir(domainDir);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Domain directory not found: ${domainDir}`);
    }
    throw error;
  }
  return entries
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => path.join(domainDir, entry));
}

function uniqueStrings(values) {
  return Array.from(new Set(values));
}

async function validateManifest(validator, filePath) {
  const manifest = await readJsonFile(filePath);
  const isValid = validator(manifest);
  return {
    manifest,
    isValid,
    errors: validator.errors ? validator.errors.slice() : [],
  };
}

function logSchemaErrors(filePath, errors) {
  console.error(`Schema validation errors in ${filePath}:`);
  for (const error of errors) {
    const instancePath = error.instancePath || '/';
    console.error(`  - ${instancePath} ${error.message}`);
  }
}

async function main() {
  const start = performance.now();
  const { validator } = await loadSchema();
  const domainFiles = await collectDomainFiles();

  if (domainFiles.length === 0) {
    console.warn('No domain reference files found; nothing to validate.');
    return;
  }

  let hasFailure = false;
  let aggregateMapped = 0;
  let aggregateTotal = 0;

  for (const domainFile of domainFiles) {
    const domainData = await readJsonFile(domainFile);
    const manifestName = domainData.manifest;
    if (!manifestName || typeof manifestName !== 'string') {
      console.error(`Domain file ${domainFile} is missing a string "manifest" property.`);
      hasFailure = true;
      continue;
    }

    const manifestPath = path.join(mappingDir, `${manifestName}.json`);
    let manifestResult;
    try {
      manifestResult = await validateManifest(validator, manifestPath);
    } catch (error) {
      console.error(`Unable to load manifest for ${manifestName}: ${error.message}`);
      hasFailure = true;
      continue;
    }

    if (!manifestResult.isValid) {
      logSchemaErrors(manifestPath, manifestResult.errors ?? []);
      hasFailure = true;
    }

    const enumValues = Array.isArray(domainData.values) ? domainData.values : [];
    if (enumValues.length === 0) {
      console.warn(`Domain file ${domainFile} does not define any values; skipping coverage check.`);
      continue;
    }

    const expectedValues = uniqueStrings(enumValues);
    const mappings = manifestResult.manifest?.mappings ?? {};
    const mappedKeys = uniqueStrings(Object.keys(mappings));

    const missing = expectedValues.filter((value) => !mappedKeys.includes(value));
    const extras = mappedKeys.filter((value) => !expectedValues.includes(value));

    const mappedCount = expectedValues.length - missing.length;
    aggregateMapped += mappedCount;
    aggregateTotal += expectedValues.length;

    const coveragePercent = formatPercent(mappedCount, expectedValues.length);
    console.log(`• ${manifestName}: ${coveragePercent}% coverage (${mappedCount}/${expectedValues.length})`);

    if (missing.length > 0) {
      hasFailure = true;
      console.error(`  Missing mappings: ${missing.join(', ')}`);
    }
    if (extras.length > 0) {
      console.warn(`  Extra mappings (not present in domain values): ${extras.join(', ')}`);
    }
  }

  if (aggregateTotal > 0) {
    const totalPercent = formatPercent(aggregateMapped, aggregateTotal);
    const durationMs = (performance.now() - start).toFixed(0);
    console.log(`\nTotal coverage: ${totalPercent}% (${aggregateMapped}/${aggregateTotal}) in ${durationMs}ms`);
  }

  if (hasFailure) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
