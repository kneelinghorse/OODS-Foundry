import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { newDb } from 'pg-mem';
import { describe, expect, it } from 'vitest';

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

const ROLLBACKS = [
  '20251120_010_drop_sla_metrics_table.sql',
  '20251120_009_drop_conversation_participants_table.sql',
  '20251120_008_drop_conversations_table.sql',
  '20251120_007_drop_delivery_attempts_table.sql',
  '20251120_006_drop_message_recipients_table.sql',
  '20251120_005_drop_messages_table.sql',
  '20251120_004_drop_delivery_policies_table.sql',
  '20251120_003_drop_templates_table.sql',
  '20251120_002_drop_channels_table.sql',
  '20251120_001_drop_communication_schema.sql',
] as const;

const MIGRATIONS_DIR = path.resolve('database/migrations');
const ROLLBACK_DIR = path.resolve('database/migrations/rollback');

function readSql(directory: string, fileName: string): string {
  return readFileSync(path.join(directory, fileName), 'utf8');
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

async function createInMemoryPool() {
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
  return pool;
}

describe('Communication migrations', () => {
  it('ship all required SQL files', () => {
    for (const file of MIGRATIONS) {
      expect(() => readSql(MIGRATIONS_DIR, file)).not.toThrow();
    }
    for (const file of ROLLBACKS) {
      expect(() => readSql(ROLLBACK_DIR, file)).not.toThrow();
    }
  });

  it('defines JSONB metadata and threading indices on messages', () => {
    const sql = readSql(MIGRATIONS_DIR, '20251120_005_create_messages_table.sql');
    expect(sql).toMatch(/metadata jsonb NOT NULL DEFAULT '{}'::jsonb/i);
    expect(sql).toMatch(/sender_id uuid NOT NULL REFERENCES core\.users\(id\) ON DELETE CASCADE/i);
    expect(sql).toMatch(/template_id uuid REFERENCES communication\.templates\(id\) ON DELETE SET NULL/i);
    expect(sql).toMatch(/parent_message_id uuid REFERENCES communication\.messages/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_messages_sender/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_messages_parent/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_messages_metadata/i);
  });

  it('enforces template variable coverage through constraint logic', () => {
    const sql = readSql(MIGRATIONS_DIR, '20251120_003_create_templates_table.sql');
    expect(sql).toMatch(/CONSTRAINT templates_body_covers_variables/i);
    expect(sql).toMatch(/jsonb_array_elements_text/i);
  });

  it('applies and rolls back migrations using pg-mem', async () => {
    const pool = await createInMemoryPool();
    try {
      const orgId = 'aaaaaaaa-0000-4000-8000-000000000000';
      const senderId = 'bbbbbbbb-1111-4111-8111-111111111111';
      const recipientId = 'cccccccc-2222-4222-8222-222222222222';
      const templateId = 'dddddddd-3333-4333-8333-333333333333';
      for (const file of MIGRATIONS) {
        for (const statement of chunkStatements(readSql(MIGRATIONS_DIR, file))) {
          await pool.query(statement);
        }
      }

      await pool.query('INSERT INTO core.organizations (id, name) VALUES ($1, $2)', [orgId, 'Comm Test Org']);
      await pool.query('INSERT INTO core.users (id, email) VALUES ($1, $2)', [senderId, 'sender@example.com']);
      await pool.query('INSERT INTO core.users (id, email) VALUES ($1, $2)', [recipientId, 'recipient@example.com']);

      const tablesToProbe = [
        'communication.schema_migrations',
        'communication.channels',
        'communication.templates',
        'communication.delivery_policies',
        'communication.messages',
        'communication.message_recipients',
        'communication.delivery_attempts',
        'communication.conversations',
        'communication.conversation_participants',
        'communication.sla_metrics',
      ];
      for (const table of tablesToProbe) {
        await pool.query(`SELECT 1 FROM ${table} LIMIT 0`);
      }

      await pool.query(
        `INSERT INTO communication.channels (id, organization_id, channel_type, name, config, enabled)
         VALUES ($1, $2, 'email', 'Test Email', '{}'::jsonb, true)`,
        ['eeeeeeee-4444-4444-8444-444444444444', orgId]
      );

      await pool.query(
        `INSERT INTO communication.templates (id, organization_id, channel_type, name, subject, body, variables, locale)
         VALUES ($1, $2, 'email', 'Smoke Template', 'Subject', 'Hi {{token}}', '["token"]'::jsonb, 'en-US')`,
        [templateId, orgId]
      );

      const messageResult = await pool.query(
        `INSERT INTO communication.messages (id, organization_id, sender_id, channel_type, template_id, subject, body, variables, metadata)
         VALUES ($1, $2, $3, 'email', $4, 'Smoke', 'Hi {{token}}', '["token"]'::jsonb, '{}'::jsonb)
         RETURNING id`,
        ['ffffffff-5555-4555-8555-555555555555', orgId, senderId, templateId]
      );
      const messageId = messageResult.rows[0]?.id;

      await pool.query(
        `INSERT INTO communication.message_recipients (message_id, recipient_id)
         VALUES ($1, $2)`,
        [messageId, recipientId]
      );

      await pool.query(
        `INSERT INTO communication.delivery_attempts (id, message_id, channel_type, status, attempt_number)
         VALUES ($1, $2, 'email', 'queued', 1)`,
        ['11111111-aaaa-4aaa-8aaa-aaaaaaaaaaab', messageId]
      );

      const conversation = await pool.query(
        `INSERT INTO communication.conversations (id, organization_id, subject)
         VALUES ($1, $2, 'Thread') RETURNING id`,
        ['22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb', orgId]
      );
      const conversationId = conversation.rows[0]?.id;

      await pool.query(
        `INSERT INTO communication.conversation_participants (conversation_id, user_id, role)
         VALUES ($1, $2, 'owner')`,
        [conversationId, senderId]
      );

      for (const file of ROLLBACKS) {
        for (const statement of chunkStatements(readSql(ROLLBACK_DIR, file))) {
          await pool.query(statement);
        }
      }

      const communicationTables = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM information_schema.tables
         WHERE table_schema = 'communication'`
      );
      expect(communicationTables.rows[0]?.count).toBe(0);
    } finally {
      await pool.end();
    }
  });
});
