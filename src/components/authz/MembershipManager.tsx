import { useMemo, useState } from 'react';
import type { JSX, ChangeEvent, FormEvent } from 'react';

import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from '@/components/base/Table.js';
import type {
  MembershipRecord,
  MembershipValidationState,
  PendingMembershipKey,
} from '@/hooks/useMemberships.js';
import TimeService from '@/services/time/index.js';

export interface MembershipRoleOption {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
}

export interface MembershipUserOption {
  readonly id: string;
  readonly name: string;
  readonly email?: string;
}

export interface OrganizationSummary {
  readonly id: string;
  readonly name: string;
}

export interface MembershipManagerProps {
  readonly organization: OrganizationSummary;
  readonly members: readonly MembershipRecord[];
  readonly roles: readonly MembershipRoleOption[];
  readonly users: readonly MembershipUserOption[];
  readonly onAssignRole?: (userId: string, roleId: string) => Promise<void> | void;
  readonly onRevokeRole?: (membership: MembershipRecord) => Promise<void> | void;
  readonly onValidateAssignment?: (userId: string, roleId: string) => Promise<MembershipValidationState | null>;
  readonly validationState?: MembershipValidationState | null;
  readonly pendingMembers?: ReadonlySet<PendingMembershipKey>;
  readonly readOnly?: boolean;
  readonly className?: string;
}

const EMPTY_PENDING = new Set<string>();

