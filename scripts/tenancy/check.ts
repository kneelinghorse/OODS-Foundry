#!/usr/bin/env tsx
/**
 * Tenancy Check Script
 * 
 * Runs tenancy test suite across multiple modes to validate isolation.
 * Executes matrix of: [shared-schema, schema-per-tenant, external-adapter] × test suites.
 * 
 * Usage:
 *   pnpm tenancy:check
 * 
 * @module scripts/tenancy/check
 */

import { spawn } from 'node:child_process';

interface TestResult {
  mode: string;
  passed: boolean;
  duration: number;
  output: string;
}

const TENANCY_MODES = ['shared-schema', 'schema-per-tenant', 'external-adapter'] as const;

async function runTests(mode: string): Promise<TestResult> {
  const startTime = Date.now();
  console.log(`\n🧪 Running tests in ${mode} mode...\n`);

  return new Promise((resolve) => {
    const proc = spawn('pnpm', ['vitest', 'run', 'tests/tenancy/', '--reporter=verbose'], {
      env: {
        ...process.env,
        OODS_TENANCY_MODE: mode,
      },
      stdio: 'inherit',
    });

    let output = '';

    proc.stdout?.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', (code) => {
      const duration = Date.now() - startTime;
      resolve({
        mode,
        passed: code === 0,
        duration,
        output,
      });
    });
  });
}

async function main(): Promise<void> {
  console.log('🔍 OODS Tenancy Matrix Check\n');
  console.log('Testing modes:', TENANCY_MODES.join(', '));
  console.log('─'.repeat(60));

  const results: TestResult[] = [];

  for (const mode of TENANCY_MODES) {
    const result = await runTests(mode);
    results.push(result);

    if (!result.passed) {
      console.error(`\n❌ Tests failed in ${mode} mode`);
    } else {
      console.log(`\n✅ Tests passed in ${mode} mode (${result.duration}ms)`);
    }
  }

  // Print summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 Summary\n');

  const allPassed = results.every((r) => r.passed);
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  results.forEach((result) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${status} | ${result.mode.padEnd(20)} | ${result.duration}ms`);
  });

  console.log('\n' + '═'.repeat(60));
  console.log(`Total time: ${totalDuration}ms`);

  if (allPassed) {
    console.log('\n✅ All tenancy modes passed!\n');
    process.exit(0);
  } else {
    console.error('\n❌ Some tenancy modes failed. See output above.\n');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Tenancy check failed:', error);
  process.exit(1);
});
