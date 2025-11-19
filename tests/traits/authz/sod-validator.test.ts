import { describe, it, beforeEach, expect } from 'vitest';

import { createSodPolicyBuilder } from '@/traits/authz/sod-policy-builder.ts';
import { createSodValidator, type SodValidatorContract } from '@/traits/authz/sod-validator.ts';

import { InMemorySodExecutor } from './sod-test-helpers.ts';

describe('SoD Validator (B28.4)', () => {
  let executor: InMemorySodExecutor;
  let validator: SodValidatorContract;

  beforeEach(() => {
    executor = new InMemorySodExecutor();
    validator = createSodValidator(executor);
  });

  it('detects Static SoD violation for Accountant + Auditor (SSoD_001)', async () => {
    const builder = createSodPolicyBuilder(executor);
    await builder.createRoleConflict('role-accountant', 'role-auditor', 'R28.1 · Accountant ≠ Auditor');

    executor.seedMembership({ userId: 'user-alice', organizationId: 'org-northwind', roleId: 'role-accountant' });

    const result = await validator.validateMembershipAssignment('user-alice', 'org-northwind', 'role-auditor');
    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.reason).toMatch(/accountant/i);
  });

  it('allows Static SoD assignment when no conflicts exist', async () => {
    executor.seedMembership({ userId: 'user-bob', organizationId: 'org-globex', roleId: 'role-viewer' });
    const result = await validator.validateMembershipAssignment('user-bob', 'org-globex', 'role-editor');
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('detects Dynamic SoD violation when creator approves same expense (DSoD_001)', async () => {
    executor.seedAction({
      userId: 'user-delta',
      organizationId: 'org-payables',
      action: 'create',
      resourceType: 'expense',
      resourceId: 'expense-001',
    });

    const result = await validator.detectDynamicSoDViolation(
      'user-delta',
      'approve',
      'expense',
      'expense-001'
    );

    expect(result.violation).toBe(true);
    expect(result.conflict?.initiatorAction).toBe('create');
    expect(result.history).toHaveLength(1);
  });

  it('does not flag Dynamic SoD when another user approves (DSoD_002)', async () => {
    executor.seedAction({
      userId: 'user-alpha',
      organizationId: 'org-payables',
      action: 'create',
      resourceType: 'purchase_order',
      resourceId: 'po-900',
    });

    const result = await validator.detectDynamicSoDViolation('user-beta', 'approve', 'purchase_order', 'po-900');
    expect(result.violation).toBe(false);
  });

  it('does not flag Dynamic SoD when approving a different resource', async () => {
    executor.seedAction({
      userId: 'user-gamma',
      organizationId: 'org-payables',
      action: 'submit',
      resourceType: 'expense',
      resourceId: 'expense-123',
    });

    const result = await validator.detectDynamicSoDViolation('user-gamma', 'approve', 'expense', 'expense-999');
    expect(result.violation).toBe(false);
  });
});
