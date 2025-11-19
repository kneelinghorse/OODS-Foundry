import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const MIGRATIONS_DIR = path.resolve('database/migrations');
const REQUIRED_MIGRATIONS = [
  '20251119_001_create_authz_schema.sql',
  '20251119_002_create_roles_table.sql',
  '20251119_003_create_permissions_table.sql',
  '20251119_004_create_role_permissions_table.sql',
  '20251119_005_create_memberships_table.sql',
  '20251119_006_create_role_hierarchy_table.sql',
  '20251119_007_create_sod_tables.sql',
  '20251119_008_create_sod_trigger.sql',
];

function readSql(fileName: string): string {
  const absolute = path.join(MIGRATIONS_DIR, fileName);
  return readFileSync(absolute, 'utf8');
}

describe('Authorization migrations', () => {
  it('ship the required migration files', () => {
    const files = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
      .map((entry) => entry.name);
    for (const required of REQUIRED_MIGRATIONS) {
      expect(files).toContain(required);
    }
  });

  it('defines the roles table with unique global names', () => {
    const sql = readSql('20251119_002_create_roles_table.sql');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS authz\.roles/);
    expect(sql).toMatch(/UNIQUE \(name\)/);
    expect(sql).toMatch(/CHECK \(length\(btrim\(name\)\) > 0\)/);
  });

  it('enforces permission name format at the database layer', () => {
    const sql = readSql('20251119_003_create_permissions_table.sql');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS authz\.permissions/);
    expect(sql).toMatch(/CHECK \(position\('\:' in name\) > 0\)/);
  });

  it('implements cascading FKs for junction tables', () => {
    const rolePermissionSql = readSql('20251119_004_create_role_permissions_table.sql');
    expect(rolePermissionSql).toMatch(/role_id uuid NOT NULL REFERENCES authz\.roles\(id\) ON DELETE CASCADE/);
    expect(rolePermissionSql).toMatch(/permission_id uuid NOT NULL REFERENCES authz\.permissions\(id\) ON DELETE CASCADE/);
    expect(rolePermissionSql).toMatch(/PRIMARY KEY \(role_id, permission_id\)/);
    expect(rolePermissionSql).toMatch(/CREATE INDEX IF NOT EXISTS idx_role_permissions_role/);

    const membershipSql = readSql('20251119_005_create_memberships_table.sql');
    expect(membershipSql).toMatch(/user_id uuid NOT NULL REFERENCES core\.users\(id\) ON DELETE CASCADE/);
    expect(membershipSql).toMatch(/organization_id uuid NOT NULL REFERENCES core\.organizations\(id\) ON DELETE CASCADE/);
    expect(membershipSql).toMatch(/role_id uuid NOT NULL REFERENCES authz\.roles\(id\) ON DELETE CASCADE/);
    expect(membershipSql).toMatch(/UNIQUE\s*\(user_id, organization_id, role_id\)/);
    expect(membershipSql).toMatch(/idx_memberships_user_org/);
    expect(membershipSql).toMatch(/idx_memberships_org_role/);
  });

  it('captures SoD metadata and indexes audit queries', () => {
    const sodSql = readSql('20251119_007_create_sod_tables.sql');
    expect(sodSql).toMatch(/CREATE TABLE IF NOT EXISTS authz\.sod_role_conflicts/);
    expect(sodSql).toMatch(/UNIQUE \(role_a_id, role_b_id, organization_id\)/);
    expect(sodSql).toMatch(/CHECK \(role_a_id <> role_b_id\)/);
    expect(sodSql).toMatch(/CREATE TABLE IF NOT EXISTS authz\.action_log/);
    expect(sodSql).toMatch(/CREATE INDEX IF NOT EXISTS idx_action_log_lookup/);
  });

  it('ships the static SoD trigger that raises descriptive errors', () => {
    const triggerSql = readSql('20251119_008_create_sod_trigger.sql');
    expect(triggerSql).toMatch(/CREATE OR REPLACE FUNCTION authz\.prevent_conflicting_roles/);
    expect(triggerSql).toMatch(/RAISE EXCEPTION 'SoD violation:/);
    expect(triggerSql).toMatch(/CREATE TRIGGER enforce_sod_on_membership/);
  });
});
