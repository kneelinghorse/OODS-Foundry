/**
 * s255-m02 (settled 6 and 7): what a memory's own pages draw, by its state, alike in React, Vue and HTML.
 *
 * A removed memory holds no words, no note on its source and no statement from the person, so on its list rows, its card,
 * its detail page and its form those places, and what removing it would leave, are drawn only while the memory is not
 * removed: a product that still sends the words of a removed memory has them shown nowhere. What remains after the
 * removal is drawn only once it is removed. Each of the three always-shown places (how it was made, what removing it
 * would leave, what remains) reads its words for an absent value from its declared label ("Not known", "Not reported";
 * storedValueLabel).
 *
 * The states come from the record's own lifecycle (Stateful's states). s255-m04: a team's store names its removal in its own
 * words, so a state named removed, forgotten, deleted or erased is read as the removal (the first the lifecycle declares);
 * a lifecycle with none is drawn as the trait declares it. A field the object binds elsewhere (fieldBindings) is followed
 * to its bound name.
 */
import type { UiElement, UiSchema } from '../schemas/generated.js';
import type { ComposedObject } from '../objects/trait-composer.js';
import { STATUSES_PROP } from '../codegen/binding-utils.js';

export const REMOVED_STATE = 'removed';
/** The names a store gives the state of a memory it no longer keeps, read as the removal. */
export const REMOVAL_STATES = [REMOVED_STATE, 'forgotten', 'deleted', 'erased'];
/** The places a memory keeps only while it is not removed, by the trait's field names. */
const KEPT_UNTIL_REMOVED = ['words', 'source_note', 'persons_statement', 'removing_leaves'];
/** The places drawn only once it is removed. */
const ONCE_REMOVED = ['remains'];

const walk = (node: UiElement, visit: (node: UiElement) => void) => { visit(node); node.children?.forEach(child => walk(child, visit)); };
/** The field a read row shows: the child the composer marks as the read value. */
const rowField = (row: UiElement): string | undefined => {
  const value = row.children?.find(child => child.meta?.intent === 'read-only-field')?.props?.field;
  return typeof value === 'string' ? value : undefined;
};

export function placeRememberedFacts(schema: UiSchema, composed: Pick<ComposedObject, 'traits'>, context: string): void {
  if (!['list', 'card', 'detail', 'form'].includes(context)) return;
  const remembered = composed.traits.find(trait => /(?:^|\/)Remembered$/.test(trait.ref.name));
  const lifecycle = composed.traits.find(trait => /(?:^|\/)Stateful$/.test(trait.ref.name));
  const states = lifecycle?.ref.parameters?.states;
  const removal = Array.isArray(states) ? (states as unknown[]).map(String).find(state => REMOVAL_STATES.includes(state)) : undefined;
  if (!remembered || !removal) return;
  const bindings = (remembered.ref.fieldBindings ?? {}) as Record<string, string | null>;
  const bound = (field: string) => Object.hasOwn(bindings, field) ? bindings[field] : field;
  const kept = new Set(KEPT_UNTIL_REMOVED.map(bound).filter((field): field is string => typeof field === 'string'));
  const after = new Set(ONCE_REMOVED.map(bound).filter((field): field is string => typeof field === 'string'));
  const open = (states as unknown[]).map(String).filter(state => state !== removal).join(' ');
  for (const screen of schema.screens) walk(screen as UiElement, node => {
    // A detail or form row holds its value in a child; a list row's or a card's cell names its field itself.
    const cell = node.component === 'LabelCell' && typeof node.props?.field === 'string' ? node.props.field : undefined;
    if (!cell && !node.id.endsWith('-read-field') && node.meta?.intent !== 'form-fact') return;
    const field = cell ?? rowField(node);
    if (field && kept.has(field)) node.props = { ...node.props, [STATUSES_PROP]: open };
    else if (field && after.has(field)) node.props = { ...node.props, [STATUSES_PROP]: removal };
  });
}
