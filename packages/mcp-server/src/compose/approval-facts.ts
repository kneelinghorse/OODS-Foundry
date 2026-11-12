import type { UiElement, UiSchema } from '../schemas/generated.js';
import type { ComposedObject } from '../objects/trait-composer.js';
import { ToolError } from '../errors/tool-error.js';

type Fact = { fact: string; fields: readonly string[] };

/**
 * s245-m02, s246-m01: the five facts a screen where an approval's answer can be given must show beside the answer, as
 * the Decision trait names them. The thing and the asker are each kept as an id and a kept name; showing either shows
 * it. Who is asking includes who it is asked for (`also`): the screen shows that too when the record keeps it, and the
 * rule says nothing when it does not, since a person who asks for themselves has no one else to name.
 */
export const APPROVAL_FACTS: ReadonlyArray<Fact & { also?: Fact }> = [
  { fact: 'the thing', fields: ['subject_id', 'subject_name'] },
  { fact: 'exactly what was shown', fields: ['shown'] },
  { fact: 'the level', fields: ['level'] },
  { fact: 'the meaning', fields: ['meaning'] },
  { fact: 'who is asking', fields: ['requested_by_id', 'requested_by_name'], also: { fact: 'who it is asked for', fields: ['requested_for_id', 'requested_for_name'] } },
];

/** The components that edit a field; an answer is given through one bound to the record's lifecycle status. */
const ANSWER_CONTROLS = new Set(['Input', 'Select', 'SegmentedControl', 'Combobox', 'Textarea', 'DatePicker', 'Checkbox', 'Switch', 'Toggle', 'StatusSelector']);
/**
 * s246-m01: the containers of the component catalog that show what they hold only after the person acts. A Tabs shows
 * one panel at a time, each child its own panel, so a Tabs with a single panel hides nothing. A Dialog opens on its own,
 * modal by default with the page behind it inert, so it separates both ways. No other catalog component hides its
 * children: FilterPanel's collapsible fieldsets render open, and the detail page's Reference details disclosure is
 * generated code, not a schema node, on a page with no answer.
 */
const hiding = (node: UiElement): 'tab' | 'dialog' | undefined =>
  node.component === 'Dialog' ? 'dialog' : node.component === 'Tabs' && !node.collectionControl && (node.children?.length ?? 0) > 1 ? 'tab' : undefined;
