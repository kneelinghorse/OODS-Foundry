/**
 * YAML Object Parser
 *
 * Parses *.object.yaml files into validated ObjectDefinition structures.
 */

import { readFileSync } from 'fs';
import { load as yamlLoad } from 'js-yaml';
import {
  type ObjectAdditionalMetadata,
  type ObjectDefinition,
  type ObjectFieldDefinition,
  type ObjectMetadata,
  type ObjectParseResult,
  type ObjectResolutions,
  type ObjectViewOverride,
  type ObjectViewOverrides,
  type ResolutionDetail,
  type TraitParameterMap,
  type TraitParameterValue,
  type TraitMountConfiguration,
  type TraitReference,
  createObjectParseFailure,
  createObjectParseSuccess,
} from '../registry/object-definition.js';
import {
  createParseError,
  type ParseError,
  type SemanticMapping,
  type TokenDefinition,
  type TraitAction,
} from '../core/trait-definition.js';

type YamlRoot = Record<string, unknown>;

/**
 * Parse an object definition from disk.
 */
export function parseObjectDefinitionFromFile(filePath: string): ObjectParseResult {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return parseObjectDefinition(content, filePath);
  } catch (error) {
    return createObjectParseFailure([
      createParseError(
        `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
        {
          file: filePath,
          code: 'FILE_READ_ERROR',
        }
      ),
    ]);
  }
}

/**
 * Parse an object definition from a YAML string.
 */
export function parseObjectDefinition(
  content: string,
  filePath?: string
): ObjectParseResult {
  const lines = content.split(/\r?\n/);

  try {
    const warnings: ParseError[] = [];

    const parsed = yamlLoad(content, {
      filename: filePath,
      onWarning: (warning) => {
        warnings.push(
          createParseError(warning.message, {
            file: filePath,
            line: warning.mark?.line,
            column: warning.mark?.column,
            code: 'YAML_WARNING',
          })
        );
      },
    });

    if (!parsed || typeof parsed !== 'object') {
      return createObjectParseFailure([
        createParseError('Invalid YAML: expected mapping at root level', {
          file: filePath,
          code: 'INVALID_ROOT',
        }),
      ]);
    }

    const root = parsed as YamlRoot;
    const structuralErrors = validateRootStructure(root, lines, filePath);
    if (structuralErrors.length > 0) {
      return createObjectParseFailure([...warnings, ...structuralErrors]);
    }

    const { definition, transformErrors } = transformToObjectDefinition(
      root,
      lines,
      filePath
    );

    if (transformErrors.length > 0) {
      return createObjectParseFailure([...warnings, ...transformErrors]);
    }

    return createObjectParseSuccess(definition);
  } catch (error) {
    const yamlError = error as { mark?: { line: number; column: number } };
    return createObjectParseFailure([
      createParseError(
        `YAML parse error: ${error instanceof Error ? error.message : String(error)}`,
        {
          file: filePath,
          line: yamlError.mark?.line,
          column: yamlError.mark?.column,
          code: 'YAML_PARSE_ERROR',
        }
      ),
    ]);
  }
}

/**
 * Ensure critical sections exist and have the expected shapes before transforming.
 */
function validateRootStructure(
  root: YamlRoot,
  lines: string[],
  filePath?: string
): ParseError[] {
  const errors: ParseError[] = [];

  const pushError = (message: string, fieldPath: string, code: string) => {
    const line = estimateLineNumber(lines, fieldPath) ?? 1;
    errors.push(
      createParseError(message, {
        file: filePath,
        field: fieldPath,
        line,
        code,
      })
    );
  };

  if (!root.object || typeof root.object !== 'object') {
    pushError('Missing required field: "object"', 'object', 'MISSING_REQUIRED_FIELD');
  } else if (Array.isArray(root.object)) {
    pushError('Field "object" must be a mapping', 'object', 'INVALID_FIELD_TYPE');
  } else {
    const metadata = root.object as Record<string, unknown>;
    const name = metadata.name;
    if (typeof name !== 'string' || name.trim().length === 0) {
      pushError('Field "object.name" is required and must be a string', 'object.name', 'MISSING_REQUIRED_FIELD');
    }

    if (metadata.extends !== undefined && !isValidExtends(metadata.extends)) {
      pushError(
        'Field "object.extends" must be a string or mapping with a "name" property',
        'object.extends',
        'INVALID_FIELD_TYPE'
      );
    }
  }

  if (!Array.isArray(root.traits) || root.traits.length === 0) {
    pushError('Field "traits" is required and must be a non-empty array', 'traits', 'MISSING_REQUIRED_FIELD');
  } else {
    root.traits.forEach((entry, index) => {
      const fieldPath = `traits[${index}]`;

      if (typeof entry === 'string') {
        if (!entry.trim()) {
          pushError('Trait entries must not be empty strings', fieldPath, 'INVALID_FIELD_VALUE');
        }
        return;
      }

      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        pushError('Trait entries must be strings or mappings', fieldPath, 'INVALID_FIELD_TYPE');
        return;
      }

      const trait = entry as Record<string, unknown>;
      const name = typeof trait.name === 'string' ? trait.name : typeof trait.trait === 'string' ? trait.trait : undefined;
      if (!name) {
        pushError('Trait entry must include "name"', `${fieldPath}.name`, 'MISSING_REQUIRED_FIELD');
      }

      if (trait.parameters !== undefined && !isPlainObject(trait.parameters)) {
        pushError(
          'Trait parameters must be a mapping of parameter names to values',
          `${fieldPath}.parameters`,
          'INVALID_FIELD_TYPE'
        );
      }

      if (trait.params !== undefined && !isPlainObject(trait.params)) {
        pushError(
          'Trait params must be a mapping of parameter names to values',
          `${fieldPath}.params`,
          'INVALID_FIELD_TYPE'
        );
      }
    });
  }

  if (root.schema !== undefined) {
    if (!isPlainObject(root.schema)) {
      pushError('Field "schema" must be a mapping', 'schema', 'INVALID_FIELD_TYPE');
    } else {
      Object.entries(root.schema as Record<string, unknown>).forEach(([fieldName, value]) => {
        const path = `schema.${fieldName}`;
        if (typeof value === 'string') {
          if (!value.trim()) {
            pushError('Schema field shorthand must not be empty', path, 'INVALID_FIELD_VALUE');
          }
          return;
        }

        if (!isPlainObject(value)) {
          pushError('Schema field must be an object or string shorthand', path, 'INVALID_FIELD_TYPE');
          return;
        }

        const typed = value as Record<string, unknown>;
        if (typed.type !== undefined && typeof typed.type !== 'string') {
          pushError('Schema field "type" must be a string', `${path}.type`, 'INVALID_FIELD_TYPE');
        }
      });
    }
  }

  if (root.resolutions !== undefined && !isPlainObject(root.resolutions)) {
    pushError('Field "resolutions" must be a mapping', 'resolutions', 'INVALID_FIELD_TYPE');
  } else if (root.resolutions) {
    const resolutions = root.resolutions as Record<string, unknown>;
    ['fields', 'semantics', 'tokens', 'views'].forEach((key) => {
      const entry = resolutions[key];
      if (entry !== undefined && !isPlainObject(entry)) {
        pushError(`Field "resolutions.${key}" must be a mapping`, `resolutions.${key}`, 'INVALID_FIELD_TYPE');
      }
    });
  }

  if (root.views !== undefined && !isPlainObject(root.views)) {
    pushError('Field "views" must be a mapping of contexts to overrides', 'views', 'INVALID_FIELD_TYPE');
  }

  if (root.semantics !== undefined && !isPlainObject(root.semantics)) {
    pushError('Field "semantics" must be a mapping', 'semantics', 'INVALID_FIELD_TYPE');
  }

  if (root.tokens !== undefined && !isPlainObject(root.tokens)) {
    pushError('Field "tokens" must be a mapping', 'tokens', 'INVALID_FIELD_TYPE');
  }

  if (root.actions !== undefined && !Array.isArray(root.actions)) {
    pushError('Field "actions" must be an array', 'actions', 'INVALID_FIELD_TYPE');
  }

  return errors;
}

/**
 * Transform validated YAML into a typed ObjectDefinition.
 */
function transformToObjectDefinition(
  root: YamlRoot,
  lines: string[],
  filePath?: string
): {
  definition: ObjectDefinition;
  transformErrors: ParseError[];
} {
  const errors: ParseError[] = [];

  const pushError = (message: string, fieldPath: string, code: string) => {
    const line = estimateLineNumber(lines, fieldPath) ?? 1;
    errors.push(
      createParseError(message, {
        file: filePath,
        field: fieldPath,
        line,
        code,
      })
    );
  };

  const metadata = normalizeMetadata(root.object as Record<string, unknown>);
  const traits = normalizeTraits(root.traits as unknown[], lines, filePath, errors);
  const schema = root.schema
    ? normalizeSchema(root.schema as Record<string, unknown>, lines, filePath, errors)
    : undefined;
  const resolutions = root.resolutions
    ? normalizeResolutions(root.resolutions as Record<string, unknown>, lines, filePath, errors)
    : undefined;

  if (schema && resolutions?.fields) {
    for (const [fieldName, detail] of Object.entries(resolutions.fields)) {
      if (!schema[fieldName]) {
        continue;
      }

      if (detail.strategy === 'use_trait') {
        pushError(
          `Field "${fieldName}" is defined in schema but resolution prefers trait definition`,
          `schema.${fieldName}`,
          'CONFLICTING_FIELD_DEFINITION'
        );
      }
    }
  }

  const definition: ObjectDefinition = {
    object: metadata,
    traits,
  };

  if (schema) {
    definition.schema = schema;
  }

  if (root.semantics) {
    definition.semantics = root.semantics as Record<string, SemanticMapping>;
  }

  if (root.tokens) {
    definition.tokens = root.tokens as TokenDefinition;
  }

  if (root.views) {
    definition.views = normalizeViews(
      root.views as Record<string, unknown>,
      lines,
      filePath,
      errors
    );
  }

  if (root.actions) {
    definition.actions = root.actions as TraitAction[];
  }

  if (resolutions) {
    definition.resolutions = resolutions;
  }

  if (root.metadata) {
    definition.metadata = root.metadata as ObjectAdditionalMetadata;
  }

  if (root.annotations) {
    definition.annotations = root.annotations as Record<string, unknown>;
  }

  return { definition, transformErrors: errors };
}

function normalizeMetadata(raw: Record<string, unknown>): ObjectMetadata {
  const extendsRaw = raw.extends;
  let extendsValue = undefined;
  if (typeof extendsRaw === 'string') {
    const name = extendsRaw.trim();
    if (name) {
      extendsValue = { name };
    }
  } else if (isPlainObject(extendsRaw)) {
    const ref = extendsRaw as Record<string, unknown>;
    if (typeof ref.name === 'string' && ref.name.trim()) {
      extendsValue = {
        name: ref.name.trim(),
        version: typeof ref.version === 'string' ? ref.version : undefined,
        source: typeof ref.source === 'string' ? ref.source : undefined,
        description: typeof ref.description === 'string' ? ref.description : undefined,
      };
    }
  }

  return {
    ...raw,
    extends: extendsValue,
  } as ObjectMetadata;
}

function normalizeTraits(
  rawTraits: unknown[],
  lines: string[],
  filePath: string | undefined,
  errors: ParseError[]
): TraitReference[] {
  const results: TraitReference[] = [];
  const aliasSet = new Set<string>();

  rawTraits.forEach((entry, index) => {
    const fieldPath = `traits[${index}]`;

    if (typeof entry === 'string') {
      const traitName = entry.trim();
      results.push({
        name: traitName,
      });
      return;
    }

    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return;
    }

    const trait = entry as Record<string, unknown>;
    const name =
      typeof trait.name === 'string'
        ? trait.name
        : typeof trait.trait === 'string'
          ? trait.trait
          : undefined;

    if (!name) {
      return;
    }

    const alias =
      typeof trait.alias === 'string' && trait.alias.trim().length > 0
        ? trait.alias.trim()
        : undefined;

    if (alias) {
      if (aliasSet.has(alias)) {
        errors.push(
          createParseError(`Duplicate trait alias "${alias}"`, {
            file: filePath,
            field: `${fieldPath}.alias`,
            line: estimateLineNumber(lines, `${fieldPath}.alias`) ?? 1,
            code: 'DUPLICATE_ALIAS',
          })
        );
      } else {
        aliasSet.add(alias);
      }
    }

    const parameters =
      normalizeParameters(
        (trait.parameters ?? trait.params) as Record<string, unknown> | undefined
      ) ?? undefined;

    const mount = normalizeMount(
      trait.mount,
      typeof trait.when === 'string' ? trait.when : undefined
    );

    const annotations: Record<string, unknown> = {};
    const knownKeys = new Set([
      'name',
      'trait',
      'version',
      'alias',
      'namespace',
      'displayName',
      'description',
      'optional',
      'disabled',
      'parameters',
      'params',
      'mount',
      'when',
    ]);

    Object.entries(trait).forEach(([key, value]) => {
      if (!knownKeys.has(key)) {
        annotations[key] = value;
      }
    });

    const reference: TraitReference = {
      name,
      version: typeof trait.version === 'string' ? trait.version : undefined,
      alias,
      namespace: typeof trait.namespace === 'string' ? trait.namespace : undefined,
      displayName:
        typeof trait.displayName === 'string' ? trait.displayName : undefined,
      description:
        typeof trait.description === 'string' ? trait.description : undefined,
      optional: trait.optional === true,
      disabled: trait.disabled === true,
      parameters,
    };

    if (mount) {
      reference.mount = mount;
    }

    if (Object.keys(annotations).length > 0) {
      reference.annotations = annotations;
    }

    results.push(reference);
  });

  return results;
}

function normalizeParameters(
  raw: Record<string, unknown> | undefined
): TraitParameterMap | undefined {
  if (!raw) {
    return undefined;
  }

  const params: TraitParameterMap = {};
  Object.entries(raw).forEach(([key, value]) => {
    params[key] = normalizeParameterValue(value);
  });
  return params;
}

function normalizeParameterValue(value: unknown): TraitParameterValue {
  if (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'string' ||
        typeof item === 'number' ||
        typeof item === 'boolean'
    )
  ) {
    if (value.every((item) => typeof item === 'string')) {
      return value.slice() as readonly string[];
    }
    if (value.every((item) => typeof item === 'number')) {
      return value.slice() as readonly number[];
    }
    if (value.every((item) => typeof item === 'boolean')) {
      return value.slice() as readonly boolean[];
    }
    if (value.every((item) => isPlainObject(item))) {
      const clones = value.map((item) => ({ ...(item as Record<string, unknown>) }));
      return clones as readonly Record<string, unknown>[];
    }
    return value as unknown as TraitParameterValue;
  }

  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (isPlainObject(value)) {
    return { ...(value as Record<string, unknown>) };
  }

  return value as TraitParameterValue;
}

function normalizeMount(mount: unknown, when?: string): TraitMountConfiguration | undefined {
  if (!mount && !when) {
    return undefined;
  }

  const result: Record<string, unknown> = {};

  if (when) {
    result.when = when;
  }

  if (Array.isArray(mount)) {
    result.contexts = mount;
  } else if (isPlainObject(mount)) {
    Object.assign(result, mount as Record<string, unknown>);
  } else if (typeof mount === 'string') {
    result.contexts = [mount];
  }

  return Object.keys(result).length > 0 ? (result as TraitMountConfiguration) : undefined;
}

function normalizeSchema(
  schema: Record<string, unknown>,
  lines: string[],
  filePath: string | undefined,
  errors: ParseError[]
): Record<string, ObjectFieldDefinition> | undefined {
  const result: Record<string, ObjectFieldDefinition> = {};

  for (const [fieldName, rawValue] of Object.entries(schema)) {
    if (typeof rawValue === 'string') {
      const parsed = parseShorthandField(rawValue);
      if (!parsed) {
        errors.push(
          createParseError(`Unable to parse shorthand schema for "${fieldName}"`, {
            file: filePath,
            field: `schema.${fieldName}`,
            line: estimateLineNumber(lines, `schema.${fieldName}`) ?? 1,
            code: 'INVALID_FIELD_VALUE',
          })
        );
        continue;
      }
      result[fieldName] = {
        ...parsed,
        provenance: 'object',
      };
      continue;
    }

    if (!isPlainObject(rawValue)) {
      continue;
    }

    const field = { ...(rawValue as Record<string, unknown>) } as unknown as ObjectFieldDefinition;
    if (!field.type || typeof field.type !== 'string') {
      errors.push(
        createParseError(`Schema field "${fieldName}" must include a string "type"`, {
          file: filePath,
          field: `schema.${fieldName}.type`,
          line: estimateLineNumber(lines, `schema.${fieldName}.type`) ?? 1,
          code: 'MISSING_REQUIRED_FIELD',
        })
      );
      continue;
    }

    if (field.required === undefined) {
      field.required = true;
    } else if (typeof field.required !== 'boolean') {
      if (typeof field.required === 'string') {
        field.required = (field.required as string).toLowerCase() === 'true';
      } else {
        field.required = Boolean(field.required);
      }
    }

    field.provenance = field.provenance ?? 'object';
    result[fieldName] = field;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function parseShorthandField(value: string): ObjectFieldDefinition | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const optional = trimmed.endsWith('?');
  const type = optional ? trimmed.slice(0, -1) : trimmed;

  const normalizedType = type.trim();
  if (!normalizedType) {
    return undefined;
  }

  return {
    type: normalizedType,
    required: !optional,
    provenance: 'object',
  };
}

function normalizeResolutions(
  raw: Record<string, unknown>,
  lines: string[],
  filePath: string | undefined,
  errors: ParseError[]
): ObjectResolutions | undefined {
  const result: ObjectResolutions = {};

  const categories: Array<keyof ObjectResolutions> = [
    'fields',
    'semantics',
    'tokens',
    'views',
  ];

  categories.forEach((category) => {
    const bucket = raw[category as string];
    if (!bucket || !isPlainObject(bucket)) {
      return;
    }

    const normalizedEntries: Record<string, ResolutionDetail> = {};
    Object.entries(bucket as Record<string, unknown>).forEach(([key, value]) => {
      const detail = normalizeResolutionDetail(value);
      if (!detail) {
        errors.push(
          createParseError(`Invalid resolution declaration for "${key}"`, {
            file: filePath,
            field: `resolutions.${category}.${key}`,
            line: estimateLineNumber(lines, `resolutions.${category}.${key}`) ?? 1,
            code: 'INVALID_FIELD_VALUE',
          })
        );
        return;
      }
      normalizedEntries[key] = detail;
    });

    if (Object.keys(normalizedEntries).length > 0) {
      result[category] = normalizedEntries;
    }
  });

  if (isPlainObject(raw.metadata)) {
    result.metadata = raw.metadata as Record<string, unknown>;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function normalizeResolutionDetail(raw: unknown): ResolutionDetail | undefined {
  if (typeof raw === 'string') {
    if (raw === 'object') {
      return { strategy: 'use_object' };
    }

    if (raw === 'merge') {
      return { strategy: 'merge' };
    }

    return {
      strategy: 'use_trait',
      trait: raw,
    };
  }

  if (!isPlainObject(raw)) {
    return undefined;
  }

  const data = raw as Record<string, unknown>;

  let strategy = parseResolutionStrategy(data);
  const trait =
    typeof data.trait === 'string'
      ? data.trait
      : typeof data.use === 'string' && data.use !== 'object'
        ? data.use
        : undefined;

  if (!strategy) {
    strategy = trait ? 'use_trait' : 'use_object';
  }

  if (strategy === 'use_trait' && !trait) {
    return undefined;
  }

  const alias = extractRecordOfStrings(data.alias) as Record<string, string> | undefined;
  const rename = extractRecordOfStrings(data.rename) as Record<string, string> | undefined;
  const metadata = extractAdditionalMetadata(data, [
    'strategy',
    'use',
    'keep',
    'prefer',
    'merge',
    'mergeStrategy',
    'trait',
    'alias',
    'rename',
    'description',
    'reason',
    'notes',
  ]);

  const mergeStrategy =
    typeof data.mergeStrategy === 'string'
      ? data.mergeStrategy
      : typeof data.merge === 'string'
        ? data.merge
        : undefined;

  return {
    strategy,
    trait,
    description: typeof data.description === 'string' ? data.description : undefined,
    reason: typeof data.reason === 'string' ? data.reason : undefined,
    notes: typeof data.notes === 'string' ? data.notes : undefined,
    alias,
    rename,
    mergeStrategy,
    metadata,
  };
}

function parseResolutionStrategy(data: Record<string, unknown>) {
  const rawStrategy = data.strategy;
  if (typeof rawStrategy === 'string') {
    switch (rawStrategy) {
      case 'use_trait':
      case 'trait':
      case 'prefer_trait':
        return 'use_trait' as const;
      case 'use_object':
      case 'object':
      case 'prefer_object':
        return 'use_object' as const;
      case 'merge':
        return 'merge' as const;
      default:
        break;
    }
  }

  const use = data.use;
  if (typeof use === 'string') {
    if (use === 'object') {
      return 'use_object' as const;
    }
    return 'use_trait' as const;
  }

  const keep = data.keep;
  if (typeof keep === 'string') {
    if (keep === 'object') {
      return 'use_object' as const;
    }
    return 'use_trait' as const;
  }

  const prefer = data.prefer;
  if (typeof prefer === 'string') {
    if (prefer === 'object') {
      return 'use_object' as const;
    }
    if (prefer === 'merge') {
      return 'merge' as const;
    }
    return 'use_trait' as const;
  }

  if (data.merge !== undefined) {
    return 'merge' as const;
  }

  return undefined;
}

function normalizeViews(
  raw: Record<string, unknown>,
  lines: string[],
  filePath: string | undefined,
  errors: ParseError[]
): ObjectViewOverrides | undefined {
  const result: ObjectViewOverrides = {};

  Object.entries(raw).forEach(([context, value]) => {
    if (Array.isArray(value)) {
      const overrides = value
        .map((entry, index) =>
          normalizeViewOverride(entry, `views.${context}[${index}]`, lines, filePath, errors)
        )
        .filter((override): override is ObjectViewOverride => override !== undefined);
      if (overrides.length > 0) {
        result[context] = overrides;
      }
      return;
    }

    if (isPlainObject(value)) {
      const override = normalizeViewOverride(
        value,
        `views.${context}`,
        lines,
        filePath,
        errors
      );
      if (override) {
        result[context] = [override];
      }
      return;
    }

    errors.push(
      createParseError(`View overrides for context "${context}" must be an array or mapping`, {
        file: filePath,
        field: `views.${context}`,
        line: estimateLineNumber(lines, `views.${context}`) ?? 1,
        code: 'INVALID_FIELD_TYPE',
      })
    );
  });

  return Object.keys(result).length > 0 ? result : undefined;
}

function normalizeViewOverride(
  raw: unknown,
  fieldPath: string,
  lines: string[],
  filePath: string | undefined,
  errors: ParseError[]
): ObjectViewOverride | undefined {
  if (!isPlainObject(raw)) {
    errors.push(
      createParseError('View override entries must be mappings', {
        file: filePath,
        field: fieldPath,
        line: estimateLineNumber(lines, fieldPath) ?? 1,
        code: 'INVALID_FIELD_TYPE',
      })
    );
    return undefined;
  }

  const entry = raw as Record<string, unknown>;

  const action =
    typeof entry.action === 'string'
      ? entry.action
      : typeof entry.type === 'string'
        ? entry.type
        : 'add';

  const override: ObjectViewOverride = {
    action: (['add', 'replace', 'remove', 'augment'].includes(action)
      ? action
      : 'add') as ObjectViewOverride['action'],
    id: typeof entry.id === 'string' ? entry.id : undefined,
    target: typeof entry.target === 'string' ? entry.target : undefined,
    trait: typeof entry.trait === 'string' ? entry.trait : undefined,
    alias: typeof entry.alias === 'string' ? entry.alias : undefined,
    component: typeof entry.component === 'string' ? entry.component : undefined,
    when: typeof entry.when === 'string' ? entry.when : undefined,
    priority: typeof entry.priority === 'number' ? entry.priority : undefined,
    notes: typeof entry.notes === 'string' ? entry.notes : undefined,
  };

  if (isPlainObject(entry.props)) {
    override.props = entry.props as Record<string, unknown>;
  }

  if (isPlainObject(entry.metadata)) {
    override.metadata = entry.metadata as Record<string, unknown>;
  }

  return override;
}

function extractRecordOfStrings(value: unknown) {
  if (!isPlainObject(value)) {
    return undefined;
  }
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, val]) => typeof val === 'string'
  );
  if (entries.length === 0) {
    return undefined;
  }
  return Object.fromEntries(entries);
}

function extractAdditionalMetadata(
  source: Record<string, unknown>,
  reserved: string[]
) {
  const metadata: Record<string, unknown> = {};
  Object.entries(source).forEach(([key, value]) => {
    if (!reserved.includes(key)) {
      metadata[key] = value;
    }
  });
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function isValidExtends(value: unknown) {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (!isPlainObject(value)) {
    return false;
  }

  return typeof (value as Record<string, unknown>).name === 'string';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/* c8 ignore start */
function estimateLineNumber(lines: string[], fieldPath: string): number | undefined {
  const segments = pathToSegments(fieldPath);
  if (segments.length === 0) {
    return undefined;
  }

  let index = 0;
  let currentIndent = 0;

  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
    const segment = segments[segmentIndex];

    if (typeof segment === 'number') {
      let occurrence = -1;
      for (let i = index; i < lines.length; i++) {
        const line = lines[i];
        const indent = leadingSpaces(line);
        const trimmed = line.trim();

        if (!trimmed) {
          continue;
        }

        if (indent < currentIndent && !trimmed.startsWith('-')) {
          return undefined;
        }

        if (trimmed.startsWith('-')) {
          occurrence += 1;
          if (occurrence === segment) {
            currentIndent = indent + 2;
            index = i + 1;
            if (segmentIndex === segments.length - 1) {
              return i + 1;
            }
            break;
          }
        }
      }
      continue;
    }

    const regex = new RegExp(`^\\s*${escapeRegExp(segment)}\\s*:?`);
    let found = false;
    for (let i = index; i < lines.length; i++) {
      const line = lines[i];
      const indent = leadingSpaces(line);
      const trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      if (indent < currentIndent && !trimmed.startsWith('-')) {
        return undefined;
      }

      if (regex.test(line)) {
        found = true;
        if (segmentIndex === segments.length - 1) {
          return i + 1;
        }
        currentIndent = indent + 2;
        index = i + 1;
        break;
      }
    }

    if (!found) {
      return undefined;
    }
  }

  return undefined;
}

function pathToSegments(path: string): Array<string | number> {
  const segments: Array<string | number> = [];
  const regex = /([^[.\]]+)|\[(\d+)\]/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(path)) !== null) {
    if (match[1]) {
      segments.push(match[1]);
    } else if (match[2]) {
      segments.push(Number(match[2]));
    }
  }

  return segments;
}

function leadingSpaces(line: string): number {
  const match = line.match(/^\s*/);
  return match ? match[0].length : 0;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/* c8 ignore end */
