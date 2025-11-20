import { useState } from 'react';
import type { JSX, ChangeEvent, FormEvent } from 'react';

import TimeService from '@/services/time/index.js';

export interface PermissionCheckInput {
  readonly userId: string;
  readonly organizationId: string;
  readonly permission: string;
}

export interface PermissionCheckResult {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly grantedByRoles?: readonly string[];
  readonly evaluatedAt: string;
}

export interface PermissionCheckerClient {
  check(payload: PermissionCheckInput): Promise<PermissionCheckResult>;
}

export interface PermissionCheckerProps {
  readonly client: PermissionCheckerClient;
  readonly defaultUserId?: string;
  readonly defaultOrganizationId?: string;
  readonly defaultPermission?: string;
  readonly readOnly?: boolean;
  readonly className?: string;
}

export function PermissionChecker({
  client,
  defaultUserId = '',
  defaultOrganizationId = '',
  defaultPermission = '',
  readOnly = false,
  className,
}: PermissionCheckerProps): JSX.Element {
  const [inputs, setInputs] = useState<PermissionCheckInput>({
    userId: defaultUserId,
    organizationId: defaultOrganizationId,
    permission: defaultPermission,
  });
  const [result, setResult] = useState<PermissionCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setInputs((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!inputs.userId || !inputs.organizationId || !inputs.permission) {
      setError('Provide userId, organizationId, and permission.');
      return;
    }
    setIsChecking(true);
    try {
      const response = await client.check(inputs);
      setResult(response);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unable to evaluate permission.';
      setError(message);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <section className={['space-y-4 rounded-2xl border border-[--cmp-border-subtle] bg-[--cmp-surface-subtle] p-6', className].filter(Boolean).join(' ')}>
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-[--sys-text-muted]">Diagnostics</p>
        <h2 className="text-lg font-semibold text-[--sys-text-primary]">Permission checker</h2>
        <p className="text-sm text-[--sys-text-muted]">Instantly confirm whether a user holds a permission within a tenant scope. Results include the granting roles.</p>
      </header>

      <form className="grid gap-4 md:grid-cols-3" onSubmit={handleSubmit}>
        <label className="text-sm text-[--sys-text-primary]">
          User ID
          <input
            type="text"
            className="mt-1 w-full rounded-lg border border-[--cmp-border-subtle] px-3 py-2 text-sm"
            name="userId"
            value={inputs.userId}
            onChange={handleChange}
            disabled={readOnly}
            placeholder="usr_123"
          />
        </label>
        <label className="text-sm text-[--sys-text-primary]">
          Organization ID
          <input
            type="text"
            className="mt-1 w-full rounded-lg border border-[--cmp-border-subtle] px-3 py-2 text-sm"
            name="organizationId"
            value={inputs.organizationId}
            onChange={handleChange}
            disabled={readOnly}
            placeholder="org_main"
          />
        </label>
        <label className="text-sm text-[--sys-text-primary]">
          Permission
          <input
            type="text"
            className="mt-1 w-full rounded-lg border border-[--cmp-border-subtle] px-3 py-2 text-sm"
            name="permission"
            value={inputs.permission}
            onChange={handleChange}
            disabled={readOnly}
            placeholder="resource:action"
          />
        </label>
        <div className="md:col-span-3">
          <button
            type="submit"
            className="rounded-full bg-[--cmp-surface-strong] px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-[--cmp-surface-strong-hover] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[--sys-focus-ring] disabled:opacity-60"
            disabled={readOnly}
          >
            {isChecking ? 'Checking…' : 'Check permission'}
          </button>
        </div>
      </form>

      {error ? (
        <p className="text-sm text-[--sys-status-danger-fg]" role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div
          className="rounded-xl border border-[--cmp-border-subtle] bg-white p-4"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[--sys-text-primary]">
              {result.allowed ? 'Permission granted' : 'Permission denied'}
            </p>
            <span className={result.allowed ? 'text-[--sys-status-success-fg]' : 'text-[--sys-status-danger-fg]'}>
              {result.allowed ? 'YES' : 'NO'}
            </span>
          </div>
          {result.grantedByRoles?.length ? (
            <div className="mt-2 text-sm text-[--sys-text-muted]">
              <p>Granted via roles:</p>
              <ul className="mt-1 list-disc pl-5">
                {result.grantedByRoles.map((role) => (
                  <li key={role}>{role}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.reason ? (
            <p className="mt-2 text-sm text-[--sys-text-muted]">{result.reason}</p>
          ) : null}
          <p className="mt-2 text-xs text-[--sys-text-subtle]">Evaluated at {formatDate(result.evaluatedAt)}</p>
        </div>
      ) : null}
    </section>
  );
}

function formatDate(value: string): string {
  try {
    const dt = TimeService.fromDatabase(value);
    return dt.toFormat('HH:mm:ss ZZZZ');
  } catch (error) {
    return value;
  }
}
