import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { newDb } from 'pg-mem';
import { describe, expect, it } from 'vitest';

import {
  CHANNEL_SEEDS,
  COMMUNICATION_SAMPLE_IDS,
  TEMPLATE_SEEDS,
} from '@/data/communication/sample-data.js';
import { seedChannels } from '@/data/communication/seed-channels.js';
import { seedPolicies } from '@/data/communication/seed-policies.js';
import { seedTemplates } from '@/data/communication/seed-templates.js';

const MIGRATIONS = [
  '20251120_001_create_communication_schema.sql',
  '20251120_002_create_channels_table.sql',
  '20251120_003_create_templates_table.sql',
  '20251120_004_create_delivery_policies_table.sql',
  '20251120_005_create_messages_table.sql',
  '20251120_006_create_message_recipients_table.sql',
  '20251120_007_create_delivery_attempts_table.sql',
  '20251120_008_create_conversations_table.sql',
  '20251120_009_create_conversation_participants_table.sql',
  '20251120_010_create_sla_metrics_table.sql',
] as const;

const MIGRATIONS_DIR = path.resolve('database/migrations');

function readSql(fileName: string): string {
  return readFileSync(path.join(MIGRATIONS_DIR, fileName), 'utf8');
}

function stripConstraint(sql: string, constraintName: string): string {
  const marker = `CONSTRAINT ${constraintName}`;
  const start = sql.indexOf(marker);
  if (start === -1) {
    return sql;
  }
  let removalStart = sql.lastIndexOf(',', start);
  if (removalStart === -1) {
    removalStart = start;
  }
  const checkIndex = sql.indexOf('CHECK', start);
  if (checkIndex === -1) {
    return sql;
  }
  let openIndex = sql.indexOf('(', checkIndex);
  if (openIndex === -1) {
    return sql;
  }
  let depth = 1;
  let cursor = openIndex + 1;
  while (cursor < sql.length && depth > 0) {
    const char = sql[cursor];
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
    }
    cursor += 1;
  }
  return `${sql.slice(0, removalStart)}\n${sql.slice(cursor)}`;
}

function chunkStatements(sql: string): readonly string[] {
  const stripped = stripConstraint(sql, 'templates_body_covers_variables');
  return stripped
    .replace(/^--.*$/gm, '')
    .replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/g, '')
    .replace(/DROP SCHEMA IF EXISTS communication CASCADE;/gi, '')
    .replace(/BEGIN;/gi, '')
    .replace(/COMMIT;/gi, '')
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0 && !statement.toUpperCase().startsWith('COMMENT ON'));
}

async function createDatabaseWithMigrations() {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  db.public.registerFunction({
    name: 'gen_random_uuid',
    returns: 'uuid',
    implementation: () => randomUUID(),
  });
  db.public.registerFunction({
    name: 'jsonb_typeof',
    args: ['jsonb'],
    returns: 'text',
    implementation: (value: unknown) => {
      if (value === null || value === undefined) {
        return null;
      }
      if (Array.isArray(value)) {
        return 'array';
      }
      if (typeof value === 'object') {
        return 'object';
      }
      if (typeof value === 'string') {
        return 'string';
      }
      if (typeof value === 'number') {
        return 'number';
      }
      if (typeof value === 'boolean') {
        return 'boolean';
      }
      return 'unknown';
    },
  });
  const adapter = db.adapters.createPg();
  const pool = new adapter.Pool();
  await pool.query('CREATE SCHEMA core;');
  await pool.query('CREATE TABLE core.organizations (id uuid PRIMARY KEY, name text);');
  await pool.query('CREATE TABLE core.users (id uuid PRIMARY KEY, email text);');
  for (const file of MIGRATIONS) {
    for (const statement of chunkStatements(readSql(file))) {
      await pool.query(statement);
    }
  }
  return pool;
}

describe('Communication seed scripts', () => {
  it('populate canonical sample data and support downstream inserts', async () => {
    const pool = await createDatabaseWithMigrations();
    const orgId = COMMUNICATION_SAMPLE_IDS.ORGANIZATIONS.atlasOperatives;
    const senderId = COMMUNICATION_SAMPLE_IDS.USERS.notificationSystem;
    const recipientId = COMMUNICATION_SAMPLE_IDS.USERS.emergencyOps;

    try {
      await pool.query('INSERT INTO core.organizations (id, name) VALUES ($1, $2)', [orgId, 'Atlas Operatives']);
      await pool.query('INSERT INTO core.users (id, email) VALUES ($1, $2)', [senderId, 'notify@atlas.example']);
      await pool.query('INSERT INTO core.users (id, email) VALUES ($1, $2)', [recipientId, 'ops@atlas.example']);

      await seedChannels(pool, { dryRun: false });
      await seedTemplates(pool, { dryRun: false });
      await seedPolicies(pool, { dryRun: false });

      const channelCount = await pool.query('SELECT COUNT(*)::int AS count FROM communication.channels');
      expect(channelCount.rows[0]?.count).toBe(CHANNEL_SEEDS.length);

      const templateCount = await pool.query('SELECT COUNT(*)::int AS count FROM communication.templates');
      expect(templateCount.rows[0]?.count).toBe(TEMPLATE_SEEDS.length);

      const urgentPolicy = await pool.query(
        `SELECT (retry_config->>'maxAttempts')::int AS retries
         FROM communication.delivery_policies
         WHERE name = 'Urgent Escalation Policy'`
      );
      expect(urgentPolicy.rows[0]?.retries).toBe(5);

      await pool.query(
        `INSERT INTO communication.messages (
           organization_id, sender_id, channel_type, template_id, body, variables, metadata
         ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
        [
          orgId,
          senderId,
          'email',
          TEMPLATE_SEEDS[0]?.id,
          'Hi {{firstName}}, welcome to {{workspaceName}} with {{activationLink}}.',
          JSON.stringify(['firstName', 'workspaceName', 'activationLink']),
          JSON.stringify({ source: 'test-suite' }),
        ]
      );

      const messageRow = await pool.query('SELECT id FROM communication.messages LIMIT 1');
      const messageId = messageRow.rows[0]?.id;
      expect(messageId).toBeTruthy();

      await pool.query('INSERT INTO communication.message_recipients (message_id, recipient_id) VALUES ($1, $2)', [
        messageId,
        recipientId,
      ]);

      const unread = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM communication.message_recipients
         WHERE recipient_id = $1 AND read_at IS NULL`,
        [recipientId]
      );
      expect(unread.rows[0]?.count).toBe(1);
    } finally {
      await pool.end();
    }
  });
});
