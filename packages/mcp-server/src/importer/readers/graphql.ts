import { parse, printSchema, buildClientSchema, valueFromASTUntyped } from 'graphql';
import { ImportProblem, escapePointer, type Document, type MapValue, type Origin } from '../source.js';
import type { ReaderResult } from './types.js';

/** Only the standard parser/type descriptions run; no resolver or scalar implementation is loaded. */
export function readGraphql(documents: Document[]): ReaderResult {
  const definitions: MapValue = Object.create(null), origins: ReaderResult['origins'] = {}, report: ReaderResult['report'] = [];
  const declarations = new Map<string, { node: MapValue; origin: Origin; fields?: Map<string, Origin> }>();
  const roots = new Set(['Query', 'Mutation', 'Subscription']);
  const note = (origin: Origin, reason: string) => report.push({ ...origin, kind: 'keyword', outcome: 'unmapped', reason });
  for (const doc of documents) {
    const introspection = doc.value.data?.__schema ? doc.value.data : doc.value.__schema ? doc.value : undefined;
    if (doc.text === undefined && !introspection) { note({ file: doc.file, pointer: '' }, 'Not a GraphQL SDL or introspection document.'); continue; }
    let nodes: readonly MapValue[];
    try { nodes = parse(doc.text ?? printSchema(buildClientSchema(introspection)), { noLocation: true }).definitions; }
    catch (error) { throw new ImportProblem('schema', `Invalid GraphQL schema: ${(error as Error).message}`, { file: doc.file, pointer: '' }); }
    for (const [i, node] of nodes.entries()) {
      const name = node.name?.value;
      const sourceIndex = introspection?.__schema.types.findIndex((item: MapValue) => item.name === name);
      const pointer = introspection && sourceIndex >= 0 ? `${doc.value.data ? '/data' : ''}/__schema/types/${sourceIndex}` : `/definitions/${i}`;
      const origin = { file: doc.file, pointer };
      if (node.kind === 'SchemaDefinition' || node.kind === 'SchemaExtension') {
        for (const operation of node.operationTypes) roots.add(operation.type.name.value);
        note(origin, 'GraphQL operation roots are transport contracts, not executable record actions.'); continue;
      }
      if (!name || !/^(?:Object|InputObject|Interface|Union|Enum|Scalar)Type(?:Definition|Extension)$/.test(node.kind)) { note(origin, 'Directive/operation declaration retained in source; no server code is executed.'); continue; }
      const existing = declarations.get(name);
      if (existing) {
        if (!node.kind.endsWith('Extension')) throw new ImportProblem('schema', `Duplicate GraphQL type ${name}.`, origin);
        for (const key of ['fields', 'values', 'types', 'interfaces', 'directives']) existing.node[key] = [...(existing.node[key] ?? []), ...(node[key] ?? [])];
      } else declarations.set(name, { node: { ...node }, origin, fields: introspection ? new Map((introspection.__schema.types[sourceIndex]?.fields ?? introspection.__schema.types[sourceIndex]?.inputFields ?? []).map((field: MapValue, index: number) => [field.name, { file: doc.file, pointer: `${pointer}/${node.kind.startsWith('Input') ? 'inputFields' : 'fields'}/${index}` }])) : undefined });
    }
  }
  const directives = (node: MapValue): MapValue => Object.fromEntries((node.directives ?? []).map((directive: MapValue) => [directive.name.value, Object.fromEntries((directive.arguments ?? []).map((arg: MapValue) => [arg.name.value, valueFromASTUntyped(arg.value)]))]));
  const scalars: MapValue = { String: { type: 'string' }, ID: { type: 'string', 'x-oods': { unique: true } }, Boolean: { type: 'boolean' }, Int: { type: 'integer', minimum: -2147483648, maximum: 2147483647 }, Float: { type: 'number' } };
  for (const [name, { node, origin }] of declarations) if (node.kind.startsWith('Scalar')) {
    const uri = directives(node).specifiedBy?.url;
    const format = typeof uri === 'string' ? ({ 'https://scalars.graphql.org/andimarek/date-time.html': 'date-time', 'https://the-guild.dev/graphql/scalars/docs/scalars/date-time': 'date-time', 'https://the-guild.dev/graphql/scalars/docs/scalars/date': 'date', 'https://the-guild.dev/graphql/scalars/docs/scalars/uuid': 'uuid', 'https://the-guild.dev/graphql/scalars/docs/scalars/email-address': 'email', 'https://tools.ietf.org/html/rfc3339': 'date-time', 'https://www.rfc-editor.org/rfc/rfc3339': 'date-time' } as Record<string, string>)[uri] : undefined;
    scalars[name] = format ? { type: 'string', format, 'x-graphql-specifiedBy': uri } : { 'x-graphql-scalar': name, ...(uri ? { 'x-graphql-specifiedBy': uri } : {}) };
    if (!format) note(origin, `Custom scalar ${name} has no supported declared scalar specification; its name does not determine a conversion.`);
  }
  const shape = (type: MapValue): MapValue => {
    if (type.kind === 'NonNullType') return shapeRequired(type.type);
    const value = shapeRequired(type);
    return value.type ? { ...value, type: [value.type, 'null'] } : { anyOf: [value, { type: 'null' }] };
  };
  const shapeRequired = (type: MapValue): MapValue => {
    if (type.kind === 'ListType') return { type: 'array', items: shape(type.type) };
    return Object.hasOwn(scalars, type.name.value) ? structuredClone(scalars[type.name.value]) : { $ref: `#/$defs/${escapePointer(type.name.value)}` };
  };
  for (const [name, { node, origin, fields }] of declarations) {
    if (node.kind.startsWith('Scalar')) continue;
    if (roots.has(name)) { note(origin, 'Operation root retained in source; queries, subscriptions and mutations are not record objects.'); continue; }
    const base = `/$defs/${escapePointer(name)}`; origins[base] = origin;
    const schema: MapValue = node.kind.startsWith('Enum') ? { type: 'string', enum: node.values.map((value: MapValue) => value.name.value), 'x-graphql-enum': node.values.map((value: MapValue) => ({ name: value.name.value, description: value.description?.value, directives: directives(value) })) }
      : node.kind.startsWith('Union') || node.kind.startsWith('Interface') ? { oneOf: (node.kind.startsWith('Union') ? node.types.map((type: MapValue) => type.name.value) : [...declarations].filter(([, item]) => item.node.interfaces?.some((type: MapValue) => type.name.value === name)).map(([key]) => key)).map((target: string) => ({ $ref: `#/$defs/${escapePointer(target)}` })), 'x-graphql-kind': node.kind, 'x-graphql-fields': node.fields ?? [] }
        : { type: 'object', properties: Object.create(null), required: [] };
    if (schema.oneOf?.length === 0) delete schema.oneOf;
    if (node.description?.value) schema.description = node.description.value;
    schema['x-graphql-directives'] = directives(node);
    definitions[name] = schema;
    if (!schema.properties) continue;
    for (const [i, field] of (node.fields ?? []).entries()) {
      const key = field.name.value, at = fields?.get(key) ?? { ...origin, pointer: `${origin.pointer}/fields/${i}` };
      if (Object.hasOwn(schema.properties, key)) { report.push({ ...at, kind: 'property', outcome: 'unmapped', reason: `Duplicate GraphQL field ${name}.${key}; the first declaration is retained and this duplicate is not merged over it.` }); continue; }
      const property = shape(field.type), declared = directives(field);
      if (field.description?.value) property.description = field.description.value;
      if (field.defaultValue) property.default = valueFromASTUntyped(field.defaultValue);
      if (declared.deprecated) { property.deprecated = true; property['x-graphql-deprecationReason'] = declared.deprecated.reason ?? 'No longer supported'; }
      property['x-graphql-directives'] = declared;
      if (field.arguments?.length) { property['x-graphql-arguments'] = field.arguments; note(at, 'Field arguments retained; no resolver is executed or argument value invented.'); }
      schema.properties[key] = property; origins[`${base}/properties/${escapePointer(key)}`] = at;
      if (field.type.kind === 'NonNullType') schema.required.push(key);
    }
  }
  return { value: { $defs: definitions }, origins, report };
}
