import { listObjects, loadObject } from '../../src/objects/object-loader.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';

/** The positive craft bar (s205-m01). Its rules, and why each reads the object rather than the composer, are in craft-says.s205.spec.ts. */
export type Field = { type?: string; required?: boolean; enum?: unknown[]; semanticType?: string };
const bare = (type: string | undefined) => String(type ?? '').replace(/\?$/, '');
const isIdentifier = (name: string, field: Field) => /(^|_)id$/i.test(name) || /\.id$/.test(field.semanticType ?? '');
const isDate = (field: Field) => ['date', 'datetime'].includes(bare(field.type));

/**
 * Reads the object's declared fields as composed with its traits (Invoice's `invoice_number` is a trait's field, not
 * the object file's) — the declarations only, never which field the composer chose to place where.
 */
export function recordFields(object: string, objectSchema: Record<string, Field>): { name?: string; primaryText?: string } {
  // The object's OWN declarations first, then what its traits add: traits compose ahead of the object's fields and
  // several carry generic `label`/`description` fields marked text.label, which would otherwise win over Person's
  // `name` or Mission's `title` — the fields the object's author actually wrote.
  const definition = loadObject(object);
  const own = new Set(Object.keys(definition.schema ?? {}));
  const authored = (definition.semantics ?? {}) as Record<string, { semantic_type?: string }>;
  // Own fields in the order the object FILE declares them (the only statement of importance the author made).
  const fields: Array<[string, Field]> = [...[...own].map(key => [key, objectSchema[key] ?? (definition.schema as Record<string, Field>)[key]!] as [string, Field]), ...Object.entries(objectSchema).filter(([key]) => !own.has(key))];
  const lower = object.toLowerCase();
  // The object's own semantics block first: the composed schema does not carry every authored semantic (Mission's
  // `title` is text.label in the object file and has no semanticType once composed).
  const semanticOf = (key: string, field: Field) => authored[key]?.semantic_type ?? field.semanticType ?? '';
  const name = fields.find(([key, field]) => semanticOf(key, field) === 'text.label')?.[0]
    ?? fields.find(([key, field]) => new RegExp(`\\.${lower}\\.(name|title|number|label|headline|subject)$`).test(semanticOf(key, field)))?.[0]
    ?? fields.find(([key]) => ['name', 'title', 'label', `${lower}_name`, `${lower}_title`, `${lower}_number`].includes(key))?.[0]
    // s206-m01: a <thing>_name names the thing. Without this step the last fallback named Usage by `provider`, the
    // billing provider every usage record shares; its meter names it. It comes after the semantic step, so Invoice
    // keeps its number over billing_contact_name. Measured: it changes the name of no other object.
    ?? fields.find(([key, field]) => /_name$/.test(key) && bare(field.type) === 'string')?.[0]
    ?? fields.find(([key, field]) => field.required && bare(field.type) === 'string' && !field.enum?.length && !isIdentifier(key, field) && !isDate(field))?.[0];
  const primaryText = fields.find(([key, field]) => /\.(text|body|content|description|summary)$/.test(semanticOf(key, field)))?.[0] ?? name;
  return { name, primaryText };
}

function nodes(schema: UiSchema | undefined): UiElement[] {
  const found: UiElement[] = [];
  const walk = (node: UiElement) => { found.push(node); node.children?.forEach(walk); };
  (schema?.screens ?? []).forEach(walk);
  return found;
}
/** Every field a node binds: `field`, and the `titleField`/`supportingField`/`statusField`… props components take. */
const boundAll = (node: UiElement): string[] => Object.entries(node.props ?? {})
  .filter(([prop, value]) => (prop === 'field' || /Field$/.test(prop)) && typeof value === 'string').map(([, value]) => value as string);
const TRUNCATING = ['maxLines', 'lines', 'truncate', 'clamp', 'lineClamp', 'excerpt', 'maxLength'];

export async function craftSays(): Promise<{ screens: number; refusedByDesign: string[]; failures: string[] }> {
  const failures: string[] = [];
  const refusedByDesign: string[] = [];
  let screens = 0;
  for (const object of listObjects()) {
    for (const context of ['card', 'list', 'detail'] as const) {
      const composed = await compose({ object, context, options: { transient: true, validate: false } });
      // OODS-V003 is a context the object refuses by design (Chunk composes only inline); it is typed, not a failure.
      if (composed.status !== 'ok') { (composed.errors?.[0]?.code === 'OODS-V003' ? refusedByDesign : failures).push(`${object}/${context}: ${composed.errors?.[0]?.code ?? composed.status}`); continue; }
      screens += 1;
      const objectSchema = (composed.schema.objectSchema ?? {}) as Record<string, Field>;
      const { name, primaryText } = recordFields(object, objectSchema);
      if (!name) { failures.push(`${object}/${context}: the object declares no field that names the record`); continue; }
      const all = nodes(composed.schema);
      if (context === 'card') {
        const binds = new Set(all.flatMap(boundAll));
        if (!binds.has(name)) failures.push(`${object}/card: does not name the record (${name})`);
        const facts = [...binds].filter(field => field !== name && !isIdentifier(field, objectSchema[field] ?? {}));
        if (!facts.length) failures.push(`${object}/card: states no fact beside the name`);
      } else if (context === 'list') {
        const rows = all.filter(node => /-row$/.test(node.id ?? ''));
        const named = rows.length > 0 && rows.every(row => nodes({ screens: [row] } as unknown as UiSchema).some(node => node !== row && boundAll(node).includes(name)));
        if (!named) failures.push(`${object}/list: rows do not name the record (${name}); rows bind ${[...new Set(rows.flatMap(row => nodes({ screens: [row] } as unknown as UiSchema).filter(node => node !== row).flatMap(boundAll)))].join(', ') || 'nothing'}`);
      } else {
        const carriers = all.filter(node => boundAll(node).includes(primaryText!));
        if (!carriers.length) failures.push(`${object}/detail: does not carry the primary text (${primaryText})`);
        else if (carriers.every(node => TRUNCATING.some(prop => node.props?.[prop] !== undefined) || node.meta?.headingExcerpt)) failures.push(`${object}/detail: carries the primary text (${primaryText}) only truncated`);
      }
    }
  }
  return { screens, refusedByDesign, failures };
}

