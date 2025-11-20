#!/usr/bin/env node
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import TimeService from '@/services/time/index.js';

import { AUTHZ_SAMPLE_DATASET } from '@/data/authz/sample-entitlements.js';
import type { AuthzDataset } from '@/data/authz/types.js';

import {
  buildOrgContext,
  ensureOrganization,
  ensureUser,
  findOrganization,
  findUser,
  listMembershipsForOrganization,
  listMembershipsForUser,
  loadDataset,
} from './authz-shared.js';

type AuditCommand = 'user' | 'org';

interface AuditCliOptions {
  readonly command: AuditCommand;
  readonly userId?: string;
  readonly organizationId?: string;
  readonly datasetPath?: string;
  readonly pretty: boolean;
}

export interface AuditIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly details?: Record<string, unknown>;
}

export interface AuditUserReport {
  readonly userId: string;
  readonly organizationIds: readonly string[];
  readonly membershipCount: number;
  readonly issues: readonly AuditIssue[];
  readonly status: 'pass' | 'review' | 'action_required';
  readonly generatedAt: string;
}

export interface AuditOrgReport {
  readonly organizationId: string;
  readonly organization: ReturnType<typeof buildOrgContext>;
  readonly memberCount: number;
  readonly membershipRecords: number;
  readonly issues: readonly AuditIssue[];
  readonly generatedAt: string;
  readonly status: 'pass' | 'review' | 'action_required';
}

export function auditUserPermissions(
  userId: string,
  dataset: AuthzDataset = AUTHZ_SAMPLE_DATASET
): AuditUserReport {
  const user = ensureUser(findUser(dataset, userId), userId);
  const memberships = listMembershipsForUser(dataset, userId);
  const issues: AuditIssue[] = [];
  const roles = new Set(dataset.roles.map((role) => role.id));
  const organizations = new Set(dataset.organizations.map((org) => org.id));

  if (memberships.length === 0) {
    issues.push({
      code: 'no_memberships',
      message: 'User has no recorded role assignments.',
      severity: 'error',
    });
  }

  for (const membership of memberships) {
    if (!roles.has(membership.role_id)) {
      issues.push({
        code: 'orphaned_membership',
        message: `Membership ${membership.id} references unknown role ${membership.role_id}.`,
        severity: 'error',
        details: {
          membershipId: membership.id,
          roleId: membership.role_id,
          organizationId: membership.organization_id,
        },
      });
    }
    if (!organizations.has(membership.organization_id)) {
      issues.push({
        code: 'unknown_org',
        message: `Membership ${membership.id} targets unknown organization ${membership.organization_id}.`,
        severity: 'warning',
        details: {
          membershipId: membership.id,
          organizationId: membership.organization_id,
        },
      });
    }
  }

  const orgsWithMembership = new Set(memberships.map((membership) => membership.organization_id));
  for (const orgId of user.organizationIds) {
    if (!orgsWithMembership.has(orgId)) {
      issues.push({
        code: 'no_role_assignments',
        message: `User is scoped to organization ${orgId} but has zero role assignments.`,
        severity: 'error',
        details: { organizationId: orgId },
      });
    }
  }

  const status = deriveStatus(issues);

  return {
    userId: user.id,
    organizationIds: [...user.organizationIds],
    membershipCount: memberships.length,
    issues,
    status,
    generatedAt: TimeService.toIsoString(TimeService.nowSystem()),
  } satisfies AuditUserReport;
}

