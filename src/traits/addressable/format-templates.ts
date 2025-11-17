import rawTemplates from '~/data/upu-s42-templates.json';

import type { Address } from '@/schemas/address.js';

import {
  type AddressFormatTemplate,
  type RawTemplateDefinition,
  parseTemplateDefinition,
} from './template-parser.js';

type TemplateKey = string;

const templateByKey = new Map<TemplateKey, AddressFormatTemplate>();
const templateByCountry = new Map<string, AddressFormatTemplate>();

initializeRegistry(rawTemplates as RawTemplateDefinition[]);

function initializeRegistry(definitions: RawTemplateDefinition[]): void {
  definitions.forEach((definition) => {
    const template = parseTemplateDefinition(definition);
    templateByKey.set(template.key, template);
    registerAlias(template.key, template);
    registerAlias(template.countryCode, template);
    template.aliases.forEach((alias) => registerAlias(alias, template));
    templateByCountry.set(template.countryCode, template);
  });
}

function registerAlias(alias: string, template: AddressFormatTemplate): void {
  if (!alias) {
    return;
  }
  const normalized = alias.toUpperCase();
  if (!templateByKey.has(normalized)) {
    templateByKey.set(normalized, template);
  }
}

export function listTemplates(): AddressFormatTemplate[] {
  return Array.from(new Set(templateByKey.values()));
}

export function getTemplateByKey(key: string): AddressFormatTemplate {
  const template = templateByKey.get(key) ?? templateByKey.get(key.toUpperCase());
  if (!template) {
    throw new Error(`No format template registered for key "${key}".`);
  }
  return template;
}

export function tryGetTemplate(key?: string | null): AddressFormatTemplate | undefined {
  if (!key) {
    return undefined;
  }
  return templateByKey.get(key) ?? templateByKey.get(key.toUpperCase());
}

export function getTemplateForAddress(address: Address): AddressFormatTemplate {
  const candidates = [
    address.formatTemplateKey,
    address.countryCode,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const template = tryGetTemplate(candidate);
    if (template) {
      return template;
    }
  }

  const fallback = templateByCountry.get(address.countryCode);
  if (fallback) {
    return fallback;
  }

  throw new Error(
    `Unable to resolve template for address country "${address.countryCode}". Provide formatTemplateKey.`
  );
}
