import path from 'node:path';
import { parse } from 'pgsql-ast-parser';
import { escapePointer, type Document, type MapValue, type Origin } from '../source.js';
import type { ReaderResult } from './types.js';

type Column = { ast: MapValue; origin: Origin; description?: string };
type Table = { name: string; columns: Map<string, Column>; constraints: Array<{ ast: MapValue; origin: Origin }>; origin: Origin; description?: string; view?: MapValue };
const key = (name: MapValue) => name.schema && name.schema !== 'public' ? `${name.schema}.${name.name}` : name.name;
const literal = (value: MapValue): unknown => value?.type === 'cast' ? literal(value.operand) : value?.type === 'null' ? null : ['string', 'integer', 'numeric', 'boolean'].includes(value?.type) ? value.value : undefined;

/** Split DDL without treating semicolons in strings, comments or function bodies as statement boundaries. */
export function sqlStatements(text: string): string[] {
  const result: string[] = [];
  let start = 0, quote = '', dollar = '', block = 0, line = false, escapeString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (line) { if (c === '\n') line = false; continue; }
    if (block) { if (c === '/' && next === '*') { block++; i++; } else if (c === '*' && next === '/') { block--; i++; } continue; }
    if (dollar) { if (text.startsWith(dollar, i)) { i += dollar.length - 1; dollar = ''; } continue; }
    if (quote) { if (c === quote) { if (next === quote) i++; else quote = ''; } else if (c === '\\' && quote === "'" && escapeString) i++; continue; }
    if (c === '-' && next === '-') { line = true; i++; }
    else if (c === '/' && next === '*') { block = 1; i++; }
    else if (c === "'" || c === '"') { quote = c; escapeString = c === "'" && /(?:^|[^A-Za-z0-9_])e$/i.test(text.slice(Math.max(0, i - 2), i)); }
    else if (c === '$') { const match = text.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/); if (match) { dollar = match[0]; i += dollar.length - 1; } }
    else if (c === ';') { result.push(text.slice(start, i + 1)); start = i + 1; }
  }
  if (text.slice(start).trim()) result.push(text.slice(start));
  return result;
}

/** Preserve source offsets while removing comments the SQL grammar cannot tokenize (for example Prisma warnings). */
function ddlLex(sql: string): { syntax: string; mask: string } {
  const syntax = sql.split(''), mask = sql.split('');
  let quote = '', dollar = '', block = 0, line = false, escaped = false;
  const blank = (i: number, comment = false) => { if (sql[i] !== '\n') { mask[i] = ' '; if (comment) syntax[i] = ' '; } };
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i], next = sql[i + 1];
    if (line) { if (c === '\n') line = false; else blank(i, true); continue; }
    if (block) {
      blank(i, true);
      if (c === '/' && next === '*') { block++; blank(++i, true); }
      else if (c === '*' && next === '/') { block--; blank(++i, true); }
      continue;
    }
    if (dollar) { blank(i); if (sql.startsWith(dollar, i)) { for (let j = 1; j < dollar.length; j++) blank(i + j); i += dollar.length - 1; dollar = ''; } continue; }
    if (quote) {
      blank(i);
      if (c === quote) { if (next === quote) blank(++i); else quote = ''; }
      else if (escaped && c === '\\') blank(++i);
      continue;
    }
    if (c === '-' && next === '-') { line = true; blank(i, true); blank(++i, true); }
    else if (c === '/' && next === '*') { block = 1; blank(i, true); blank(++i, true); }
    else if (c === "'" || c === '"') { quote = c; escaped = c === "'" && /(?:^|[^A-Za-z0-9_])e$/i.test(sql.slice(Math.max(0, i - 2), i)); blank(i); }
    else if (c === '$') { const match = sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/); if (match) { dollar = match[0]; for (let j = 0; j < dollar.length; j++) blank(i + j); i += dollar.length - 1; } }
  }
  return { syntax: syntax.join(''), mask: mask.join('') };
}
function tableProjectionSql(sql: string): { sql: string; notes: string[] } {
  const lexed = ddlLex(sql), mask = lexed.mask, notes: string[] = [];
  sql = lexed.syntax;
  if (!/^\s*CREATE\s+(?:UNLOGGED\s+)?TABLE\b/i.test(mask)) return { sql, notes };
  // Storage choice does not change the generated field's type or read-only contract.
  const virtual = [...mask.matchAll(/\)\s+(VIRTUAL)\b/gi)];
  for (const match of virtual.reverse()) { const index = match.index! + match[0].length - match[1].length; sql = sql.slice(0, index) + 'STORED ' + sql.slice(index + match[1].length); }
  if (virtual.length) notes.push('VIRTUAL generated-column storage is retained in source; its field is projected as read-only without evaluating the expression.');
  const partition = /\bPARTITION\s+BY\s+(?:RANGE|LIST|HASH)\s*\([^;]*\)\s*;?\s*$/i.exec(mask);
  if (partition) { sql = sql.slice(0, partition.index) + ';'; notes.push('Partition routing is retained in source; the parent table columns are projected.'); }
  return { sql, notes };
}

