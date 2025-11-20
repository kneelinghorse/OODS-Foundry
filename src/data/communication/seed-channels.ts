#!/usr/bin/env node
import process from 'node:process';

import type { Queryable, SeedExecutionOptions } from './seed-utils.js';
import { requireQueryable, runSeedCli } from './seed-utils.js';
import { CHANNEL_SEEDS } from './sample-data.js';

export async function seedChannels(queryable: Queryable | null, options: SeedExecutionOptions = {}): Promise<void> {
  const dryRun = options.dryRun ?? false;

  for (const channel of CHANNEL_SEEDS) {
    const message = `[communication-seed] channel ${channel.name} (${channel.channelType})`;
    if (dryRun) {
      console.log(`[dry-run] ${message}`);
      continue;
    }

    const executor = requireQueryable(queryable);
    await executor.query(
      `INSERT INTO communication.channels (id, organization_id, channel_type, name, config, enabled, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb)
       ON CONFLICT (organization_id, name) DO UPDATE
         SET config = EXCLUDED.config,
             enabled = EXCLUDED.enabled,
             metadata = EXCLUDED.metadata,
             updated_at = now();`,
      [
        channel.id,
        channel.organizationId,
        channel.channelType,
        channel.name,
        JSON.stringify(channel.config),
        channel.enabled,
        JSON.stringify({ source: 'B29.2', channelId: channel.id }),
      ]
    );
  }
}

if (process.argv[1]?.endsWith('seed-channels.ts')) {
  void runSeedCli(process.argv.slice(2), 'communication-seed-channels', seedChannels);
}
