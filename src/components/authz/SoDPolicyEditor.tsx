import { useMemo, useState } from 'react';
import type { JSX, ChangeEvent, FormEvent } from 'react';

import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from '@/components/base/Table.js';

import type { MembershipRoleOption, OrganizationSummary } from './MembershipManager.js';
import TimeService from '@/services/time/index.js';

export interface SodPolicy {
  readonly id: string;
  readonly roleAId: string;
  readonly roleBId: string;
  readonly reason: string;
  readonly organizationId: string | null;
  readonly active: boolean;
  readonly createdAt?: string;
}

export interface SodPolicyDraft {
  readonly roleAId: string;
  readonly roleBId: string;
  readonly reason: string;
  readonly organizationId: string | null;
  readonly active?: boolean;
}

export interface SoDPolicyEditorProps {
  readonly policies: readonly SodPolicy[];
  readonly roles: readonly MembershipRoleOption[];
  readonly organizationOptions?: readonly OrganizationSummary[];
  readonly onCreatePolicy?: (draft: SodPolicyDraft) => Promise<void> | void;
  readonly onUpdatePolicy?: (policyId: string, updates: Partial<SodPolicyDraft>) => Promise<void> | void;
  readonly onDeletePolicy?: (policyId: string) => Promise<void> | void;
  readonly readOnly?: boolean;
  readonly className?: string;
}

const DEFAULT_DRAFT: SodPolicyDraft = {
  roleAId: '',
  roleBId: '',
  reason: '',
  organizationId: null,
  active: true,
};

