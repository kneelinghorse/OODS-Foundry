import React from 'react';
import type { JSX } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import '../../src/styles/globals.css';
import type { PermissionCheckerClient } from '../../src/components/authz/PermissionChecker.js';
import { PermissionChecker } from '../../src/components/authz/PermissionChecker.js';
import { UserWithAuthableExample } from '../../examples/objects/user-with-authable';
import { AUTHZ_SAMPLE_DATASET, AUTHZ_SAMPLE_IDS, createSampleAuthableTrait } from '../../src/data/authz/sample-entitlements';

const authableTrait = createSampleAuthableTrait();
const organizationLookup = new Map(AUTHZ_SAMPLE_DATASET.organizations.map((org) => [org.id, org.name]));
const roleLookup = new Map(authableTrait.listRoles().map((role) => [role.id, role.name]));

const meta: Meta<typeof UserMembershipPanel> = {
  title: 'Objects/User/UserWithAuthable',
  component: UserMembershipPanel,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Authable + Preferenceable example showing multi-tenant membership state and entitlement checks.',
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof UserMembershipPanel>;

function UserMembershipPanel(): JSX.Element {
  const assignments = UserWithAuthableExample.membership_records;
  return (
    <section className="min-h-screen bg-[--cmp-surface-canvas] p-8 text-[--sys-text-primary]">
      <div className="mx-auto max-w-4xl space-y-6 rounded-3xl border border-[--cmp-border-subtle] bg-white p-8 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
        <header>
          <p className="text-xs font-semibold uppercase tracking-wide text-[--sys-text-muted]">User</p>
          <h1 className="text-2xl font-semibold">{UserWithAuthableExample.name}</h1>
          <p className="text-sm text-[--sys-text-muted]">{UserWithAuthableExample.description}</p>
        </header>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Organizations" value={new Set(assignments.map((record) => record.organization_id)).size} />
          <StatCard label="Roles" value={new Set(assignments.map((record) => record.role_id)).size} />
          <StatCard label="Session roles" value={UserWithAuthableExample.session_roles?.length ?? 0} />
        </div>
        <table className="w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[--sys-text-muted]">
              <th>Organization</th>
              <th>Role</th>
              <th>Assigned</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((record) => (
              <tr key={record.id} className="rounded-2xl bg-[--cmp-surface-subtle] text-sm">
                <td className="rounded-l-2xl px-4 py-3 font-semibold">
                  {organizationLookup.get(record.organization_id) ?? record.organization_id}
                </td>
                <td className="px-4 py-3 text-[--sys-text-muted]">
                  {roleLookup.get(record.role_id) ?? record.role_id}
                </td>
                <td className="rounded-r-2xl px-4 py-3 text-[--sys-text-muted]">
                  {new Date(record.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="rounded-2xl border border-[--cmp-border-subtle] bg-[--cmp-surface-subtle] p-4">
      <p className="text-xs uppercase tracking-wide text-[--sys-text-muted]">{label}</p>
      <p className="text-2xl font-semibold text-[--sys-text-primary]">{value}</p>
    </div>
  );
}

const checkerClient: PermissionCheckerClient = {
  async check({ userId, organizationId, permission }) {
    const allowed = authableTrait.userHasPermission(userId, organizationId, permission);
    const grantedByRoles = allowed
      ? authableTrait.getRolesForUser(userId, organizationId).map((role) => role.name)
      : [];
    return {
      allowed,
      evaluatedAt: new Date().toISOString(),
      grantedByRoles,
      reason: allowed ? 'Permission granted via Authable membership.' : 'No role grants this permission.',
    };
  },
};

export const MultiOrgMemberships: Story = {
  name: 'User with multiple tenant roles',
  render: () => <UserMembershipPanel />,
};

export const PermissionCheckUi: Story = {
  name: 'Permission checker diagnostics',
  render: () => (
    <div className="min-h-screen bg-[--cmp-surface-canvas] p-8">
      <PermissionChecker
        client={checkerClient}
        defaultUserId={AUTHZ_SAMPLE_IDS.USERS.anika}
        defaultOrganizationId={AUTHZ_SAMPLE_IDS.ORGS.northwind}
        defaultPermission="document:approve"
      />
    </div>
  ),
};
