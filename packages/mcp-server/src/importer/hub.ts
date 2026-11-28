import { readOdata } from './readers/odata.js';
import { readGraphql } from './readers/graphql.js';
import { readPrisma } from './readers/prisma.js';
import { readDbt } from './readers/dbt.js';
import { readSql } from './readers/sql.js';
import type { UnreadTable } from './readers/types.js';
import fs from 'node:fs';
import Ajv2020Import from 'ajv/dist/2020.js';
import { Sources, ImportProblem, canonical, escapePointer, hash, isMap, walk, wrappedReference, type MapValue, type Origin, type SourceInput } from './source.js';

export type Outcome = 'mapped' | 'proposed' | 'unmapped';
export type ReportEntry = Origin & { kind: 'schema' | 'property' | 'variant' | 'enum' | 'link' | 'keyword'; outcome: Outcome; reason: string; object?: string };
export type Hub = { $schema: string; $defs: Record<string, MapValue>; 'x-oods': { version: 1; sources: Array<{ file: string; bytes: number; sha256: string }>; provenance: Record<string, Origin>; sourceNames: Record<string, string> } };
export type Normalized = { hub: Hub; report: ReportEntry[]; contentHash: string; unread?: UnreadTable[] };
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
/** s255-m01 (G1): what two inline records may differ in and still be one record: their words, not their shape. */
const DOCUMENTATION = new Set(['title', 'description', 'example', 'examples', '$comment', 'externalDocs']);
const shapeOf = (value: unknown): unknown => Array.isArray(value) ? value.map(shapeOf)
  : isMap(value) ? Object.fromEntries(Object.keys(value).sort().filter(key => !DOCUMENTATION.has(key)).map(key => [key, shapeOf(value[key])])) : value;
const METHODS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace', 'query']);
/**
 * s255-m01 (G1): an inline schema in an API operation is named by its title or, failing that, by where it sits: the method,
 * the path and its role there (the response, with its status unless it succeeds; the request; a parameter or a header by
 * its name), as in "GET /v1/memories/{memory_id}/ response". Before, it was named Operation and a hash of its pointer.
 * Its media type is returned apart, to tell two schemas of one place apart, and the draft's name reads the method as a
 * word (GetV1MemoriesMemoryIdResponse).
 */
function operationName(node: MapValue, pointer: string): { name: string; nameAs?: string; media: string } {
  const parts = pointer.split('/').slice(1).map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'));
  const content = parts.indexOf('content'), media = content >= 0 ? parts[content + 1] ?? '' : '';
  if (typeof node.schema?.title === 'string' && node.schema.title.trim()) return { name: node.schema.title, media };
  const words: string[] = [];
  let rest: string[];
  if (parts[0] === 'paths') {
    rest = parts.slice(2);
    if (METHODS.has(rest[0])) { words.push(rest[0].toUpperCase()); rest = rest.slice(1); }
    words.push(parts[1]);
  } else {
    words.push(parts[2], { parameters: 'parameter', responses: 'response', requestBodies: 'request', headers: 'header' }[parts[1]] ?? parts[1]);
    rest = parts.slice(3);
  }
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === 'responses') { const status = rest[++i]; words.push('response', ...(/^2\d\d$/.test(status) ? [] : [status])); }
    else if (rest[i] === 'requestBody') words.push('request');
    else if (rest[i] === 'parameters') { i++; words.push(typeof node.name === 'string' ? node.name : `parameter ${rest[i]}`, 'parameter'); }
    else if (rest[i] === 'headers') words.push(rest[++i], 'header');
    else if (rest[i] === 'content') i++;
  }
  return { name: words.join(' '), nameAs: parts[0] === 'paths' && METHODS.has(parts[2]) ? [words[0].toLowerCase(), ...words.slice(1)].join(' ') : undefined, media };
}
const schemaMaps = new Set(['properties', 'patternProperties', '$defs', 'definitions', 'dependentSchemas']);
const schemaSingles = new Set(['items', 'additionalProperties', 'additionalItems', 'contains', 'not', 'if', 'then', 'else', 'propertyNames', 'unevaluatedProperties', 'unevaluatedItems']);
const schemaArrays = new Set(['allOf', 'oneOf', 'anyOf', 'prefixItems']);

