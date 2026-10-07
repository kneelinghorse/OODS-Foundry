import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { ImportProblem, escapePointer, isMap, type Document, type MapValue, type Origin } from '../source.js';
import type { ReaderResult } from './types.js';

const array = (value: any): any[] => value === undefined ? [] : Array.isArray(value) ? value : [value];
const pathOf = (value: any): string | undefined => isMap(value) ? value.$Path ?? value.$PropertyPath ?? value.$NavigationPropertyPath ?? value.$AnnotationPath : undefined;
const localPath = (value: any) => { const path = pathOf(value); return path && !path.includes('/') ? path : undefined; };
const staticText = (value: any): string | undefined => typeof value === 'string' && !/^\{i18n>[^}]+\}$/.test(value) ? value : undefined;
const bool = (value: any) => value === true || value === 'true';

/** CSDL XML is lowered directly, preserving vocabulary expressions instead of passing through OpenAPI. */
function xmlCsdl(doc: Document): MapValue {
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(doc.text!)) throw new ImportProblem('input', 'XML DTD and entity declarations are refused.', { file: doc.file, pointer: '' });
  const valid = XMLValidator.validate(doc.text!);
  if (valid !== true) throw new ImportProblem('input', `Invalid CSDL XML: ${valid.err.msg}`, { file: doc.file, pointer: '' });
  const parsed = new XMLParser({ ignoreAttributes: false, parseTagValue: false, parseAttributeValue: false, processEntities: false, transformTagName: name => name.split(':').pop()!, maxNestedTags: 160 }).parse(doc.text!);
  const decode = (text: any): any => typeof text === 'string' ? text.replace(/&(amp|lt|gt|quot|apos);/g, (_match, key) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[key as 'amp']) : text;
  const value = (node: any): any => {
    if (!isMap(node)) return decode(node);
    for (const key of ['Path', 'PropertyPath', 'NavigationPropertyPath', 'AnnotationPath']) if (node[`@_${key}`] !== undefined || node[key] !== undefined) return { [`$${key}`]: node[`@_${key}`] ?? node[key] };
    for (const key of ['String', 'Bool', 'Int', 'Decimal', 'Float', 'EnumMember']) {
      const val = node[`@_${key}`] ?? node[key];
      if (val !== undefined) return key === 'Bool' ? bool(val) : ['Int', 'Decimal', 'Float'].includes(key) ? Number(val) : decode(val);
    }
    if (node.Collection !== undefined) { const collection = node.Collection; if (!isMap(collection)) return []; return Object.entries(collection).filter(([key]) => !key.startsWith('@_')).flatMap(([key, entries]) => array(entries).map(entry => key === 'Record' ? value({ Record: entry }) : value({ [key]: entry }))); }
    if (node.Record !== undefined) {
      const record = node.Record, result: MapValue = Object.create(null);
      if (record['@_Type']) result.$Type = record['@_Type'];
      for (const prop of array(record.PropertyValue)) result[prop['@_Property']] = value(prop);
      return result;
    }
    if (Object.keys(node).every(key => ['@_Term', '@_Qualifier'].includes(key))) return true;
    return { $Expression: node };
  };
  const annotated = (node: MapValue): MapValue => Object.fromEntries(array(node.Annotation).map(item => [`@${item['@_Term']}${item['@_Qualifier'] ? `#${item['@_Qualifier']}` : ''}`, value(item)]));
  const root = parsed.Edmx ?? parsed;
  const result: MapValue = { $Version: root['@_Version'] ?? '4.0', $Reference: {} };
  for (const ref of array(root.Reference)) result.$Reference[ref['@_Uri']] = { $Include: array(ref.Include).map(include => ({ $Namespace: include['@_Namespace'], $Alias: include['@_Alias'] })) };
  for (const schema of array(root.DataServices?.Schema ?? root.Schema)) {
    const namespace = schema['@_Namespace'], target: MapValue = Object.create(null); result[namespace] = target;
    if (schema['@_Alias']) target.$Alias = schema['@_Alias'];
    for (const kind of ['EntityType', 'ComplexType', 'EnumType', 'TypeDefinition', 'EntityContainer', 'Association']) for (const item of array(schema[kind])) {
      const name = item['@_Name'], output: MapValue = { $Kind: kind, ...annotated(item) }; target[name] = output;
      if (item['@_BaseType']) output.$BaseType = item['@_BaseType'];
      if (item['@_UnderlyingType']) output.$UnderlyingType = item['@_UnderlyingType'];
      if (item.Key) output.$Key = array(item.Key.PropertyRef).map(key => key['@_Name']);
      if (kind === 'EnumType') for (const member of array(item.Member)) output[member['@_Name']] = Number(member['@_Value'] ?? 0);
      if (kind === 'Association') {
        output.$Ends = array(item.End).map(end => ({ role: end['@_Role'], type: end['@_Type'], multiplicity: end['@_Multiplicity'] }));
        if (item.ReferentialConstraint) output.$Constraint = Object.fromEntries(['Principal', 'Dependent'].map(role => [role, { role: item.ReferentialConstraint[role]?.['@_Role'], fields: array(item.ReferentialConstraint[role]?.PropertyRef).map(property => property['@_Name']) }]));
        continue;
      }
      for (const propertyKind of ['Property', 'NavigationProperty', 'EntitySet', 'Singleton']) for (const property of array(item[propertyKind])) {
        const field: MapValue = { $Kind: propertyKind, ...annotated(property) };
        for (const [key, val] of Object.entries(property)) if (key.startsWith('@_')) {
          const attr = key.slice(2);
          if (attr.startsWith('sap:')) field[`@${attr}`] = decode(val);
          else if (attr !== 'Name') field[`$${attr}`] = val;
        }
        if (field.$EntityType) field.$Type = field.$EntityType;
        const collection = /^Collection\((.*)\)$/.exec(field.$Type ?? ''); if (collection) { field.$Type = collection[1]; field.$Collection = true; }
        if (['Property', 'NavigationProperty'].includes(propertyKind)) field.$Nullable = field.$Nullable === undefined ? true : bool(field.$Nullable);
        if (property.ReferentialConstraint) field.$ReferentialConstraint = Object.fromEntries(array(property.ReferentialConstraint).map(constraint => [constraint['@_Property'], constraint['@_ReferencedProperty']]));
        output[property['@_Name']] = field;
      }
    }
    for (const external of array(schema.Annotations)) target.$Annotations = { ...target.$Annotations, [external['@_Target']]: annotated(external) };
  }
  return result;
}

export function readOdata(documents: Document[]): ReaderResult {
  const definitions: MapValue = Object.create(null), origins: ReaderResult['origins'] = {}, report: ReaderResult['report'] = [];
  const types = new Map<string, { value: MapValue; origin: Origin }>(), aliases = new Map<string, string>();
  const sets = new Map<string, string>();
  const containers: Array<{ name: string; value: MapValue; origin: Origin }> = [], annotations: Array<{ target: string; value: MapValue; origin: Origin }> = [];
  const note = (origin: Origin, reason: string, outcome: 'mapped' | 'unmapped' = 'unmapped') => report.push({ ...origin, kind: 'keyword', outcome, reason });
  const expand = (name: string): string => { const i = name.indexOf('.'); return i < 0 ? name : `${aliases.get(name.slice(0, i)) ?? name.slice(0, i)}${name.slice(i)}`; };
  for (const doc of documents) {
    const data = doc.text !== undefined ? xmlCsdl(doc) : doc.value;
    for (const [uri, reference] of Object.entries(data.$Reference ?? {}) as Array<[string, MapValue]>) {
      for (const include of reference.$Include ?? []) if (include.$Alias) aliases.set(include.$Alias, include.$Namespace);
      note({ file: doc.file, pointer: `/$Reference/${escapePointer(uri)}` }, `Referenced vocabulary/model ${uri} is not fetched; declarations supplied in this folder remain available.`);
    }
    for (const [namespace, value] of Object.entries(data) as Array<[string, MapValue]>) if (!namespace.startsWith('$') && isMap(value)) {
      if (value.$Alias) aliases.set(value.$Alias, namespace);
      for (const [target, annotation] of Object.entries(value.$Annotations ?? {})) annotations.push({ target, value: annotation as MapValue, origin: { file: doc.file, pointer: `/${escapePointer(namespace)}/$Annotations/${escapePointer(target)}` } });
      for (const [name, item] of Object.entries(value) as Array<[string, MapValue]>) if (!name.startsWith('$') && isMap(item)) {
        const origin = { file: doc.file, pointer: `/${escapePointer(namespace)}/${escapePointer(name)}` };
        if (item.$Kind === 'EntityContainer') containers.push({ name: `${namespace}.${name}`, value: item, origin });
        else if (['EntityType', 'ComplexType', 'EnumType', 'TypeDefinition', 'Association'].includes(item.$Kind)) {
          const full = `${namespace}.${name}`; if (types.has(full)) throw new ImportProblem('schema', `Duplicate OData type ${full}.`, origin);
          types.set(full, { value: item, origin });
        } else note(origin, 'CSDL operation/term declaration retained; no operation is executed.');
      }
    }
  }
  for (const annotation of annotations) {
    const [type, field] = annotation.target.split('/'), target = types.get(expand(type)) ?? containers.find(container => container.name === expand(type));
    const destination = target && (field ? target.value[field] : target.value);
    if (destination) Object.assign(destination, annotation.value);
    else note(annotation.origin, `External annotation target ${annotation.target} is absent or is not an object field.`);
  }
  for (const { value } of containers) for (const [name, set] of Object.entries(value) as Array<[string, MapValue]>) if (isMap(set) && set.$Type) sets.set(name, expand(set.$Type));
  const term = (key: string) => key.replace(/^@/, '').replace(/#[^#]+$/, '').replace(/^(?:com\.sap\.vocabularies|Org\.OData)\./, '').replace(/\.v1\./i, '.');
  const annotationsOf = (value: MapValue) => Object.entries(value).filter(([key]) => key.startsWith('@')).map(([key, val]) => [key, term(`@${expand(key.slice(1))}`), val] as const);
  const annotationValue = (value: MapValue, wanted: string) => annotationsOf(value).find(([, name]) => name === wanted)?.[2];
  const readOnly = (value: MapValue) => value['@sap:creatable'] === 'false' && value['@sap:updatable'] === 'false'
    || annotationValue(value, 'Capabilities.InsertRestrictions')?.Insertable === false && annotationValue(value, 'Capabilities.UpdateRestrictions')?.Updatable === false;
  const scalar = (type: string): MapValue => {
    if (['Edm.String', 'Edm.Stream', 'Edm.Binary'].includes(type)) return { type: 'string' };
    if (type === 'Edm.Guid') return { type: 'string', format: 'uuid' };
    if (type === 'Edm.Boolean') return { type: 'boolean' };
    if (/^Edm\.(Byte|SByte|Int16|Int32|Int64)$/.test(type)) return { type: 'integer' };
    if (/^Edm\.(Decimal|Double|Single)$/.test(type)) return { type: 'number' };
    if (['Edm.DateTime', 'Edm.DateTimeOffset'].includes(type)) return { type: 'string', format: 'date-time' };
    if (type === 'Edm.Date') return { type: 'string', format: 'date' };
    if (['Edm.Time', 'Edm.TimeOfDay', 'Edm.Duration'].includes(type)) return { type: 'string' };
    return { $ref: `#/$defs/${escapePointer(expand(type))}` };
  };
  for (const [name, { value, origin }] of types) {
    if (value.$Kind === 'Association') { note(origin, 'v2 association retained as navigation target evidence.'); continue; }
    const base = `/$defs/${escapePointer(name)}`; origins[base] = origin;
    const schema: MapValue = value.$Kind === 'EnumType' ? { type: 'string', enum: Object.keys(value).filter(key => !/^[$@]/.test(key)) }
      : value.$Kind === 'TypeDefinition' ? scalar(value.$UnderlyingType) : { type: 'object', properties: Object.create(null), required: [], 'x-oods': {} };
    definitions[name] = schema;
    if (value.$BaseType) schema.allOf = [{ $ref: `#/$defs/${escapePointer(expand(value.$BaseType))}` }];
    schema['x-odata'] = Object.fromEntries(Object.entries(value).filter(([key]) => /^[$@]/.test(key)));
    const description = annotationValue(value, 'Core.Description'); if (staticText(description)) schema.description = description;
    else if (description) note(origin, 'Localized description retained; no translation bundle was supplied.');
    if (!schema.properties) continue;
    if (readOnly(value)) schema.readOnly = true;
    for (const [field, raw] of Object.entries(value) as Array<[string, MapValue]>) {
      if (/^[$@]/.test(field) || !isMap(raw)) continue;
      const at = { ...origin, pointer: `${origin.pointer}/${escapePointer(field)}` };
      let type = raw.$Type ?? 'Edm.String', many = raw.$Collection === true;
      if (raw.$Relationship) {
        const declaration = types.get(expand(raw.$Relationship))?.value;
        const association = declaration?.$Ends?.find((end: MapValue) => end.role === raw.$ToRole);
        if (!association) { note(at, `Navigation association ${raw.$Relationship} is unavailable.`); continue; }
        type = association.type; many = association.multiplicity === '*';
        const constraint = declaration?.$Constraint;
        if (constraint?.Principal.role === raw.$ToRole && constraint.Dependent.role === raw.$FromRole && constraint.Principal.fields.length === constraint.Dependent.fields.length) raw.$ReferentialConstraint = Object.fromEntries(constraint.Dependent.fields.map((field: string, index: number) => [field, constraint.Principal.fields[index]]));
      }
      if (raw.$Kind === 'NavigationProperty' && !many && raw.$ReferentialConstraint && Object.keys(raw.$ReferentialConstraint).length === 1) {
        const local = Object.keys(raw.$ReferentialConstraint)[0];
        if (value[local]) {
          schema['x-odata'].navigation = { ...schema['x-odata'].navigation, [field]: raw };
          schema['x-oods'].relationships = [...(schema['x-oods'].relationships ?? []), { target: expand(type), via: local, cardinality: 'many-to-one', label: staticText(annotationValue(raw, 'Common.Label')) ?? field }];
          note(at, `Navigation uses its declared foreign-key field ${local}; no duplicate editor is created.`, 'mapped');
          continue;
        }
      }
      if (raw.$ReferentialConstraint && Object.keys(raw.$ReferentialConstraint).length > 1) note(at, 'Composite navigation constraint retained; separate scalar foreign-key pickers are not inferred.');
      let property = scalar(type);
      if (many) property = { type: 'array', items: raw.$Nullable === true && raw.$Kind !== 'NavigationProperty' ? property.type ? { ...property, type: [property.type, 'null'] } : { anyOf: [property, { type: 'null' }] } : property };
      const hints: MapValue = {};
      for (const [key, vocabulary, annotation] of annotationsOf(raw)) {
        let mapped = true;
        if (typeof annotation === 'string' && !staticText(annotation)) { note({ ...at, pointer: `${at.pointer}/${escapePointer(key)}` }, 'Localized annotation retained; no translation bundle was supplied.'); continue; }
        if (['Common.Label', 'sap:label'].includes(vocabulary) && typeof annotation === 'string') hints.label = annotation;
        else if (vocabulary === 'Core.Description' && typeof annotation === 'string') property.description = annotation;
        else if (vocabulary === 'Common.Text' && localPath(annotation)) hints.displayLabelField = localPath(annotation);
        else if (['Core.Computed', 'Core.Immutable'].includes(vocabulary)) { if (bool(annotation)) property.readOnly = true; }
        else if (vocabulary === 'sap:updatable' || vocabulary === 'sap:creatable') { if (annotation === 'false') property.readOnly = true; }
        else if (vocabulary === 'sap:display-format' && annotation === 'Date') { property.type = 'string'; property.format = 'date'; }
        else if (vocabulary === 'Measures.ISOCurrency' && localPath(annotation)) hints.currency = { field: localPath(annotation) };
        else if (vocabulary === 'Measures.Unit') hints.unit = localPath(annotation) ? { field: localPath(annotation) } : typeof annotation === 'string' ? { symbol: annotation } : undefined;
        else if (vocabulary === 'Validation.AllowedValues' && Array.isArray(annotation)) property.enum = annotation.map(item => item.Value).filter(item => item !== undefined);
        else if (vocabulary === 'Common.ValueList' && isMap(annotation)) {
          const target = sets.get(annotation.CollectionPath);
          if (target) schema['x-oods'].relationships = [...(schema['x-oods'].relationships ?? []), { target, via: field, cardinality: 'many-to-one', label: staticText(annotation.Label) ?? hints.label ?? field }];
          else mapped = false;
        } else mapped = false;
        note({ ...at, pointer: `${at.pointer}/${escapePointer(key)}` }, mapped ? 'Declared vocabulary projected into field semantics or behavior.' : 'Vocabulary retained in the hub; no supported field projection.', mapped ? 'mapped' : 'unmapped');
      }
      if (hints.unit?.symbol) hints.label = `${hints.label ?? field} (${hints.unit.symbol})`;
      if (hints.unit?.field) note({ ...at, pointer: `${at.pointer}/@Measures.Unit` }, 'Dynamic unit pairing preserved in object semantics; no unit conversion or dynamic unit text is performed.');
      if (raw.$MaxLength && Number.isFinite(Number(raw.$MaxLength))) property.maxLength = Number(raw.$MaxLength);
      if (raw.$DefaultValue !== undefined) property.default = property.type === 'boolean' ? bool(raw.$DefaultValue) : ['integer', 'number'].includes(property.type) ? Number(raw.$DefaultValue) : raw.$DefaultValue;
      const keys = (value.$Key ?? []).map((key: any) => typeof key === 'string' ? key : Object.values(key)[0]);
      if (keys.includes(field)) { hints.primaryKey = true; hints.unique = keys.length === 1; }
      if (keys.includes(field) || many || raw.$Nullable !== true) schema.required.push(field);
      else property = property.type ? { ...property, type: [property.type, 'null'] } : { anyOf: [property, { type: 'null' }] };
      if (Object.keys(hints).length) property['x-oods'] = Object.fromEntries(Object.entries(hints).filter(([, val]) => val !== undefined));
      property['x-odata'] = raw;
      schema.properties[field] = property; origins[`${base}/properties/${escapePointer(field)}`] = at;
      if (!many && raw.$ReferentialConstraint && Object.keys(raw.$ReferentialConstraint).length === 1) for (const local of Object.keys(raw.$ReferentialConstraint)) schema['x-oods'].relationships = [...(schema['x-oods'].relationships ?? []), { target: expand(type), via: local, cardinality: 'many-to-one', label: hints.label ?? field }];
    }
    const header = annotationValue(value, 'UI.HeaderInfo');
    if (header) { schema['x-oods'].titleField = localPath(header.Title?.Value); schema['x-oods'].summaryField = localPath(header.Description?.Value); }
    const line = annotationValue(value, 'UI.LineItem');
    if (Array.isArray(line)) schema['x-oods'].listColumns = line.map(item => ({ field: localPath(item.Value), ...(staticText(item.Label) ? { label: item.Label } : {}) })).filter(item => item.field && schema.properties[item.field]);
    const facets = annotationValue(value, 'UI.Facets');
    const facetLabels = new Map<string, string>();
    const visitFacets = (entries: any[]) => { for (const facet of entries) { const path = pathOf(facet.Target); if (path && staticText(facet.Label)) facetLabels.set(path.replace(/^@/, ''), facet.Label); if (Array.isArray(facet.Facets)) visitFacets(facet.Facets); } };
    if (Array.isArray(facets)) visitFacets(facets);
    for (const [key, vocabulary, annotation] of annotationsOf(value)) {
      if (vocabulary === 'UI.FieldGroup') {
        const group = facetLabels.get(key.slice(1)) ?? staticText(annotation.Label) ?? key.split('#')[1] ?? 'Details';
        for (const entry of annotation.Data ?? []) { const field = localPath(entry.Value); if (field && schema.properties[field]) schema.properties[field]['x-oods'] = { ...schema.properties[field]['x-oods'], detailGroup: group }; }
      }
      const supported = ['UI.HeaderInfo', 'UI.LineItem', 'UI.FieldGroup', 'UI.Facets', 'Core.Description'].includes(vocabulary);
      note({ ...origin, pointer: `${origin.pointer}/${escapePointer(key)}` }, supported ? 'Declared UI vocabulary shapes record presentation.' : 'Vocabulary preserved in the hub without a supported object projection.', supported ? 'mapped' : 'unmapped');
    }
    schema['x-oods'] = Object.fromEntries(Object.entries(schema['x-oods']).filter(([, val]) => val !== undefined));
    for (const property of Object.values(schema.properties) as MapValue[]) {
      const currency = property['x-oods']?.currency?.field;
      if (currency && schema.properties[currency]) schema.properties[currency].format = 'iso-4217';
    }
  }
  for (const { value, origin } of containers) for (const [name, set] of Object.entries(value) as Array<[string, MapValue]>) if (isMap(set) && set.$Type) {
    const schema = definitions[expand(set.$Type)];
    if (schema && readOnly(set)) schema.readOnly = true;
    note({ ...origin, pointer: `${origin.pointer}/${escapePointer(name)}` }, schema ? 'Entity set supplies type and capability evidence.' : 'Entity-set type is unavailable.', schema ? 'mapped' : 'unmapped');
  }
  return { value: { $defs: definitions }, origins, report };
}
