import type { QueryResultRow } from 'pg';

import { cloneParams, nowIso, type RuntimeLogger, type SqlExecutor } from './runtime-types.js';

export interface SodPolicy {
  readonly id: string;
  readonly roleAId: string;
  readonly roleBId: string;
  readonly organizationId: string | null;
  readonly reason: string;
  readonly active: boolean;
  readonly createdAt: string;
}

export interface CreateRoleConflictInput {
  readonly roleAId: string;
  readonly roleBId: string;
  readonly reason: string;
  readonly organizationId?: string | null;
}

export interface UpdateRoleConflictInput {
  readonly reason?: string;
  readonly active?: boolean;
  readonly organizationId?: string | null;
}

export interface SodPolicyBuilderOptions {
  readonly logger?: RuntimeLogger;
}

export interface SodPolicyBuilder {
  createRoleConflict(roleAId: string, roleBId: string, reason: string, organizationId?: string | null): Promise<SodPolicy>;
  updateRoleConflict(policyId: string, updates: UpdateRoleConflictInput): Promise<SodPolicy>;
  deleteRoleConflict(policyId: string): Promise<boolean>;
  listConflicts(organizationId?: string | null): Promise<SodPolicy[]>;
}

const INSERT_POLICY_SQL = `
INSERT INTO authz.sod_role_conflicts (role_a_id, role_b_id, organization_id, reason)
VALUES ($1::uuid, $2::uuid, $3::uuid, $4::text)
RETURNING id, role_a_id, role_b_id, organization_id, reason, active, created_at;
`;

const FETCH_POLICY_SQL = `
SELECT id, role_a_id, role_b_id, organization_id, reason, active, created_at
FROM authz.sod_role_conflicts
WHERE id = $1::uuid;
`;

const UPDATE_POLICY_SQL = `
UPDATE authz.sod_role_conflicts
   SET role_a_id = $2::uuid,
       role_b_id = $3::uuid,
       organization_id = $4::uuid,
       reason = $5::text,
       active = $6::boolean
 WHERE id = $1::uuid
 RETURNING id, role_a_id, role_b_id, organization_id, reason, active, created_at;
`;

const DELETE_POLICY_SQL = `
DELETE FROM authz.sod_role_conflicts
 WHERE id = $1::uuid
 RETURNING id;
`;

const LIST_POLICIES_SQL = `
SELECT id, role_a_id, role_b_id, organization_id, reason, active, created_at
FROM authz.sod_role_conflicts
WHERE ($1::uuid IS NULL)
   OR organization_id IS NULL
   OR organization_id = $1::uuid
ORDER BY created_at ASC;
`;

const DUPLICATE_POLICY_SQL = `
SELECT id
FROM authz.sod_role_conflicts
WHERE (
    (role_a_id = $1::uuid AND role_b_id = $2::uuid)
 OR (role_a_id = $2::uuid AND role_b_id = $1::uuid)
)
AND (
    ($3::uuid IS NULL AND organization_id IS NULL)
 OR organization_id = $3::uuid
)
LIMIT 1;
`;

const MEMBERSHIP_CONFLICT_SQL = `
SELECT m1.user_id, m1.organization_id
FROM authz.memberships m1
JOIN authz.memberships m2
  ON m1.user_id = m2.user_id
 AND m1.organization_id = m2.organization_id
WHERE m1.role_id = $1::uuid
  AND m2.role_id = $2::uuid
  AND ($3::uuid IS NULL OR m1.organization_id = $3::uuid)
LIMIT 1;
`;

interface SodPolicyRow extends QueryResultRow {
  readonly id: string;
  readonly role_a_id: string;
  readonly role_b_id: string;
  readonly organization_id: string | null;
  readonly reason: string;
  readonly active: boolean;
  readonly created_at: string | Date;
}

interface MembershipConflictRow extends QueryResultRow {
  readonly user_id: string;
  readonly organization_id: string;
}

export class SodPolicyError extends Error {}

export class SodPolicyValidationError extends SodPolicyError {}

class DefaultSodPolicyBuilder implements SodPolicyBuilder {
  private readonly logger?: RuntimeLogger;

  constructor(private readonly executor: SqlExecutor, options: SodPolicyBuilderOptions = {}) {
    this.logger = options.logger;
  }

  async createRoleConflict(
    roleAId: string,
    roleBId: string,
    reason: string,
    organizationId?: string | null
  ): Promise<SodPolicy> {
    const [normalizedRoleA, normalizedRoleB] = normalizeRolePair(roleAId, roleBId);
    const normalizedReason = ensureReason(reason);
    const scope = organizationId ?? null;

    await this.ensureNoDuplicate(normalizedRoleA, normalizedRoleB, scope);
    await this.ensureNoMembershipCollision(normalizedRoleA, normalizedRoleB, scope);

    const result = await this.executor.query<SodPolicyRow>(
      INSERT_POLICY_SQL,
      cloneParams([normalizedRoleA, normalizedRoleB, scope, normalizedReason])
    );
    if ((result.rowCount ?? 0) === 0) {
      throw new SodPolicyError('Failed to create SoD policy.');
    }
    const policy = this.toPolicy(result.rows[0]!);
    this.logger?.debug?.('sod_policy_created', {
      policyId: policy.id,
      roleAId: policy.roleAId,
      roleBId: policy.roleBId,
      organizationId: policy.organizationId,
      ts: nowIso(),
    });
    return policy;
  }