function orderedFiles(documents: Document[], report: ReaderResult['report']): Document[] {
  const sql = documents.filter(doc => doc.text !== undefined);
  const note = (doc: Document, reason: string) => report.push({ file: doc.file, pointer: '', kind: 'keyword', outcome: 'unmapped', reason });
  const journal = documents.find(doc => /(?:^|\/)meta\/_journal\.json$/.test(doc.file));
  if (journal?.value.entries) {
    const base = path.posix.dirname(path.posix.dirname(journal.file));
    const ordered: Document[] = [];
    for (const entry of [...journal.value.entries].sort((a, b) => a.idx - b.idx)) {
      const file = path.posix.normalize(path.posix.join(base, `${entry.tag}.sql`));
      const doc = sql.find(item => item.file === file);
      if (!doc) throw new Error(`Drizzle journal names a missing local migration: ${file}`);
      ordered.push(doc);
    }
    for (const doc of sql) if (!ordered.includes(doc)) note(doc, 'Not listed in the Drizzle journal; not replayed.');
    return ordered;
  }
  const admitted = sql.filter(doc => { if (/\.down\.sql$/i.test(doc.file) || /(?:^|\/)U\d.*__.*\.sql$/i.test(doc.file)) { note(doc, 'Down/undo migration is not part of forward schema replay.'); return false; } return true; });
  const version = (file: string) => path.posix.basename(file).match(/^V([0-9_.]+)__/i)?.[1] ?? path.posix.basename(file).match(/^(\d+)_/)?.[1];
  return admitted.sort((a, b) => {
    const x = version(a.file), y = version(b.file);
    if (x && y) {
      const left = x.split(/[_.]/).map(BigInt), right = y.split(/[_.]/).map(BigInt);
      for (let i = 0; i < Math.max(left.length, right.length); i++) { const delta = (left[i] ?? 0n) - (right[i] ?? 0n); if (delta) return delta < 0 ? -1 : 1; }
    }
    return a.file < b.file ? -1 : a.file === b.file ? 0 : 1;
  });
}

