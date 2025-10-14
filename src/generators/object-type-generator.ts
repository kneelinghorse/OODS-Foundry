import type { ResolvedObject } from '../registry/object-composer.js';
import type { FieldProvenance } from '../core/composed-object.js';
import type { SchemaField } from '../core/trait-definition.js';
import {
  buildTraitParameterRegistry,
  formatDefaultValue,
  formatLiteralUnion,
  formatPropertyName,
  mapSchemaType,
  resolveUnionFromParameter,
  sanitizeIdentifier,
  toPascalCase,
} from './type-utils.js';
import {
  renderObjectInterfaceFile,
  type ObjectInterfaceTemplateField,
} from './templates/object-interface.js';

interface SchemaFieldValidation {
  enum?: readonly (string | number | boolean)[];
  enumFromParameter?: string;
  [key: string]: unknown;
}

export interface ObjectInterfaceGenerationOptions {
  readonly includeJsDoc?: boolean;
  readonly interfaceName?: string;
}

export interface GeneratedObjectInterface {
  readonly objectName: string;
  readonly interfaceName: string;
  readonly fileName: string;
  readonly code: string;
  readonly traits: readonly string[];
}

export function generateObjectInterface(
  resolved: ResolvedObject,
  options: ObjectInterfaceGenerationOptions = {}
): GeneratedObjectInterface {
  const includeJsDoc = options.includeJsDoc ?? true;
  const objectName = resolved.definition.object.name;
  const interfaceName =
    sanitizeIdentifier(options.interfaceName ?? toPascalCase(objectName));
  const registry = buildTraitParameterRegistry(resolved.resolvedTraits);

  const schemaEntries = Object.entries(resolved.composed.schema).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  const fields: ObjectInterfaceTemplateField[] = schemaEntries.map(([fieldName, field]) => {
    const provenance = resolved.composed.metadata.provenance.get(fieldName);
    const type = resolveFieldType(field, provenance, registry);
    const jsDoc = includeJsDoc
      ? buildFieldDocumentation(fieldName, field, provenance)
      : [];

    return {
      name: formatPropertyName(fieldName),
      type,
      optional: field.required === false,
      jsDoc,
    };
  });

  const sourcePath = resolved.record.source.path;
  const traits = resolved.resolvedTraits.map((trait) => trait.definition.trait.name);

  const code = renderObjectInterfaceFile({
    objectName,
    interfaceName,
    description: resolved.definition.object.description,
    sourcePath,
    traits,
    fields,
  });

  return {
    objectName,
    interfaceName,
    fileName: `${interfaceName}.d.ts`,
    code,
    traits,
  };
}

function resolveFieldType(
  field: SchemaField,
  provenance: FieldProvenance | undefined,
  registry: ReturnType<typeof buildTraitParameterRegistry>
): string {
  const validation = (field.validation ?? {}) as SchemaFieldValidation;

  if (Array.isArray(validation.enum) && validation.enum.length > 0) {
    const literals = validation.enum.filter(
      (value): value is string | number | boolean =>
        typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    );
    if (literals.length === validation.enum.length) {
      return formatLiteralUnion(literals);
    }
  }

  if (typeof validation.enumFromParameter === 'string') {
    const literals = resolveUnionFromParameter({
      parameterName: validation.enumFromParameter,
      provenance,
      registry,
    });
    if (literals && literals.length > 0) {
      return formatLiteralUnion(literals);
    }
  }

  return mapSchemaType(field);
}

function buildFieldDocumentation(
  fieldName: string,
  field: SchemaField,
  provenance: FieldProvenance | undefined
): string[] {
  const lines: string[] = [];

  if (field.description) {
    lines.push(field.description);
  }

  const provenanceLines = describeProvenance(provenance);
  if (provenanceLines.length > 0) {
    if (lines.length > 0) {
      lines.push('');
    }
    lines.push(...provenanceLines);
  }

  if (field.default !== undefined) {
    if (lines.length > 0) {
      lines.push('');
    }
    lines.push(`Default: ${formatDefaultValue(field.default)}`);
  }

  if (lines.length === 0) {
    lines.push(`Field: ${fieldName}`);
  }

  return lines;
}

function describeProvenance(provenance: FieldProvenance | undefined): string[] {
  if (!provenance) {
    return ['Source: Composition pipeline'];
  }

  const layerLabel = formatLayerLabel(provenance.layer);
  const lines = [`Source: ${provenance.source} (${layerLabel})`];

  if (provenance.previousSources && provenance.previousSources.length > 0) {
    lines.push(`Overrides: ${provenance.previousSources.join(', ')}`);
  }

  if (provenance.overridden && (!provenance.previousSources || provenance.previousSources.length === 0)) {
    lines.push('Overrides: Previous value');
  }

  return lines;
}

function formatLayerLabel(
  layer: FieldProvenance['layer']
): string {
  switch (layer) {
    case 'foundation':
      return 'foundation';
    case 'base':
      return 'base object';
    case 'trait':
      return 'trait';
    case 'object':
      return 'object override';
    case 'context':
      return 'context override';
    default:
      return layer;
  }
}
