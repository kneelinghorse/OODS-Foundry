import { randomUUID } from 'node:crypto';

import type { QueryResult, QueryResultRow } from 'pg';

import type { SqlExecutor } from '@/traits/authz/runtime-types.ts';

interface ConflictRecord {
  id: string;
  role_a_id: string;
  role_b_id: string;
  organization_id: string | null;
  reason: string;
  active: boolean;
  created_at: string;
}

interface MembershipRecord {
  id: string;
  user_id: string;
  organization_id: string;
  role_id: string;
}

interface ActionLogRecord {
  id: string;
  user_id: string;
  organization_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  performed_at: string;
}

export interface SeedMembershipInput {
  userId: string;
  organizationId: string;
  roleId: string;
}

export interface SeedActionInput {
  userId: string;
  organizationId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  performedAt?: string;
}

export class InMemorySodExecutor implements SqlExecutor {
  private readonly conflicts = new Map<string, ConflictRecord>();
  private readonly memberships: MembershipRecord[] = [];
  private readonly actionLog: ActionLogRecord[] = [];

  seedMembership(entry: SeedMembershipInput): void {
    this.memberships.push({
      id: randomUUID(),
      user_id: entry.userId,
      organization_id: entry.organizationId,
      role_id: entry.roleId,
    });
  }

  seedAction(entry: SeedActionInput): void {
    this.actionLog.push({
      id: randomUUID(),
      user_id: entry.userId,
      organization_id: entry.organizationId,
      action: entry.action.trim().toLowerCase(),
      resource_type: entry.resourceType.trim().toLowerCase(),
      resource_id: entry.resourceId,
      performed_at: entry.performedAt ?? new Date().toISOString(),
    });
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params: readonly unknown[] = []
  ): Promise<QueryResult<T>> {
    const normalized = normalizeSql(sql);
    if (normalized.startsWith('insert into authz.sod_role_conflicts')) {
      return this.insertConflict(params) as QueryResult<T>;
    }
    if (normalized.startsWith('select id, role_a_id, role_b_id, organization_id, reason, active, created_at from authz.sod_role_conflicts where id')) {
      return this.fetchConflictById(params) as QueryResult<T>;
    }
    if (normalized.startsWith('select id from authz.sod_role_conflicts')) {
      return this.findDuplicate(params) as QueryResult<T>;
    }
    if (normalized.startsWith('update authz.sod_role_conflicts')) {
      return this.updateConflict(params) as QueryResult<T>;
    }
    if (normalized.startsWith('delete from authz.sod_role_conflicts')) {
      return this.deleteConflict(params) as QueryResult<T>;
    }
    if (normalized.startsWith('select id, role_a_id, role_b_id, organization_id, reason, active, created_at from authz.sod_role_conflicts')) {
      return this.listConflicts(params) as QueryResult<T>;
    }
    if (normalized.startsWith('select m1.user_id, m1.organization_id from authz.memberships m1')) {
      return this.findMembershipCollision(params) as QueryResult<T>;
    }
    if (normalized.startsWith('select role_id from authz.memberships')) {
      return this.listUserRoles(params) as QueryResult<T>;
    }
    if (normalized.startsWith('select id, role_a_id, role_b_id, organization_id, reason from authz.sod_role_conflicts')) {
      return this.conflictsForRole(params) as QueryResult<T>;
    }
    if (normalized.startsWith('select id, user_id, organization_id, action, resource_type, resource_id, performed_at from authz.action_log')) {
      return this.actionHistory(params) as QueryResult<T>;
    }

    throw new Error(`Unsupported SQL in InMemorySodExecutor: ${normalized}`);
  }

  private insertConflict(params: readonly unknown[]): QueryResult<ConflictRecord> {
    const conflict: ConflictRecord = {
      id: randomUUID(),
      role_a_id: params[0] as string,
      role_b_id: params[1] as string,
      organization_id: (params[2] as string | null) ?? null,
      reason: params[3] as string,
      active: true,
      created_at: new Date().toISOString(),
    };
    this.conflicts.set(conflict.id, conflict);
    return buildResult([conflict]);
  }

  private fetchConflictById(params: readonly unknown[]): QueryResult<ConflictRecord> {
    const policy = this.conflicts.get(params[0] as string);
    return buildResult(policy ? [policy] : []);
  }

