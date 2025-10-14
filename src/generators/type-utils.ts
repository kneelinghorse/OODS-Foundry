import type { SchemaField } from '../core/trait-definition.js';
import type { FieldProvenance } from '../core/composed-object.js';
import type { ResolvedTrait } from '../registry/resolver.js';
import type { TraitParameterValue } from '../registry/object-definition.js';

export interface TraitParameterRegistry {
  readonly lookups: Map<string, Readonly<Record<string, TraitParameterValue>>>;
}

export interface StateTransition {
  readonly from_state: string;
  readonly to_state: string;
  readonly timestamp: string;
  readonly reason?: string;
  readonly actor_id?: string;
}

export interface ResolveUnionOptions {
  readonly parameterName: string;
  readonly provenance?: FieldProvenance;
  readonly registry: TraitParameterRegistry;
}

const SIMPLE_TYPE_MAPPINGS: Record<string, string> = {
  string: 'string',
  text: 'string',
  uuid: 'string',
  cuid: 'string',
  ulid: 'string',
  datetime: 'string',
  timestamp: 'string',
  date: 'string',
  email: 'string',
  uri: 'string',
  url: 'string',
  slug: 'string',
  token: 'string',
  locale: 'string',
  number: 'number',
  int: 'number',
  integer: 'number',
  float: 'number',
  decimal: 'number',
  double: 'number',
  currency: 'string',
  boolean: 'boolean',
  json: 'unknown',
  jsonb: 'unknown',
  object: 'Record<string, unknown>',
  map: 'Record<string, unknown>',
  record: 'Record<string, unknown>',
  array: 'unknown[]',
  any: 'unknown',
  unknown: 'unknown',
};

const IDENTIFIER_SEGMENT = /[A-Za-z0-9]+/g;
const PROPERTY_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function buildTraitParameterRegistry(
  traits: readonly ResolvedTrait[]
): TraitParameterRegistry {
  const lookups = new Map<string, Readonly<Record<string, TraitParameterValue>>>();

  for (const trait of traits) {
    const key = trait.definition.trait.name;
    lookups.set(key, trait.parameters);

    if (trait.reference.alias) {
      lookups.set(trait.reference.alias, trait.parameters);
    }
  }

  return { lookups };
}

export function resolveUnionFromParameter(
  options: ResolveUnionOptions
): readonly (string | number | boolean)[] | undefined {
  const { parameterName, provenance, registry } = options;

  const preferredSources = new Set<string>();
  if (provenance?.source) {
    preferredSources.add(provenance.source);
  }
  if (provenance?.previousSources) {
    provenance.previousSources.forEach((source) => preferredSources.add(source));
  }

  const tryResolve = (sourceName: string): readonly (string | number | boolean)[] | undefined => {
    const params = registry.lookups.get(sourceName);
    if (!params) {
      return undefined;
    }
    const value = params[parameterName];
    if (value === undefined) {
      return undefined;
    }
    return toPrimitiveLiteralArray(value);
  };

  for (const source of preferredSources) {
    const resolved = tryResolve(source);
    if (resolved && resolved.length > 0) {
      return resolved;
    }
  }

  let fallback: readonly (string | number | boolean)[] | undefined;
  for (const [, params] of registry.lookups.entries()) {
    const value = params[parameterName];
    if (value === undefined) {
      continue;
    }

    const literals = toPrimitiveLiteralArray(value);
    if (!literals || literals.length === 0) {
      continue;
    }

    if (!fallback) {
      fallback = literals;
      continue;
    }

    const current = new Set(fallback);
    const hasSameValues =
      literals.length === fallback.length && literals.every((value) => current.has(value));
    if (!hasSameValues) {
      return undefined;
    }
  }

  return fallback;
}

export function mapSchemaType(field: SchemaField): string {
  const rawType = typeof field.type === 'string' ? field.type.trim() : '';
  if (!rawType) {
    return 'unknown';
  }

  let normalized = rawType;
  let nullable = false;

  if (normalized.endsWith('?')) {
    nullable = true;
    normalized = normalized.slice(0, -1).trim();
  }

  if (!normalized) {
    return nullable ? 'unknown | null' : 'unknown';
  }

  if (normalized.includes('|') || normalized.includes('&') || normalized.includes('<')) {
    return nullable ? `${normalized} | null` : normalized;
  }

  if (normalized.endsWith('[]')) {
    const inner = normalized.slice(0, -2).trim();
    const mappedInner = SIMPLE_TYPE_MAPPINGS[inner.toLowerCase()];
    const result = `${mappedInner ?? inner}[]`;
    return nullable ? `${result} | null` : result;
  }

  const mapped = SIMPLE_TYPE_MAPPINGS[normalized.toLowerCase()] ?? normalized;
  return nullable ? `${mapped} | null` : mapped;
}

export function formatLiteralUnion(values: readonly (string | number | boolean)[]): string {
  const unique = Array.from(new Set(values));
  return unique.map(formatLiteralValue).join(' | ');
}

export function formatLiteralValue(value: string | number | boolean): string {
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return `'${value.replace(/'/g, "\\'")}'`;
}

export function formatDefaultValue(value: unknown): string {
  if (value === undefined) {
    return '';
  }

  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string') {
    return `'${value.replace(/'/g, "\\'")}'`;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    const preview = value
      .slice(0, 5)
      .map((entry) =>
        typeof entry === 'string'
          ? `'${entry.replace(/'/g, "\\'")}'`
          : typeof entry === 'number' || typeof entry === 'boolean'
            ? String(entry)
            : '...'
      )
      .join(', ');
    return `[${preview}${value.length > 5 ? ', ...' : ''}]`;
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[object]';
    }
  }

  return String(value);
}

export function toPascalCase(value: string): string {
  const segments = value.match(IDENTIFIER_SEGMENT);
  if (!segments || segments.length === 0) {
    return 'ComposedObject';
  }

  return segments
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
}

export function sanitizeIdentifier(value: string): string {
  const sanitized = value.replace(/[^A-Za-z0-9_]/g, '_');
  if (!sanitized) {
    return '_';
  }

  if (/^[0-9]/.test(sanitized)) {
    return `_${sanitized}`;
  }

  return sanitized;
}

export function formatPropertyName(name: string): string {
  if (PROPERTY_IDENTIFIER.test(name)) {
    return name;
  }

  return `'${name.replace(/'/g, "\\'")}'`;
}

function toPrimitiveLiteralArray(
  value: TraitParameterValue
): readonly (string | number | boolean)[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const literals: (string | number | boolean)[] = [];

  for (const entry of value) {
    if (
      entry === null ||
      (typeof entry !== 'string' && typeof entry !== 'number' && typeof entry !== 'boolean')
    ) {
      return undefined;
    }
    literals.push(entry);
  }

  return literals;
}
