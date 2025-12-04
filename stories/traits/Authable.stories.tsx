/**
 * Authable Trait — RBAC System Demo
 *
 * This story demonstrates the Authable trait which provides:
 * Role-Based Access Control (RBAC) as a composable extension for objects.
 *
 * Unlike Statusable (visual states), Authable is about ACCESS CONTROL:
 * role + resource → permission check (allowed/denied)
 *
 * Navigation order follows learning progression:
 * 1. Overview - What is this? Why does it exist?
 * 2. Permission Matrix - Visual proof (role × permission grid)
 * 3. Role Examples - Concrete role definitions
 * 4. How It Works - The permission check flow
 */

import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import {
  AUTHZ_SAMPLE_DATASET,
  createSampleAuthableTrait,
  AUTHZ_SAMPLE_IDS,
} from '../../src/data/authz/sample-entitlements.js';

/* ─────────────────────────────────────────────────────────────────────────────
 * Style constants (consistent with Statusable.stories.tsx)
 * ───────────────────────────────────────────────────────────────────────────── */

const STYLES = {
  page: {
    padding: '2rem',
    maxWidth: '1000px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  heading: {
    marginTop: 0,
    marginBottom: '0.5rem',
  },
  subheading: {
    color: '#666',
    marginTop: 0,
    marginBottom: '2rem',
    fontWeight: 400 as const,
  },
  section: {
    marginBottom: '3rem',
  },
  groupLabel: {
    fontSize: '0.75rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    color: '#888',
    marginBottom: '0.75rem',
    fontWeight: 600 as const,
  },
  card: {
    padding: '1.5rem',
    borderRadius: '0.75rem',
    border: '1px solid #e0e0e0',
    background: '#fafafa',
  },
  codeBlock: {
    padding: '1rem',
    borderRadius: '0.5rem',
    background: '#1e1e1e',
    color: '#d4d4d4',
    fontFamily: 'ui-monospace, monospace',
    fontSize: '0.875rem',
    lineHeight: 1.6,
    overflow: 'auto' as const,
  },
} as const;

/* ─────────────────────────────────────────────────────────────────────────────
 * Initialize the Authable trait for demos
 * ───────────────────────────────────────────────────────────────────────────── */

const authableTrait = createSampleAuthableTrait();

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. OVERVIEW — What is Authable? Why does it exist?
 * ───────────────────────────────────────────────────────────────────────────── */

function OverviewStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Authable</h1>
      <h2 style={STYLES.subheading}>
        Consistent role-based access control across your entire application
      </h2>

      <section style={STYLES.section}>
        <p style={{ fontSize: '1.125rem', lineHeight: 1.7, marginBottom: '2rem' }}>
          Authable provides a <strong>permission model</strong> that answers the question:
          "Can this user perform this action on this resource?" Define roles and permissions once,
          enforce them everywhere.
        </p>

        {/* Before/After comparison */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div style={{ ...STYLES.card, borderColor: '#fca5a5', background: '#fef2f2' }}>
            <h3 style={{ marginTop: 0, color: '#dc2626', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Without a System
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8, color: '#555' }}>
              <li>Scattered if-statements across codebase</li>
              <li>Inconsistent role definitions per feature</li>
              <li>"Admin can do everything" hardcoded</li>
              <li>No audit trail of permission checks</li>
            </ul>
          </div>

          <div style={{ ...STYLES.card, borderColor: '#86efac', background: '#f0fdf4' }}>
            <h3 style={{ marginTop: 0, color: '#16a34a', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              With Authable
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8, color: '#555' }}>
              <li>Centralized role → permission mapping</li>
              <li>Consistent checks across all objects</li>
              <li>Multi-tenant: same user, different roles per org</li>
              <li>Auditable and testable permission model</li>
            </ul>
          </div>
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>The Core Question</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <code style={{ padding: '0.5rem 0.75rem', background: '#f3f4f6', borderRadius: '0.25rem' }}>
            canUser(userId, orgId, "document:approve")
          </code>
          <span style={{ color: '#888', fontSize: '1.5rem' }}>→</span>
          <span style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.25rem',
            background: '#dcfce7',
            color: '#166534',
            fontWeight: 600,
          }}>
            ✓ Allowed
          </span>
          <span style={{ color: '#888', margin: '0 0.5rem' }}>or</span>
          <span style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.25rem',
            background: '#fee2e2',
            color: '#991b1b',
            fontWeight: 600,
          }}>
            ✗ Denied
          </span>
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Key Concepts</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#4f46e5' }}>Roles</strong>
            <span style={{ color: '#666' }}>Named bundles of permissions (e.g., Owner, Editor, Viewer)</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#4f46e5' }}>Permissions</strong>
            <span style={{ color: '#666' }}>Atomic capabilities (e.g., document:read, document:approve)</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#4f46e5' }}>Memberships</strong>
            <span style={{ color: '#666' }}>User → Organization → Role assignments</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#4f46e5' }}>Organizations</strong>
            <span style={{ color: '#666' }}>Tenant boundaries for multi-org access</span>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. PERMISSION MATRIX — Visual proof: role × permission grid
 * ───────────────────────────────────────────────────────────────────────────── */

