import { sanitizeSchema } from './sanitize-schema.js';

const retained = ['type', 'enum', 'const', 'default', 'required', 'minimum', 'maximum', 'minLength', 'maxLength', 'minItems', 'maxItems', 'pattern', 'format', 'additionalProperties'];
const jsonTypes = ['object', 'array', 'string', 'number', 'boolean', 'null'];
const words = name => name.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ');
const parameterDescriptions = {
  apply: 'Write on true; otherwise preview.', theme: 'Token theme.', options: 'Operation options.',
  preferences: 'Layout and appearance preferences.', schema: 'UiSchema.', report: 'Reconciliation report.',
  metadata: 'Mapping metadata.', object: 'Object filter.', context: 'Rendering-context filter.', mode: 'Full schema or patch mode.',
};
const shortDescription = (text, limit) => {
  if (text.length <= limit) return text;
  const scope = text.match(/Actions: .*$/)?.[0];
  const sentences = text.split(/(?<=[.!?])\s+/);
  const first = sentences[0].length <= limit ? sentences[0] : `${text.slice(0, limit - 20).replace(/\s+\S*$/, '')}…`;
  return `${first}${scope && !first.includes(scope) ? ` ${scope}` : ''} See full schema for details.`;
};

/** A discovery view only: the native AJV validator always receives the original full schema. */
export function advertisedSchema(schema, readExternalSchema = () => undefined) {
  const resolve = (ref, root) => {
    const [file, pointer = ''] = ref.split('#');
    const document = file ? readExternalSchema(file) : root;
    const target = pointer ? pointer.slice(1).split('/').reduce((node, key) => node?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], document) : document;
    return { target, document };
  };
  const types = (value, root, seen = new Set()) => {
    if (!value || typeof value !== 'object') return jsonTypes;
    if (value.type) return [value.type].flat();
    if (value.$ref) {
      if (seen.has(value)) return jsonTypes;
      const { target, document } = resolve(value.$ref, root);
      return types(target, document, new Set([...seen, value]));
    }
    const choices = value.oneOf ?? value.anyOf;
    if (choices) return [...new Set(choices.flatMap(choice => types(choice, root, seen)))];
    if (value.properties || value.additionalProperties) return ['object'];
    if (value.items) return ['array'];
    return jsonTypes;
  };
  const sanitized = sanitizeSchema(schema, true, true, ref => {
    const { target, document } = resolve(ref, schema);
    const inferred = types(target, document);
    return { type: inferred.length === 1 ? inferred[0] : inferred,
      description: target?.description ?? `Structured input; read the full schema (${ref}) for its contract.` };
  });
  function compact(value, name, depth) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const result = Object.fromEntries(retained.filter(key => key in value).map(key => [key, value[key]]));
    const alternatives = value.oneOf ?? value.anyOf;
    const variants = alternatives?.map(item => compact(item, name, depth));
    result.type ??= variants ? [...new Set(variants.flatMap(variant => variant.type ?? jsonTypes))]
      : value.properties || value.additionalProperties ? 'object' : value.items ? 'array' : jsonTypes;
    const meaning = depth === 0 ? parameterDescriptions[name] : undefined;
    const description = value.description?.trim();
    result.description = shortDescription(description?.startsWith('Actions:') && meaning ? `${meaning} ${description}`
      : description || meaning || `${words(name)}.`, depth === 0 ? 240 : 110);
    if (variants) {
      const fields = [...new Set(alternatives.flatMap(variant => Object.keys(variant.properties ?? {})))];
      if (fields.length) result.description += ` Variant fields: ${fields.join(', ')}. Read the full schema for each variant.`;
      // A union's individual constraints apply only to that variant, never to every caller.
      if (result.additionalProperties === false && fields.length) delete result.additionalProperties;
    }
    if (value.properties) {
      if (depth < 1) result.properties = Object.fromEntries(Object.entries(value.properties).map(([key, child]) => [key, compact(child, key, depth + 1)]));
      else {
        result.description += ` Fields: ${Object.keys(value.properties).join(', ')}. See full schema.`;
        // A summarized object cannot reject its undisclosed field names at discovery time.
        delete result.required;
        if (result.additionalProperties === false) result.additionalProperties = true;
      }
    }
    if (value.items) result.items = compact(value.items, `${name} item`, depth + 1);
    if (result.additionalProperties && typeof result.additionalProperties === 'object') {
      result.additionalProperties = compact(result.additionalProperties, `${name} entry`, depth + 1);
    }
    return result;
  }
  return {
    type: 'object',
    properties: Object.fromEntries(Object.entries(sanitized.properties ?? {}).map(([name, value]) => [name, compact(value, name, 0)])),
    ...(sanitized.required ? { required: sanitized.required } : {}),
    ...(sanitized.additionalProperties !== undefined ? { additionalProperties: sanitized.additionalProperties } : {}),
  };
}
