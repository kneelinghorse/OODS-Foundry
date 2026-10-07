import { parsePrismaSchema } from '@loancrate/prisma-schema-parser';
import { escapePointer, type Document, type MapValue, type Origin } from '../source.js';
import type { ReaderResult } from './types.js';

const value = (node: MapValue | undefined): any => node?.kind === 'literal' ? node.value : node?.kind === 'path' ? node.value.join('.') : node?.kind === 'array' ? node.items.map(value) : undefined;
const attributeName = (node: MapValue) => node.path.value.join('.');
const docText = (node: MapValue) => (node.comments ?? []).filter((c: MapValue) => c.kind === 'docComment').map((c: MapValue) => c.text).filter((line: string) => !line.trimStart().startsWith('@')).join('\n');

export function readPrisma(documents: Document[]): ReaderResult {
  const definitions: MapValue = Object.create(null), origins: ReaderResult['origins'] = {}, report: ReaderResult['report'] = [];
  const declarations: Array<{ ast: MapValue; origin: Origin; description: string }> = [];
  const note = (origin: Origin, reason: string, outcome: 'mapped' | 'unmapped' = 'unmapped', kind: 'keyword' | 'property' = 'keyword') => report.push({ ...origin, reason, outcome, kind });
  for (const doc of documents.filter(d => /\.prisma$/i.test(d.file) || d.text !== undefined && documents.length === 1)) {
    const parsed = parsePrismaSchema(doc.text ?? '');
    let description = '';
    for (const [i, ast] of parsed.declarations.entries()) {
      if (ast.kind === 'commentBlock') { description = docText(ast); continue; }
      const origin = { file: doc.file, pointer: `/declarations/${i}` };
      if (['model', 'view', 'type', 'enum'].includes(ast.kind)) declarations.push({ ast, origin, description });
      else note(origin, `${ast.kind} retained in source; configuration and generators are never executed.`);
      description = '';
    }
  }
  const enums = new Map(declarations.filter(d => d.ast.kind === 'enum').map(d => [d.ast.name.value, d.ast.members.filter((m: MapValue) => m.kind === 'enumValue').map((m: MapValue) => m.name.value)]));
  const models = new Set(declarations.filter(d => d.ast.kind !== 'enum').map(d => d.ast.name.value));
  for (const { ast, origin, description } of declarations) {
    const name = ast.name.value, base = `/$defs/${escapePointer(name)}`;
    if (Object.hasOwn(definitions, name)) throw new Error(`${origin.file}#${origin.pointer}: duplicate Prisma declaration ${name}`);
    if (ast.kind === 'enum') {
      Object.defineProperty(definitions, name, { value: { type: 'string', enum: enums.get(name), ...(description ? { description } : {}) }, enumerable: true });
      origins[base] = origin;
      for (const [i, member] of ast.members.entries()) for (const attr of member.attributes ?? []) note({ ...origin, pointer: `${origin.pointer}/members/${i}` }, `${attributeName(attr)} enum mapping retained as source metadata; API enum names are preserved.`, 'mapped');
      continue;
    }
    const schema: MapValue = { type: 'object', properties: Object.create(null), required: [], 'x-oods': { relationships: [] }, ...(description ? { description } : {}), ...(ast.kind === 'view' ? { readOnly: true } : {}) };
    Object.defineProperty(definitions, name, { value: schema, enumerable: true }); origins[base] = origin;
    let fieldDescription = '';
    for (const [i, member] of ast.members.entries()) {
      const at = { ...origin, pointer: `${origin.pointer}/members/${i}` };
      if (member.kind === 'commentBlock') {
        if (member.comments?.some((comment: MapValue) => comment.text?.trimStart().startsWith('@'))) note(at, 'Generator directive comment retained in source; excluded from end-user help text and never executed.');
        fieldDescription = docText(member); continue; }
      if (member.kind === 'blockAttribute') {
        const attr = attributeName(member);
        if (attr === 'id' || attr === 'unique') {
          const keys = value(member.args?.find((arg: MapValue) => arg.kind === 'array')) ?? [];
          // Process after fields, since block attributes can appear anywhere.
          schema['x-prisma-keys'] ??= []; schema['x-prisma-keys'].push({ kind: attr, fields: keys });
          note(at, `Composite ${attr} declaration retained; single-column keys become field evidence.`, 'mapped');
        } else if (attr === 'map') { schema['x-prisma-table'] = value(member.args?.[0]); note(at, 'Database table mapping retained; Prisma model name is the object name.', 'mapped'); }
        else note(at, `Prisma @@${attr} retained in source; no additional screen behavior inferred.`);
        continue;
      }
      if (member.kind !== 'field') { note(at, `Unsupported Prisma member ${member.kind}.`); continue; }
      const field = member.name.value, wrapper = member.type.kind, type = member.type.type ?? member.type, typeName = type.name?.value;
      const attrs = new Map<string, MapValue>((member.attributes ?? []).map((attr: MapValue) => [attributeName(attr), attr]));
      const relation = attrs.get('relation');
      const relationKeys = value(relation?.args?.find((arg: MapValue) => arg.kind === 'namedArgument' && arg.name.value === 'fields')?.expression);
      if (models.has(typeName) && relationKeys?.length === 1) {
        schema['x-oods'].relationships.push({ target: typeName, via: relationKeys[0], cardinality: 'many-to-one', label: field.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (char: string) => char.toUpperCase()) });
        schema['x-prisma-relations'] ??= {}; schema['x-prisma-relations'][field] = { target: typeName, attribute: relation };
        note(at, `Relationship navigation ${field} is represented by its foreign-key picker ${relationKeys[0]}.`, 'mapped', 'property');
        fieldDescription = ''; continue;
      }
      let shape: MapValue;
      if (models.has(typeName)) shape = { $ref: `#/$defs/${escapePointer(typeName)}` };
      else if (enums.has(typeName)) shape = { type: 'string', enum: enums.get(typeName) };
      else shape = ({ String: { type: 'string' }, Boolean: { type: 'boolean' }, Int: { type: 'integer' }, BigInt: { type: 'integer' }, Float: { type: 'number' }, Decimal: { type: 'number' }, DateTime: { type: 'string', format: 'date-time' }, Json: { type: 'object', additionalProperties: true } } as Record<string, MapValue>)[typeName] ?? { 'x-prisma-type': typeName ?? value(type.type) ?? 'unsupported' };
      shape = { ...shape };
      for (const [attr, declaration] of attrs) {
        if (attr === 'id' || attr === 'unique') shape['x-oods'] = { ...shape['x-oods'], unique: true, ...(attr === 'id' ? { primaryKey: true } : {}) };
        else if (attr === 'map') shape['x-prisma-column'] = value(declaration.args?.[0]);
        else if (attr === 'updatedAt') { shape.readOnly = true; shape['x-oods'] = { ...shape['x-oods'], generatedTimestamp: true }; }
        else if (attr === 'default') {
          const expr = declaration.args?.[0], supplied = value(expr);
          if (supplied !== undefined) shape.default = supplied;
          else if (expr?.kind === 'functionCall') {
            const call = expr.path.value.join('.');
            shape['x-prisma-default'] = call;
            if (call === 'now') shape['x-oods'] = { ...shape['x-oods'], generatedTimestamp: true };
            if (['now', 'autoincrement', 'uuid', 'cuid', 'ulid'].includes(call)) shape.readOnly = true;
            if (call === 'uuid') shape.format = 'uuid';
            if (call === 'cuid') shape.pattern = '^c[a-z0-9]{24}$';
            if (call === 'ulid') shape.pattern = '^[0-9A-HJKMNP-TV-Z]{26}$';
            note(at, `Default function ${call} retained as a declaration and never evaluated.`, ['now', 'autoincrement', 'uuid', 'cuid', 'ulid'].includes(call) ? 'mapped' : 'unmapped');
          }
        } else if (attr.startsWith('db.')) {
          const native = attr.slice(3); shape['x-prisma-native'] = { name: native, args: declaration.args?.map(value) };
          if (native === 'Uuid') shape.format = 'uuid';
          if (native === 'Date') shape.format = 'date';
          if (['VarChar', 'Char', 'NVarChar', 'NChar'].includes(native) && typeof value(declaration.args?.[0]) === 'number') shape.maxLength = value(declaration.args![0]);
          note(at, `Native type ${native} preserved${['Uuid', 'Date', 'VarChar', 'Char', 'NVarChar', 'NChar'].includes(native) ? ' with its format/length' : '; Prisma scalar supplies the field type'}.`, 'mapped');
        } else if (attr !== 'relation') note(at, `Prisma @${attr} has no object projection.`);
      }
      if (wrapper === 'list') shape = { type: 'array', items: shape, ...(models.has(typeName) ? { readOnly: true } : {}) };
      else if (wrapper === 'optional') shape = shape.$ref ? { anyOf: [shape, { type: 'null' }] } : { ...shape, ...(shape.type ? { type: [shape.type, 'null'] } : {}) };
      else schema.required.push(field);
      const docs = [fieldDescription, member.comment?.kind === 'docComment' ? member.comment.text : ''].filter(Boolean).join('\n');
      if (docs) shape.description = docs;
      fieldDescription = '';
      Object.defineProperty(schema.properties, field, { value: shape, enumerable: true }); origins[`${base}/properties/${escapePointer(field)}`] = at;
    }
    for (const constraint of schema['x-prisma-keys'] ?? []) for (const field of constraint.fields) if (schema.properties[field]) {
      schema.properties[field]['x-oods'] = { ...schema.properties[field]['x-oods'], ...(constraint.fields.length === 1 ? { unique: true } : {}), ...(constraint.kind === 'id' ? { primaryKey: true } : {}) };
    }
    if (!schema['x-oods'].relationships.length) delete schema['x-oods'].relationships;
  }
  return { value: { $defs: definitions }, origins, report };
}
