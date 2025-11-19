import type { QueryResultRow } from 'pg';

import { cloneParams, nowIso, type RuntimeLogger, type SqlExecutor } from './runtime-types.js';

const LIST_USER_ROLE_IDS_SQL = `
SELECT role_id
FROM authz.memberships
WHERE user_id = $1::uuid
  AND organization_id = $2::uuid;
`;

const ACTIVE_CONFLICTS_FOR_ROLE_SQL = `
SELECT id, role_a_id, role_b_id, organization_id, reason
FROM authz.sod_role_conflicts
WHERE active = true
  AND ($2::uuid IS NULL OR organization_id IS NULL OR organization_id = $2::uuid)
  AND ($1::uuid = role_a_id OR $1::uuid = role_b_id);
`;

const ACTION_LOG_HISTORY_SQL = `
SELECT id, user_id, organization_id, action, resource_type, resource_id, performed_at
FROM authz.action_log
WHERE user_id = $1::uuid
  AND resource_type = $2
  AND resource_id = $3::uuid
ORDER BY performed_at DESC
LIMIT $4::int;
`;

interface MembershipRoleRow extends QueryResultRow {
  readonly role_id: string;
}

interface SodConflictRow extends QueryResultRow {
  readonly id: string;
  readonly role_a_id: string;
  readonly role_b_id: string;
  readonly organization_id: string | null;
  readonly reason: string;
}

interface ActionLogRow extends QueryResultRow {
  readonly id: string;
  readonly user_id: string;
  readonly organization_id: string;
  readonly action: string;
  readonly resource_type: string;
  readonly resource_id: string;
  readonly performed_at: string | Date;
}

export interface StaticSoDViolation {
  readonly policyId: string;
  readonly reason: string;
  readonly conflictingRoleId: string;
  readonly organizationId: string | null;
}

export interface StaticValidationResult {
  readonly valid: boolean;
  readonly violations: StaticSoDViolation[];
}

export interface DynamicActionLogEntry {
  readonly id: string;
  readonly userId: string;
  readonly organizationId: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly performedAt: string;
}

export interface DynamicSoDViolationResult {
  readonly violation: boolean;
  readonly auditOnly: true;
  readonly ruleDescription?: string;
  readonly conflict?: {
    readonly initiatorAction: string;
    readonly conflictingAction: string;
    readonly timestamp: string;
  };
  readonly history: DynamicActionLogEntry[];
}

export interface DynamicConflictPair {
  readonly initiatorAction: string;
  readonly conflictingAction: string;
}

export interface DynamicSoDRule {
  readonly resourceTypes: readonly string[];
  readonly description: string;
  readonly conflictingPairs: readonly DynamicConflictPair[];
}

export interface SodValidatorOptions {
  readonly logger?: RuntimeLogger;
  readonly dynamicRules?: readonly DynamicSoDRule[];
  readonly historyLimit?: number;
}

export interface SodValidatorContract {
  validateMembershipAssignment(userId: string, organizationId: string, roleId: string): Promise<StaticValidationResult>;
  detectDynamicSoDViolation(
    userId: string,
    action: string,
    resourceType: string,
    resourceId: string
  ): Promise<DynamicSoDViolationResult>;
}

interface NormalizedDynamicSoDRule {
  readonly resourceTypes: readonly string[];
  readonly description: string;
  readonly pairs: readonly { initiatorAction: string; conflictingAction: string }[];
}

const DEFAULT_DYNAMIC_RULES: DynamicSoDRule[] = [
  {
    resourceTypes: ['*', 'purchase_order', 'expense'],
    description: 'Creator and approver must differ for financial records (R28.1).',
    conflictingPairs: [
      { initiatorAction: 'create', conflictingAction: 'approve' },
      { initiatorAction: 'submit', conflictingAction: 'approve' },
    ],
  },
];

export class SodValidator implements SodValidatorContract {
  private readonly logger?: RuntimeLogger;
  private readonly dynamicRules: readonly NormalizedDynamicSoDRule[];
  private readonly historyLimit: number;

  constructor(private readonly executor: SqlExecutor, options: SodValidatorOptions = {}) {
    this.logger = options.logger;
    this.historyLimit = Math.max(5, Math.min(options.historyLimit ?? 25, 100));
    this.dynamicRules = (options.dynamicRules ?? DEFAULT_DYNAMIC_RULES).map((rule) => normalizeRule(rule));
  }

