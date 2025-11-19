import { describe, expect, it } from 'vitest';

import {
  listAuthzSchemas,
  schemaRegistry,
  assertSchemaVersionCompatible,
} from '@/traits/authz/schema-registry.ts';
import { validateRole } from '@/traits/authz/schema-validator.ts';

const roleId = '550e8400-e29b-41d4-a716-446655440000';
const membershipId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

describe('Authz schema registry', () => {
  it('lists all registered schema identifiers', () => {
    const ids = listAuthzSchemas().map((entry) => entry.id);
    expect(ids).toEqual(['role', 'permission', 'membership', 'role-hierarchy']);
  });

  it('validates membership payloads through the JSON Schema registry', () => {
    const result = schemaRegistry.validateSchema(
      {
        id: membershipId,
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        organization_id: '789e0123-e45b-47c8-b901-234567890abc',
        role_id: roleId,
        created_at: '2025-11-19T00:00:00Z',
        updated_at: '2025-11-19T00:00:00Z',
      },
      'membership'
    );

    expect(result.success).toBe(true);
    expect(result.version).toBe(schemaRegistry.getVersion());
  });

  it('returns formatted issues for invalid payloads', () => {
    const result = schemaRegistry.validateSchema(
      {
        id: membershipId,
        user_id: 'not-a-uuid',
        organization_id: '789e0123-e45b-47c8-b901-234567890abc',
        role_id: roleId,
        created_at: '2025-11-19T00:00:00Z',
        updated_at: '2025-11-19T00:00:00Z',
      },
      'membership'
    );

    expect(result.success).toBe(false);
    expect(result.issues[0]?.message).toMatch(/uuid/i);
  });

  it('guards schema compatibility expectations', () => {
    expect(schemaRegistry.isVersionCompatible('role', schemaRegistry.getVersion())).toBe(true);
    expect(() => assertSchemaVersionCompatible('role', '0.9.0')).toThrow(/version/i);
  });
});

describe('Dual validator', () => {
  it('returns enriched role data', () => {
    const result = validateRole({
      id: roleId,
      name: 'Editor',
      description: 'Content editors',
    });

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('Editor');
    expect(result.errors).toHaveLength(0);
  });
});