export function auditOrgAccess(
  organizationId: string,
  dataset: AuthzDataset = AUTHZ_SAMPLE_DATASET
): AuditOrgReport {
  const organization = ensureOrganization(findOrganization(dataset, organizationId), organizationId);
  const memberships = listMembershipsForOrganization(dataset, organizationId);
  const issues: AuditIssue[] = [];
  const roles = new Set(dataset.roles.map((role) => role.id));
  const users = new Map(dataset.users.map((user) => [user.id, user]));

  for (const membership of memberships) {
    if (!roles.has(membership.role_id)) {
      issues.push({
        code: 'orphaned_membership',
        message: `Membership ${membership.id} uses unknown role ${membership.role_id}.`,
        severity: 'error',
        details: { membershipId: membership.id, roleId: membership.role_id },
      });
    }
    if (!users.has(membership.user_id)) {
      issues.push({
        code: 'unknown_user_membership',
        message: `Membership ${membership.id} references unknown user ${membership.user_id}.`,
        severity: 'error',
        details: { membershipId: membership.id, userId: membership.user_id },
      });
    }
  }

  const usersWithMembership = new Set(memberships.map((membership) => membership.user_id));
  for (const user of dataset.users) {
    if (user.organizationIds.includes(organizationId) && !usersWithMembership.has(user.id)) {
      issues.push({
        code: 'user_without_role',
        message: `User ${user.name} (${user.id}) is mapped to ${organization.name} but has no roles assigned.`,
        severity: 'error',
        details: { userId: user.id },
      });
    }
  }

  const status = deriveStatus(issues);

  return {
    organizationId,
    organization: buildOrgContext(organization, memberships.length),
    memberCount: usersWithMembership.size,
    membershipRecords: memberships.length,
    issues,
    generatedAt: TimeService.toIsoString(TimeService.nowSystem()),
    status,
  } satisfies AuditOrgReport;
}

function deriveStatus(issues: readonly AuditIssue[]): AuditUserReport['status'] {
  if (issues.some((issue) => issue.severity === 'error')) {
    return 'action_required';
  }
  if (issues.some((issue) => issue.severity === 'warning')) {
    return 'review';
  }
  return 'pass';
}

function parseArgs(argv: string[]): AuditCliOptions {
  const [commandRaw, ...rest] = argv;
  if (!commandRaw) {
    return printUsage('Missing command.');
  }
  if (commandRaw !== 'user' && commandRaw !== 'org') {
    return printUsage(`Unsupported command: ${commandRaw}`);
  }

  let userId: string | undefined;
  let organizationId: string | undefined;
  let datasetPath: string | undefined;
  let pretty = false;

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    switch (token) {
      case '--user':
        userId = rest[++index];
        break;
      case '--org':
      case '--organization':
        organizationId = rest[++index];
        break;
      case '--dataset':
        datasetPath = rest[++index];
        break;
      case '--pretty':
        pretty = true;
        break;
      case '--help':
      case '-h':
        return printUsage();
      default:
        break;
    }
  }

  if (commandRaw === 'user' && !userId) {
    return printUsage('User audits require --user.');
  }

  if (commandRaw === 'org' && !organizationId) {
    return printUsage('Organization audits require --org.');
  }

  return {
    command: commandRaw,
    userId,
    organizationId,
    datasetPath,
    pretty,
  } satisfies AuditCliOptions;
}

function printUsage(error?: string): never {
  if (error) {
    console.error(`Error: ${error}`);
  }
  console.log(`Usage: pnpm tsx src/cli/authz-audit.ts <user|org> [options]

Commands:
  user   Audit a user's role + permission posture (requires --user)
  org    Audit organization assignments + anomalies (requires --org)

Options:
  --user <uuid>         User identifier
  --org <uuid>          Organization identifier
  --dataset <file>      Optional dataset JSON override
  --pretty              Pretty-print JSON output
  -h, --help            Show help
`);
  process.exit(error ? 1 : 0);
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  try {
    const dataset = await loadDataset(options.datasetPath);
    const payload = options.command === 'user'
      ? auditUserPermissions(options.userId!, dataset)
      : auditOrgAccess(options.organizationId!, dataset);
    const serialized = options.pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
    console.log(serialized);
  } catch (error) {
    console.error('[authz-audit] Failed:', error);
    process.exitCode = 1;
  }
}

function isCliEntry(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return import.meta.url === pathToFileURL(entry).href;
}

if (isCliEntry()) {
  void run();
}
