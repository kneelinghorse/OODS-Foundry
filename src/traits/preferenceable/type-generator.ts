import { compile, type JSONSchema } from 'json-schema-to-typescript';

import { resolvePreferenceSchema } from './schema-registry.js';

export interface GeneratePreferenceTypesOptions {
  readonly version?: string;
  readonly interfaceName?: string;
  readonly bannerComment?: string;
}

const typeCache = new Map<string, Promise<string>>();

export function resetPreferenceTypeCache(): void {
  typeCache.clear();
}

export async function generatePreferenceTypes(
  options: GeneratePreferenceTypesOptions = {}
): Promise<string> {
  const definition = resolvePreferenceSchema(options.version);
  const interfaceName =
    options.interfaceName ?? `PreferenceDocumentV${definition.version.replaceAll('.', '_')}`;
  const cacheKey = `${definition.version}:${interfaceName}`;

  let pending = typeCache.get(cacheKey);
  if (!pending) {
    const schemaClone = structuredClone(definition.schema) as JSONSchema;
    pending = compile(schemaClone, interfaceName, {
      bannerComment: options.bannerComment ?? '',
      additionalProperties: false,
      style: {
        singleQuote: true,
        semi: true,
      },
    });
    typeCache.set(cacheKey, pending);
  }

  return pending;
}
