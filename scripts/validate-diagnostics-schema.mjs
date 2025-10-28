#!/usr/bin/env node
/**
 * validate-diagnostics-schema.mjs
 *
 * Validates diagnostics.json against the performance-harness.schema.json schema.
 *
 * Usage:
 *   node scripts/validate-diagnostics-schema.mjs
 *
 * Exit codes:
 *   0 - Valid
 *   1 - Validation errors
 *   2 - Missing files or other errors
 *
 * Sprint 18 (B18.8): Performance CI integration - governance validation
 */

import { readFileSync } from 'fs';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const DIAGNOSTICS_PATH = 'diagnostics.json';
const SCHEMA_PATH = 'diagnostics/performance-harness.schema.json';

/**
 * Load JSON file
 */
function loadJSON(path) {
  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ Could not load ${path}: ${error.message}`);
    process.exit(2);
  }
}

/**
 * Main validation
 */
function main() {
  console.log('🔍 Validating diagnostics.json schema compliance...');
  console.log('');

  const diagnostics = loadJSON(DIAGNOSTICS_PATH);
  const schema = loadJSON(SCHEMA_PATH);

  // Initialize AJV with formats
  const ajv = new Ajv({ allErrors: true, verbose: true });
  addFormats(ajv);

  const validate = ajv.compile(schema);

  // Check if performanceHarness exists
  if (!diagnostics.performanceHarness) {
    console.warn('⚠️  No performanceHarness data found in diagnostics.json');
    console.warn('   This is expected if no performance runs have completed yet.');
    process.exit(0);
  }

  // Validate
  const valid = validate(diagnostics);

  if (valid) {
    console.log('✅ Schema validation passed');
    console.log('');

    const { performanceHarness } = diagnostics;
    console.log('Performance Harness Summary:');
    console.log(`  Version:        ${performanceHarness.version}`);
    console.log(`  Last Run:       ${performanceHarness.runTimestamp}`);
    console.log(`  Environment:    ${performanceHarness.environment}`);
    console.log(`  Commit SHA:     ${performanceHarness.commitSha || 'N/A'}`);
    console.log(`  Snapshots:      ${performanceHarness.snapshots?.length || 0}`);

    if (performanceHarness.lastUpdated) {
      console.log(`  Last Updated:   ${performanceHarness.lastUpdated}`);
    }

    process.exit(0);
  } else {
    console.error('❌ Schema validation failed');
    console.error('');

    for (const error of validate.errors || []) {
      console.error(`  • ${error.instancePath || '/'}: ${error.message}`);
      if (error.params) {
        console.error(`    Params: ${JSON.stringify(error.params)}`);
      }
    }

    console.error('');
    console.error('Schema:', SCHEMA_PATH);
    console.error('Data:   ', DIAGNOSTICS_PATH);

    process.exit(1);
  }
}

main();
