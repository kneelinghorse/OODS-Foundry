/* @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';

import { MembershipManager } from '../../../src/components/authz/MembershipManager.js';
import type {
  MembershipManagerProps,
  MembershipRoleOption,
  MembershipUserOption,
  OrganizationSummary,
} from '../../../src/components/authz/MembershipManager.js';
import type { MembershipRecord } from '../../../src/hooks/useMemberships.js';

const ORG: OrganizationSummary = { id: 'org-main', name: 'Foundry Labs' };
const ROLES: MembershipRoleOption[] = [
  { id: 'role_admin', name: 'Admin' },
  { id: 'role_editor', name: 'Editor' },
];
const USERS: MembershipUserOption[] = [
  { id: 'usr_alex', name: 'Alex Lee' },
  { id: 'usr_blair', name: 'Blair Chen' },
];
const MEMBERS: MembershipRecord[] = [
  {
    id: 'mbr_1',
    userId: 'usr_alex',
    userName: 'Alex Lee',
    organizationId: ORG.id,
    roleId: 'role_admin',
    assignedAt: new Date().toISOString(),
    state: 'active',
  },
];

function renderManager(overrides: Partial<MembershipManagerProps> = {}) {
  const props: MembershipManagerProps = {
    organization: ORG,
    roles: ROLES,
    users: USERS,
    members: MEMBERS,
    onAssignRole: vi.fn(),
    onRevokeRole: vi.fn(),
    onValidateAssignment: vi.fn(),
    validationState: null,
    pendingMembers: new Set(),
    ...overrides,
  };
  return render(<MembershipManager {...props} />);
}

describe('MembershipManager accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = renderManager();
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: false },
      },
    });
    expect(results.violations ?? []).toHaveLength(0);
  });

  it('supports keyboard submissions for assigning roles', async () => {
    const onAssignRole = vi.fn();
    renderManager({ onAssignRole });
    const user = userEvent.setup();

    const userSelect = screen.getByLabelText(/user/i);
    await user.selectOptions(userSelect, 'usr_blair');

    const roleSelect = screen.getByLabelText(/role/i);
    await user.selectOptions(roleSelect, 'role_editor');

    const assignButton = screen.getByRole('button', { name: /assign role/i });
    assignButton.focus();
    await user.keyboard('{Enter}');

    expect(onAssignRole).toHaveBeenCalledWith('usr_blair', 'role_editor');
  });
});
