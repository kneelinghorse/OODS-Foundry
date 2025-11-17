import type { Address } from '@/schemas/address.js';

import {
  getTemplateByKey,
  getTemplateForAddress,
} from './format-templates.js';
import type {
  AddressFormatTemplate,
  AddressTemplateComponent,
  TemplateComponentToken,
  TemplateLine,
} from './template-parser.js';

export interface FormatAddressOptions {
  readonly locale?: string;
  readonly templateKey?: string;
  readonly includeCountry?: boolean;
}

export interface FormatAddressResult {
  readonly formatted: string;
  readonly lines: readonly string[];
  readonly template: AddressFormatTemplate;
  readonly components: Partial<Record<AddressTemplateComponent, string | string[]>>;
}

type ComponentValue = string | readonly string[] | undefined;
type ComponentValueMap = Partial<Record<AddressTemplateComponent, ComponentValue>>;

const displayNameCache = new Map<string, Intl.DisplayNames>();

/**
 * Format an Address value object using the registered UPU S42 template.
 */
export function formatAddress(address: Address, options: FormatAddressOptions = {}): FormatAddressResult {
  const template = resolveTemplate(address, options);
  const componentValues = buildComponentValues(address, options);
  const componentUsage = new Map<AddressTemplateComponent, string[]>();
  const lines: string[] = [];

  for (const line of template.lines) {
    const rendered = renderLine(line, componentValues, componentUsage);
    rendered.forEach((value) => {
      if (value.length > 0) {
        lines.push(value);
      }
    });
  }

  return {
    formatted: lines.join('\n'),
    lines,
    template,
    components: Object.fromEntries(componentUsage.entries()),
  };
}

function resolveTemplate(address: Address, options: FormatAddressOptions): AddressFormatTemplate {
  if (options.templateKey) {
    return getTemplateByKey(options.templateKey);
  }
  return getTemplateForAddress(address);
}

function buildComponentValues(
  address: Address,
  options: FormatAddressOptions
): ComponentValueMap {
  return {
    organizationName: address.organizationName,
    addressLines: address.addressLines,
    dependentLocality: address.dependentLocality,
    locality: address.locality,
    administrativeArea: address.administrativeArea,
    postalCode: address.postalCode,
    countryCode: address.countryCode,
    countryName: options.includeCountry === false ? undefined : getCountryDisplayName(address.countryCode, options.locale),
    formatTemplateKey: address.formatTemplateKey,
    languageCode: address.languageCode,
  };
}

function renderLine(
  line: TemplateLine,
  values: ComponentValueMap,
  usage: Map<AddressTemplateComponent, string[]>
): string[] {
  if (line.tokens.length === 0) {
    return [];
  }

  let outputs = [''];

  for (const token of line.tokens) {
    if (token.kind === 'literal') {
      outputs = outputs.map((value) => value + token.value);
      continue;
    }

    const resolved = resolveValue(token, values);
    if (!resolved) {
      if (token.options.required) {
        throw new Error(`Template requires component "${token.component}" but no value is available.`);
      }
      continue;
    }

    const rendered = Array.isArray(resolved.value) ? resolved.value : [resolved.value];
    const nextOutputs: string[] = [];

    for (const existing of outputs) {
      if (resolved.multiline && rendered.length > 1) {
        rendered.forEach((entry) => {
          const formatted = applyOptions(entry, token);
          recordUsage(usage, token.component, formatted);
          nextOutputs.push(normalizeLine(existing + formatted));
        });
      } else {
        const content = rendered.join(resolved.separator ?? '');
        const formatted = applyOptions(content, token);
        recordUsage(usage, token.component, formatted);
        nextOutputs.push(existing + formatted);
      }
    }

    outputs = nextOutputs;
  }

  return outputs
    .map((value) => normalizeLine(value).trim())
    .filter((value) => value.length > 0);
}

interface ResolvedValue {
  readonly value: string | readonly string[];
  readonly multiline: boolean;
  readonly separator?: string;
}

function resolveValue(
  token: TemplateComponentToken,
  values: ComponentValueMap
): ResolvedValue | null {
  const raw = values[token.component];
  if (raw === undefined || raw === null) {
    return null;
  }

  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      return null;
    }
    return {
      value: raw,
      multiline: token.options.multiline ?? token.component === 'addressLines',
      separator: token.options.separator ?? ', ',
    };
  }

  const trimmed = String(raw).trim();
  if (trimmed.length === 0) {
    return null;
  }

  return {
    value: trimmed,
    multiline: false,
  };
}

function applyOptions(value: string, token: TemplateComponentToken): string {
  let result = value;
  if (token.options.uppercase) {
    result = result.toUpperCase();
  }
  if (token.options.prefix) {
    result = token.options.prefix + result;
  }
  if (token.options.suffix) {
    result = result + token.options.suffix;
  }
  return result;
}

function recordUsage(
  usage: Map<AddressTemplateComponent, string[]>,
  component: AddressTemplateComponent,
  value: string
): void {
  if (!value) {
    return;
  }
  const existing = usage.get(component) ?? [];
  existing.push(value);
  usage.set(component, existing);
}

function normalizeLine(value: string): string {
  return value.replace(/\t+/g, ' ').replace(/\s+$/u, '');
}

function getCountryDisplayName(countryCode: string, locale?: string): string {
  if (typeof Intl.DisplayNames === 'undefined') {
    return countryCode;
  }
  const lang = locale ?? 'en';
  const cacheKey = lang.toLowerCase();
  let formatter = displayNameCache.get(cacheKey);
  if (!formatter) {
    try {
      formatter = new Intl.DisplayNames([lang], { type: 'region' });
    } catch {
      formatter = new Intl.DisplayNames(['en'], { type: 'region' });
    }
    displayNameCache.set(cacheKey, formatter);
  }
  return formatter.of(countryCode) ?? countryCode;
}
