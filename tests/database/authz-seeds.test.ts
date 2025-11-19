import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PERMISSION_SEEDS,
  DEFAULT_ROLE_SEEDS,
  ROLE_PERMISSION_MATRIX,
  flattenRolePermissionMatrix,
} from '@/cli/authz-defaults.js';

const ROLE_SEED_FILE = path.resolve('database/seeds/authz_seed_default_roles.sql');
const PERMISSION_SEED_FILE = path.resolve('database/seeds/authz_seed_default_permissions.sql');
const ROLE_PERMISSION_SEED_FILE = path.resolve('database/seeds/authz_seed_role_permissions.sql');

function extractFirstColumnValues(sql: string): string[] {
  const lines = sql
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith("('"));
  return lines.map((line) => {
    const match = line.match(/\('([^']+)'/);
    return match ? match[1] : '';
  });
}

describe('Authorization seeds', () => {
  it('keeps SQL role seed scripts aligned with TypeScript defaults', () => {
    const sql = readFileSync(ROLE_SEED_FILE, 'utf8');
    const sqlNames = extractFirstColumnValues(sql);
    const typeScriptNames = DEFAULT_ROLE_SEEDS.map((role) => role.name);
    expect(sqlNames).toEqual(typeScriptNames);
    expect(sql).toMatch(/ON CONFLICT \(name\) DO NOTHING/);
  });

  it('keeps SQL permission seed script aligned with TypeScript defaults', () => {
    const sql = readFileSync(PERMISSION_SEED_FILE, 'utf8');
    const sqlNames = extractFirstColumnValues(sql);
    const typeScriptNames = DEFAULT_PERMISSION_SEEDS.map((permission) => permission.name);
    expect(sqlNames).toEqual(typeScriptNames);
    expect(sql).toMatch(/ON CONFLICT \(name\) DO NOTHING/);
    for (const permission of DEFAULT_PERMISSION_SEEDS) {
      expect(sql).toContain(`('${permission.name}'`);
    }
  });

  it('seeds admin/editor/viewer mappings consistently', () => {
    const sql = readFileSync(ROLE_PERMISSION_SEED_FILE, 'utf8');
    expect(sql).toMatch(/SELECT 'Admin'::text AS role_name, name AS permission_name FROM authz\.permissions/);
    expect(sql).toMatch(/editor_permissions/);
    expect(sql).toMatch(/viewer_permissions/);

    const matrix = flattenRolePermissionMatrix(ROLE_PERMISSION_MATRIX);
    expect(matrix.get('Viewer')).toEqual(new Set(['user:read', 'document:read', 'org:view']));
    const editorPermissions = matrix.get('Editor');
    expect(editorPermissions?.has('user:delete')).toBe(false);
    expect(editorPermissions?.has('org:update')).toBe(true);
  });
});