export function MembershipManager({
  organization,
  members,
  roles,
  users,
  onAssignRole,
  onRevokeRole,
  onValidateAssignment,
  validationState,
  pendingMembers,
  readOnly = false,
  className,
}: MembershipManagerProps): JSX.Element {
  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id ?? '');
  const [selectedRoleId, setSelectedRoleId] = useState<string>(roles[0]?.id ?? '');
  const [formError, setFormError] = useState<string | null>(null);
  const [lastValidationMessage, setLastValidationMessage] = useState<string | null>(null);

  const pending = pendingMembers ?? EMPTY_PENDING;

  const conflictingViolations = useMemo(() => {
    if (!validationState || validationState.valid) {
      return [];
    }
    if (validationState.userId !== selectedUserId || validationState.roleId !== selectedRoleId) {
      return [];
    }
    return validationState.violations;
  }, [selectedRoleId, selectedUserId, validationState]);

  const handleUserChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedUserId(event.target.value);
    setLastValidationMessage(null);
  };

  const handleRoleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedRoleId(event.target.value);
    setLastValidationMessage(null);
  };

  const handleValidate = async () => {
    if (!onValidateAssignment || !selectedUserId || !selectedRoleId) {
      return;
    }
    const result = await onValidateAssignment(selectedUserId, selectedRoleId);
    if (!result) {
      setLastValidationMessage('No validator configured.');
      return;
    }
    setLastValidationMessage(
      result.valid ? 'Assignment passes SoD validation.' : 'Conflicts detected. Review the warnings below.'
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (!selectedUserId || !selectedRoleId) {
      setFormError('Select both a user and a role.');
      return;
    }
    try {
      await onAssignRole?.(selectedUserId, selectedRoleId);
      setLastValidationMessage(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to assign role.';
      setFormError(message);
    }
  };

  const pendingKey = buildPendingKey(selectedUserId, selectedRoleId);
  const isSubmitting = pending.has(pendingKey);

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => a.userName?.localeCompare(b.userName ?? '') ?? 0);
  }, [members]);

  const summaryStats = useMemo(() => {
    const uniqueUsers = new Set(members.map((member) => member.userId));
    const uniqueRoles = new Set(members.map((member) => member.roleId));
    return {
      members: uniqueUsers.size,
      roles: uniqueRoles.size,
    };
  }, [members]);

  return (
    <section className={['space-y-6', className].filter(Boolean).join(' ')}>
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[--sys-text-muted]">Organization</p>
        <h2 className="text-xl font-semibold text-[--sys-text-primary]">{organization.name}</h2>
        <p className="text-sm text-[--sys-text-muted]">
          Manage member-to-role assignments. These changes scope to {organization.name} only.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Active members" value={summaryStats.members} description="Unique users assigned to this org" />
        <StatCard label="Roles in use" value={summaryStats.roles} description="Distinct roles mapped to members" />
      </div>

      <form className="space-y-4 rounded-2xl border border-[--cmp-border-subtle] bg-[--cmp-surface-subtle] p-6" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm text-[--sys-text-primary]">
            User
            <select
              className="mt-1 w-full rounded-lg border border-[--cmp-border-subtle] bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[--sys-focus-ring]"
              value={selectedUserId}
              onChange={handleUserChange}
              disabled={readOnly}
            >
              <option value="" disabled>
                Select user
              </option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                  {user.email ? ` · ${user.email}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-[--sys-text-primary]">
            Role
            <select
              className="mt-1 w-full rounded-lg border border-[--cmp-border-subtle] bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[--sys-focus-ring]"
              value={selectedRoleId}
              onChange={handleRoleChange}
              disabled={readOnly}
            >
              <option value="" disabled>
                Select role
              </option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-full border border-[--cmp-border-subtle] px-4 py-2 text-sm font-semibold text-[--sys-text-primary] hover:border-[--cmp-border-strong] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[--sys-focus-ring] disabled:opacity-60"
            onClick={handleValidate}
            disabled={readOnly || !onValidateAssignment}
          >
            Check SoD conflicts
          </button>
          <button
            type="submit"
            className="rounded-full border border-transparent bg-[--cmp-surface-strong] px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-[--cmp-surface-strong-hover] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[--sys-focus-ring] disabled:bg-[--cmp-surface-canvas] disabled:text-[--sys-text-primary] disabled:border-[--cmp-border-subtle]"
            disabled={readOnly || isSubmitting || !selectedUserId || !selectedRoleId}
          >
            {isSubmitting ? 'Assigning…' : 'Assign role'}
          </button>
        </div>

        {formError ? <p className="text-sm text-[--sys-status-danger-fg]">{formError}</p> : null}
        {lastValidationMessage ? <p className="text-sm text-[--sys-text-muted]">{lastValidationMessage}</p> : null}

        {conflictingViolations.length > 0 ? (
          <div className="rounded-xl border border-[--sys-status-warning-border] bg-[--sys-status-warning-bg] p-4" role="alert">
            <p className="text-sm font-semibold text-[--sys-status-warning-fg]">Separation of duty conflict</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[--sys-text-primary]">
              {conflictingViolations.map((violation) => (
                <li key={violation.policyId}>
                  {violation.reason} (conflicts with role {violation.conflictingRoleId}
                  {violation.organizationId ? ` in org ${violation.organizationId}` : ''})
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </form>

      <div>
        <h3 className="mb-2 text-base font-semibold text-[--sys-text-primary]">Current memberships</h3>
        <Table className="w-full" containerClassName="overflow-x-auto">
          <TableHeader>
            <TableRow>
              <TableHeaderCell scope="col">User</TableHeaderCell>
              <TableHeaderCell scope="col">Role</TableHeaderCell>
              <TableHeaderCell scope="col">State</TableHeaderCell>
              <TableHeaderCell scope="col">Actions</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-[--sys-text-muted]">
                  No memberships found for this organization.
                </TableCell>
              </TableRow>
            ) : (
              sortedMembers.map((member) => {
                const memberKey = buildPendingKey(member.userId, member.roleId);
                const isMemberPending = pending.has(memberKey);
                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="text-sm font-medium text-[--sys-text-primary]">{member.userName ?? member.userId}</div>
                      {member.userId !== member.userName ? (
                        <p className="text-xs text-[--sys-text-muted]">{member.userId}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-[--sys-text-primary]">{resolveRoleName(member.roleId, roles)}</p>
                      <p className="text-xs text-[--sys-text-muted]">{member.roleId}</p>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-[--cmp-surface-canvas] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[--sys-text-muted]">
                        {(member.state ?? 'active').toUpperCase()}
                      </span>
                      {member.assignedAt ? (
                        <p className="mt-1 text-xs text-[--sys-text-subtle]">Since {formatDate(member.assignedAt)}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="rounded-full border border-[--cmp-border-subtle] px-4 py-1 text-sm font-semibold text-[--sys-text-primary] hover:border-[--cmp-border-strong] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[--sys-focus-ring] disabled:opacity-60"
                        onClick={() => onRevokeRole?.(member)}
                        disabled={readOnly || isMemberPending}
                      >
                        {isMemberPending ? 'Revoking…' : 'Revoke'}
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function buildPendingKey(userId: string, roleId: string): PendingMembershipKey {
  return `${userId}:${roleId}`;
}

function resolveRoleName(roleId: string, roles: readonly MembershipRoleOption[]): string {
  return roles.find((role) => role.id === roleId)?.name ?? roleId;
}

function formatDate(value?: string): string {
  if (!value) {
    return 'unknown';
  }
  try {
    const dt = TimeService.fromDatabase(value);
    return dt.toFormat('LLL d, yyyy');
  } catch (error) {
    return value;
  }
}

interface StatCardProps {
  readonly label: string;
  readonly value: number;
  readonly description?: string;
}

function StatCard({ label, value, description }: StatCardProps): JSX.Element {
  return (
    <div className="rounded-2xl border border-[--cmp-border-subtle] bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-[--sys-text-muted]">{label}</p>
      <p className="text-3xl font-semibold text-[--sys-text-primary]">{value}</p>
      {description ? <p className="text-xs text-[--sys-text-muted]">{description}</p> : null}
    </div>
  );
}
