import { describe, it, beforeEach, expect } from 'vitest';

import { createSodPolicyBuilder, SodPolicyValidationError, type SodPolicyBuilder } from '@/traits/authz/sod-policy-builder.ts';

import { InMemorySodExecutor } from './sod-test-helpers.ts';

describe('SoD Policy Builder (B28.4)', () => {
  let executor: InMemorySodExecutor;
  let builder: SodPolicyBuilder;

  beforeEach(() => {
    executor = new InMemorySodExecutor();
    builder = createSodPolicyBuilder(executor);
  });

  it('creates global and org-scoped conflicts and returns both for that org', async () => {
    const globalPolicy = await builder.createRoleConflict('role-accountant', 'role-auditor', 'R28.1 · SSoD_001');
    expect(globalPolicy.organizationId).toBeNull();
    expect(globalPolicy.roleAId.localeCompare(globalPolicy.roleBId)).toBeLessThan(0);

    const orgPolicy = await builder.createRoleConflict(
      'role-requester',
      'role-approver',
      'R28.1 · SSoD_002',
      'org-finance'
    );
    expect(orgPolicy.organizationId).toBe('org-finance');

    const scoped = await builder.listConflicts('org-finance');
    expect(scoped).toHaveLength(2);
    expect(scoped.map((policy) => policy.id).sort()).toEqual([globalPolicy.id, orgPolicy.id].sort());
  });

  it('prevents duplicate policies for the same role pair and scope', async () => {
    await builder.createRoleConflict('role-risk', 'role-compliance', 'First writer wins');
    await expect(
      builder.createRoleConflict('role-compliance', 'role-risk', 'Attempted duplicate')
    ).rejects.toBeInstanceOf(SodPolicyValidationError);
  });

  it('rejects creation when a user already holds both conflicting roles (SSoD_001)', async () => {
    const userId = 'user-payments';
    executor.seedMembership({ userId, organizationId: 'org-globex', roleId: 'role-initiator' });
    executor.seedMembership({ userId, organizationId: 'org-globex', roleId: 'role-authorizer' });

    await expect(
      builder.createRoleConflict('role-initiator', 'role-authorizer', 'Payment Initiator ≠ Authorizer', 'org-globex')
    ).rejects.toBeInstanceOf(SodPolicyValidationError);
  });

  it('updates policy metadata and can deactivate without throwing', async () => {
    const policy = await builder.createRoleConflict('role-dev', 'role-prod-admin', 'Dev ≠ Prod Admin');

    const updated = await builder.updateRoleConflict(policy.id, {
      reason: 'Production access requires independent reviewer',
      organizationId: 'org-platform',
      active: false,
    });

    expect(updated.reason).toMatch(/independent reviewer/i);
    expect(updated.organizationId).toBe('org-platform');
    expect(updated.active).toBe(false);
  });

  it('deletes policies cleanly', async () => {
    const policy = await builder.createRoleConflict('role-a', 'role-b', 'Cleanup test');
    const deleted = await builder.deleteRoleConflict(policy.id);
    expect(deleted).toBe(true);
    const remaining = await builder.listConflicts();
    expect(remaining).toHaveLength(0);
  });
});
