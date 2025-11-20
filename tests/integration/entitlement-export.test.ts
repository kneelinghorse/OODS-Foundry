import { describe, expect, it } from 'vitest';

import { AUTHZ_SAMPLE_DATASET, AUTHZ_SAMPLE_IDS } from '../../src/data/authz/sample-entitlements';
import { auditOrgAccess, auditUserPermissions } from '../../src/cli/authz-audit';
import { exportOrgEntitlements, exportUserEntitlements } from '../../src/cli/authz-export';

describe('authz-export CLI helpers', () => {
  it('exports user entitlements with roles and permissions', () => {
    const exportPayload = exportUserEntitlements(
      AUTHZ_SAMPLE_IDS.USERS.anika,
      AUTHZ_SAMPLE_IDS.ORGS.atlas,
      AUTHZ_SAMPLE_DATASET
    );
    expect(exportPayload.roles.map((role) => role.name)).toContain('Owner');
    expect(exportPayload.permissions.map((permission) => permission.name)).toContain('document:approve');
    expect(exportPayload.organization.id).toBe(AUTHZ_SAMPLE_IDS.ORGS.atlas);
  });

  it('exports organization entitlements with aggregate stats', () => {
    const exportPayload = exportOrgEntitlements(AUTHZ_SAMPLE_IDS.ORGS.atlas, AUTHZ_SAMPLE_DATASET);
    expect(exportPayload.memberCount).toBeGreaterThan(0);
    expect(exportPayload.distinctRoles).toBeGreaterThan(0);
    expect(exportPayload.organization.membershipCount).toBeGreaterThan(0);
  });
});

describe('authz-audit CLI helpers', () => {
  it('flags users without memberships', () => {
    const report = auditUserPermissions(AUTHZ_SAMPLE_IDS.USERS.sunny, AUTHZ_SAMPLE_DATASET);
    expect(report.status).toBe('action_required');
    expect(report.issues.some((issue) => issue.code === 'no_memberships')).toBe(true);
  });

  it('detects orphaned memberships at the organization level', () => {
    const report = auditOrgAccess(AUTHZ_SAMPLE_IDS.ORGS.atlas, AUTHZ_SAMPLE_DATASET);
    expect(report.status).toBe('action_required');
    expect(report.issues.some((issue) => issue.code === 'orphaned_membership')).toBe(true);
  });
});
