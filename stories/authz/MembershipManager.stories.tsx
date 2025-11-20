import type { Meta, StoryObj } from '@storybook/react';
import { useMemo } from 'react';
import '../../src/styles/globals.css';

import { MembershipManager } from '../../src/components/authz/MembershipManager.js';
import type {
  MembershipManagerProps,
  MembershipRoleOption,
  MembershipUserOption,
  OrganizationSummary,
} from '../../src/components/authz/MembershipManager.js';
import { useMemberships } from '../../src/hooks/useMemberships.js';
import type {
  MembershipClient,
  MembershipRecord,
  MembershipValidator,
  SodValidationResult,
} from '../../src/hooks/useMemberships.js';

const ORG: OrganizationSummary = { id: 'org-main', name: 'Foundry Labs' };

const ROLE_OPTIONS: MembershipRoleOption[] = [
  { id: 'role_admin', name: 'Admin' },
  { id: 'role_editor', name: 'Editor' },
  { id: 'role_approver', name: 'Approver' },
  { id: 'role_requester', name: 'Requester' },
];

const USER_OPTIONS: MembershipUserOption[] = [
  { id: 'usr_alex', name: 'Alex Lee', email: 'alex@example.com' },
  { id: 'usr_blair', name: 'Blair Chen', email: 'blair@example.com' },
  { id: 'usr_casey', name: 'Casey Patel', email: 'casey@example.com' },
];

interface StoryContextProps {
  readonly validator?: MembershipValidator;
  readonly readOnly?: boolean;
}

class MockMembershipClient implements MembershipClient {
  private members: MembershipRecord[] = [
    {
      id: 'mbr_1',
      userId: 'usr_alex',
      userName: 'Alex Lee',
      organizationId: ORG.id,
      roleId: 'role_admin',
      assignedAt: new Date(Date.now() - 86400000).toISOString(),
      state: 'active',
    },
    {
      id: 'mbr_2',
      userId: 'usr_blair',
      userName: 'Blair Chen',
      organizationId: ORG.id,
      roleId: 'role_editor',
      assignedAt: new Date(Date.now() - 3600000).toISOString(),
      state: 'active',
    },
  ];

  async listMemberships(): Promise<readonly MembershipRecord[]> {
    return [...this.members];
  }

  async assignRole(userId: string, roleId: string): Promise<MembershipRecord> {
    const record: MembershipRecord = {
      id: `mbr_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      userName: USER_OPTIONS.find((user) => user.id === userId)?.name ?? userId,
      organizationId: ORG.id,
      roleId,
      assignedAt: new Date().toISOString(),
      state: 'active',
    };
    this.members = [...this.members.filter((membership) => membership.id !== record.id), record];
    return record;
  }

  async revokeRole(userId: string, roleId: string): Promise<boolean> {
    const before = this.members.length;
    this.members = this.members.filter((member) => !(member.userId === userId && member.roleId === roleId));
    return this.members.length !== before;
  }
}

class MockValidator implements MembershipValidator {
  async validateAssignment(userId: string, _organizationId: string, roleId: string): Promise<SodValidationResult> {
    if (userId === 'usr_alex' && roleId === 'role_approver') {
      return {
        valid: false,
        violations: [
          {
            policyId: 'SSoD_001',
            reason: 'Alex already holds Requester. Approver + Requester conflict.',
            conflictingRoleId: 'role_requester',
            organizationId: null,
          },
        ],
      } satisfies SodValidationResult;
    }
    return { valid: true, violations: [] } satisfies SodValidationResult;
  }
}

function MembershipPlayground({ validator, readOnly }: StoryContextProps): JSX.Element {
  const client = useMemo(() => new MockMembershipClient(), []);
  const result = useMemberships({
    organizationId: ORG.id,
    client,
    validator,
    autoRefreshIntervalMs: 0,
  });

  const props: MembershipManagerProps = {
    organization: ORG,
    roles: ROLE_OPTIONS,
    users: USER_OPTIONS,
    members: result.memberships,
    onAssignRole: result.assignRole,
    onRevokeRole: (member) => result.revokeRole(member.userId, member.roleId),
    onValidateAssignment: result.validateAssignment,
    validationState: result.validationState,
    pendingMembers: result.pendingMembers,
    readOnly,
  };

  return (
    <div className="min-h-screen bg-[--cmp-surface-canvas] p-8">
      <MembershipManager {...props} />
    </div>
  );
}

const meta: Meta<typeof MembershipManager> = {
  title: 'Authz/MembershipManager',
  component: MembershipManager,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['vrt'],
};

export default meta;

type Story = StoryObj<typeof MembershipManager>;

export const DefaultManager: Story = {
  render: () => <MembershipPlayground />,
};

export const ConflictPrevention: Story = {
  render: () => <MembershipPlayground validator={new MockValidator()} />,
};

export const ReadOnlyView: Story = {
  render: () => <MembershipPlayground readOnly />,
};
