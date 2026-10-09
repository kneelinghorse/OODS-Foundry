import type { FieldSchemaEntry } from '../schemas/generated.js';
import { loadObject } from '../objects/object-loader.js';
import type { ObjectDefinition } from '../objects/types.js';

const bare = (type: string | undefined) => String(type ?? '').replace(/\?$/, '');

/** A field whose semantic type says it is the record's prose rather than a name for it. */
export const isProseSemantic = (semantic: string | undefined) => /\.(text|body|content|summary|description)$/.test(semantic ?? '');

/**
 * s206-m01: the one field that names a record — the rule the positive craft bar measures (test/product-reality/
 * craft-says.ts), so a card, a list row, a detail heading and the sample data all name a record with the field its
 * author wrote. It replaces s205-m02's `authoredLabelField` (the single text.label field, consulted only where the
 * fixed list fell back to an identifier), which its first step subsumes. Before this, each producer took the first of a fixed list (plan_name, name, title, display_name, label)
 * and otherwise the identifier: a trait's generic `label` headed Person's card instead of its `name`, Subscription's
 * card named nothing, and Invoice's detail was titled by its id.
 *
 * The object's OWN fields come first, in the order its file declares them, then the fields its traits add:
 *   1. the field marked `text.label`;
 *   2. a field whose semantic type is the object's own name/title/number/label/headline/subject (Invoice's number);
 *   3. a field called name, title or label, or <object>_name/_title/_number;
 *   4. a field called <thing>_name (Usage's meter_name) — after 2, so Invoice keeps its number over its contact's name;
 *   5. the first required plain string that is not an identifier, an enum or a date.
 * An object that declares none of these has no field that names a record.
 */
export function recordNameField(objectName: string | undefined, fields: Record<string, FieldSchemaEntry>): string | undefined {
  let definition: ObjectDefinition | undefined;
  try { definition = objectName ? loadObject(objectName) : undefined; } catch { definition = undefined; }
  const own = Object.keys(definition?.schema ?? {}).filter(name => fields[name]);
  const ordered = [...own, ...Object.keys(fields).filter(name => !own.includes(name))];
  const authored = (definition?.semantics ?? {}) as Record<string, { semantic_type?: string }>;
  const semantic = (name: string) => authored[name]?.semantic_type ?? fields[name]?.semanticType ?? '';
  const lower = (definition?.object.name ?? objectName ?? '').toLowerCase();
  const isIdentifier = (name: string) => /(^|_)id$/i.test(name) || /\.id$/.test(fields[name]?.semanticType ?? '');
  const isDate = (name: string) => ['date', 'datetime'].includes(bare(fields[name]?.type));
  return ordered.find(name => semantic(name) === 'text.label')
    ?? (lower ? ordered.find(name => new RegExp(`\\.${lower}\\.(name|title|number|label|headline|subject)$`, 'i').test(semantic(name))) : undefined)
    ?? ordered.find(name => ['name', 'title', 'label', `${lower}_name`, `${lower}_title`, `${lower}_number`].includes(name))
    ?? ordered.find(name => /_name$/.test(name) && bare(fields[name]!.type) === 'string')
    ?? (definition?.object.domain === 'imported' ? undefined : ordered.find(name => fields[name]!.required && bare(fields[name]!.type) === 'string' && !fields[name]!.enum?.length && !isIdentifier(name) && !isDate(name)));
}

/**
 * The field a generated app titles, sorts and headings a record by: `recordNameField`, unless that is the record's
 * prose (a heading is a name, not a paragraph — a CMOS decision has no title), else the fallback identifier.
 */
export function recordTitleField(objectName: string | undefined, fields: Record<string, FieldSchemaEntry>, fallback: string): string {
  const named = recordNameField(objectName, fields);
  return named && !isProseSemantic(fields[named]?.semanticType) ? named : fallback;
}

/**
 * s210-m01: the one field that says what a record is about in a line — the field its object marks `text.summary` —
 * shown under the record's name on a list row and as the detail heading's subtitle. An object that marks none has no
 * summary line; a list row then names the record and shows its trait facts, as before.
 */
export function recordSummaryField(objectName: string | undefined, fields: Record<string, FieldSchemaEntry>): string | undefined {
  let definition: ObjectDefinition | undefined;
  try { definition = objectName ? loadObject(objectName) : undefined; } catch { definition = undefined; }
  const authored = (definition?.semantics ?? {}) as Record<string, { semantic_type?: string }>;
  const semantic = (name: string) => authored[name]?.semantic_type ?? fields[name]?.semanticType ?? '';
  return Object.keys(fields).find(name => semantic(name) === 'text.summary' && bare(fields[name]?.type) === 'string');
}
