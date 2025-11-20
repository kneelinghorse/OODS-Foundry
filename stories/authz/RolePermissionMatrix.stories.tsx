import type { Meta, StoryObj } from '@storybook/react';
import { useMemo } from 'react';
import '../../src/styles/globals.css';

import { RolePermissionMatrix } from '../../src/components/authz/RolePermissionMatrix.js';
import type {
  RolePermissionConflictHighlight,
  RolePermissionMatrixProps,
} from '../../src/components/authz/RolePermissionMatrix.js';
import { useRolePermissions } from '../../src/hooks/useRolePermissions.js';
import type {
  PermissionDescriptor,
  RoleDescriptor,
  RolePermissionCellKey,
  RolePermissionClient,
  RolePermissionMatrixSnapshot,
} from '../../src/hooks/useRolePermissions.js';

const SAMPLE_ROLES: RoleDescriptor[] = [
  { id: 'role_admin', name: 'Admin', description: 'Full control across the tenant.' },
  { id: 'role_editor', name: 'Editor', description: 'Manage content and settings.' },
  { id: 'role_viewer', name: 'Viewer', description: 'Read-only access.' },
];

const SAMPLE_PERMISSIONS: PermissionDescriptor[] = [
  { id: 'perm_user_manage', name: 'user:manage', resource: 'user', action: 'manage', description: 'Invite/update users.' },
  { id: 'perm_invoice_approve', name: 'invoice:approve', resource: 'invoice', action: 'approve', description: 'Approve invoices.' },
  { id: 'perm_org_configure', name: 'org:configure', resource: 'organization', action: 'configure', description: 'Change org settings.' },
  { id: 'perm_audit_read', name: 'audit:read', resource: 'audit', action: 'read', description: 'Inspect audit log.' },
];

class MockRolePermissionClient implements RolePermissionClient {
  private snapshot: RolePermissionMatrixSnapshot;

  constructor(seed?: RolePermissionMatrixSnapshot) {
    this.snapshot = seed ?? {
      roles: SAMPLE_ROLES,
      permissions: SAMPLE_PERMISSIONS,
      assignments: {
        role_admin: SAMPLE_PERMISSIONS.map((permission) => permission.id),
        role_editor: ['perm_user_manage', 'perm_invoice_approve'],
        role_viewer: ['perm_audit_read'],
      },
      organizationId: 'org-main',
      updatedAt: new Date().toISOString(),
    } satisfies RolePermissionMatrixSnapshot;
  }

  async fetchMatrix(): Promise<RolePermissionMatrixSnapshot> {
    return structuredClone(this.snapshot);
  }

  async assignPermission(roleId: string, permissionId: string): Promise<RolePermissionMatrixSnapshot> {
    const assignments = new Set(this.snapshot.assignments[roleId] ?? []);
    assignments.add(permissionId);
    this.snapshot = {
      ...this.snapshot,
      assignments: {
        ...this.snapshot.assignments,
        [roleId]: Array.from(assignments),
      },
      updatedAt: new Date().toISOString(),
    } satisfies RolePermissionMatrixSnapshot;
    return structuredClone(this.snapshot);
  }

  async revokePermission(roleId: string, permissionId: string): Promise<RolePermissionMatrixSnapshot> {
    const assignments = new Set(this.snapshot.assignments[roleId] ?? []);
    assignments.delete(permissionId);
    this.snapshot = {
      ...this.snapshot,
      assignments: {
        ...this.snapshot.assignments,
        [roleId]: Array.from(assignments),
      },
      updatedAt: new Date().toISOString(),
    } satisfies RolePermissionMatrixSnapshot;
    return structuredClone(this.snapshot);
  }
}

const mockClient = new MockRolePermissionClient();

const meta: Meta<typeof RolePermissionMatrix> = {
  title: 'Authz/RolePermissionMatrix',
  component: RolePermissionMatrix,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['vrt'],
};

export default meta;

type Story = StoryObj<typeof RolePermissionMatrix>;

interface PlaygroundProps {
  readonly readOnly?: boolean;
  readonly conflictHighlights?: readonly RolePermissionConflictHighlight[];
}

function MatrixPlayground({ readOnly, conflictHighlights }: PlaygroundProps): JSX.Element {
  const { matrix, toggleAssignment, busyCells } = useRolePermissions({
    client: mockClient,
    organizationId: 'org-main',
    autoRefreshIntervalMs: 0,
  });

  const props: RolePermissionMatrixProps = useMemo(
    () => ({
      matrix,
      readOnly,
      busyCells,
      conflictHighlights,
      onToggle: toggleAssignment,
    }),
    [busyCells, conflictHighlights, matrix, readOnly, toggleAssignment]
  );

  return (
    <div className="min-h-screen bg-[--cmp-surface-canvas] p-8">
      <RolePermissionMatrix {...props} />
    </div>
  );
}

export const AdminManaging: Story = {
  render: () => <MatrixPlayground />,
};

export const ReadOnlyViewer: Story = {
  render: () => <MatrixPlayground readOnly />,
};

export const SoDConflictWarning: Story = {
  render: () => (
    <MatrixPlayground
      conflictHighlights={[
        {
          roleId: 'role_admin',
          permissionId: 'perm_invoice_approve',
          message: 'Conflicts with DSoD_002 (creator ≠ approver).',
        },
      ]}
    />
  ),
};