export function readSql(documents: Document[]): ReaderResult {
  const report: ReaderResult['report'] = [], origins: Record<string, Origin> = {}, definitions: MapValue = Object.create(null);
  const tables = new Map<string, Table>(), enums = new Map<string, string[]>();
  const note = (origin: Origin, reason: string, outcome: 'mapped' | 'unmapped' = 'unmapped') => report.push({ ...origin, kind: 'keyword', outcome, reason });
  const addColumn = (table: Table, ast: MapValue, origin: Origin) => {
    if (ast.kind === 'like table') { note(origin, 'LIKE table options are not projected; declare the columns explicitly.'); return; }
    table.columns.set(ast.name.name, { ast: structuredClone(ast), origin });
  };
  const renameReferences = (old: string, replacement: string, column?: string, nextColumn?: string) => {
    for (const table of tables.values()) for (const constraint of [...table.constraints.map(c => c.ast), ...[...table.columns.values()].flatMap(c => c.ast.constraints ?? [])]) {
      if (constraint.foreignTable && key(constraint.foreignTable) === old) {
        if (!column) { const parts = replacement.split('.'); constraint.foreignTable = { name: parts.pop(), ...(parts.length ? { schema: parts.join('.') } : {}) }; }
        else for (const field of constraint.foreignColumns ?? []) if (field.name === column) field.name = nextColumn;
      }
    }
  };
  for (const doc of orderedFiles(documents, report)) {
    const statements = sqlStatements(doc.text ?? '');
    for (const [index, sql] of statements.entries()) {
      const origin = { file: doc.file, pointer: `/statements/${index}` };
      let nodes: MapValue[];
      try {
        const projected = tableProjectionSql(sql);
        nodes = parse(projected.sql) as MapValue[];
        for (const [i, reason] of projected.notes.entries()) note({ ...origin, pointer: `${origin.pointer}/storage/${i}` }, reason);
      }
      catch (error) { note(origin, `SQL syntax not mapped: ${(error as Error).message.split('\n')[0]}. Statement retained in source; no SQL was executed.`); continue; }
      for (const ast of nodes) {
        if (ast.type === 'create enum') { enums.set(key(ast.name), ast.values.map((v: MapValue) => v.value)); note(origin, 'Enum type retained as a field value list.', 'mapped'); }
        else if (ast.type === 'alter enum') {
          const values = enums.get(key(ast.name));
          if (values && ast.change.type === 'add value') { values.push(ast.change.add.value); note(origin, 'Enum value added in migration order.', 'mapped'); }
          else if (values && ast.change.type === 'rename') { enums.delete(key(ast.name)); enums.set(key(ast.change.to), values); note(origin, 'Enum renamed in migration order.', 'mapped'); }
          else note(origin, 'Enum alteration has no known target or supported projection.');
        } else if (ast.type === 'create table' || ast.type === 'create view' || ast.type === 'create materialized view') {
          const name = key(ast.name);
          if (ast.ifNotExists && tables.has(name)) { note(origin, 'Existing table retained by IF NOT EXISTS.', 'mapped'); continue; }
          const table: Table = { name, columns: new Map(), constraints: [], origin, ...(ast.type !== 'create table' ? { view: ast } : {}) };
          tables.set(name, table);
          (ast.columns ?? []).forEach((column: MapValue, i: number) => addColumn(table, column, { ...origin, pointer: `${origin.pointer}/columns/${i}` }));
          table.constraints = (ast.constraints ?? []).map((constraint: MapValue, i: number) => ({ ast: constraint, origin: { ...origin, pointer: `${origin.pointer}/constraints/${i}` } }));
          if (ast.inherits?.length) note(origin, 'Table inheritance retained in source; inherited fields are not guessed.');
          note(origin, 'Table or read-only view entered the schema replay.', 'mapped');
        } else if (ast.type === 'alter table') {
          let table = tables.get(key(ast.table));
          if (!table) { note(origin, `ALTER target ${key(ast.table)} is absent from the source schema.`); continue; }
          for (const [i, change] of ast.changes.entries()) {
            const at = { ...origin, pointer: `${origin.pointer}/changes/${i}` };
            const column = change.column?.name;
            if (change.type === 'add column') addColumn(table, change.column, at);
            else if (change.type === 'drop column') { table.columns.delete(column); table.constraints = table.constraints.filter(c => !(c.ast.columns ?? c.ast.localColumns ?? []).some((v: MapValue) => v.name === column)); }
            else if (change.type === 'rename column') {
              const value = table.columns.get(column);
              if (!value) { note(at, 'Cannot rename an absent column.'); continue; }
              table.columns.delete(column); value.ast.name.name = change.to.name; table.columns.set(change.to.name, value);
              for (const constraint of table.constraints) for (const field of constraint.ast.columns ?? constraint.ast.localColumns ?? []) if (field.name === column) field.name = change.to.name;
              renameReferences(table.name, table.name, column, change.to.name);
            } else if (change.type === 'rename') {
              const prior = table.name; const prefix = prior.includes('.') ? prior.slice(0, prior.lastIndexOf('.') + 1) : '';
              tables.delete(prior); table.name = prefix + change.to.name; tables.set(table.name, table); renameReferences(prior, table.name);
            } else if (change.type === 'add constraint') table.constraints.push({ ast: change.constraint, origin: at });
            else if (change.type === 'drop constraint') {
              table.constraints = table.constraints.filter(c => c.ast.constraintName?.name !== change.constraint.name);
              for (const value of table.columns.values()) value.ast.constraints = (value.ast.constraints ?? []).filter((c: MapValue) => c.constraintName?.name !== change.constraint.name);
            } else if (change.type === 'alter column') {
              const value = table.columns.get(column), alteration = change.alter;
              if (!value) { note(at, 'Cannot alter an absent column.'); continue; }
              value.ast.constraints ??= [];
              if (alteration.type === 'set type') value.ast.dataType = alteration.dataType;
              else if (alteration.type === 'set default') { value.ast.constraints = value.ast.constraints.filter((c: MapValue) => c.type !== 'default'); value.ast.constraints.push({ type: 'default', default: alteration.default }); }
              else if (alteration.type === 'drop default') value.ast.constraints = value.ast.constraints.filter((c: MapValue) => c.type !== 'default');
              else if (alteration.type === 'set not null') value.ast.constraints.push({ type: 'not null' });
              else if (alteration.type === 'drop not null') value.ast.constraints = value.ast.constraints.filter((c: MapValue) => c.type !== 'not null');
              else if (alteration.type === 'add generated') value.ast.constraints.push(alteration);
              else { note(at, `Unsupported column alteration: ${alteration.type}`); continue; }
            } else { note(at, `Unsupported table alteration: ${change.type}`); continue; }
            note(at, 'Schema alteration replayed without running SQL.', 'mapped');
          }
        } else if (ast.type === 'drop table' || ast.type === 'drop view' || ast.type === 'drop materialized view') {
          for (const name of ast.names ?? []) tables.delete(key(name)); note(origin, 'Schema object dropped in migration order.', 'mapped');
        } else if (ast.type === 'comment') {
          const name = ast.on.type === 'column' ? key({ name: ast.on.column.table, schema: ast.on.column.schema }) : key(ast.on.name);
          const table = tables.get(name), target = ast.on.type === 'column' ? table?.columns.get(ast.on.column.column) : table;
          if (target) { target.description = ast.comment; note(origin, 'COMMENT ON becomes source description.', 'mapped'); }
          else note(origin, 'Comment target has no projected object or field.');
        } else if (ast.type === 'create index' && ast.unique && !ast.where && ast.expressions.every((v: MapValue) => v.expression.type === 'ref')) {
          const table = tables.get(key(ast.table));
          if (table) { table.constraints.push({ ast: { type: 'unique', columns: ast.expressions.map((v: MapValue) => ({ name: v.expression.name })) }, origin }); note(origin, 'Unique index becomes key evidence.', 'mapped'); }
          else note(origin, 'Unique index target is absent.');
        } else note(origin, `${ast.type} has no object-schema projection; no code or data statement was executed.`);
      }
    }
  }
  const dataType = (type: MapValue, origin: Origin): MapValue => {
    if (type.kind === 'array') return { type: 'array', items: dataType(type.arrayOf, origin) };
    const name = String(type.name).toLowerCase();
    if (enums.has(key(type))) return { type: 'string', enum: enums.get(key(type)) };
    if (/^(smallint|int2|integer|int|int4|bigint|int8|smallserial|serial|bigserial|serial2|serial4|serial8)$/.test(name)) return { type: 'integer', ...(/serial/.test(name) ? { readOnly: true } : {}) };
    if (/^(numeric|decimal|real|float4|float8|double precision|money)$/.test(name)) return { type: 'number' };
    if (/^(bool|boolean)$/.test(name)) return { type: 'boolean' };
    if (/^(text|varchar|character varying|char|character|citext|name)$/.test(name)) return { type: 'string', ...(type.config?.[0] ? { maxLength: type.config[0] } : {}) };
    if (name === 'uuid') return { type: 'string', format: 'uuid' };
    if (name === 'date') return { type: 'string', format: 'date' };
    if (/^timestamp/.test(name) || name === 'timestamptz') return { type: 'string', format: 'date-time' };
    if (/^(json|jsonb)$/.test(name)) return { type: 'object', additionalProperties: true };
    note(origin, `SQL type ${key(type)} has no scalar mapping.`); return { 'x-sql-type': key(type) };
  };
  const check = (expr: MapValue, fields: MapValue, origin: Origin): boolean => {
    if (expr.type === 'binary' && expr.op === 'AND') return check(expr.left, fields, origin) && check(expr.right, fields, origin);
    if (expr.type !== 'binary' || expr.left?.type !== 'ref' || !fields[expr.left.name]) return false;
    const field = fields[expr.left.name], value = literal(expr.right);
    if (expr.op === 'IN' && expr.right.type === 'list') { const values = expr.right.expressions.map(literal); if (values.some((v: unknown) => v === undefined)) return false; field.enum = values; return true; }
    const bound = ({ '>=': 'minimum', '<=': 'maximum', '>': 'exclusiveMinimum', '<': 'exclusiveMaximum' } as Record<string, string>)[expr.op];
    if (bound && typeof value === 'number') { field[bound] = value; return true; }
    if (expr.op === '=' && value !== undefined) { field.enum = [value]; return true; }
    return false;
  };
  const project = (table: Table, active = new Set<string>()): MapValue => {
    if (definitions[table.name]) return definitions[table.name];
    const schema: MapValue = { type: 'object', properties: Object.create(null), required: [], 'x-oods': { relationships: [] }, ...(table.description ? { description: table.description } : {}) };
    Object.defineProperty(definitions, table.name, { value: schema, enumerable: true });
    origins[`/$defs/${escapePointer(table.name)}`] = table.origin;
    const fields = schema.properties;
    for (const [name, column] of table.columns) {
      const field = dataType(column.ast.dataType, column.origin);
      if (column.description) field.description = column.description;
      Object.defineProperty(fields, name, { value: field, enumerable: true });
      origins[`/$defs/${escapePointer(table.name)}/properties/${escapePointer(name)}`] = column.origin;
    }
    const applyConstraint = (constraint: MapValue, at: Origin, local?: string) => {
      const names: string[] = local ? [local] : (constraint.columns ?? constraint.localColumns ?? []).map((v: MapValue) => v.name);
      if (constraint.type === 'primary key' || constraint.type === 'unique') {
        for (const name of names) if (fields[name]) { fields[name]['x-oods'] = { ...fields[name]['x-oods'], ...(names.length === 1 ? { unique: true } : {}), ...(constraint.type === 'primary key' ? { primaryKey: true } : {}) }; if (constraint.type === 'primary key') schema.required.push(name); }
        note(at, `${constraint.type} retained${names.length > 1 ? ' as a composite key; no single column is asserted unique' : ''}.`, 'mapped');
      } else if (constraint.type === 'not null' && local) schema.required.push(local);
      else if (constraint.type === 'default' && local) {
        const value = literal(constraint.default);
        if (value !== undefined) fields[local].default = value;
        else if (constraint.default?.type === 'call' && ['now', 'transaction_timestamp', 'statement_timestamp'].includes(constraint.default.function?.name)) fields[local]['x-oods'] = { ...fields[local]['x-oods'], generatedTimestamp: true };
        else note(at, 'Non-literal SQL default retained in source and never evaluated.');
      } else if (constraint.type === 'reference' || constraint.type === 'foreign key') {
        const target = key(constraint.foreignTable);
        if (names.length !== 1 || constraint.foreignColumns.length > 1) { note(at, 'Composite foreign key retained in source; a scalar picker cannot express a tuple.'); return; }
        if (!tables.has(target)) { note(at, `Foreign key target ${target} is absent from this source.`); return; }
        schema['x-oods'].relationships.push({ target, via: names[0], cardinality: 'many-to-one', label: names[0].replace(/_/g, ' ') });
        note(at, 'Foreign key becomes a declared relationship.', 'mapped');
      } else if (constraint.type === 'check') { if (!check(constraint.expr, fields, at)) note(at, 'CHECK expression preserved in source; only literal comparisons and IN lists map to validation.'); else note(at, 'CHECK becomes field validation.', 'mapped'); }
      else if (constraint.type === 'add generated' && local) fields[local].readOnly = true;
      else if (constraint.type !== 'null') note(at, `Column constraint ${constraint.type} has no projection.`);
    };
    for (const [name, column] of table.columns) for (const [i, constraint] of (column.ast.constraints ?? []).entries()) applyConstraint(constraint, { ...column.origin, pointer: `${column.origin.pointer}/constraints/${i}` }, name);
    for (const constraint of table.constraints) applyConstraint(constraint.ast, constraint.origin);
    if (table.view) {
      schema.readOnly = true;
      const query = table.view.query;
      if (query.type !== 'select' || active.has(table.name)) note(table.origin, 'Complex or recursive view projection requires declared column types; retained in source.');
      else {
        active.add(table.name);
        const sources = (query.from ?? []).filter((from: MapValue) => from.type === 'table').map((from: MapValue) => ({ alias: from.name.alias ?? from.name.name, table: tables.get(key(from.name)) }));
        for (const [i, column] of (query.columns ?? []).entries()) {
          const expr = column.expr, alias = table.view.columnNames?.[i]?.name ?? column.alias?.name ?? expr.name;
          if (expr.type === 'ref' && expr.name === '*') {
            for (const source of sources) if (source.table && (!expr.table || expr.table.name === source.alias)) Object.assign(fields, structuredClone(project(source.table, active).properties));
          } else if (expr.type === 'ref') {
            const matches = sources.filter((source: MapValue) => source.table && (!expr.table || expr.table.name === source.alias)).map((source: MapValue) => project(source.table, active).properties[expr.name]).filter(Boolean);
            if (matches.length === 1) fields[alias] = structuredClone(matches[0]); else note(table.origin, `View column ${alias} has no unambiguous source type.`);
          } else if (expr.type === 'cast' && alias) fields[alias] = dataType(expr.to, table.origin);
          else if (alias && literal(expr) !== undefined) fields[alias] = { type: typeof literal(expr) === 'number' ? 'number' : typeof literal(expr) };
          else note(table.origin, `View expression ${alias ?? i} has no declared scalar type.`);
        }
      }
    }
    schema.required = [...new Set(schema.required)].sort();
    for (const [name, field] of Object.entries(fields) as Array<[string, MapValue]>) if (!schema.required.includes(name) && field.type && !field.readOnly) field.type = [...new Set([...(Array.isArray(field.type) ? field.type : [field.type]), 'null'])];
    if (!schema['x-oods'].relationships.length) delete schema['x-oods'].relationships;
    return schema;
  };
  for (const table of [...tables.values()].sort((a, b) => a.name < b.name ? -1 : 1)) project(table);
  // Use the same normalized-name map as the hub; references below are remapped there.
  return { value: { $defs: definitions }, origins, report };
}
