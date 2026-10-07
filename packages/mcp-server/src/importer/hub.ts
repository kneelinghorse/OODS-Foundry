import fs from 'node:fs';
import Ajv2020Import from 'ajv/dist/2020.js';
import { Sources, ImportProblem, canonical, escapePointer, hash, isMap, walk, type MapValue, type Origin, type SourceInput } from './source.js';

export type Outcome = 'mapped' | 'proposed' | 'unmapped';
export type ReportEntry = Origin & { kind: 'schema' | 'property' | 'variant' | 'enum' | 'link' | 'keyword'; outcome: Outcome; reason: string; object?: string };
export type Hub = { $schema: string; $defs: Record<string, MapValue>; 'x-oods': { version: 1; sources: Array<{ file: string; bytes: number; sha256: string }>; provenance: Record<string, Origin>; sourceNames: Record<string, string> } };
export type Normalized = { hub: Hub; report: ReportEntry[]; contentHash: string };
const DIALECT = 'https://json-schema.org/draft/2020-12/schema';
const ajv = new (Ajv2020Import as any)({ strict: false, allErrors: true, validateFormats: false });
// Deliberately separate from tool-contract Ajv: source vocabulary cannot alter tool validation.
ajv.addVocabulary([{ keyword: 'x-oods', schemaType: 'object', valid: true }]);
// A dist-only server must still answer degraded health without optional authoring data.
// Load the shipped hub contract when importing, just as trait parameter schemas are loaded on use.
let hubContract: ReturnType<typeof ajv.compile> | undefined;
export const validateHubSchema = (schema: MapValue) => {
  hubContract ??= ajv.compile(JSON.parse(fs.readFileSync(new URL('../../../../schemas/import/object-hub.schema.json', import.meta.url), 'utf8')));
  return ajv.validateSchema(schema) && hubContract(schema);
};
const identity = (origin: Origin) => `${origin.file}#${origin.pointer}`;
export const pascalName = (name: string) => {
  const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean);
  const joined = words.map(word => word[0]!.toUpperCase() + word.slice(1)).join('') || 'Imported';
  const safe = /^[A-Za-z]/.test(joined) ? joined : `Imported${joined}`;
  return safe.length > 96 ? `${safe.slice(0, 80)}${hash(name).slice(0, 12)}` : safe;
};
const schemaMaps = new Set(['properties', 'patternProperties', '$defs', 'definitions', 'dependentSchemas']);
const schemaSingles = new Set(['items', 'additionalProperties', 'additionalItems', 'contains', 'not', 'if', 'then', 'else', 'propertyNames', 'unevaluatedProperties', 'unevaluatedItems']);
const schemaArrays = new Set(['allOf', 'oneOf', 'anyOf', 'prefixItems']);

