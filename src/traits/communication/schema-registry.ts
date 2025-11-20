import Ajv2020, { type AnySchema, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import registryDocument from '~/data/communication-schemas/registry.json';

import { formatAjvErrors } from '@/validation/formatter.js';
import type { ValidationIssue } from '@/validation/types.js';

const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true, strict: false });
addFormats(ajv);

export const COMMUNICATION_REGISTRY_VERSION = '1.0.0';

const SCHEMA_IDS = [
  'channel',
  'template',
  'delivery-policy',
  'message',
  'conversation',
  'message-status',
] as const;
export type CommunicationSchemaId = (typeof SCHEMA_IDS)[number];

type JsonSchemaDocument = AnySchema;

interface RegistrySchemaDefinition {
  readonly id: CommunicationSchemaId;
  readonly title: string;
  readonly description: string;
  readonly status: 'experimental' | 'stable' | 'deprecated';
  readonly citation: string;
  readonly schema: JsonSchemaDocument;
  readonly example: Record<string, unknown>;
}

interface RegistryDocument {
  readonly id: string;
  readonly version: string;
  readonly updatedAt: string;
  readonly schemas: readonly RegistrySchemaDefinition[];
}

export interface CommunicationSchemaSummary {
  readonly id: CommunicationSchemaId;
  readonly title: string;
  readonly description: string;
  readonly status: RegistrySchemaDefinition['status'];
  readonly citation: string;
}

export interface CommunicationSchemaValidationResult {
  readonly success: boolean;
  readonly schemaId: CommunicationSchemaId;
  readonly version: string;
  readonly issues: ValidationIssue[];
}

function assertSchemaId(candidate: string): asserts candidate is CommunicationSchemaId {
  if (!SCHEMA_IDS.includes(candidate as CommunicationSchemaId)) {
    throw new Error(`Schema id "${candidate}" is not registered in the communication registry.`);
  }
}

function cloneSchema(schema: JsonSchemaDocument): AnySchema {
  return structuredClone(schema) as AnySchema;
}

class CommunicationSchemaRegistry {
  private readonly version: string;
  private readonly definitions = new Map<CommunicationSchemaId, RegistrySchemaDefinition>();
  private readonly validators = new Map<CommunicationSchemaId, ValidateFunction>();

  constructor(document: RegistryDocument) {
    this.version = document.version;
    if (this.version !== COMMUNICATION_REGISTRY_VERSION) {
      throw new Error(
        `Communication schema registry version mismatch. Expected ${COMMUNICATION_REGISTRY_VERSION}, received ${this.version}.`
      );
    }

    for (const entry of document.schemas) {
      assertSchemaId(entry.id);
      if (this.definitions.has(entry.id)) {
        throw new Error(`Duplicate schema definition for ${entry.id}.`);
      }
      const clonedSchema = cloneSchema(entry.schema);
      this.definitions.set(entry.id, { ...entry, schema: clonedSchema });
      ajv.addSchema(clonedSchema);
    }
  }

  getVersion(): string {
    return this.version;
  }

  listSchemas(): readonly CommunicationSchemaSummary[] {
    return Array.from(this.definitions.values()).map((definition) => ({
      id: definition.id,
      title: definition.title,
      status: definition.status,
      description: definition.description,
      citation: definition.citation,
    }));
  }

  getSchema(schemaId: CommunicationSchemaId): RegistrySchemaDefinition {
    const definition = this.definitions.get(schemaId);
    if (!definition) {
      throw new Error(`Communication schema "${schemaId}" is not registered.`);
    }
    return definition;
  }

  private getValidator(schemaId: CommunicationSchemaId): ValidateFunction {
    let validator = this.validators.get(schemaId);
    if (!validator) {
      const definition = this.getSchema(schemaId);
      validator = ajv.compile(definition.schema as AnySchema);
      this.validators.set(schemaId, validator);
    }
    return validator;
  }

  validate(data: unknown, schemaId: CommunicationSchemaId): CommunicationSchemaValidationResult {
    const validator = this.getValidator(schemaId);
    const payload = structuredClone(data);
    const valid = validator(payload);
    if (valid) {
      return { success: true, schemaId, version: this.version, issues: [] };
    }

    return {
      success: false,
      schemaId,
      version: this.version,
      issues: formatAjvErrors(
        validator.errors,
        `data/communication-schemas/registry.json#${schemaId}`
      ),
    };
  }
}

const registryData = registryDocument as RegistryDocument;
export const communicationSchemaRegistry = new CommunicationSchemaRegistry(registryData);

export function listCommunicationSchemas(): readonly CommunicationSchemaSummary[] {
  return communicationSchemaRegistry.listSchemas();
}

export function getCommunicationSchema(
  schemaId: CommunicationSchemaId
): RegistrySchemaDefinition {
  return communicationSchemaRegistry.getSchema(schemaId);
}

export function validateCommunicationSchema(
  data: unknown,
  schemaId: CommunicationSchemaId
): CommunicationSchemaValidationResult {
  return communicationSchemaRegistry.validate(data, schemaId);
}