function PermissionMatrixStory(): JSX.Element {
  const roles = AUTHZ_SAMPLE_DATASET.roles;
  const permissions = AUTHZ_SAMPLE_DATASET.permissions;
  const rolePermissions = AUTHZ_SAMPLE_DATASET.rolePermissions;

  const hasPermission = (roleId: string, permissionId: string): boolean => {
    const perms = rolePermissions[roleId] || [];
    return perms.includes(permissionId);
  };

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Permission Matrix</h1>
      <h2 style={STYLES.subheading}>
        Which roles can perform which actions?
      </h2>

      <section style={STYLES.section}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.875rem',
          }}>
            <thead>
              <tr>
                <th style={{
                  padding: '0.75rem 1rem',
                  textAlign: 'left',
                  borderBottom: '2px solid #e0e0e0',
                  background: '#f9fafb',
                  fontWeight: 600,
                  color: '#374151',
                }}>
                  Role
                </th>
                {permissions.map((perm) => (
                  <th key={perm.id} style={{
                    padding: '0.75rem 0.5rem',
                    textAlign: 'center',
                    borderBottom: '2px solid #e0e0e0',
                    background: '#f9fafb',
                    fontWeight: 500,
                    color: '#6b7280',
                    fontSize: '0.75rem',
                    whiteSpace: 'nowrap',
                  }}>
                    <div style={{ transform: 'rotate(-25deg)', transformOrigin: 'center', marginBottom: '0.5rem' }}>
                      {perm.name}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.map((role, rowIndex) => (
                <tr key={role.id} style={{ background: rowIndex % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={{
                    padding: '0.75rem 1rem',
                    fontWeight: 600,
                    color: '#111827',
                    borderBottom: '1px solid #e0e0e0',
                  }}>
                    {role.name}
                  </td>
                  {permissions.map((perm) => {
                    const allowed = hasPermission(role.id, perm.id);
                    return (
                      <td key={perm.id} style={{
                        padding: '0.75rem 0.5rem',
                        textAlign: 'center',
                        borderBottom: '1px solid #e0e0e0',
                      }}>
                        {allowed ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: '#dcfce7',
                            color: '#166534',
                            fontWeight: 700,
                          }}>
                            ✓
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: '#f3f4f6',
                            color: '#9ca3af',
                          }}>
                            –
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Legend</div>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: '#dcfce7',
              color: '#166534',
              fontWeight: 700,
            }}>
              ✓
            </span>
            <span style={{ color: '#374151' }}>Permission granted</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: '#f3f4f6',
              color: '#9ca3af',
            }}>
              –
            </span>
            <span style={{ color: '#374151' }}>Permission not granted</span>
          </div>
        </div>
      </section>

      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Permission Descriptions</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
          {permissions.map((perm) => (
            <div key={perm.id} style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              background: '#fff',
              border: '1px solid #e0e0e0',
            }}>
              <code style={{
                display: 'block',
                marginBottom: '0.25rem',
                fontWeight: 600,
                color: '#4f46e5',
              }}>
                {perm.name}
              </code>
              <span style={{ fontSize: '0.875rem', color: '#666' }}>{perm.description}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. ROLE EXAMPLES — Concrete role definitions
 * ───────────────────────────────────────────────────────────────────────────── */

function RoleExamplesStory(): JSX.Element {
  const roles = AUTHZ_SAMPLE_DATASET.roles;
  const permissions = AUTHZ_SAMPLE_DATASET.permissions;
  const rolePermissions = AUTHZ_SAMPLE_DATASET.rolePermissions;

  const getPermissionsForRole = (roleId: string) => {
    const permIds = rolePermissions[roleId] || [];
    return permissions.filter((p) => permIds.includes(p.id));
  };

  const roleColors: Record<string, { bg: string; border: string; accent: string }> = {
    Owner: { bg: '#fef3c7', border: '#f59e0b', accent: '#92400e' },
    Approver: { bg: '#dbeafe', border: '#3b82f6', accent: '#1e40af' },
    Editor: { bg: '#f3e8ff', border: '#a855f7', accent: '#6b21a8' },
  };

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Role Examples</h1>
      <h2 style={STYLES.subheading}>
        Concrete role definitions from the sample dataset
      </h2>

      <section style={STYLES.section}>
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {roles.map((role) => {
            const rolePerms = getPermissionsForRole(role.id);
            const colors = roleColors[role.name] || { bg: '#f3f4f6', border: '#9ca3af', accent: '#374151' };

            return (
              <div key={role.id} style={{
                padding: '1.5rem',
                borderRadius: '0.75rem',
                border: `2px solid ${colors.border}`,
                background: colors.bg,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ margin: 0, color: colors.accent, fontSize: '1.25rem' }}>
                      {role.name}
                    </h3>
                    <p style={{ margin: '0.25rem 0 0', color: '#555', fontSize: '0.875rem' }}>
                      {role.description}
                    </p>
                  </div>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '1rem',
                    background: '#fff',
                    border: `1px solid ${colors.border}`,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: colors.accent,
                  }}>
                    {rolePerms.length} permission{rolePerms.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div style={STYLES.groupLabel}>Granted Permissions</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {rolePerms.map((perm) => (
                    <span key={perm.id} style={{
                      padding: '0.375rem 0.75rem',
                      borderRadius: '0.25rem',
                      background: '#fff',
                      border: '1px solid #e0e0e0',
                      fontSize: '0.8125rem',
                      fontFamily: 'ui-monospace, monospace',
                    }}>
                      {perm.name}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Role Hierarchy</div>
        <p style={{ color: '#666', marginBottom: '1rem' }}>
          Roles can inherit permissions from parent roles. In this example:
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            background: roleColors.Owner.bg,
            border: `1px solid ${roleColors.Owner.border}`,
            fontWeight: 600,
            color: roleColors.Owner.accent,
          }}>
            Owner
          </span>
          <span style={{ color: '#888' }}>→</span>
          <span style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            background: roleColors.Approver.bg,
            border: `1px solid ${roleColors.Approver.border}`,
            fontWeight: 600,
            color: roleColors.Approver.accent,
          }}>
            Approver
          </span>
          <span style={{ color: '#888' }}>→</span>
          <span style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            background: roleColors.Editor.bg,
            border: `1px solid ${roleColors.Editor.border}`,
            fontWeight: 600,
            color: roleColors.Editor.accent,
          }}>
            Editor
          </span>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. HOW IT WORKS — Permission check flow walkthrough
 * ───────────────────────────────────────────────────────────────────────────── */

function HowItWorksStory(): JSX.Element {
  const sampleUser = AUTHZ_SAMPLE_DATASET.users[0]; // Anika
  const sampleOrg = AUTHZ_SAMPLE_DATASET.organizations[0]; // Atlas
  const samplePermission = 'document:approve';

  // Simulate the permission check flow
  const userMembership = AUTHZ_SAMPLE_DATASET.memberships.find(
    (m) => m.user_id === sampleUser.id && m.organization_id === sampleOrg.id
  );
  const userRole = AUTHZ_SAMPLE_DATASET.roles.find((r) => r.id === userMembership?.role_id);
  const rolePerms = userRole ? (AUTHZ_SAMPLE_DATASET.rolePermissions[userRole.id] || []) : [];
  const permissionRecord = AUTHZ_SAMPLE_DATASET.permissions.find((p) => p.name === samplePermission);
  const isAllowed = permissionRecord ? rolePerms.includes(permissionRecord.id) : false;

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>How It Works</h1>
      <h2 style={STYLES.subheading}>
        Follow one permission check through the system
      </h2>

      {/* Scene 1: The Check Request */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Scene 1: The Check Request</div>
        <p style={{ margin: '0 0 1rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
          Your application needs to know if <strong>{sampleUser.name}</strong> can approve documents
          in the <strong>{sampleOrg.name}</strong> organization.
        </p>
        <pre style={STYLES.codeBlock}>
{`// The question we're asking
authableTrait.userHasPermission(
  "${sampleUser.id.slice(0, 8)}...",  // ${sampleUser.name}
  "${sampleOrg.id.slice(0, 8)}...",   // ${sampleOrg.name}
  "${samplePermission}"               // The capability to check
)`}
        </pre>
      </section>

      {/* Scene 2: Membership Lookup */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Scene 2: Membership Lookup</div>
        <p style={{ margin: '0 0 1rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
          First, we find the user's role in this organization:
        </p>
        <div style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1rem'
        }}>
          <div style={{ flex: '1 1 180px', padding: '1rem', background: '#fff', borderRadius: '0.5rem', border: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>User</div>
            <code style={{ fontWeight: 600 }}>{sampleUser.name}</code>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: '#888', fontSize: '1.5rem' }}>+</div>
          <div style={{ flex: '1 1 180px', padding: '1rem', background: '#fff', borderRadius: '0.5rem', border: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>Organization</div>
            <code style={{ fontWeight: 600 }}>{sampleOrg.name}</code>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: '#888', fontSize: '1.5rem' }}>→</div>
          <div style={{ flex: '1 1 180px', padding: '1rem', background: '#fef3c7', borderRadius: '0.5rem', border: '1px solid #f59e0b' }}>
            <div style={{ fontSize: '0.75rem', color: '#92400e', marginBottom: '0.25rem' }}>Role Found</div>
            <code style={{ fontWeight: 600, color: '#92400e' }}>{userRole?.name || 'None'}</code>
          </div>
        </div>
        <pre style={STYLES.codeBlock}>
{`// Membership record found:
{
  user_id: "${sampleUser.id.slice(0, 8)}...",
  organization_id: "${sampleOrg.id.slice(0, 8)}...",
  role_id: "${userRole?.id.slice(0, 8) || 'none'}...",  // → "${userRole?.name || 'None'}"
}`}
        </pre>
      </section>

      {/* Scene 3: Permission Resolution */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Scene 3: Permission Resolution</div>
        <p style={{ margin: '0 0 1rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
          Next, we check if the <strong>{userRole?.name || 'Role'}</strong> role has the <code>{samplePermission}</code> permission:
        </p>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1rem'
        }}>
          <div style={{ padding: '1rem', background: '#fef3c7', borderRadius: '0.5rem', border: '1px solid #f59e0b' }}>
            <div style={{ fontSize: '0.75rem', color: '#92400e', marginBottom: '0.25rem' }}>Role</div>
            <code style={{ fontWeight: 600, color: '#92400e' }}>{userRole?.name}</code>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: '#888', fontSize: '1.5rem' }}>→</div>
          <div style={{ flex: 1, padding: '1rem', background: '#fff', borderRadius: '0.5rem', border: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.5rem' }}>Role Permissions</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {AUTHZ_SAMPLE_DATASET.permissions
                .filter((p) => rolePerms.includes(p.id))
                .map((p) => (
                  <code key={p.id} style={{
                    padding: '0.25rem 0.5rem',
                    background: p.name === samplePermission ? '#dcfce7' : '#f3f4f6',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    fontWeight: p.name === samplePermission ? 600 : 400,
                    border: p.name === samplePermission ? '1px solid #86efac' : '1px solid #e0e0e0',
                  }}>
                    {p.name}
                  </code>
                ))}
            </div>
          </div>
        </div>
      </section>

      {/* Scene 4: The Result */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Scene 4: The Result</div>
        <p style={{ margin: '0 0 1.5rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
          The permission check completes with a clear answer:
        </p>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          padding: '1.5rem',
          background: isAllowed ? '#f0fdf4' : '#fef2f2',
          borderRadius: '0.5rem',
          border: `1px solid ${isAllowed ? '#86efac' : '#fca5a5'}`,
        }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: isAllowed ? '#dcfce7' : '#fee2e2',
            color: isAllowed ? '#166534' : '#991b1b',
            fontSize: '1.5rem',
            fontWeight: 700,
          }}>
            {isAllowed ? '✓' : '✗'}
          </span>
          <div>
            <div style={{ fontWeight: 600, fontSize: '1.125rem', color: isAllowed ? '#166534' : '#991b1b' }}>
              {isAllowed ? 'Permission Granted' : 'Permission Denied'}
            </div>
            <div style={{ color: '#666', marginTop: '0.25rem' }}>
              {isAllowed
                ? `${sampleUser.name} has the ${userRole?.name} role, which includes ${samplePermission}.`
                : `${sampleUser.name}'s role does not include this permission.`}
            </div>
          </div>
        </div>
      </section>

      {/* Why This Matters */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Why This Matters</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Consistency</strong>
            <span style={{ color: '#666' }}>Same check logic everywhere in your app</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Multi-Tenant</strong>
            <span style={{ color: '#666' }}>Same user can have different roles per organization</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Auditable</strong>
            <span style={{ color: '#666' }}>Every check can be logged and traced</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Testable</strong>
            <span style={{ color: '#666' }}>Unit test your permission model directly</span>
          </div>
        </div>
      </section>

      {/* Usage Code */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Usage in Code</div>
        <pre style={STYLES.codeBlock}>
{`import { createSampleAuthableTrait } from '@/data/authz/sample-entitlements';

const authable = createSampleAuthableTrait();

// Check a permission
const canApprove = authable.userHasPermission(
  userId,
  organizationId,
  'document:approve'
);

if (canApprove) {
  // Show approve button
} else {
  // Hide or disable approve button
}

// Get all roles for a user in an org
const roles = authable.getRolesForUser(userId, organizationId);

// List all available permissions
const allPerms = authable.listPermissions();`}
        </pre>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Storybook Configuration
 * ───────────────────────────────────────────────────────────────────────────── */

type Story = StoryObj<Record<string, never>>;

const meta: Meta = {
  title: 'Traits/Core/Authable',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

// 1. Overview — First in nav
export const Overview: Story = {
  name: '1. Overview',
  render: () => <OverviewStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 2. Permission Matrix — Visual proof
export const PermissionMatrix: Story = {
  name: '2. Permission Matrix',
  render: () => <PermissionMatrixStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 3. Role Examples — Concrete definitions
export const RoleExamples: Story = {
  name: '3. Role Examples',
  render: () => <RoleExamplesStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 4. How It Works — Permission check flow
export const HowItWorks: Story = {
  name: '4. How It Works',
  render: () => <HowItWorksStory />,
  parameters: {
    chromatic: { disableSnapshot: true },
  },
};