  async validateMembershipAssignment(userId: string, organizationId: string, roleId: string): Promise<StaticValidationResult> {
    const membershipsResult = await this.executor.query<MembershipRoleRow>(
      LIST_USER_ROLE_IDS_SQL,
      cloneParams([userId, organizationId])
    );
    const currentRoles = new Set(membershipsResult.rows.map((row) => row.role_id));
    if (currentRoles.size === 0) {
      return { valid: true, violations: [] } satisfies StaticValidationResult;
    }

    const conflictsResult = await this.executor.query<SodConflictRow>(
      ACTIVE_CONFLICTS_FOR_ROLE_SQL,
      cloneParams([roleId, organizationId])
    );
    const violations: StaticSoDViolation[] = [];
    for (const row of conflictsResult.rows) {
      const conflictingRoleId = row.role_a_id === roleId ? row.role_b_id : row.role_a_id;
      if (currentRoles.has(conflictingRoleId)) {
        violations.push({
          policyId: row.id,
          reason: row.reason,
          conflictingRoleId,
          organizationId: row.organization_id ?? null,
        });
      }
    }

    const valid = violations.length === 0;
    if (!valid) {
      this.logger?.warn?.('static_sod_violation_detected', {
        userId,
        organizationId,
        roleId,
        violationCount: violations.length,
        ts: nowIso(),
      });
    }
    return { valid, violations } satisfies StaticValidationResult;
  }

  async detectDynamicSoDViolation(
    userId: string,
    action: string,
    resourceType: string,
    resourceId: string
  ): Promise<DynamicSoDViolationResult> {
    const normalizedResourceType = resourceType.trim().toLowerCase();
    const normalizedAction = action.trim().toLowerCase();
    const rules = this.dynamicRules.filter((rule) =>
      rule.resourceTypes.includes('*') || rule.resourceTypes.includes(normalizedResourceType)
    );

    if (rules.length === 0) {
      return { violation: false, auditOnly: true, history: [] } satisfies DynamicSoDViolationResult;
    }

    const historyResult = await this.executor.query<ActionLogRow>(
      ACTION_LOG_HISTORY_SQL,
      cloneParams([userId, normalizedResourceType, resourceId, this.historyLimit])
    );
    const history = historyResult.rows.map((row) => this.toActionEntry(row));

    for (const rule of rules) {
      for (const pair of rule.pairs) {
        if (normalizedAction !== pair.conflictingAction) {
          continue;
        }
        const conflictingEntry = history.find((entry) => entry.action === pair.initiatorAction);
        if (conflictingEntry) {
          this.logger?.warn?.('dynamic_sod_violation_detected', {
            userId,
            resourceType: normalizedResourceType,
            resourceId,
            initiator: pair.initiatorAction,
            conflicting: pair.conflictingAction,
            ts: nowIso(),
          });
          return {
            violation: true,
            auditOnly: true,
            ruleDescription: rule.description,
            conflict: {
              initiatorAction: pair.initiatorAction,
              conflictingAction: pair.conflictingAction,
              timestamp: conflictingEntry.performedAt,
            },
            history,
          } satisfies DynamicSoDViolationResult;
        }
      }
    }

    return { violation: false, auditOnly: true, history } satisfies DynamicSoDViolationResult;
  }

  private toActionEntry(row: ActionLogRow): DynamicActionLogEntry {
    return {
      id: row.id,
      userId: row.user_id,
      organizationId: row.organization_id,
      action: row.action.trim().toLowerCase(),
      resourceType: row.resource_type.trim().toLowerCase(),
      resourceId: row.resource_id,
      performedAt: row.performed_at instanceof Date ? row.performed_at.toISOString() : row.performed_at,
    } satisfies DynamicActionLogEntry;
  }
}

export function createSodValidator(executor: SqlExecutor, options: SodValidatorOptions = {}): SodValidatorContract {
  return new SodValidator(executor, options);
}

function normalizeRule(rule: DynamicSoDRule): NormalizedDynamicSoDRule {
  const resourceTypes = rule.resourceTypes.length > 0 ? rule.resourceTypes : ['*'];
  return {
    resourceTypes: resourceTypes.map((type) => type.trim().toLowerCase()),
    description: rule.description,
    pairs: rule.conflictingPairs.map((pair) => ({
      initiatorAction: pair.initiatorAction.trim().toLowerCase(),
      conflictingAction: pair.conflictingAction.trim().toLowerCase(),
    })),
  } satisfies NormalizedDynamicSoDRule;
}