  async updateRoleConflict(policyId: string, updates: UpdateRoleConflictInput): Promise<SodPolicy> {
    const existing = await this.fetchPolicyOrThrow(policyId);
    if (!hasUpdates(updates)) {
      return existing;
    }

    const next = { ...existing } satisfies SodPolicy;
    if (updates.reason !== undefined) {
      next.reason = ensureReason(updates.reason);
    }
    if (updates.organizationId !== undefined) {
      next.organizationId = updates.organizationId ?? null;
    }
    if (updates.active !== undefined) {
      next.active = updates.active;
    }

    if (next.active) {
      await this.ensureNoMembershipCollision(next.roleAId, next.roleBId, next.organizationId);
    }
    await this.ensureNoDuplicate(next.roleAId, next.roleBId, next.organizationId, next.id);

    const result = await this.executor.query<SodPolicyRow>(
      UPDATE_POLICY_SQL,
      cloneParams([
        next.id,
        next.roleAId,
        next.roleBId,
        next.organizationId ?? null,
        next.reason,
        next.active,
      ])
    );
    if ((result.rowCount ?? 0) === 0) {
      throw new SodPolicyError(`SoD policy ${policyId} was not updated.`);
    }
    const policy = this.toPolicy(result.rows[0]!);
    this.logger?.debug?.('sod_policy_updated', {
      policyId: policy.id,
      active: policy.active,
      organizationId: policy.organizationId,
      ts: nowIso(),
    });
    return policy;
  }

  async deleteRoleConflict(policyId: string): Promise<boolean> {
    const result = await this.executor.query(DELETE_POLICY_SQL, cloneParams([policyId]));
    const deleted = (result.rowCount ?? 0) > 0;
    if (deleted) {
      this.logger?.debug?.('sod_policy_deleted', {
        policyId,
        ts: nowIso(),
      });
    }
    return deleted;
  }

  async listConflicts(organizationId?: string | null): Promise<SodPolicy[]> {
    const result = await this.executor.query<SodPolicyRow>(LIST_POLICIES_SQL, cloneParams([organizationId ?? null]));
    return result.rows.map((row) => this.toPolicy(row));
  }

  private async ensureNoDuplicate(
    roleAId: string,
    roleBId: string,
    organizationId: string | null,
    ignorePolicyId?: string
  ): Promise<void> {
    const result = await this.executor.query<{ id: string }>(
      DUPLICATE_POLICY_SQL,
      cloneParams([roleAId, roleBId, organizationId])
    );
    const duplicate = result.rows[0];
    if (duplicate && duplicate.id !== ignorePolicyId) {
      throw new SodPolicyValidationError('A SoD policy already exists for that role pair and scope.');
    }
  }

  private async ensureNoMembershipCollision(
    roleAId: string,
    roleBId: string,
    organizationId: string | null
  ): Promise<void> {
    const result = await this.executor.query<MembershipConflictRow>(
      MEMBERSHIP_CONFLICT_SQL,
      cloneParams([roleAId, roleBId, organizationId])
    );
    const row = result.rows[0];
    if (row) {
      const scopeLabel = row.organization_id ?? 'any organization';
      throw new SodPolicyValidationError(
        `Cannot create SoD policy: user ${row.user_id} already holds both roles within ${scopeLabel}.`
      );
    }
  }

  private async fetchPolicyOrThrow(policyId: string): Promise<SodPolicy> {
    const result = await this.executor.query<SodPolicyRow>(FETCH_POLICY_SQL, cloneParams([policyId]));
    const row = result.rows[0];
    if (!row) {
      throw new SodPolicyError(`SoD policy ${policyId} was not found.`);
    }
    return this.toPolicy(row);
  }

  private toPolicy(row: SodPolicyRow): SodPolicy {
    return {
      id: row.id,
      roleAId: row.role_a_id,
      roleBId: row.role_b_id,
      organizationId: row.organization_id ?? null,
      reason: row.reason,
      active: row.active,
      createdAt: serializeTimestamp(row.created_at),
    } satisfies SodPolicy;
  }
}

export function createSodPolicyBuilder(
  executor: SqlExecutor,
  options: SodPolicyBuilderOptions = {}
): SodPolicyBuilder {
  return new DefaultSodPolicyBuilder(executor, options);
}

function normalizeRolePair(roleAId: string, roleBId: string): [string, string] {
  const trimmedA = roleAId?.trim();
  const trimmedB = roleBId?.trim();
  if (!trimmedA || !trimmedB) {
    throw new SodPolicyValidationError('Role identifiers must be provided for both sides of the conflict.');
  }
  if (trimmedA === trimmedB) {
    throw new SodPolicyValidationError('A role cannot conflict with itself.');
  }
  return trimmedA.localeCompare(trimmedB) <= 0 ? [trimmedA, trimmedB] : [trimmedB, trimmedA];
}

function ensureReason(reason: string): string {
  const normalized = reason?.trim();
  if (!normalized) {
    throw new SodPolicyValidationError('A non-empty reason is required for SoD policies.');
  }
  return normalized;
}

function serializeTimestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function hasUpdates(updates: UpdateRoleConflictInput): boolean {
  return ['reason', 'active', 'organizationId'].some((key) => key in updates);
}
