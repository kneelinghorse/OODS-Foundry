import { ZodError } from 'zod';

import type { ValidationIssue } from '@/validation/types.js';
import { ErrorCodes } from '@/validation/types.js';
import { createCompositionIssue, formatZodIssues } from '@/validation/formatter.js';

import { normalizeRole, type RoleDocument, type RoleInput } from '@/schemas/authz/role.schema.js';
import {
  normalizePermission,
  type PermissionDocument,
  type PermissionInput,
} from '@/schemas/authz/permission.schema.js';
import {
  normalizeMembership,
  type MembershipDocument,
  type MembershipInput,
  type NormalizeMembershipOptions,
} from '@/schemas/authz/membership.schema.js';
import {
  normalizeRoleHierarchyEdge,
  type RoleHierarchyEdge,
  type RoleHierarchyInput,
} from '@/schemas/authz/role-hierarchy.schema.js';

import {
  schemaRegistry,
  type AuthzSchemaId,
  type AuthzSchemaValidationResult,
} from './schema-registry.js';

const ROLE_FILE = 'src/schemas/authz/role.schema.ts';
const PERMISSION_FILE = 'src/schemas/authz/permission.schema.ts';
const MEMBERSHIP_FILE = 'src/schemas/authz/membership.schema.ts';
const HIERARCHY_FILE = 'src/schemas/authz/role-hierarchy.schema.ts';

export interface AuthzValidationResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly schemaId: AuthzSchemaId;
  readonly version: string;
  readonly errors: ValidationIssue[];
}

function handleNormalization<T>(
  normalizer: () => T,
  filePath: string
): { success: true; data: T } | { success: false; errors: ValidationIssue[] } {
  try {
    return { success: true, data: normalizer() };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, errors: formatZodIssues(error.issues, filePath) };
    }

    const issue = createCompositionIssue(
      ErrorCodes.INVALID_PARAMETER_VALUE,
      error instanceof Error ? error.message : 'Validation failed.',
      '/',
      filePath
    );
    return { success: false, errors: [issue] };
  }
}

function combineResults<T>(
  schemaId: AuthzSchemaId,
  filePath: string,
  normalization: () => T
): AuthzValidationResult<T> {
  const normalized = handleNormalization(normalization, filePath);
  const version = schemaRegistry.getVersion();

  if (!normalized.success) {
    return {
      success: false,
      schemaId,
      version,
      errors: normalized.errors,
    };
  }

  const registryResult: AuthzSchemaValidationResult = schemaRegistry.validateSchema(
    normalized.data,
    schemaId
  );

  if (!registryResult.success) {
    return {
      success: false,
      schemaId,
      version: registryResult.version,
      errors: registryResult.issues,
    };
  }

  return {
    success: true,
    schemaId,
    version: registryResult.version,
    data: normalized.data,
    errors: [],
  };
}

export function validateRole(role: RoleInput): AuthzValidationResult<RoleDocument> {
  return combineResults('role', ROLE_FILE, () => normalizeRole(role));
}

export function validatePermission(
  permission: PermissionInput
): AuthzValidationResult<PermissionDocument> {
  return combineResults('permission', PERMISSION_FILE, () => normalizePermission(permission));
}

export interface MembershipValidationOptions extends NormalizeMembershipOptions {}

export function validateMembership(
  membership: MembershipInput,
  options: MembershipValidationOptions = {}
): AuthzValidationResult<MembershipDocument> {
  return combineResults('membership', MEMBERSHIP_FILE, () =>
    normalizeMembership(membership, options)
  );
}

export function validateRoleHierarchyEdge(
  edge: RoleHierarchyInput
): AuthzValidationResult<RoleHierarchyEdge> {
  return combineResults('role-hierarchy', HIERARCHY_FILE, () => normalizeRoleHierarchyEdge(edge));
}