export function normalizeSource(input: SourceInput): Normalized {
  const sources = new Sources(input);
  const schemas = new Map<string, { origin: Origin; value: MapValue; sourceName: string }>();
  const report = new Map<string, ReportEntry>();
  const addReport = (entry: ReportEntry) => { report.set(`${identity(entry)}:${entry.kind}`, entry); };
  const addSchema = (value: unknown, origin: Origin, sourceName: string) => {
    if (!isMap(value)) return;
    schemas.set(identity(origin), { origin, value, sourceName });
  };
  // Broken local pointers in public specs are named in the report, never guessed. Security failures still abort.
  const resolve = (reference: string, origin: Origin) => {
    try { return sources.ref(reference, origin); }
    catch (error) {
      if (!(error instanceof ImportProblem) || error.code !== 'unresolved') throw error;
      addReport({ ...origin, kind: 'link', outcome: 'unmapped', reason: error.message });
      return undefined;
    }
  };
  const scanned = new Set<string>();
  // Referenced files discovered by traversal join this insertion-ordered work queue once.
  for (const [file, doc] of sources.documents) {
    if (scanned.has(file)) continue;
    scanned.add(file);
    const value = doc.value;
    const isApi = value.openapi !== undefined || value.swagger !== undefined;
    if (isApi && value.swagger !== '2.0' && !/^3\.[012]\.\d+$/.test(value.openapi ?? '')) throw new ImportProblem('schema', 'Supported OpenAPI versions are 2.0 and 3.0–3.2.', { file, pointer: '/openapi' });
    if (!isApi && value.$schema !== undefined && !/\/draft(?:\/2020-12|[-\/]07)\/schema#?$/.test(value.$schema)) throw new ImportProblem('schema', `Unsupported JSON Schema dialect: ${value.$schema}`, { file, pointer: '/$schema' });
    if (!isApi && (value.properties || value.allOf || value.$ref || value.oneOf || value.anyOf || value.type)) addSchema(value, { file, pointer: '' }, value.title || file.replace(/\.(json|ya?ml)$/i, ''));
    const definitions = isApi ? (value.swagger ? value.definitions : value.components?.schemas) : (value.$defs ?? value.definitions);
    const prefix = isApi ? (value.swagger ? '/definitions' : '/components/schemas') : (value.$defs ? '/$defs' : '/definitions');
    if (isMap(definitions)) for (const name of Object.keys(definitions).sort()) addSchema(definitions[name], { file, pointer: `${prefix}/${escapePointer(name)}` }, name);
    walk(value, (node, pointer) => {
      if (!isMap(node) || pointer.split('/').some(part => part.startsWith('x-') || part === 'examples' || part === 'example')) return;
      if (/\/links\/[^/]+$/.test(pointer)) addReport({ file, pointer, kind: 'link', outcome: 'unmapped', reason: 'API operation link retained in source; not a record relationship.' });
      if (isApi && /^\/paths\/[^/]+$/.test(pointer)) addReport({ file, pointer, kind: 'keyword', outcome: 'unmapped', reason: 'API operations and transport metadata do not become executable application actions. Nested schemas have separate outcomes.' });
      if (typeof node.$ref === 'string') {
        const origin = { file, pointer: `${pointer}/$ref` };
        const resolved = resolve(node.$ref, origin);
        // References to schema nodes are promoted below, after all named roots have been collected.
        if (!resolved) return;
        addReport({ ...origin, kind: 'link', outcome: 'unmapped', reason: 'Reference retained; not yet projected as an object relationship.' });
        if (!isMap(resolved.value) && typeof resolved.value !== 'boolean') throw new ImportProblem('reference', 'A reference must resolve to a mapping or boolean schema.', origin);
      }
      if (isApi && /^(?:\/paths\/|\/components\/(?:parameters|responses|requestBodies|headers)\/)/.test(pointer) && isMap(node.schema)) {
        const at = `${pointer}/schema`;
        addSchema(node.schema, { file, pointer: at }, `Operation${hash(at).slice(0, 10)}`);
      }
    });
    for (const key of Object.keys(value).sort()) {
      if (isApi && !['definitions', 'components', 'paths'].includes(key)) addReport({ file, pointer: `/${escapePointer(key)}`, kind: 'keyword', outcome: 'unmapped', reason: 'API metadata/transport configuration has no object projection; source subtree retained in the input.' });
    }
  }
  if (!schemas.size) throw new ImportProblem('schema', 'No named or root schemas were found.');

  // Find references and nested named definitions in schema positions, not inside examples or arbitrary annotations.
  const discover = (schema: unknown, origin: Origin) => {
    if (!isMap(schema)) return;
    if (typeof schema.$ref === 'string') {
      const target = resolve(schema.$ref, { ...origin, pointer: `${origin.pointer}/$ref` });
      if (target && isMap(target.value) && !schemas.has(identity(target.origin))) addSchema(target.value, target.origin, target.value.title || target.origin.pointer.split('/').pop() || target.origin.file.replace(/\.(json|ya?ml)$/i, ''));
    }
    for (const [key, child] of Object.entries(schema)) {
      const at = { file: origin.file, pointer: `${origin.pointer}/${escapePointer(key)}` };
      if (schemaMaps.has(key) && isMap(child)) for (const name of Object.keys(child).sort()) {
        const place = { file: at.file, pointer: `${at.pointer}/${escapePointer(name)}` };
        if (key === '$defs' || key === 'definitions') addSchema(child[name], place, name);
        discover(child[name], place);
      }
      else if (schemaSingles.has(key) && !Array.isArray(child)) discover(child, at);
      else if ((schemaArrays.has(key) || key === 'items') && Array.isArray(child)) child.forEach((item, i) => discover(item, { file: at.file, pointer: `${at.pointer}/${i}` }));
    }
  };
  for (const schema of schemas.values()) discover(schema.value, schema.origin);
  const names = new Map<string, string>();
  const used = new Set<string>();
  for (const [key, schema] of [...schemas.entries()].sort(([a], [b]) => a < b ? -1 : 1)) {
    const base = pascalName(schema.sourceName);
    let name = base;
    if (used.has(name)) name += hash(key).slice(0, 10);
    used.add(name); names.set(key, name);
  }
  const hub: Hub = { $schema: DIALECT, $defs: {}, 'x-oods': { version: 1, sources: [...sources.documents.values()].map(({ file, bytes, sha256 }) => ({ file, bytes, sha256 })).sort((a, b) => a.file < b.file ? -1 : 1), provenance: {}, sourceNames: {} } };
  const provenance = hub['x-oods'].provenance;
  const copy = (value: unknown, origin: Origin, destination: string): any => {
    // Copy JSON data without prototype setters and bind every value to its source location.
    provenance[destination] = origin;
    if (Array.isArray(value)) return value.map((entry, i) => copy(entry, { file: origin.file, pointer: `${origin.pointer}/${i}` }, `${destination}/${i}`));
    if (isMap(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, copy(value[key], { file: origin.file, pointer: `${origin.pointer}/${escapePointer(key)}` }, `${destination}/${escapePointer(key)}`)]));
    return value;
  };
  const normalize = (value: unknown, origin: Origin, destination: string, owner: string): any => {
    provenance[destination] = origin;
    if (!isMap(value)) return copy(value, origin, destination);
    const result: MapValue = {};
    for (const key of Object.keys(value).sort()) {
      const child = value[key];
      const at = { file: origin.file, pointer: `${origin.pointer}/${escapePointer(key)}` };
      const dest = `${destination}/${escapePointer(key)}`;
      const entry: ReportEntry = { ...at, object: owner, kind: key === '$ref' ? 'link' : 'keyword', outcome: 'unmapped', reason: 'Preserved in the hub; not enforced by the object field contract.' };
      if (key === '$schema' || key === '$id' || key === 'id') { entry.reason = 'Source identifier/dialect kept in provenance; hub uses 2020-12 and local references.'; addReport(entry); continue; }
      if (key === 'nullable' || key === 'x-nullable') { addReport({ ...entry, outcome: 'mapped', reason: 'Converted to a JSON Schema null union.' }); continue; }
      if (key === '$ref' && typeof child === 'string') {
        const target = resolve(child, at);
        if (!target) { result['x-oods-unresolved-ref'] = child; provenance[`${destination}/x-oods-unresolved-ref`] = at; continue; }
        const name = names.get(identity(target.origin));
        if (!name) throw new ImportProblem('reference', 'Referenced schema has no hub identity.', at);
        result.$ref = `#/$defs/${name}`; provenance[dest] = at;
        entry.reason = 'Preserved as a local hub reference; draft projection decides whether it is a relationship.';
      } else if (schemaMaps.has(key) && isMap(child)) {
        const targetKey = key === 'definitions' ? '$defs' : key;
        result[targetKey] = Object.fromEntries(Object.keys(child).sort().map(name => {
          const place = { file: origin.file, pointer: `${at.pointer}/${escapePointer(name)}` };
          if (key === 'properties') addReport({ ...place, object: owner, kind: 'property', outcome: 'unmapped', reason: 'Preserved in the hub; no field projected yet.' });
          return [name, normalize(child[name], place, `${destination}/${targetKey}/${escapePointer(name)}`, owner)];
        }));
        provenance[`${destination}/${targetKey}`] = at;
      } else if (schemaSingles.has(key) && !Array.isArray(child)) result[key] = normalize(child, at, dest, owner);
      else if (schemaArrays.has(key) && Array.isArray(child)) {
        result[key] = child.map((item, i) => {
          const place = { file: at.file, pointer: `${at.pointer}/${i}` };
          if (key === 'oneOf' || key === 'anyOf') addReport({ ...place, object: owner, kind: 'variant', outcome: 'unmapped', reason: `${key} alternative retained separately; variants are never silently merged.` });
          return normalize(item, place, `${dest}/${i}`, owner);
        });
        provenance[dest] = at;
      } else if (key === 'items' && Array.isArray(child)) {
        result.prefixItems = child.map((item, i) => normalize(item, { file: at.file, pointer: `${at.pointer}/${i}` }, `${destination}/prefixItems/${i}`, owner));
        if (value.additionalItems !== undefined) result.items = normalize(value.additionalItems, { file: at.file, pointer: `${origin.pointer}/additionalItems` }, `${destination}/items`, owner);
        entry.reason = 'Draft-07 tuple converted to prefixItems; tuple projection is not supported.';
      } else if ((key === 'exclusiveMinimum' || key === 'exclusiveMaximum') && typeof child === 'boolean') {
        const inclusive = key === 'exclusiveMinimum' ? 'minimum' : 'maximum';
        if (child === true && typeof value[inclusive] === 'number') { result[key] = value[inclusive]; provenance[dest] = at; }
        entry.reason = 'Boolean exclusive bound upgraded to the 2020-12 numeric bound.';
      } else if ((key === 'minimum' && value.exclusiveMinimum === true) || (key === 'maximum' && value.exclusiveMaximum === true) || (key === 'additionalItems' && Array.isArray(value.items))) continue;
      else Object.defineProperty(result, key, { value: copy(child, at, dest), enumerable: true, writable: true, configurable: true });
      if (key === 'enum' && Array.isArray(child)) child.forEach((_item, i) => addReport({ file: at.file, pointer: `${at.pointer}/${i}`, object: owner, kind: 'enum', outcome: 'unmapped', reason: 'Enum member retained; field projection determines whether it is used.' }));
      addReport(entry);
    }
    if (value.nullable === true || value['x-nullable'] === true) {
      if (result.type) result.type = [...new Set([...(Array.isArray(result.type) ? result.type : [result.type]), 'null'])];
      else { const original = { ...result }; for (const key of Object.keys(result)) delete result[key]; result.anyOf = [original, { type: 'null' }]; }
      if (Array.isArray(result.enum) && !result.enum.includes(null)) result.enum.push(null);
    }
    if (typeof value.discriminator === 'string') result.discriminator = { propertyName: value.discriminator };
    return result;
  };
  for (const [key, schema] of [...schemas.entries()].sort(([a], [b]) => names.get(a)! < names.get(b)! ? -1 : 1)) {
    const name = names.get(key)!;
    hub.$defs[name] = normalize(schema.value, schema.origin, `/$defs/${name}`, name);
    hub['x-oods'].sourceNames[name] = schema.sourceName;
    addReport({ ...schema.origin, object: name, kind: 'schema', outcome: 'unmapped', reason: 'Schema retained in the hub; draft projection pending.' });
  }
  for (const name of Object.keys(hub.$defs)) walk(hub.$defs[name], (_value, pointer) => {
    if (!provenance[pointer]) provenance[pointer] = provenance[pointer.slice(0, pointer.lastIndexOf('/'))] ?? provenance[`/$defs/${name}`];
  }, `/$defs/${name}`);
  if (!validateHubSchema(hub)) throw new ImportProblem('schema', `Invalid x-oods hub annotation: ${ajv.errorsText(hubContract.errors ?? ajv.errors)}`);
  return { hub, report: [...report.values()].sort((a, b) => `${identity(a)}:${a.kind}` < `${identity(b)}:${b.kind}` ? -1 : 1), contentHash: `sha256:${hash(canonical(hub['x-oods'].sources))}` };
}