export function normalizeSource(input: SourceInput): Normalized {
  const sources = new Sources(input);
  const documents = [...sources.documents.values()];
  const format = input.format ?? (documents.some(doc => /\.(xml|edmx)$/i.test(doc.file) || doc.value.$Version) ? 'odata'
    : documents.some(doc => /\.(graphql|gql)$/i.test(doc.file) || doc.value.__schema || doc.value.data?.__schema) ? 'graphql' : documents.some(doc => /\.prisma$/i.test(doc.file)) ? 'prisma'
    : documents.some(doc => /(?:^|\/)dbt_project\.ya?ml$/.test(doc.file) || doc.value.metadata?.dbt_schema_version || Array.isArray(doc.value.models) || Array.isArray(doc.value.snapshots) || Array.isArray(doc.value.semantic_models)) ? 'dbt'
      : documents.some(doc => /\.sql$/i.test(doc.file)) ? 'sql' : undefined);
  const projection = format === 'odata' ? readOdata(documents) : format === 'graphql' ? readGraphql(documents) : format === 'sql' ? readSql(documents) : format === 'prisma' ? readPrisma(documents) : format === 'dbt' ? readDbt(documents) : undefined;
  if (projection) {
    for (const doc of sources.documents.values()) doc.value = {};
    sources.documents.values().next().value!.value = projection.value;
  }
  const schemas = new Map<string, { origin: Origin; value: MapValue; sourceName: string; media?: string; nameAs?: string }>();
  // G1: an inline record read once, by file and shape; each later one of the same shape is reported as drafted once.
  const inlineShapes = new Map<string, string>(), sameShape: Array<{ origin: Origin; first: string }> = [], references: Array<{ origin: Origin; target: string }> = [];
  const report = new Map<string, ReportEntry>();
  const addReport = (entry: ReportEntry) => { report.set(`${identity(entry)}:${entry.kind}`, entry); };
  const addSchema = (value: unknown, origin: Origin, sourceName: string, inline?: { media: string; nameAs?: string }) => {
    if (!isMap(value)) return;
    schemas.set(identity(origin), { origin, value, sourceName, ...inline });
  };
  // Unreachable references are named and skipped. Containment violations still abort before any read.
  const resolve = (reference: string, origin: Origin) => {
    try { return sources.ref(reference, origin); }
    catch (error) {
      if (!(error instanceof ImportProblem) || !['unresolved', 'reference'].includes(error.code)) throw error;
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
        const at = `${pointer}/schema`, shape = isMap(node.schema.properties) ? `${file}\n${canonical(shapeOf(node.schema))}` : undefined;
        // G1: a schema that is only a reference to a named schema is that record, drafted once under its own name.
        const reference = typeof node.schema.$ref === 'string' && Object.keys(node.schema).every(key => key === '$ref' || DOCUMENTATION.has(key)) ? node.schema.$ref : wrappedReference(node.schema)?.$ref;
        if (typeof reference === 'string') {
          let target: string | undefined;
          try { target = identity(sources.ref(reference, { file, pointer: `${at}/$ref` }).origin); } catch { target = undefined; }
          if (target !== undefined && schemas.has(target)) { references.push({ origin: { file, pointer: at }, target }); return; }
        }
        const first = shape === undefined ? undefined : inlineShapes.get(shape);
        if (first !== undefined) { sameShape.push({ origin: { file, pointer: at }, first }); return; }
        if (shape !== undefined) inlineShapes.set(shape, identity({ file, pointer: at }));
        const named = operationName(node, pointer);
        addSchema(node.schema, { file, pointer: at }, named.name, { media: named.media, ...(named.nameAs ? { nameAs: named.nameAs } : {}) });
      }
    });
    for (const key of Object.keys(value).sort()) {
      if (isApi && !['definitions', 'components', 'paths'].includes(key)) addReport({ file, pointer: `/${escapePointer(key)}`, kind: 'keyword', outcome: 'unmapped', reason: 'API metadata/transport configuration has no object projection; source subtree retained in the input.' });
    }
  }
  if (!schemas.size && !projection) throw new ImportProblem('schema', 'No named or root schemas were found.');

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
    // CSDL namespaces identify a service, not a user-facing object. Full identity stays in sourceNames and references.
    const base = pascalName(format === 'odata' ? schema.sourceName.split('.').pop()! : schema.nameAs ?? schema.sourceName);
    let name = base;
    // G1: two inline schemas of one place are told apart by media type, then by number; never by a hash.
    if (used.has(name) && schema.media !== undefined) {
      if (schema.media && !used.has(base + pascalName(schema.media))) name = base + pascalName(schema.media);
      else for (let i = 2; used.has(name); i++) name = `${base}${i}`;
    } else if (used.has(name)) name += hash(key).slice(0, 10);
    used.add(name); names.set(key, name);
  }
  for (const { origin, target } of references) addReport({ ...origin, object: names.get(target), kind: 'schema', outcome: 'mapped', reason: `A reference to ${names.get(target)}: that record is drafted once, under its own name.` });
  for (const { origin, first } of sameShape) addReport({ ...origin, object: names.get(first), kind: 'schema', outcome: 'mapped', reason: `The same shape as the inline schema at ${first.slice(first.indexOf('#') + 1)}, apart from its descriptions: one record, drafted once as ${names.get(first)}.` });
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
      else if (key === 'type' && child === 'file') {
        // s245-m03: Swagger 2.0's file type (a download or an upload, Gitea's raw and media files) is OpenAPI 3's binary string.
        result.type = 'string'; provenance[dest] = at;
        if (value.format === undefined) { result.format = 'binary'; provenance[`${destination}/format`] = at; }
        entry.outcome = 'mapped'; entry.reason = "Swagger 2.0's file type is read as a binary string, OpenAPI 3's form for a file.";
      } else Object.defineProperty(result, key, { value: copy(child, at, dest), enumerable: true, writable: true, configurable: true });
      if (['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf'].includes(key) && typeof result[key] === 'string') {
        if (/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(result[key]) && Number.isFinite(Number(result[key]))) {
          result[key] = Number(result[key]); entry.reason = 'Numeric string bound normalized to a JSON Schema number; original location retained.';
        } else { delete result[key]; result[`x-oods-invalid-${key}`] = child; entry.reason = 'Invalid numeric bound preserved as source annotation and omitted from executable validation.'; }
      }
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
  for (const schema of Object.values(hub.$defs)) for (const edge of schema['x-oods']?.relationships ?? []) {
    edge.target = Object.keys(hub['x-oods'].sourceNames).find(name => hub['x-oods'].sourceNames[name] === edge.target) ?? edge.target;
  }
  for (const name of Object.keys(hub.$defs)) walk(hub.$defs[name], (_value, pointer) => {
    if (!provenance[pointer]) provenance[pointer] = provenance[pointer.slice(0, pointer.lastIndexOf('/'))] ?? provenance[`/$defs/${name}`];
  }, `/$defs/${name}`);
  if (projection) {
    const remap = (origin: Origin): Origin => {
      let pointer = origin.pointer;
      while (pointer) {
        const match = projection.origins[pointer];
        if (match) return { file: match.file, pointer: match.pointer + origin.pointer.slice(pointer.length) };
        pointer = pointer.slice(0, pointer.lastIndexOf('/'));
      }
      return origin;
    };
    for (const [pointer, origin] of Object.entries(provenance)) provenance[pointer] = remap(origin);
    const entries = [...report.values()]; report.clear();
    for (const entry of entries) addReport({ ...entry, ...remap(entry) });
    for (const entry of projection.report) addReport(entry);
  }
  if (!validateHubSchema(hub)) throw new ImportProblem('schema', `Invalid x-oods hub annotation: ${ajv.errorsText(hubContract.errors ?? ajv.errors)}`);
  return { hub, report: [...report.values()].sort((a, b) => `${identity(a)}:${a.kind}` < `${identity(b)}:${b.kind}` ? -1 : 1), contentHash: `sha256:${hash(canonical(hub['x-oods'].sources))}`, ...(projection?.unread ? { unread: projection.unread } : {}) };
}
