/**
 * Sanitizes JSON Schema for MCP client compatibility.
 *
 * Claude's API (and other strict MCP clients) reject schemas containing
 * top-level allOf/oneOf/anyOf. The native server validates with AJV anyway —
 * adapter schemas are for agent discovery only.
 *
 * Transforms applied:
 * 1. Strip top-level allOf, oneOf, anyOf
 * 2. Flatten nested oneOf/anyOf to their first variant
 * 3. Remove $schema, $id, title meta-keywords (not part of MCP input_schema)
 * 4. Replace $ref with { type: "object" } stub (clients can't resolve local refs)
 * 5. Infer a primitive `type` when `enum`/`const` is present without one
 *    (strict providers, e.g. Moonshot, reject typeless enum/const schemas)
 * 6. Before step 1, lift the per-action arguments of an action dispatcher (a top-level allOf of
 *    `if: { properties: { action: { const } } }` / `then` branches: repl, schema, object, map) into the
 *    flat properties. Stripping the branches alone listed only `action` (s211-m01). Each lifted
 *    argument's description names the actions it applies to and those that require it; `action`
 *    stays the only required field, and the server's AJV still enforces every per-action rule.
 */

const META_KEYWORDS = new Set(['$schema', '$id', 'title']);
const COMPOSITION_KEYWORDS = new Set(['allOf', 'oneOf', 'anyOf']);

