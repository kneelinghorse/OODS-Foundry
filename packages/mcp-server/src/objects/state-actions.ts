/**
 * s249-m03: a lifecycle's declared actions (Stateful 2.5.0 `actions`): the named moves a person makes on a record, such
 * as a grant's Revoke, Pause and Resume. Each moves the record to one state of its declared order (`to`), from the states
 * it names or, by default, every state whose declared targets include `to` (`from`); a person reads its `verb`; it
 * records `event` (one of Timestampable's recordedEvents); it may write an optional note to `reasonField` and who acted
 * to the seat `bySeat` names (its `_id`, `_name` and `_kind`); it may ask first (`confirm`); and records of the same
 * object whose `alsoEnds.via` names the record make the same move with it.
 *
 * parameter-validation.ts checks an action against the order; this module reads the declarations, normalized, and checks
 * what needs the composed object: the fields an action names and its event. OODS Foundry models and renders: a generated
 * app writes the move when a person asks, and stops nothing outside the record.
 */
import type { FieldDefinition, ObjectDefinition } from './types.js';

export interface StateAction {
  id: string;
  to: string;
  from: string[];
  verb: string;
  event: string;
  reasonField?: string;
  bySeat?: string;
  confirm: boolean;
  alsoEnds?: { via: string };
}

const short = (name: unknown) => String(name).split('/').pop();
const pascal = (id: string) => id.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
/** The screen action event a declared action binds to ("onRevoke"), and its handler ("handleRevoke"), named from its id. */
export const stateActionEvent = (action: Pick<StateAction, 'id'>) => `on${pascal(action.id)}`;
export const stateActionHandler = (action: Pick<StateAction, 'id'>) => `handle${pascal(action.id)}`;
const isMap = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The object's Stateful parameters, when it composes Stateful. */
function lifecycle(definition: Pick<ObjectDefinition, 'traits'>): { index: number; parameters: Record<string, unknown> } | undefined {
  const index = definition.traits.findIndex(trait => short(trait.name) === 'Stateful');
  return index < 0 ? undefined : { index, parameters: (definition.traits[index]!.parameters ?? {}) as Record<string, unknown> };
}

/** The declared order, as lists of targets by state. */
export function declaredOrder(definition: Pick<ObjectDefinition, 'traits'>): Record<string, string[]> | undefined {
  const rules = lifecycle(definition)?.parameters.transitionRules;
  if (!isMap(rules)) return undefined;
  return Object.fromEntries(Object.entries(rules).map(([from, targets]) => [from, Array.isArray(targets) ? targets.map(String) : []]));
}

/** The lifecycle's states in their declared order (Stateful's `states`), or the order's own keys when it lists none. */
export function declaredStates(definition: Pick<ObjectDefinition, 'traits'>): string[] {
  const states = lifecycle(definition)?.parameters.states;
  return Array.isArray(states) ? states.map(String) : Object.keys(declaredOrder(definition) ?? {});
}

/** The object's declared actions, each with its `from` worked out; none when it declares none or no order. */
export function declaredActions(definition: Pick<ObjectDefinition, 'traits'>): StateAction[] {
  const found = lifecycle(definition);
  const order = declaredOrder(definition);
  const raw = found?.parameters.actions;
  if (!order || !Array.isArray(raw)) return [];
  const states = Array.isArray(found!.parameters.states) ? (found!.parameters.states as unknown[]).map(String) : Object.keys(order);
  return raw.filter(isMap).filter(action => typeof action.id === 'string' && typeof action.to === 'string' && typeof action.verb === 'string' && typeof action.event === 'string').map(action => ({
    id: action.id as string, to: action.to as string,
    from: Array.isArray(action.from) ? (action.from as unknown[]).map(String) : states.filter(state => (order[state] ?? []).includes(action.to as string)),
    verb: action.verb as string, event: action.event as string,
    ...(typeof action.reasonField === 'string' ? { reasonField: action.reasonField } : {}),
    ...(typeof action.bySeat === 'string' ? { bySeat: action.bySeat } : {}),
    confirm: action.confirm === true,
    ...(isMap(action.alsoEnds) && typeof action.alsoEnds.via === 'string' ? { alsoEnds: { via: action.alsoEnds.via } } : {}),
  }));
}

/** True when an action moves a record to a final state of its declared order: an ending, after which it is kept. */
export function endsRecord(action: StateAction, order: Record<string, string[]> | undefined): boolean {
  return Boolean(order && Object.hasOwn(order, action.to) && order[action.to]!.length === 0);
}

/**
 * What the composed object cannot hold of its declared actions: an event Timestampable does not record, or a field an
 * action names that the object lacks. Each problem names its path under the Stateful reference (`traits[i]...`).
 */
export function stateActionProblems(definition: Pick<ObjectDefinition, 'traits'>, fields: Record<string, FieldDefinition>): Array<{ path: string; message: string }> {
  const found = lifecycle(definition);
  const raw = found?.parameters.actions;
  if (!found || !Array.isArray(raw)) return [];
  const timestamps = definition.traits.find(trait => short(trait.name) === 'Timestampable')?.parameters as Record<string, unknown> | undefined;
  const events = Array.isArray(timestamps?.recordedEvents) ? (timestamps!.recordedEvents as unknown[]).map(String) : undefined;
  const base = `traits[${found.index}].parameters.actions`;
  return raw.flatMap((action, index) => {
    if (!isMap(action)) return [];
    const at = `${base}[${index}]`;
    const problems: Array<{ path: string; message: string }> = [];
    if (typeof action.event === 'string') {
      if (!events) problems.push({ path: `${at}.event`, message: `${at}.event "${action.event}" needs lifecycle/Timestampable, whose recordedEvents name the events a record keeps.` });
      else if (!events.includes(action.event)) problems.push({ path: `${at}.event`, message: `${at}.event "${action.event}" is not one of Timestampable's recordedEvents (${events.join(', ')}).` });
    }
    const field = (place: string, name: string) => { if (!Object.hasOwn(fields, name)) problems.push({ path: place, message: `${place} "${name}" is not a field of the object, including its traits.` }); };
    if (typeof action.reasonField === 'string') field(`${at}.reasonField`, action.reasonField);
    if (typeof action.bySeat === 'string') for (const suffix of ['_id', '_name', '_kind']) field(`${at}.bySeat`, `${action.bySeat}${suffix}`);
    if (isMap(action.alsoEnds) && typeof action.alsoEnds.via === 'string') field(`${at}.alsoEnds.via`, action.alsoEnds.via);
    return problems;
  });
}
