import Ajv, { type AnySchema, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

import registryDocument from '~/data/authz-schemas/registry.json';

import { formatAjvErrors } from '@/validation/formatter.js';
import type { ValidationIssue } from '@/validation/types.js';

const ajv = new Ajv({
  allErrors: true,
  allowUnionTypes: true,
  strict: false,
});
addFormats(ajv);

export const AUTHZ_REGISTRY_VERSION = '1.0.0';

const KNOWN_SCHEMA_IDS = ['role', 'permission', 'membership', 'role-hierarchy'] as const;
export type AuthzSchemaId = (typeof KNOWN_SCHEMA_IDS)[number];

type JsonSchemaDocument = Record<string, unknown>;

interface AuthzSchemaDefinition {
  readonly id: AuthzSchemaId;
  readonly title: string;
  readonly description: string;
  readonly status: 'stable' | 'experimental' | 'deprecated';
  readonly citation: string;
  readonly schema: JsonSchemaDocument;
  readonly uiSchema: Record<string, unknown>;
  readonly example: Record<string, unknown>;
}

interface AuthzRegistryDocument {
  readonly id: string;
  readonly version: string;
  readonly schemas: readonly AuthzSchemaDefinition[];
}

export interface AuthzSchemaSummary {
  readonly id: AuthzSchemaId;
  readonly title: string;
  readonly status: AuthzSchemaDefinition['status'];
  readonly citation: string;
  readonly description: string;
}

export interface AuthzSchemaValidationResult {
  readonly success: boolean;
  readonly schemaId: AuthzSchemaId;
  readonly version: string;
  readonly issues: ValidationIssue[];
}

function assertSchemaId(candidate: string): asserts candidate is AuthzSchemaId {
  if (!KNOWN_SCHEMA_IDS.includes(candidate as AuthzSchemaId)) {
    throw new Error(`Schema id "${candidate}" is not registered in the Authz registry.`);
  }
}

function cloneSchema(schema: JsonSchemaDocument): AnySchema {
  return structuredClone(schema) as AnySchema;
}

class AuthzSchemaRegistry {
  private readonly version: string;
  private readonly definitionMap: Map<AuthzSchemaId, AuthzSchemaDefinition>;
  private readonly validatorMap = new Map<AuthzSchemaId, ValidateFunction>();

  constructor(document: AuthzRegistryDocument) {
    this.version = document.version;
    if (this.version !== AUTHZ_REGISTRY_VERSION) {
      throw new Error(
        `Authz schema registry version mismatch. Expected ${AUTHZ_REGISTRY_VERSION}, received ${this.version}.`
      );
    }
    this.definitionMap = new Map();
    for (const entry of document.schemas) {
      assertSchemaId(entry.id);
      if (this.definitionMap.has(entry.id)) {
        throw new Error(`Duplicate authz schema definition registered for "${entry.id}".`);
      }
      this.definitionMap.set(entry.id, entry);
    }
  }

  getVersion(): string {
    return this.version;
  }

  listSchemas(): readonly AuthzSchemaSummary[] {
    return Array.from(this.definitionMap.values()).map((definition) => ({
      id: definition.id,
      title: definition.title,
      status: definition.status,
      citation: definition.citation,
      description: definition.description,
    }));
  }

  getSchema(schemaId: AuthzSchemaId): AuthzSchemaDefinition {
    const definition = this.definitionMap.get(schemaId);
    if (!definition) {
      throw new Error(`Authz schema "${schemaId}" is not registered.`);
    }
    return definition;
  }

  isSchemaId(candidate: string): candidate is AuthzSchemaId {
    return this.definitionMap.has(candidate as AuthzSchemaId);
  }

  getValidator(schemaId: AuthzSchemaId): ValidateFunction {
    let validator = this.validatorMap.get(schemaId);
    if (!validator) {
      const definition = this.getSchema(schemaId);
      validator = ajv.compile(cloneSchema(definition.schema));
      this.validatorMap.set(schemaId, validator);
    }
    return validator;
  }

  validateSchema(data: unknown, schemaId: AuthzSchemaId): AuthzSchemaValidationResult {
    const validator = this.getValidator(schemaId);
    const payload = structuredClone(data);
    const valid = validator(payload);
    if (valid) {
      return {
        success: true,
        schemaId,
        version: this.version,
        issues: [],
      };
    }

    return {
      success: false,
      schemaId,
      version: this.version,
      issues: formatAjvErrors(validator.errors, `data/authz-schemas/registry.json#${schemaId}`),
    };
  }

  isVersionCompatible(schemaId: AuthzSchemaId, consumerVersion: string): boolean {
    void schemaId; // reserved for future schema-specific branching
    return consumerVersion === this.version;
  }

  assertVersionCompatible(schemaId: AuthzSchemaId, consumerVersion: string): void {
    if (!this.isVersionCompatible(schemaId, consumerVersion)) {
      throw new Error(
        `Schema ${schemaId} expects registry version ${this.version}, received ${consumerVersion}.`
      );
    }
  }
}

const registryData = registryDocument as AuthzRegistryDocument;

export const schemaRegistry = new AuthzSchemaRegistry(registryData);

export function listAuthzSchemas(): readonly AuthzSchemaSummary[] {
  return schemaRegistry.listSchemas();
}

export function getAuthzSchema(schemaId: AuthzSchemaId): AuthzSchemaDefinition {
  return schemaRegistry.getSchema(schemaId);
}

export function validateWithRegistry(
  data: unknown,
  schemaId: AuthzSchemaId
): AuthzSchemaValidationResult {
  return schemaRegistry.validateSchema(data, schemaId);
}

export function isSchemaVersionCompatible(schemaId: AuthzSchemaId, version: string): boolean {
  return schemaRegistry.isVersionCompatible(schemaId, version);
}

export function assertSchemaVersionCompatible(schemaId: AuthzSchemaId, version: string): void {
  schemaRegistry.assertVersionCompatible(schemaId, version);
}
