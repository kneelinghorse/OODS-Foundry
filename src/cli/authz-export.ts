#!/usr/bin/env node
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import type { MembershipDocument } from '@/schemas/authz/membership.schema.js';
import type { PermissionDocument } from '@/schemas/authz/permission.schema.js';
import type { RoleDocument } from '@/schemas/authz/role.schema.js';
import TimeService from '@/services/time/index.js';

import { AUTHZ_SAMPLE_DATASET } from '@/data/authz/sample-entitlements.js';
import type { AuthzDataset } from '@/data/authz/types.js';
import {
  buildOrgContext,
  createTrait,
  ensureOrganization,
  ensureUser,
  findOrganization,
  findUser,
  listMembershipsForOrganization,
  listMembershipsForUser,
  loadDataset,
} from './authz-shared.js';
import { AuthableTrait } from '@/traits/authz/authz-trait.js';

type ExportCommand = 'user' | 'org';

interface ExportCliOptions {
  readonly command: ExportCommand;
  readonly userId?: string;
  readonly organizationId?: string;
  readonly datasetPath?: string;
  readonly pretty: boolean;
}

export interface RoleSummary {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
}

export interface PermissionSummary {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly resource_type?: string;
}

export interface UserEntitlementExport {
  readonly userId: string;
  readonly subject: {
    readonly name: string;
    readonly email?: string;
    readonly preferredName?: string;
  };
  readonly organization: ReturnType<typeof buildOrgContext>;
  readonly sessionRoles: readonly string[];
  readonly roles: readonly RoleSummary[];
  readonly permissions: readonly PermissionSummary[];
  readonly memberships: number;
  readonly generatedAt: string;
  readonly source: 'authable-trait';
}

export interface OrgEntitlementExport {
  readonly organization: ReturnType<typeof buildOrgContext>;
  readonly members: readonly UserEntitlementExport[];
  readonly memberCount: number;
  readonly distinctRoles: number;
  readonly generatedAt: string;
  readonly source: 'authable-trait';
}

export function exportUserEntitlements(
  userId: string,
  organizationId: string,
  dataset: AuthzDataset = AUTHZ_SAMPLE_DATASET,
  traitInstance?: AuthableTrait
): UserEntitlementExport {
  const trait = traitInstance ?? createTrait(dataset);
  const user = ensureUser(findUser(dataset, userId), userId);
  const organization = ensureOrganization(findOrganization(dataset, organizationId), organizationId);
  const memberships = listMembershipsForUser(dataset, userId, organizationId);

  if (memberships.length === 0) {
    throw new Error(`User ${userId} has no memberships within ${organizationId}.`);
  }

  const roleDocuments = trait.getRolesForUser(userId, organizationId);
  const permissions = gatherPermissions(trait, memberships);

  return {
    userId,
    subject: {
      name: user.name,
      email: user.email,
      preferredName: user.preferredName,
    },
    organization: buildOrgContext(organization, memberships.length),
    sessionRoles: user.sessionRoles ?? [],
    roles: roleDocuments.map(toRoleSummary),
    permissions: permissions.map(toPermissionSummary),
    memberships: memberships.length,
    generatedAt: TimeService.toIsoString(TimeService.nowSystem()),
    source: 'authable-trait',
  } satisfies UserEntitlementExport;
}

export function exportOrgEntitlements(
  organizationId: string,
  dataset: AuthzDataset = AUTHZ_SAMPLE_DATASET
): OrgEntitlementExport {
  const organization = ensureOrganization(findOrganization(dataset, organizationId), organizationId);
  const memberships = listMembershipsForOrganization(dataset, organizationId);
  const uniqueUserIds = Array.from(new Set(memberships.map((membership) => membership.user_id)));
  const trait = createTrait(dataset);

  const members = uniqueUserIds.map((userId) => exportUserEntitlements(userId, organizationId, dataset, trait));
  const roleIds = new Set<string>();
  members.forEach((entry) => entry.roles.forEach((role) => roleIds.add(role.id)));

  return {
    organization: buildOrgContext(organization, memberships.length),
    members,
    memberCount: members.length,
    distinctRoles: roleIds.size,
    generatedAt: TimeService.toIsoString(TimeService.nowSystem()),
    source: 'authable-trait',
  } satisfies OrgEntitlementExport;
}

function gatherPermissions(trait: AuthableTrait, memberships: readonly MembershipDocument[]): PermissionDocument[] {
  const permissionMap = new Map<string, PermissionDocument>();
  for (const membership of memberships) {
    try {
      const permissions = trait.getPermissionsForRole(membership.role_id);
      for (const permission of permissions) {
        permissionMap.set(permission.id, permission);
      }
    } catch {
      // Skip orphaned role references so audits can surface the issue without breaking exports.
    }
  }
  return [...permissionMap.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function toRoleSummary(role: RoleDocument): RoleSummary {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
  };
}

function toPermissionSummary(permission: PermissionDocument): PermissionSummary {
  return {
    id: permission.id,
    name: permission.name,
    description: permission.description,
    resource_type: permission.resource_type,
  };
}

function parseArgs(argv: string[]): ExportCliOptions {
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

  if (commandRaw === 'user' && (!userId || !organizationId)) {
    return printUsage('User exports require --user and --org values.');
  }

  if (commandRaw === 'org' && !organizationId) {
    return printUsage('Organization exports require --org.');
  }

  return {
    command: commandRaw,
    userId,
    organizationId,
    datasetPath,
    pretty,
  } satisfies ExportCliOptions;
}

function printUsage(error?: string): never {
  if (error) {
    console.error(`Error: ${error}`);
  }
  console.log(`Usage: pnpm tsx src/cli/authz-export.ts <user|org> [options]

Commands:
  user   Export a user's entitlements. Requires --user and --org.
  org    Export all entitlements for an organization. Requires --org.

Options:
  --user <uuid>         User identifier
  --org <uuid>          Organization identifier
  --dataset <file>      Path to dataset JSON (defaults to sample dataset)
  --pretty              Pretty-print JSON output
  -h, --help            Show help
`);
  process.exit(error ? 1 : 0);
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  try {
    const dataset = await loadDataset(options.datasetPath);
    let payload: UserEntitlementExport | OrgEntitlementExport;
    if (options.command === 'user') {
      payload = exportUserEntitlements(options.userId!, options.organizationId!, dataset);
    } else {
      payload = exportOrgEntitlements(options.organizationId!, dataset);
    }
    const serialized = options.pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
    console.log(serialized);
  } catch (error) {
    console.error('[authz-export] Failed:', error);
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
