import { useCallback, useMemo, useRef } from 'react';
import type { JSX, KeyboardEvent } from 'react';

import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from '@/components/base/Table.js';
import type {
  RolePermissionCellKey,
  RolePermissionMatrixState,
} from '@/hooks/useRolePermissions.js';

export interface RolePermissionConflictHighlight {
  readonly roleId: string;
  readonly permissionId: string;
  readonly message: string;
}

export interface RolePermissionMatrixProps {
  readonly matrix: RolePermissionMatrixState | null;
  readonly onToggle?: (roleId: string, permissionId: string, nextState: boolean) => void | Promise<void>;
  readonly readOnly?: boolean;
  readonly busyCells?: ReadonlySet<RolePermissionCellKey>;
  readonly className?: string;
  readonly title?: string;
  readonly description?: string;
  readonly emptyState?: JSX.Element | null;
  readonly conflictHighlights?: readonly RolePermissionConflictHighlight[];
}

const EMPTY_SET = new Set<string>();

export function RolePermissionMatrix({
  matrix,
  onToggle,
  readOnly = false,
  busyCells,
  className,
  title = 'Role permission matrix',
  description = 'Toggle permissions per role. Use the arrow keys to move between cells and Space to toggle.',
  emptyState,
  conflictHighlights,
}: RolePermissionMatrixProps): JSX.Element {
  const assignments = matrix?.assignments ?? new Map<string, ReadonlySet<string>>();
  const roles = matrix?.roles ?? [];
  const permissions = matrix?.permissions ?? [];
  const busy = busyCells ?? EMPTY_SET;
  const tableRef = useRef<HTMLTableElement | null>(null);

  const conflictMap = useMemo(() => {
    const map = new Map<string, RolePermissionConflictHighlight>();
    conflictHighlights?.forEach((conflict) => {
      map.set(makeCellKey(conflict.roleId, conflict.permissionId), conflict);
    });
    return map;
  }, [conflictHighlights]);

  const focusCell = useCallback((rowIndex: number, colIndex: number) => {
    const target = tableRef.current?.querySelector<HTMLButtonElement>(
      `[data-rpm-cell="true"][data-row-index="${rowIndex}"][data-col-index="${colIndex}"]`
    );
    target?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const target = event.currentTarget;
      const rowIndex = Number(target.dataset.rowIndex ?? '0');
      const colIndex = Number(target.dataset.colIndex ?? '0');
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          focusCell(Math.max(0, rowIndex - 1), colIndex);
          break;
        case 'ArrowDown':
          event.preventDefault();
          focusCell(Math.min(roles.length - 1, rowIndex + 1), colIndex);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          focusCell(rowIndex, Math.max(0, colIndex - 1));
          break;
        case 'ArrowRight':
          event.preventDefault();
          focusCell(rowIndex, Math.min(permissions.length - 1, colIndex + 1));
          break;
        case ' ':
        case 'Enter': {
          event.preventDefault();
          target.click();
          break;
        }
        default:
          break;
      }
    },
    [focusCell, permissions.length, roles.length]
  );

  const renderMatrix = (): JSX.Element => {
    if (!matrix) {
      return (
        <div className="rounded-xl border border-dashed border-[--cmp-border-subtle] p-6 text-sm text-[--sys-text-muted]" role="status">
          Loading role permissions…
        </div>
      );
    }

    if (roles.length === 0 || permissions.length === 0) {
      return (
        emptyState ?? (
          <div className="rounded-xl border border-dashed border-[--cmp-border-subtle] p-6 text-sm text-[--sys-text-muted]">
            No role or permission data available.
          </div>
        )
      );
    }

    return (
      <Table
        ref={tableRef}
        role="grid"
        aria-readonly={readOnly}
        className="w-full"
        containerClassName={className}
        containerStyle={{ overflowX: 'auto' }}
      >
        <TableHeader>
          <TableRow>
            <TableHeaderCell scope="col" className="min-w-[12rem]">Role</TableHeaderCell>
            {permissions.map((permission, permissionIndex) => (
              <TableHeaderCell key={permission.id} scope="col" className="text-center">
                <div className="flex flex-col gap-1 text-xs text-[--sys-text-muted]">
                  <span className="font-semibold uppercase tracking-wide">{permission.name}</span>
                  {permission.description ? <span>{permission.description}</span> : null}
                  {permission.resource ? (
                    <span className="text-[0.65rem] uppercase tracking-widest text-[--sys-text-subtle]">
                      {permission.resource}
                      {permission.action ? ` · ${permission.action}` : ''}
                    </span>
                  ) : null}
                  <span className="sr-only">Column {permissionIndex + 1}</span>
                </div>
              </TableHeaderCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role, roleIndex) => {
            const rowAssignments = assignments.get(role.id) ?? EMPTY_SET;
            return (
              <TableRow key={role.id}>
                <TableHeaderCell scope="row" className="align-top text-sm">
                  <span className="font-semibold text-[--sys-text-primary]">{role.name}</span>
                  {role.description ? (
                    <p className="text-xs text-[--sys-text-muted]">{role.description}</p>
                  ) : null}
                </TableHeaderCell>
                {permissions.map((permission, permissionIndex) => {
                  const cellKey = makeCellKey(role.id, permission.id);
                  const enabled = rowAssignments.has(permission.id);
                  const waiting = busy.has(cellKey);
                  const conflict = conflictMap.get(cellKey);
                  return (
                    <TableCell key={cellKey} className="text-center">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={enabled}
                        aria-label={`Toggle ${permission.name} for ${role.name}`}
                        aria-describedby={conflict ? `${cellKey}-conflict` : undefined}
                        className={buildCellClasses(enabled, waiting, Boolean(conflict))}
                        data-rpm-cell="true"
                        data-row-index={roleIndex}
                        data-col-index={permissionIndex}
                        onKeyDown={handleKeyDown}
                        onClick={() => {
                          if (readOnly || waiting) {
                            return;
                          }
                          const next = !enabled;
                          void onToggle?.(role.id, permission.id, next);
                        }}
                        disabled={readOnly || waiting}
                      >
                        <span aria-hidden="true">{enabled ? '●' : '○'}</span>
                        <span className="sr-only">{enabled ? 'Enabled' : 'Disabled'}</span>
                      </button>
                      {conflict ? (
                        <p
                          id={`${cellKey}-conflict`}
                          role="note"
                          className="mt-2 text-xs text-[--sys-status-warning-fg]"
                        >
                          {conflict.message}
                        </p>
                      ) : null}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-[--sys-text-primary]">{title}</h2>
        <p className="text-sm text-[--sys-text-muted]">{description}</p>
      </header>
      {renderMatrix()}
    </section>
  );
}

function makeCellKey(roleId: string, permissionId: string): RolePermissionCellKey {
  return `${roleId}:${permissionId}`;
}

function buildCellClasses(enabled: boolean, waiting: boolean, hasConflict: boolean): string {
  const base = [
    'role-permission-toggle inline-flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--sys-focus-ring]',
  ];
  if (enabled) {
    base.push('border-[--cmp-border-strong] bg-[--cmp-surface-strong] text-[--sys-text-primary]');
  } else {
    base.push('border-[--cmp-border-subtle] bg-[--cmp-surface-canvas] text-[--sys-text-muted]');
  }
  if (waiting) {
    base.push('opacity-60');
  }
  if (hasConflict) {
    base.push('ring-2 ring-[--sys-status-warning-fg]');
  }
  return base.join(' ');
}
