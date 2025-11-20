/* @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RolePermissionMatrix } from '../../../src/components/authz/RolePermissionMatrix.js';
import type {
  RolePermissionMatrixState,
  RoleDescriptor,
  PermissionDescriptor,
} from '../../../src/hooks/useRolePermissions.js';

const ROLES: RoleDescriptor[] = [
  { id: 'role_admin', name: 'Admin' },
  { id: 'role_editor', name: 'Editor' },
];

const PERMISSIONS: PermissionDescriptor[] = [
  { id: 'perm_manage', name: 'user:manage' },
  { id: 'perm_approve', name: 'invoice:approve' },
];

function createMatrix(): RolePermissionMatrixState {
  return {
    roles: ROLES,
    permissions: PERMISSIONS,
    assignments: new Map([
      ['role_admin', new Set(['perm_manage', 'perm_approve'])],
      ['role_editor', new Set(['perm_manage'])],
    ]),
    updatedAt: new Date().toISOString(),
    organizationId: 'org-main',
  } satisfies RolePermissionMatrixState;
}

describe('RolePermissionMatrix', () => {
  it('invokes callback when toggling permissions', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <RolePermissionMatrix
        matrix={createMatrix()}
        onToggle={onToggle}
      />
    );

    const toggle = screen.getByRole('checkbox', { name: /user:manage for Admin/i });
    await user.click(toggle);

    expect(onToggle).toHaveBeenCalledWith('role_admin', 'perm_manage', false);
  });

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<RolePermissionMatrix matrix={createMatrix()} />);

    const firstCell = screen.getByRole('checkbox', { name: /user:manage for Admin/i });
    firstCell.focus();
    await user.keyboard('{ArrowRight}');
    const nextCell = screen.getByRole('checkbox', { name: /invoice:approve for Admin/i });
    expect(nextCell).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    const editorCell = screen.getByRole('checkbox', { name: /invoice:approve for Editor/i });
    expect(editorCell).toHaveFocus();
  });

  it('renders SoD conflict messaging when provided', () => {
    render(
      <RolePermissionMatrix
        matrix={createMatrix()}
        conflictHighlights={[
          { roleId: 'role_editor', permissionId: 'perm_manage', message: 'Conflicts with SSoD_002' },
        ]}
      />
    );

    expect(screen.getByText(/conflicts with/i)).toBeInTheDocument();
  });
});
