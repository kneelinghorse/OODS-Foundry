import React from 'react';
import type { JSX } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import '../../src/styles/globals.css';
import { MembershipManager } from '../../src/components/authz/MembershipManager.js';
import type { MembershipRecord, MembershipValidationState } from '../../src/hooks/useMemberships';
import { OrganizationWithAuthableExample } from '../../examples/objects/organization-with-authable';
import { AUTHZ_SAMPLE_DATASET, AUTHZ_SAMPLE_IDS, createSampleAuthableTrait } from '../../src/data/authz/sample-entitlements';

const authableTrait = createSampleAuthableTrait();
const organizationName = AUTHZ_SAMPLE_DATASET.organizations.find((org) => org.id === AUTHZ_SAMPLE_IDS.ORGS.atlas)?.name ?? 'Atlas FinOps';
const roleLookup = new Map(authableTrait.listRoles().map((role) => [role.id, role.name]));
const userLookup = new Map(AUTHZ_SAMPLE_DATASET.users.map((user) => [user.id, user.name]));

const meta: Meta<typeof OrgMemberList> = {
  title: 'Objects/Organization/OrganizationMembers',
  component: OrgMemberList,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Organization Authable snapshot showing membership diagnostics and assignment UI.',
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof OrgMemberList>;

function OrgMemberList(): JSX.Element {
  const records = OrganizationWithAuthableExample.membership_records ?? [];
  return (
    <section className="min-h-screen bg-[--cmp-surface-canvas] p-8 text-[--sys-text-primary]">
      <div className="mx-auto max-w-5xl space-y-6 rounded-3xl border border-[--cmp-border-subtle] bg-white p-8 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
        <header>
          <p className="text-xs font-semibold uppercase tracking-wide text-[--sys-text-muted]">Organization</p>
          <h1 className="text-2xl font-semibold">{organizationName}</h1>
          <p className="text-sm text-[--sys-text-muted]">Authable memberships replicated into Addressable detail contexts.</p>
        </header>
        <table className="w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[--sys-text-muted]">
              <th>User</th>
              <th>Role</th>
              <th>Assigned</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id} className="rounded-2xl bg-[--cmp-surface-subtle] text-sm">
                <td className="rounded-l-2xl px-4 py-3 font-semibold">{userLookup.get(record.user_id) ?? record.user_id}</td>
                <td className="px-4 py-3 text-[--sys-text-muted]">{roleLookup.get(record.role_id) ?? record.role_id}</td>
                <td className="rounded-r-2xl px-4 py-3 text-[--sys-text-muted]">
                  {new Date(record.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const membershipRecords: MembershipRecord[] = (OrganizationWithAuthableExample.membership_records ?? []).map((record) => ({
  id: record.id,
  userId: record.user_id,
  organizationId: record.organization_id,
  roleId: record.role_id,
  roleName: roleLookup.get(record.role_id),
  userName: userLookup.get(record.user_id),
  state: 'active',
  assignedAt: record.created_at,
}));

const membershipRoles = authableTrait.listRoles().map((role) => ({ id: role.id, name: role.name, description: role.description }));
const membershipUsers = AUTHZ_SAMPLE_DATASET.users.map((user) => ({ id: user.id, name: user.name, email: user.email }));

async function mockAssignRole(userId: string, roleId: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[storybook] assign role ${roleId} to ${userId}`);
}

async function mockRevokeRole(record: MembershipRecord): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[storybook] revoke role ${record.roleId} from ${record.userId}`);
}

async function mockValidateAssignment(userId: string, roleId: string): Promise<MembershipValidationState> {
  return {
    userId,
    roleId,
    organizationId: AUTHZ_SAMPLE_IDS.ORGS.atlas,
    valid: true,
    checkedAt: new Date().toISOString(),
    violations: [],
  };
}

export const MemberList: Story = {
  name: 'Org member list',
  render: () => <OrgMemberList />,
};

export const RoleAssignmentUi: Story = {
  name: 'Role assignment UI',
  render: () => (
    <div className="min-h-screen bg-[--cmp-surface-canvas] p-8">
      <MembershipManager
        organization={{ id: AUTHZ_SAMPLE_IDS.ORGS.atlas, name: organizationName }}
        members={membershipRecords}
        roles={membershipRoles}
        users={membershipUsers}
        onAssignRole={mockAssignRole}
        onRevokeRole={mockRevokeRole}
        onValidateAssignment={mockValidateAssignment}
      />
    </div>
  ),
};

