/** Codex's compact normalized JSON budget, before it strips parameter descriptions. */
export function normalizedSchema(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(normalizedSchema);
  const retained = new Set(['$ref', 'type', 'description', 'enum', 'items', 'minItems', 'properties', 'required', 'additionalProperties', 'anyOf', 'oneOf', 'allOf', '$defs', 'definitions']);
  const result = {};
  for (const [key, value] of Object.entries(schema)) {
    if (!retained.has(key)) continue;
    result[key] = ['properties', '$defs', 'definitions'].includes(key)
      ? Object.fromEntries(Object.entries(value).map(([name, child]) => [name, normalizedSchema(child)]))
      : ['items', 'additionalProperties', 'anyOf', 'oneOf', 'allOf'].includes(key) ? normalizedSchema(value) : value;
  }
  if ('const' in schema) result.enum = [schema.const];
  if (result.type === 'array' && !result.items) result.items = { type: 'string' };
  if (result.type === 'object' && !result.properties) result.properties = {};
  return result;
}
export const schemaBytes = schema => Buffer.byteLength(JSON.stringify(normalizedSchema(schema)), 'utf8');
