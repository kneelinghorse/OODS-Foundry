import type { Address } from '@/schemas/address.js';

export type AddressTemplateComponent = keyof Address | 'countryName';

export interface TemplateComponentOptions {
  prefix?: string;
  suffix?: string;
  uppercase?: boolean;
  multiline?: boolean;
  separator?: string;
  required?: boolean;
}

export interface TemplateComponentToken {
  readonly kind: 'component';
  readonly component: AddressTemplateComponent;
  readonly options: TemplateComponentOptions;
}

export interface TemplateLiteralToken {
  readonly kind: 'literal';
  readonly value: string;
}

export type TemplateToken = TemplateComponentToken | TemplateLiteralToken;

export interface TemplateLine {
  readonly index: number;
  readonly raw: string;
  readonly tokens: readonly TemplateToken[];
}

export interface RawTemplateDefinition {
  readonly key: string;
  readonly countryCode: string;
  readonly description: string;
  readonly template: string;
  readonly aliases?: readonly string[];
}

export interface AddressFormatTemplate {
  readonly key: string;
  readonly countryCode: string;
  readonly description: string;
  readonly aliases: readonly string[];
  readonly lines: readonly TemplateLine[];
}

const PLACEHOLDER_PATTERN = /{{(.*?)}}/g;

const VALID_COMPONENT_NAMES = new Set<AddressTemplateComponent>([
  'addressLines',
  'administrativeArea',
  'countryCode',
  'countryName',
  'dependentLocality',
  'formatTemplateKey',
  'languageCode',
  'locality',
  'organizationName',
  'postalCode',
]);

/**
 * Parse a raw template definition (loaded from JSON) into a normalized structure.
 */
export function parseTemplateDefinition(definition: RawTemplateDefinition): AddressFormatTemplate {
  if (!definition.key) {
    throw new Error('Template key is required.');
  }
  if (!definition.countryCode || definition.countryCode.length !== 2) {
    throw new Error(`Template ${definition.key} is missing a valid countryCode.`);
  }

  const lines = parseTemplateString(definition.template ?? '');
  const aliases = (definition.aliases ?? []).map((alias) => alias.toUpperCase());

  return {
    key: String(definition.key),
    countryCode: definition.countryCode.toUpperCase(),
    description: definition.description ?? '',
    aliases,
    lines,
  };
}

/**
 * Parse a full multi-line template string into template lines and tokens.
 */
export function parseTemplateString(template: string): TemplateLine[] {
  return template.split('\\n').map((line, index) => ({
    index,
    raw: line,
    tokens: parseLine(line),
  }));
}

function parseLine(line: string): TemplateToken[] {
  const tokens: TemplateToken[] = [];
  let cursor = 0;

  for (const match of line.matchAll(PLACEHOLDER_PATTERN)) {
    if (match.index === undefined) {
      continue;
    }
    if (match.index > cursor) {
      tokens.push({
        kind: 'literal',
        value: line.slice(cursor, match.index),
      });
    }

    const placeholder = match[1] ?? '';
    tokens.push(parsePlaceholder(placeholder));
    cursor = match.index + match[0].length;
  }

  if (cursor < line.length) {
    tokens.push({
      kind: 'literal',
      value: line.slice(cursor),
    });
  }

  return tokens;
}

function parsePlaceholder(content: string): TemplateComponentToken {
  const segments = content
    .split('|')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    throw new Error('Encountered empty placeholder in template.');
  }

  const [componentName, ...optionSegments] = segments;
  const component = parseComponentName(componentName);
  const options = parseOptions(optionSegments);

  return {
    kind: 'component',
    component,
    options,
  };
}

function parseComponentName(name: string): AddressTemplateComponent {
  if (!VALID_COMPONENT_NAMES.has(name as AddressTemplateComponent)) {
    throw new Error(`Unsupported address component "${name}" in template.`);
  }
  return name as AddressTemplateComponent;
}

function parseOptions(parts: readonly string[]): TemplateComponentOptions {
  const options: TemplateComponentOptions = {};

  for (const part of parts) {
    if (part === 'uppercase') {
      options.uppercase = true;
      continue;
    }
    if (part === 'multiline') {
      options.multiline = true;
      continue;
    }
    if (part === 'required') {
      options.required = true;
      continue;
    }

    const [rawKey, rawValue] = splitOption(part);
    if (!rawKey) {
      continue;
    }

    const value = rawValue ?? '';
    switch (rawKey) {
      case 'prefix':
        options.prefix = value;
        break;
      case 'suffix':
        options.suffix = value;
        break;
      case 'separator':
        options.separator = value;
        break;
      default:
        throw new Error(`Unknown template option "${rawKey}".`);
    }
  }

  return options;
}

function splitOption(input: string): [string, string | undefined] {
  const eqIndex = input.indexOf('=');
  if (eqIndex === -1) {
    return [input, undefined];
  }

  const key = input.slice(0, eqIndex).trim();
  const rawValue = input.slice(eqIndex + 1).trim();
  return [key, stripQuotes(rawValue)];
}

function stripQuotes(value: string): string {
  if (!value) {
    return '';
  }
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }
  return value;
}
