import { escapePointer, isMap, type Document, type MapValue, type Origin } from '../source.js';
import type { ReaderResult } from './types.js';

/** Recognize only the literal reference grammar. Never evaluate an expression or a Jinja template. */
const reference = (value: unknown): string | undefined => typeof value === 'string' ? value.match(/^(?:\{\{\s*)?ref\(\s*['"]([^'"]+)['"]\s*\)(?:\s*\}\})?$/)?.[1] ?? value.match(/^(?:\{\{\s*)?source\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)(?:\s*\}\})?$/)?.slice(1).join('_') : undefined;
const scalar = (value: unknown): MapValue => {
  const name = String(value ?? '').toLowerCase();
  if (/^(smallint|integer|int|bigint|int\d+)(\b|$)/.test(name)) return { type: 'integer' };
  if (/^(numeric|decimal|number|float|double|real)(\b|$)/.test(name)) return { type: 'number' };
  if (/^(boolean|bool)$/.test(name)) return { type: 'boolean' };
  if (/^(varchar|nvarchar|char|text|string)(\b|$)/.test(name)) return { type: 'string' };
  if (name === 'date') return { type: 'string', format: 'date' };
  if (/^(timestamp|datetime)/.test(name)) return { type: 'string', format: 'date-time' };
  if (name === 'uuid') return { type: 'string', format: 'uuid' };
  return {};
};
export function readDbt(documents: Document[]): ReaderResult {
  const definitions: MapValue = Object.create(null), origins: ReaderResult['origins'] = {}, report: ReaderResult['report'] = [];
  const resources: Array<{ name: string; resource: MapValue; origin: Origin; snapshot: boolean }> = [];
  const semantics: Array<{ model: MapValue; origin: Origin }> = [];
  const tests: Array<{ test: MapValue; origin: Origin }> = [];
  const note = (origin: Origin, reason: string, outcome: 'mapped' | 'unmapped' = 'unmapped') => report.push({ ...origin, kind: 'keyword', reason, outcome });
  const description = (value: unknown, origin: Origin): string | undefined => {
    if (typeof value !== 'string') return undefined;
    if (/\{[{%]/.test(value)) { note(origin, 'Dynamic dbt documentation/Jinja retained in source; no template evaluated.'); return undefined; }
    return value;
  };
  const manifest = documents.find(doc => isMap(doc.value.nodes) && doc.value.metadata?.dbt_schema_version);
  if (manifest) {
    for (const [id, node] of Object.entries(manifest.value.nodes) as Array<[string, MapValue]>) {
      const origin = { file: manifest.file, pointer: `/nodes/${escapePointer(id)}` };
      if (['model', 'snapshot', 'seed'].includes(node.resource_type)) resources.push({ name: node.name, resource: node, origin, snapshot: node.resource_type === 'snapshot' });
      else if (node.resource_type === 'test') tests.push({ test: node, origin });
      else note(origin, `dbt ${node.resource_type} retained without execution.`);
    }
    for (const [id, model] of Object.entries(manifest.value.semantic_models ?? {})) semantics.push({ model: model as MapValue, origin: { file: manifest.file, pointer: `/semantic_models/${escapePointer(id)}` } });
    for (const doc of documents) if (doc !== manifest) note({ file: doc.file, pointer: '' }, 'The compiled manifest is the selected schema source; accompanying project files are not evaluated or merged over it.');
  } else for (const doc of documents) {
    for (const kind of ['models', 'snapshots', 'seeds']) if (Array.isArray(doc.value[kind])) doc.value[kind].forEach((resource: MapValue, i: number) => resources.push({ name: resource.name, resource, origin: { file: doc.file, pointer: `/${kind}/${i}` }, snapshot: kind === 'snapshots' }));
    for (const [i, model] of (Array.isArray(doc.value.semantic_models) ? doc.value.semantic_models : []).entries()) semantics.push({ model, origin: { file: doc.file, pointer: `/semantic_models/${i}` } });
    for (const [i, source] of (Array.isArray(doc.value.sources) ? doc.value.sources : []).entries()) for (const [j, table] of (source.tables ?? []).entries()) resources.push({ name: `${source.name}_${table.name}`, resource: table, origin: { file: doc.file, pointer: `/sources/${i}/tables/${j}` }, snapshot: false });
    if (doc.text !== undefined) note({ file: doc.file, pointer: '' }, 'dbt SQL is retained as source only; queries and Jinja are never evaluated.');
  }
  const addTest = (schema: MapValue, field: string, raw: unknown, at: Origin) => {
    const test = typeof raw === 'string' ? raw : isMap(raw) ? Object.keys(raw)[0] : undefined;
    if (!test) { note(at, 'Test declaration is not a static mapping.'); return; }
    const body = isMap(raw) && isMap(raw[test]) ? raw[test] : {};
    const args = body.arguments ?? body;
    const property = schema.properties[field];
    if (!property) { note(at, `Test field ${field} is absent from the declared columns.`); return; }
    if (test === 'not_null') schema.required.push(field);
    else if (test === 'unique') property['x-oods'] = { ...property['x-oods'], unique: true };
    else if (test === 'accepted_values' && Array.isArray(args.values)) { property.enum = args.values; property.type ??= typeof args.values[0] === 'number' ? 'number' : typeof args.values[0]; }
    else if (test === 'relationships') {
      const target = reference(args.to);
      if (!target) { note(at, 'Relationship target is not a literal ref()/source(); no Jinja evaluated.'); return; }
      schema['x-oods'].relationships.push({ target, via: field, cardinality: 'many-to-one', label: field.replace(/_/g, ' ') });
      property.type ??= 'string';
    } else { note(at, `dbt test ${test} preserved; its SQL semantics are not executed or guessed.`); return; }
    note(at, `Declared ${test} test becomes field/relationship evidence.`, 'mapped');
  };
  for (const { name, resource, origin, snapshot } of resources) {
    if (!name || Object.hasOwn(definitions, name)) { note(origin, `Missing or duplicate dbt model name ${name}; declaration not merged implicitly.`); continue; }
    const schema: MapValue = { type: 'object', readOnly: true, properties: Object.create(null), required: [], 'x-oods': { relationships: [] }, 'x-dbt': { meta: resource.meta ?? resource.config?.meta ?? {}, contract: resource.config?.contract ?? resource.contract ?? {}, constraints: resource.constraints ?? [] } };
    const desc = description(resource.description, { ...origin, pointer: `${origin.pointer}/description` }); if (desc) schema.description = desc;
    Object.defineProperty(definitions, name, { value: schema, enumerable: true });
    const base = `/$defs/${escapePointer(name)}`; origins[base] = origin;
    const columns = Array.isArray(resource.columns) ? resource.columns.map((column: MapValue, i: number) => [String(i), column]) : Object.entries(resource.columns ?? {});
    for (const [key, column] of columns as Array<[string, MapValue]>) {
      const field = column.name ?? key, at = { ...origin, pointer: `${origin.pointer}/columns/${escapePointer(key)}` };
      const property = scalar(column.data_type);
      // dbt's current properties syntax embeds semantic entities and dimensions in columns.
      if (column.dimension?.type === 'time') Object.assign(property, { type: 'string', format: 'date-time' });
      if (column.dimension?.type === 'categorical') property.type ??= 'string';
      if (column.entity) {
        property.type ??= 'string';
        if (['primary', 'unique'].includes(column.entity.type)) property['x-oods'] = { unique: true, ...(column.entity.type === 'primary' ? { primaryKey: true } : {}) };
        property['x-dbt-entity'] = column.entity;
      }
      if (column.dimension) property['x-dbt-dimension'] = column.dimension;
      const desc = description(column.description, { ...at, pointer: `${at.pointer}/description` }); if (desc) property.description = desc;
      const meta = column.meta ?? column.config?.meta;
      if (isMap(meta)) { property['x-dbt-meta'] = meta; if (isMap(meta['x-oods'])) property['x-oods'] = meta['x-oods']; }
      Object.defineProperty(schema.properties, field, { value: property, enumerable: true }); origins[`${base}/properties/${escapePointer(field)}`] = at;
      for (const [i, test] of [...(column.tests ?? []), ...(column.data_tests ?? [])].entries()) addTest(schema, field, test, { ...at, pointer: `${at.pointer}/tests/${i}` });
      for (const constraint of column.constraints ?? []) {
        if (constraint.type === 'not_null') schema.required.push(field);
        else if (['unique', 'primary_key'].includes(constraint.type)) { property['x-oods'] = { ...property['x-oods'], unique: true, ...(constraint.type === 'primary_key' ? { primaryKey: true } : {}) }; if (constraint.type === 'primary_key') schema.required.push(field); }
        else note(at, `Column constraint ${constraint.type} retained in source; expression not evaluated.`);
      }
      if (!property.type) note({ ...at, pointer: `${at.pointer}/data_type` }, 'Column has no declared scalar data type; no type is inferred from its name.');
    }
    for (const [i, metric] of (resource.metrics ?? []).entries()) {
      const at = { ...origin, pointer: `${origin.pointer}/metrics/${i}` }, field = metric.expr ?? metric.name;
      if (metric.type !== 'simple' || typeof field !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(field)) { note(at, 'Metric expression retained without evaluation.'); continue; }
      const property = schema.properties[field] ??= {};
      // Counting a key does not make the key numeric. Arithmetic measures do declare numeric values.
      if (['sum', 'average', 'avg', 'median'].includes(metric.agg)) property.type ??= 'number';
      property['x-dbt-metric'] = metric;
      if (metric.label) property['x-oods'] = { ...property['x-oods'], label: metric.label };
      note(at, 'Simple metric aggregation preserved as declared evidence.', 'mapped');
    }
    for (const [i] of [...(resource.tests ?? []), ...(resource.data_tests ?? [])].entries()) note({ ...origin, pointer: `${origin.pointer}/tests/${i}` }, 'Model test retained without SQL or template execution.');
    for (const constraint of resource.constraints ?? []) {
      if (['primary_key', 'unique', 'not_null'].includes(constraint.type)) { for (const field of constraint.columns ?? []) if (schema.properties[field]) {
        schema.properties[field]['x-oods'] = { ...schema.properties[field]['x-oods'], ...(constraint.columns.length === 1 ? { unique: true } : {}), ...(constraint.type === 'primary_key' ? { primaryKey: true } : {}) };
        if (constraint.type !== 'unique') schema.required.push(field);
      } } else note(origin, `Model constraint ${constraint.type} retained in the hub; no expression evaluated.`);
    }
    if (snapshot) {
      const custom = resource.config?.snapshot_meta_column_names ?? {};
      const from = custom.dbt_valid_from ?? 'dbt_valid_from', to = custom.dbt_valid_to ?? 'dbt_valid_to';
      schema.properties[from] ??= { type: 'string', format: 'date-time', readOnly: true };
      schema.properties[to] ??= { type: ['string', 'null'], format: 'date-time', readOnly: true };
      schema['x-oods'].history = { field: to, timestampField: from };
      note(origin, 'Snapshot declaration supplies type-2 validity fields and read-only history.', 'mapped');
    }
  }
  for (const { test, origin } of tests) {
    const metadata = test.test_metadata;
    if (!metadata?.name) { note(origin, 'Singular SQL test is not evaluated.'); continue; }
    const args = metadata.kwargs ?? {}, target = reference(args.model) ?? test.depends_on?.nodes?.map((id: string) => id.split('.').pop()).find((name: string) => definitions[name]);
    if (target && definitions[target]) addTest(definitions[target], test.column_name ?? args.column_name, { [metadata.name]: args }, origin);
    else note(origin, 'Generic test has no declared model target.');
  }
  for (const { model, origin } of semantics) {
    const target = reference(model.model) ?? model.node_relation?.alias;
    if (!target || !definitions[target]) { note(origin, 'Semantic model target cannot be resolved from a literal local model declaration.'); continue; }
    const schema = definitions[target];
    schema['x-dbt-semantic'] = model;
    for (const kind of ['entities', 'dimensions', 'measures']) for (const [i, entry] of (model[kind] ?? []).entries()) {
      const at = { ...origin, pointer: `${origin.pointer}/${kind}/${i}` };
      const field = entry.expr ?? entry.name;
      if (typeof field !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(field)) { note(at, 'Semantic expression is not a literal column name; retained without evaluation.'); continue; }
      const property = schema.properties[field] ??= {};
      if (kind === 'dimensions') Object.assign(property, entry.type === 'time' ? { type: 'string', format: 'date-time' } : entry.type === 'categorical' ? { type: 'string' } : {});
      if (kind === 'measures') { property.type ??= 'number'; property['x-dbt-aggregation'] = entry.agg; }
      if (kind === 'entities') {
        property.type ??= 'string';
        if (['primary', 'unique'].includes(entry.type)) property['x-oods'] = { ...property['x-oods'], unique: true, ...(entry.type === 'primary' ? { primaryKey: true } : {}) };
      }
      const desc = description(entry.description, at); if (desc) property.description = desc;
      const meta = entry.meta ?? entry.config?.meta;
      if (meta?.['x-oods']) property['x-oods'] = { ...property['x-oods'], ...meta['x-oods'] };
      origins[`/$defs/${escapePointer(target)}/properties/${escapePointer(field)}`] ??= at;
      note(at, `Semantic ${kind} supplies declared type, key or measure evidence; aggregation retained.`, 'mapped');
    }
  }
  for (const [name, schema] of Object.entries(definitions) as Array<[string, MapValue]>) {
    schema.required = [...new Set(schema.required)].sort();
    schema['x-oods'].relationships = schema['x-oods'].relationships.filter((edge: MapValue) => {
      if (definitions[edge.target]) return true;
      note(origins[`/$defs/${escapePointer(name)}`], `Related model ${edge.target} is absent from this source.`); return false;
    });
    if (!schema['x-oods'].relationships.length) delete schema['x-oods'].relationships;
  }
  return { value: { $defs: definitions }, origins, report };
}
