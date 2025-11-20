#!/usr/bin/env node
import process from 'node:process';

import type { Queryable, SeedExecutionOptions } from './seed-utils.js';
import { requireQueryable, runSeedCli } from './seed-utils.js';
import { POLICY_SEEDS } from './sample-data.js';

export async function seedPolicies(queryable: Queryable | null, options: SeedExecutionOptions = {}): Promise<void> {
  const dryRun = options.dryRun ?? false;

  for (const policy of POLICY_SEEDS) {
    const message = `[communication-seed] policy ${policy.name}`;
    if (dryRun) {
      console.log(`[dry-run] ${message}`);
      continue;
    }

    const executor = requireQueryable(queryable);
    await executor.query(
      `INSERT INTO communication.delivery_policies (id, organization_id, name, retry_config, throttling_config, quiet_hours)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)
       ON CONFLICT (organization_id, name) DO UPDATE
         SET retry_config = EXCLUDED.retry_config,
             throttling_config = EXCLUDED.throttling_config,
             quiet_hours = EXCLUDED.quiet_hours,
             updated_at = now();`,
      [
        policy.id,
        policy.organizationId,
        policy.name,
        JSON.stringify(policy.retryConfig),
        JSON.stringify(policy.throttlingConfig),
        JSON.stringify(policy.quietHours),
      ]
    );
  }
}

if (process.argv[1]?.endsWith('seed-policies.ts')) {
  void runSeedCli(process.argv.slice(2), 'communication-seed-policies', seedPolicies);
}
