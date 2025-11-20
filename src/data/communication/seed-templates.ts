#!/usr/bin/env node
import process from 'node:process';

import type { Queryable, SeedExecutionOptions } from './seed-utils.js';
import { requireQueryable, runSeedCli } from './seed-utils.js';
import { TEMPLATE_SEEDS } from './sample-data.js';

export async function seedTemplates(queryable: Queryable | null, options: SeedExecutionOptions = {}): Promise<void> {
  const dryRun = options.dryRun ?? false;

  for (const template of TEMPLATE_SEEDS) {
    const message = `[communication-seed] template ${template.name} (${template.channelType})`;
    if (dryRun) {
      console.log(`[dry-run] ${message}`);
      continue;
    }

    const executor = requireQueryable(queryable);
    await executor.query(
      `INSERT INTO communication.templates (id, organization_id, channel_type, name, subject, body, variables, locale)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
       ON CONFLICT (organization_id, name) DO UPDATE
         SET subject = EXCLUDED.subject,
             body = EXCLUDED.body,
             variables = EXCLUDED.variables,
             locale = EXCLUDED.locale,
             channel_type = EXCLUDED.channel_type,
             updated_at = now();`,
      [
        template.id,
        template.organizationId,
        template.channelType,
        template.name,
        template.subject,
        template.body,
        JSON.stringify(template.variables),
        template.locale,
      ]
    );
  }
}

if (process.argv[1]?.endsWith('seed-templates.ts')) {
  void runSeedCli(process.argv.slice(2), 'communication-seed-templates', seedTemplates);
}
