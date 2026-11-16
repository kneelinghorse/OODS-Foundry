/**
 * s249-m03 (Interface 10): an object's declared order of states (Stateful's `transitionRules`), read alike by every
 * renderer and by a generated app's store. The order maps each state to the states it may move to; an empty list marks a
 * final state, which a record never leaves.
 *
 * A status select offers the record's current state and the moves the order allows from it (statusOptionsInOrder), in the
 * standalone React and Vue screens, in HTML and in generated apps alike, and a generated store refuses any other move in
 * plain words (declaredMoveRefusal, declaredActionRefusal). OODS Foundry models and renders the order: a product that
 * keeps its records elsewhere enforces it there.
 */

/** The declared order: each state's allowed targets; an empty list marks a final state. */
export type DeclaredStateOrder = Readonly<Record<string, readonly string[]>>;

/** The words a refusal is written in: the object as a person reads it ("grant") and each state's label ("Needs input"). */
export interface StateOrderWords {
  object: string;
  labels?: Readonly<Record<string, string>>;
}

const optionValue = (option: unknown): string | undefined => {
  if (typeof option === 'string' || typeof option === 'number') return String(option);
  if (!option || typeof option !== 'object') return undefined;
  const { value, id } = option as { value?: unknown; id?: unknown };
  return value != null ? String(value) : id != null ? String(id) : undefined;
};

/**
 * A status select's options for a record in `current`: the current state and the states the declared order allows from
 * it, in the order the options are given. A record in a final state is offered only its own state. A state the order does
 * not name (a record outside the declared states) keeps every option, as before.
 */
export function statusOptionsInOrder<T>(options: readonly T[], current: unknown, order: DeclaredStateOrder): T[] {
  const state = current == null ? '' : String(current);
  if (!Object.hasOwn(order, state)) return [...options];
  const allowed = new Set([state, ...order[state]!]);
  return options.filter(option => allowed.has(optionValue(option) ?? ''));
}

/** True when the order names the state and it moves nowhere. */
export function isFinalState(order: DeclaredStateOrder, state: unknown): boolean {
  const name = state == null ? '' : String(state);
  return Object.hasOwn(order, name) && order[name]!.length === 0;
}

/**
 * A state as a record's own list and select write it, in sentence case ("Needs input"). s249-m05 (the fresh read): the
 * refusals name the status as a label ("This task's status is Needs input"), since "This task is needs input" and "an
 * used approval" do not read.
 */
const words = (state: string, labels?: Readonly<Record<string, string>>) => {
  const label = (labels?.[state] ?? state.split(/[_-]+/).filter(Boolean).join(' ')).toLowerCase();
  return label.charAt(0).toUpperCase() + label.slice(1);
};
const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');
const list = (items: readonly string[], joiner: 'and' | 'or') => items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} ${joiner} ${items[items.length - 1]}`;

/** The sentence a final record's refused move reads: "This grant's status is Revoked, and that status is final." */
export function finalStateRefusal(state: string, text: StateOrderWords): string {
  return `This ${text.object}'s status is ${words(state, text.labels)}, and that status is final.`;
}

/**
 * Why the declared order refuses a move from `from` to `to`, or undefined when it allows it. A move out of a final state
 * reads "This grant's status is Revoked, and that status is final."; another move the order does not allow reads "This
 * grant's status is Active; from there it moves only to Paused, Revoked, Expired or Replaced." A record staying where it
 * is, or in a state the order does not name, is never refused.
 */
export function declaredMoveRefusal(order: DeclaredStateOrder, from: unknown, to: unknown, text: StateOrderWords): string | undefined {
  const source = from == null ? '' : String(from);
  const target = to == null ? '' : String(to);
  if (source === target || !Object.hasOwn(order, source)) return undefined;
  const targets = order[source]!;
  if (targets.includes(target)) return undefined;
  if (!targets.length) return finalStateRefusal(source, text);
  return `This ${text.object}'s status is ${words(source, text.labels)}; from there it moves only to ${list(targets.map(state => words(state, text.labels)), 'or')}.`;
}

/**
 * Why a declared action (a grant's Revoke) cannot be taken on a record in `current`, or undefined when its `from` states
 * include it: "This grant's status is Active; Resume is for a grant whose status is Paused." A final record reads as
 * declaredMoveRefusal says.
 */
export function declaredActionRefusal(action: { verb: string; from: readonly string[] }, current: unknown, order: DeclaredStateOrder, text: StateOrderWords): string | undefined {
  const state = current == null ? '' : String(current);
  if (action.from.includes(state)) return undefined;
  if (isFinalState(order, state)) return finalStateRefusal(state, text);
  const from = action.from.map(name => words(name, text.labels));
  return `This ${text.object}'s status is ${words(state, text.labels)}; ${action.verb} is for ${article(text.object)} ${text.object} whose status is ${list(from, 'or')}.`;
}