  private findDuplicate(params: readonly unknown[]): QueryResult<{ id: string }> {
    const [roleA, roleB, org] = params as [string, string, string | null];
    const match = [...this.conflicts.values()].find(
      (policy) => sameScope(policy.organization_id, org ?? null) && hasRolePair(policy, roleA, roleB)
    );
    return buildResult(match ? [{ id: match.id }] : []);
  }

  private updateConflict(params: readonly unknown[]): QueryResult<ConflictRecord> {
    const [id, roleA, roleB, org, reason, active] = params as [
      string,
      string,
      string,
      string | null,
      string,
      boolean
    ];
    const policy = this.conflicts.get(id);
    if (!policy) {
      return buildResult([]);
    }
    policy.role_a_id = roleA;
    policy.role_b_id = roleB;
    policy.organization_id = org ?? null;
    policy.reason = reason;
    policy.active = active;
    return buildResult([policy]);
  }

  private deleteConflict(params: readonly unknown[]): QueryResult<{ id: string }> {
    const id = params[0] as string;
    const deleted = this.conflicts.delete(id);
    return buildResult(deleted ? [{ id }] : [], 'DELETE');
  }

  private listConflicts(params: readonly unknown[]): QueryResult<ConflictRecord> {
    const org = (params[0] as string | null) ?? null;
    const rows = [...this.conflicts.values()]
      .filter((policy) => org === null || policy.organization_id === null || policy.organization_id === org)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    return buildResult(rows);
  }

  private findMembershipCollision(params: readonly unknown[]): QueryResult<{ user_id: string; organization_id: string }> {
    const [roleA, roleB, org] = params as [string, string, string | null];
    for (const membership of this.memberships) {
      if (org && membership.organization_id !== org) {
        continue;
      }
      const sameOrgMemberships = this.memberships.filter(
        (other) => other.user_id === membership.user_id && other.organization_id === membership.organization_id
      );
      const hasRoleA = sameOrgMemberships.some((other) => other.role_id === roleA);
      const hasRoleB = sameOrgMemberships.some((other) => other.role_id === roleB);
      if (hasRoleA && hasRoleB) {
        return buildResult([
          {
            user_id: membership.user_id,
            organization_id: membership.organization_id,
          },
        ]);
      }
    }
    return buildResult([]);
  }

  private listUserRoles(params: readonly unknown[]): QueryResult<{ role_id: string }> {
    const [userId, organizationId] = params as [string, string];
    const rows = this.memberships
      .filter((membership) => membership.user_id === userId && membership.organization_id === organizationId)
      .map((membership) => ({ role_id: membership.role_id }));
    return buildResult(rows);
  }

  private conflictsForRole(params: readonly unknown[]): QueryResult<SodConflictRow> {
    const [roleId, organizationId] = params as [string, string | null];
    const rows = [...this.conflicts.values()].filter((policy) => {
      if (!policy.active) {
        return false;
      }
      const roleMatch = policy.role_a_id === roleId || policy.role_b_id === roleId;
      if (!roleMatch) {
        return false;
      }
      if (organizationId === null) {
        return true;
      }
      if (policy.organization_id === null) {
        return true;
      }
      return policy.organization_id === organizationId;
    });
    return buildResult(rows as SodConflictRow[]);
  }

  private actionHistory(params: readonly unknown[]): QueryResult<ActionLogRecord> {
    const [userId, resourceType, resourceId, limitRaw] = params as [string, string, string, number];
    const limit = Number(limitRaw) || 25;
    const rows = this.actionLog
      .filter(
        (entry) => entry.user_id === userId && entry.resource_type === resourceType && entry.resource_id === resourceId
      )
      .sort((a, b) => b.performed_at.localeCompare(a.performed_at))
      .slice(0, limit);
    return buildResult(rows);
  }
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function buildResult<T>(rows: T[], command: string = 'SELECT'): QueryResult<T> {
  return {
    command,
    rowCount: rows.length,
    oid: 0,
    rows,
    fields: [],
  } as QueryResult<T>;
}

function hasRolePair(record: ConflictRecord, roleA: string, roleB: string): boolean {
  return (
    (record.role_a_id === roleA && record.role_b_id === roleB) ||
    (record.role_a_id === roleB && record.role_b_id === roleA)
  );
}

function sameScope(existing: string | null, target: string | null): boolean {
  if (existing === null && target === null) {
    return true;
  }
  if (existing === null || target === null) {
    return false;
  }
  return existing === target;
}

interface SodConflictRow extends ConflictRecord {}