const bound = (node: UiElement): string[] => Object.entries(node.props ?? {}).flatMap(([prop, value]) => (prop === 'field' || /Field$/.test(prop)) && typeof value === 'string' ? [value] : []);
/** "the level or the meaning": both messages say what is not shown or not kept, so the last item takes "or". */
const list = (items: string[]) => items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${items.at(-1)}`;

/** A node with where it sits: its screen, the tab panel it is in within each Tabs, and the dialogs around it. */
type Placed = { node: UiElement; screen: number; panels: ReadonlyArray<readonly [UiElement, number]>; dialogs: readonly UiElement[] };
/** A fact is beside an answer on the same screen, inside the same dialogs, and in the answer's panel of any Tabs it is in. */
const beside = (fact: Placed, answer: Placed): boolean => fact.screen === answer.screen
  && fact.dialogs.length === answer.dialogs.length && fact.dialogs.every(dialog => answer.dialogs.includes(dialog))
  && fact.panels.every(([tabs, panel]) => answer.panels.some(([other, index]) => other === tabs && index === panel));
/** Where a fact that is not beside the answer sits instead, in the words of the refusal. */
const whereIs = (fact: Placed, answer: Placed): string => fact.screen !== answer.screen ? 'on another screen'
  : fact.dialogs.some(dialog => !answer.dialogs.includes(dialog)) ? 'in a dialog'
    : answer.dialogs.some(dialog => !fact.dialogs.includes(dialog)) ? 'outside the dialog the answer is in' : 'in another tab';

/**
 * The approval-facts rule (s245-m02, s246-m01, traits/core/Decision), checked where the screen is made, beside the
 * result-state rule. A record composing Decision is found by its trait and its field bindings, never by semantic types:
 * a field an import leaves unbound loses its schema, semantics and views, exactly where the rule must say what is
 * missing.
 *
 * A screen is one where an answer can be given when a control edits the lifecycle's status. A collection's controls
 * (its filter, sort, search, the row that opens a record) are not answer controls, so a list never is such a screen.
 * Each answer control is held to the facts beside it: on its own screen, not in another tab, and inside the same dialogs
 * (a fact in a dialog the answer is not in, or outside the dialog the answer is in, is not beside it). A fact the record
 * keeps that is not beside an answer is refused (OODS-V221, naming it and where it is instead), and a fact the record
 * does not keep at all is a warning (OODS-V222, naming it) while the screen composes, so an accepted import never ends
 * with an object whose form cannot be composed. The rule reads the composed screen's structure, never its pixels or a
 * record's values: it cannot see the fold, a scrolled panel or styling that hides a fact, or whether the words are true
 * or enough, and it asks for the same five facts at every level. Only design_compose runs it.
 */
export function enforceApprovalFacts(schema: UiSchema, composed: ComposedObject | undefined): Array<{ code: string; message: string }> {
  const decision = composed?.traits.find(trait => trait.definition.trait.name === 'Decision');
  if (!composed || !decision) return [];
  const target = (ref: { fieldBindings?: Record<string, string | null> }, field: string): string | null =>
    ref.fieldBindings && Object.hasOwn(ref.fieldBindings, field) ? ref.fieldBindings[field]! : field;
  const stateful = composed.traits.find(trait => trait.definition.trait.name === 'Stateful');
  const status = stateful ? target(stateful.ref, 'status') : null;
  if (!status) return [];
  const placed: Placed[] = [];
  const walk = (node: UiElement, at: Omit<Placed, 'node'>): void => {
    placed.push({ node, ...at });
    const kind = hiding(node);
    node.children?.forEach((child, index) => walk(child, kind === 'tab' ? { ...at, panels: [...at.panels, [node, index]] } : kind === 'dialog' ? { ...at, dialogs: [...at.dialogs, node] } : at));
  };
  schema.screens.forEach((screen, index) => walk(screen, { screen: index, panels: [], dialogs: [] }));
  const answers = placed.filter(({ node }) => !node.collectionControl && ANSWER_CONTROLS.has(node.component) && node.props?.field === status);
  if (!answers.length) return [];
  const keptOf = (fields: readonly string[]) => fields.map(field => target(decision.ref, field)).filter((field): field is string => typeof field === 'string' && Boolean(composed.schema[field]));
  // Who it is asked for is held to the screen when the record keeps it, and is never a warning when it does not.
  const facts = APPROVAL_FACTS.flatMap(({ fact, fields, also }) => [{ fact, kept: keptOf(fields), warns: true }, ...(also ? [{ fact: also.fact, kept: keptOf(also.fields), warns: false }] : [])]);
  const unkept = facts.filter(({ kept, warns }) => warns && !kept.length).map(({ fact }) => fact);
  const elsewhere = new Map<string, Set<string>>();
  for (const answer of answers) for (const { fact, kept } of facts.filter(({ kept }) => kept.length)) {
    const binders = placed.filter(({ node }) => !node.collectionControl && bound(node).some(field => kept.includes(field)));
    if (binders.some(binder => beside(binder, answer))) continue;
    const places = elsewhere.get(fact) ?? new Set<string>();
    for (const binder of binders) places.add(whereIs(binder, answer));
    elsewhere.set(fact, places);
  }
  const object = composed.object.name;
  const missing = facts.map(({ fact }) => fact).filter(fact => elsewhere.has(fact));
  if (missing.length) {
    const misplaced = missing.filter(fact => elsewhere.get(fact)!.size);
    const where = Object.fromEntries(misplaced.map(fact => [fact, [...elsewhere.get(fact)!]]));
    const placedText = misplaced.length ? ` (${misplaced.map(fact => `${fact} is ${where[fact]!.join(' and ')}`).join('; ')})` : '';
    throw new ToolError('OODS-V221', `${object}'s screen gives an answer to an approval (its ${status}) without showing ${list(missing)} where the answer is given${placedText}: a screen where someone answers must show, beside the answer, the thing, exactly what was shown, the level, the meaning and who is asking, and who it is asked for when the record keeps it. A fact in another tab, on the other side of a dialog or on another screen is not beside it. Place the Decision trait's form views for them, or bind a node beside the answer to each. Nothing was written.`, { object, facts: missing, ...(misplaced.length ? { where } : {}) });
  }
  return unkept.length ? [{ code: 'OODS-V222', message: `${object}'s approvals do not keep ${list(unkept)}, so the screen where an answer is given cannot show ${unkept.length === 1 ? 'it' : 'them'}: the person answering sees only what the record keeps. Bind the Decision field for each to a field the source keeps.` }] : [];
}