const actionOf = branch => {
  const action = branch?.if?.properties?.action?.const;
  return typeof action === 'string' && branch.then && typeof branch.then === 'object' ? action : undefined;
};
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const withoutDescription = ({ description, ...rest }) => rest;
const sentence = text => { const trimmed = (text ?? '').trim(); return !trimmed || /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`; };
const named = actions => actions.length < 3 ? actions.join(' and ') : `${actions.slice(0, -1).join(', ')} and ${actions.at(-1)}`;
const REF_STUB = '(complex schema — see server docs)';

/** One definition for an argument several actions declare: identical shapes keep theirs; object shapes take the union of their fields. */
function mergedShape(uses) {
  const shapes = uses.map(use => withoutDescription(use.definition));
  if (shapes.every(shape => canonical(shape) === canonical(shapes[0]))) return shapes[0];
  if (!shapes.every(shape => shape.properties && typeof shape.properties === 'object')) return shapes[0];
  const properties = {};
  for (const shape of shapes) {
    for (const [name, definition] of Object.entries(shape.properties)) {
      if (name in properties) continue;
      const actions = uses.filter((_, index) => name in shapes[index].properties).map(use => use.action);
      properties[name] = actions.length === uses.length ? definition
        : { ...definition, description: [sentence(definition.description), `Only for ${named(actions)}.`].filter(Boolean).join(' ') };
    }
  }
  return { ...shapes[0], properties };
}

/**
 * What a lifted argument means, then which actions take it. Actions whose branch says nothing share the one
 * description the others give; a text that only shortens another (schema's `name` for load) folds into it.
 */
function mergedArgument(uses, preserveReferences = false) {
  const texts = [...new Set(uses.map(use => sentence(use.definition.description)).filter(Boolean))];
  const fuller = text => texts.find(other => other !== text && other.startsWith(text.replace(/\.$/, ''))) ?? text;
  const groups = new Map();
  for (const use of uses) {
    const text = sentence(use.definition.description);
    if (text) groups.set(fuller(text), [...(groups.get(fuller(text)) ?? []), use.action]);
  }
  const meaning = groups.size === 1 ? [...groups.keys()] : [...groups].map(([text, actions]) => `For ${named(actions)}: ${text}`);
  const scope = `Actions: ${uses.map(use => use.required ? `${use.action} (required)` : use.action).join(', ')}.`;
  const shape = mergedShape(uses);
  // The recursive pass replaces a $ref wholesale, which would drop the scope; stub it here instead.
  if ('$ref' in shape && !preserveReferences) return { type: 'object', description: [...meaning, REF_STUB, scope].join(' ') };
  return { ...shape, description: [...meaning, scope].join(' ') };
}

/** Discover action arguments through schema composition, without lifting fields inside argument objects. */
function actionArguments(root, body) {
  const properties = {};
  const required = new Set();
  function visit(schema, conditional = false, references = new Set()) {
    if (!schema || typeof schema !== 'object') return;
    if (typeof schema.$ref === 'string' && schema.$ref.startsWith('#/') && !references.has(schema.$ref)) {
      const target = schema.$ref.slice(2).split('/').reduce((node, key) => node?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], root);
      visit(target, conditional, new Set([...references, schema.$ref]));
    }
    for (const [name, definition] of Object.entries(schema.properties ?? {})) {
      // Preserve the first declared shape, filling in constraints/defaults supplied by an allOf sibling.
      properties[name] = { ...definition, ...properties[name] };
    }
    if (!conditional) for (const name of schema.required ?? []) required.add(name);
    for (const branch of schema.allOf ?? []) visit(branch, conditional, references);
    // Conditional and alternative inputs belong in the union, but cannot be called required for the action.
    for (const branch of [...(schema.oneOf ?? []), ...(schema.anyOf ?? []), schema.then, schema.else]) visit(branch, true, references);
  }
  visit(body);
  return { properties, required };
}

function liftActionArguments(schema, preserveReferences = false) {
  const branches = Array.isArray(schema.allOf) ? schema.allOf.filter(branch => actionOf(branch) !== undefined) : [];
  if (branches.length === 0) return schema;
  const uses = new Map();
  for (const branch of branches) {
    const action = actionOf(branch);
    const { properties, required } = actionArguments(schema, branch.then);
    for (const [name, definition] of Object.entries(properties)) {
      if (name in (schema.properties ?? {})) continue;
      uses.set(name, [...(uses.get(name) ?? []), { action, definition, required: required.has(name) }]);
    }
  }
  const lifted = Object.fromEntries([...uses].map(([name, entries]) => [name, mergedArgument(entries, preserveReferences)]));
  return { ...schema, properties: { ...schema.properties, ...lifted } };
}

// The compact advertiser retains alternatives and supplies reference types before summarizing them;
// existing callers keep the historical client-compatible flattening behavior by default.
export function sanitizeSchema(schema, isRoot = true, preserveAlternatives = false, resolveReference) {
  if (schema === null || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(item => sanitizeSchema(item, false, preserveAlternatives, resolveReference));

  // Replace $ref with a generic object stub
  if ('$ref' in schema) {
    return resolveReference ? { ...resolveReference(schema.$ref), ...(schema.description ? { description: schema.description } : {}) }
      : { type: 'object', description: REF_STUB };
  }

  if (isRoot) schema = liftActionArguments(schema, Boolean(resolveReference));

  const out = {};

  for (const [key, value] of Object.entries(schema)) {
    // Strip top-level meta-keywords
    if (isRoot && META_KEYWORDS.has(key)) {
      continue;
    }

    // Strip top-level composition keywords (allOf/oneOf/anyOf)
    if (isRoot && COMPOSITION_KEYWORDS.has(key)) {
      continue;
    }

    // Flatten nested oneOf/anyOf to first variant
    if (!preserveAlternatives && !isRoot && (key === 'oneOf' || key === 'anyOf') && Array.isArray(value) && value.length > 0) {
      const firstVariant = sanitizeSchema(value[0], false, preserveAlternatives, resolveReference);
      if (typeof firstVariant === 'object' && firstVariant !== null && !Array.isArray(firstVariant)) {
        Object.assign(out, firstVariant);
      }
      continue;
    }

    out[key] = sanitizeSchema(value, false, preserveAlternatives, resolveReference);
  }

  // Infer a primitive type for typeless enum/const schemas.
  if (!('type' in out)) {
    const jsonType = (v) =>
      v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'object' ? 'object' : typeof v;
    if ('const' in out) {
      out.type = jsonType(out.const);
    } else if (Array.isArray(out.enum) && out.enum.length > 0) {
      const types = [...new Set(out.enum.map(jsonType))];
      out.type = types.length === 1 ? types[0] : types;
    }
  }

  return out;
}
