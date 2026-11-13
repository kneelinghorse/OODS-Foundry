/**
 * s247-m01: the one place OODS Foundry reads a declared order at run time is the Cancel action in generated React and Vue
 * screens: the detail's action bar offers Cancel, and the generated store accepts it, only from a state whose declared
 * targets include the state cancelling moves to. This is that order, looked up by the object's name at generation time,
 * as the relationship diagram looks an object up, because the UI schema has no place for it.
 *
 * Only for an object that composes Cancellable. Approval declares an order and composes no Cancellable, so none of its
 * screens or stores move; Subscription and Transaction compose Cancellable and declare no order, so theirs do not either.
 * Undefined when the name is no registered object, the object declares no order, or it does not compose Cancellable;
 * Cancel then follows the lifecycle's state names, as it did in 0.13.1. Nothing else reads the order at run time: the
 * status select offers every state, and a generated app saves any move.
 */
import { loadObject } from './object-loader.js';

export type DeclaredOrder = Readonly<Record<string, readonly string[]>>;

const short = (name: unknown) => String(name).split('/').pop();

export function declaredCancelOrder(objectName: string | undefined): DeclaredOrder | undefined {
  if (!objectName) return undefined;
  let traits;
  try { traits = loadObject(objectName).traits ?? []; } catch { return undefined; }
  if (!traits.some(trait => short(trait.name) === 'Cancellable')) return undefined;
  const rules = (traits.find(trait => short(trait.name) === 'Stateful')?.parameters as Record<string, unknown> | undefined)?.transitionRules;
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) return undefined;
  return Object.fromEntries(Object.entries(rules as Record<string, unknown>).map(([from, targets]) => [from, Array.isArray(targets) ? targets.map(String) : []]));
}