export function SoDPolicyEditor({
  policies,
  roles,
  organizationOptions = [],
  onCreatePolicy,
  onUpdatePolicy,
  onDeletePolicy,
  readOnly = false,
  className,
}: SoDPolicyEditorProps): JSX.Element {
  const [draft, setDraft] = useState<SodPolicyDraft>(DEFAULT_DRAFT);
  const [scopeMode, setScopeMode] = useState<'global' | 'org'>('global');
  const [error, setError] = useState<string | null>(null);

  const sortedPolicies = useMemo(() => {
    return [...policies].sort((a, b) => a.reason.localeCompare(b.reason));
  }, [policies]);

  const handleInputChange = (event: ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setDraft((prev) => ({ ...prev, [name]: value }));
  };

  const handleScopeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const mode = event.target.value === 'org' ? 'org' : 'global';
    setScopeMode(mode);
    setDraft((prev) => ({ ...prev, organizationId: mode === 'org' ? prev.organizationId ?? organizationOptions[0]?.id ?? '' : null }));
  };

  const handleScopeSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextOrg = event.target.value;
    setDraft((prev) => ({ ...prev, organizationId: nextOrg }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!draft.roleAId || !draft.roleBId) {
      setError('Select both roles to define a conflict.');
      return;
    }
    if (draft.roleAId === draft.roleBId) {
      setError('Roles must be distinct.');
      return;
    }
    if (!draft.reason.trim()) {
      setError('Provide a reason explaining the conflict.');
      return;
    }
    if (scopeMode === 'org' && !draft.organizationId) {
      setError('Select an organization scope.');
      return;
    }
    await onCreatePolicy?.(draft);
    setDraft({ ...DEFAULT_DRAFT });
    setScopeMode('global');
  };

  const handleToggleActive = async (policy: SodPolicy) => {
    await onUpdatePolicy?.(policy.id, { active: !policy.active });
  };

  const handleDelete = async (policy: SodPolicy) => {
    await onDeletePolicy?.(policy.id);
  };

  return (
    <section className={['space-y-5', className].filter(Boolean).join(' ')}>
      <header>
        <h2 className="text-lg font-semibold text-[--sys-text-primary]">SoD policy editor</h2>
        <p className="text-sm text-[--sys-text-muted]">Create or update conflicting role pairs. Scope policies globally or to a specific organization.</p>
      </header>

      <form className="space-y-4 rounded-2xl border border-[--cmp-border-subtle] bg-[--cmp-surface-subtle] p-6" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-[--sys-text-primary]">
            Role A
            <select
              className="mt-1 w-full rounded-lg border border-[--cmp-border-subtle] bg-white px-3 py-2 text-sm"
              name="roleAId"
              value={draft.roleAId}
              onChange={handleInputChange}
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
          <label className="text-sm text-[--sys-text-primary]">
            Role B
            <select
              className="mt-1 w-full rounded-lg border border-[--cmp-border-subtle] bg-white px-3 py-2 text-sm"
              name="roleBId"
              value={draft.roleBId}
              onChange={handleInputChange}
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

        <label className="block text-sm text-[--sys-text-primary]">
          Reason
          <textarea
            className="mt-1 w-full rounded-lg border border-[--cmp-border-subtle] bg-white px-3 py-2 text-sm"
            name="reason"
            value={draft.reason}
            onChange={handleInputChange}
            rows={3}
            disabled={readOnly}
          />
        </label>

        <div className="flex flex-wrap gap-6 text-sm text-[--sys-text-primary]">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="scope"
              value="global"
              checked={scopeMode === 'global'}
              onChange={handleScopeChange}
              disabled={readOnly}
            />
            Global
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="scope"
              value="org"
              checked={scopeMode === 'org'}
              onChange={handleScopeChange}
              disabled={readOnly || organizationOptions.length === 0}
            />
            Specific organization
          </label>
          {scopeMode === 'org' ? (
            <select
              className="rounded-lg border border-[--cmp-border-subtle] bg-white px-3 py-2 text-sm"
              value={draft.organizationId ?? ''}
              onChange={handleScopeSelect}
              disabled={readOnly}
            >
              <option value="" disabled>
                Select organization
              </option>
              {organizationOptions.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <button
          type="submit"
          className="rounded-full bg-[--cmp-surface-strong] px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-[--cmp-surface-strong-hover] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[--sys-focus-ring] disabled:opacity-60"
          disabled={readOnly}
        >
          Create policy
        </button>
        {error ? <p className="text-sm text-[--sys-status-danger-fg]">{error}</p> : null}
      </form>

      <div>
        <h3 className="mb-2 text-base font-semibold text-[--sys-text-primary]">Existing policies</h3>
        <Table className="w-full" containerClassName="overflow-x-auto">
          <TableHeader>
            <TableRow>
              <TableHeaderCell scope="col">Roles</TableHeaderCell>
              <TableHeaderCell scope="col">Reason</TableHeaderCell>
              <TableHeaderCell scope="col">Scope</TableHeaderCell>
              <TableHeaderCell scope="col">Status</TableHeaderCell>
              <TableHeaderCell scope="col">Actions</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPolicies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-[--sys-text-muted]">
                  No SoD policies defined.
                </TableCell>
              </TableRow>
            ) : (
              sortedPolicies.map((policy) => (
                <TableRow key={policy.id}>
                  <TableCell>
                    <p className="text-sm font-medium text-[--sys-text-primary]">
                      {resolveRoleName(policy.roleAId, roles)} · {resolveRoleName(policy.roleBId, roles)}
                    </p>
                    <p className="text-xs text-[--sys-text-muted]">{policy.id}</p>
                  </TableCell>
                  <TableCell className="text-sm text-[--sys-text-primary]">{policy.reason}</TableCell>
                  <TableCell className="text-sm text-[--sys-text-muted]">
                    {policy.organizationId ? `Org ${policy.organizationId}` : 'Global'}
                  </TableCell>
                  <TableCell>
                    <span className={policy.active ? 'text-[--sys-status-success-fg]' : 'text-[--sys-status-danger-fg]'}>
                      {policy.active ? 'Active' : 'Inactive'}
                    </span>
                    {policy.createdAt ? (
                      <p className="text-xs text-[--sys-text-subtle]">{formatDate(policy.createdAt)}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="space-x-3">
                    <button
                      type="button"
                      className="rounded-full border border-[--cmp-border-subtle] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[--sys-text-primary] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[--sys-focus-ring] disabled:opacity-60"
                      onClick={() => handleToggleActive(policy)}
                      disabled={readOnly}
                    >
                      {policy.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-[--cmp-border-subtle] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[--sys-status-danger-fg] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[--sys-focus-ring] disabled:opacity-60"
                      onClick={() => handleDelete(policy)}
                      disabled={readOnly}
                    >
                      Delete
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function resolveRoleName(roleId: string, roles: readonly MembershipRoleOption[]): string {
  return roles.find((role) => role.id === roleId)?.name ?? roleId;
}

function formatDate(value?: string): string {
  if (!value) {
    return '';
  }
  try {
    const dt = TimeService.fromDatabase(value);
    return dt.toFormat('LLL d, yyyy');
  } catch (error) {
    return value;
  }
}
