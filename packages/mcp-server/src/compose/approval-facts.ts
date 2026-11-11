import type { UiElement, UiSchema } from '../schemas/generated.js';
import type { ComposedObject } from '../objects/trait-composer.js';
import { ToolError } from '../errors/tool-error.js';

/**
 * s245-m02: the four facts a screen where an approval's answer can be given must also show, as the Decision trait names
 * them. The thing is kept as an id and a kept name; showing either shows the thing.
 */
export const APPROVAL_FACTS: ReadonlyArray<{ fact: string; fields: readonly string[] }> = [
  { fact: 'the thing', fields: ['subject_id', 'subject_name'] },
  { fact: 'exactly what was shown', fields: ['shown'] },
  { fact: 'the level', fields: ['level'] },
  { fact: 'the meaning', fields: ['meaning'] },
];

/** The components that edit a field; an answer is given through one bound to the record's lifecycle status. */
const ANSWER_CONTROLS = new Set(['Input', 'Select', 'SegmentedControl', 'Combobox', 'Textarea', 'DatePicker', 'Checkbox', 'Switch', 'Toggle', 'StatusSelector']);
const bound = (node: UiElement): string[] => Object.entries(node.props ?? {}).flatMap(([prop, value]) => (prop === 'field' || /Field$/.test(prop)) && typeof value === 'string' ? [value] : []);
/** "the level or the meaning": both messages say what is not shown or not kept, so the last item takes "or". */
const list = (items: string[]) => items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${items.at(-1)}`;

/**
 * The approval-facts rule (s245-m02, traits/core/Decision), checked where the screen is made, beside the result-state
 * rule. A record composing Decision is found by its trait and its field bindings, never by semantic types: a field an
 * import leaves unbound loses its schema, semantics and views, exactly where the rule must say what is missing.
 *
 * A screen is one where an answer can be given when a control edits the lifecycle's status. A collection's controls
 * (its filter, sort, search, the row that opens a record) are not answer controls, so a list never is such a screen.
 * On such a screen, a fact the record keeps that the screen leaves out is refused (OODS-V221, naming it), and a fact the
 * record does not keep at all is a warning (OODS-V222, naming it) while the screen composes, so an accepted import never
 * ends with an object whose form cannot be composed. The rule checks presence only: it never reads a record's values,
 * cannot see whether a fact is above the fold or behind a tab, and asks for the same four facts at every level.
 */
export function enforceApprovalFacts(schema: UiSchema, composed: ComposedObject | undefined): Array<{ code: string; message: string }> {
  const decision = composed?.traits.find(trait => trait.definition.trait.name === 'Decision');
  if (!composed || !decision) return [];
  const target = (ref: { fieldBindings?: Record<string, string | null> }, field: string): string | null =>
    ref.fieldBindings && Object.hasOwn(ref.fieldBindings, field) ? ref.fieldBindings[field]! : field;
  const stateful = composed.traits.find(trait => trait.definition.trait.name === 'Stateful');
  const status = stateful ? target(stateful.ref, 'status') : null;
  if (!status) return [];
  const nodes: UiElement[] = [];
  const walk = (node: UiElement): void => { nodes.push(node); node.children?.forEach(walk); };
  schema.screens.forEach(walk);
  const answers = nodes.some(node => !node.collectionControl && ANSWER_CONTROLS.has(node.component) && node.props?.field === status);
  if (!answers) return [];
  const shown = new Set(nodes.filter(node => !node.collectionControl).flatMap(bound));
  const missing: string[] = [];
  const unkept: string[] = [];
  for (const { fact, fields } of APPROVAL_FACTS) {
    const kept = fields.map(field => target(decision.ref, field)).filter((field): field is string => typeof field === 'string' && Boolean(composed.schema[field]));
    if (!kept.length) unkept.push(fact);
    else if (!kept.some(field => shown.has(field))) missing.push(fact);
  }
  const object = composed.object.name;
  if (missing.length) {
    throw new ToolError('OODS-V221', `${object}'s screen gives an answer to an approval (its ${status}) without showing ${list(missing)}: a screen where someone answers must also show the thing, exactly what was shown, the level and the meaning. Place the Decision trait's form views for them, or bind a node on the screen to each. Nothing was written.`, { object, facts: missing });
  }
  return unkept.length ? [{ code: 'OODS-V222', message: `${object}'s approvals do not keep ${list(unkept)}, so the screen where an answer is given cannot show ${unkept.length === 1 ? 'it' : 'them'}: the person answering sees only what the record keeps. Bind the Decision field for each to a field the source keeps.` }] : [];
}
