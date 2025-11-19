import type { QueryResultRow } from 'pg';

import { MembershipSchema, type MembershipDocument } from '@/schemas/authz/membership.schema.js';

import { cloneParams, nowIso, type RuntimeLogger, type SqlExecutor } from './runtime-types.js';

export class MembershipServiceError extends Error {}

interface MembershipRow extends QueryResultRow {
  readonly id: string;
  readonly user_id: string;
  readonly organization_id: string;
  readonly role_id: string;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
}

export interface MembershipServiceOptions {
  readonly logger?: RuntimeLogger;
}

const UPSERT_MEMBERSHIP_SQL = `
INSERT INTO authz.memberships (user_id, organization_id, role_id)
VALUES ($1::uuid, $2::uuid, $3::uuid)
ON CONFLICT (user_id, organization_id, role_id)
DO UPDATE SET updated_at = now()
RETURNING id, user_id, organization_id, role_id, created_at, updated_at;
`;

const DELETE_MEMBERSHIP_SQL = `
DELETE FROM authz.memberships
WHERE user_id = $1::uuid AND organization_id = $2::uuid AND role_id = $3::uuid
RETURNING id;
`;

const LIST_USER_MEMBERSHIPS_SQL = `
SELECT id, user_id, organization_id, role_id, created_at, updated_at
FROM authz.memberships
WHERE user_id = $1::uuid
  AND ($2::uuid IS NULL OR organization_id = $2::uuid)
ORDER BY created_at ASC;
`;

const LIST_ORG_MEMBERS_SQL = `
SELECT id, user_id, organization_id, role_id, created_at, updated_at
FROM authz.memberships
WHERE organization_id = $1::uuid
ORDER BY created_at ASC;
`;

export class MembershipService {
  private readonly logger?: RuntimeLogger;

  constructor(private readonly executor: SqlExecutor, options: MembershipServiceOptions = {}) {
    this.logger = options.logger;
  }

  async assignRole(userId: string, organizationId: string, roleId: string): Promise<MembershipDocument> {
    const result = await this.executor.query<MembershipRow>(
      UPSERT_MEMBERSHIP_SQL,
      cloneParams([userId, organizationId, roleId])
    );
    if ((result.rowCount ?? 0) === 0) {
      throw new MembershipServiceError('Failed to assign role: database returned no rows.');
    }
    const membership = this.toMembership(result.rows[0]!);
    this.logger?.debug?.('membership_assigned', {
      userId,
      organizationId,
      roleId,
      ts: nowIso(),
    });
    return membership;
  }

  async revokeRole(userId: string, organizationId: string, roleId: string): Promise<boolean> {
    const result = await this.executor.query(DELETE_MEMBERSHIP_SQL, cloneParams([userId, organizationId, roleId]));
    const revoked = (result.rowCount ?? 0) > 0;
    this.logger?.debug?.('membership_revoked', {
      userId,
      organizationId,
      roleId,
      revoked,
      ts: nowIso(),
    });
    return revoked;
  }

  async listUserMemberships(userId: string, organizationId?: string): Promise<MembershipDocument[]> {
    const result = await this.executor.query<MembershipRow>(
      LIST_USER_MEMBERSHIPS_SQL,
      cloneParams([userId, organizationId ?? null])
    );
    return result.rows.map((row) => this.toMembership(row));
  }

  async listOrgMembers(organizationId: string): Promise<MembershipDocument[]> {
    const result = await this.executor.query<MembershipRow>(
      LIST_ORG_MEMBERS_SQL,
      cloneParams([organizationId])
    );
    return result.rows.map((row) => this.toMembership(row));
  }

  private toMembership(row: MembershipRow): MembershipDocument {
    return MembershipSchema.parse({
      id: row.id,
      user_id: row.user_id,
      organization_id: row.organization_id,
      role_id: row.role_id,
      created_at: normalizeTimestamp(row.created_at),
      updated_at: normalizeTimestamp(row.updated_at),
    });
  }
}

function normalizeTimestamp(value: Date | string): string {
  return typeof value === 'string' ? value : value.toISOString();
}
