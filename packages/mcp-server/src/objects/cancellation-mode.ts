/**
 * How an object's cancellation works, read from the lifecycle it declares (s213-m01, Sprint 212 review finding 3).
 *
 *  - `deferred`: the lifecycle has `pending_cancellation`, so a record can cancel at its billing period's end
 *    (Subscription). Only a deferred object shows period-end terms or offers "cancel at period end".
 *  - `immediate`: the lifecycle has `cancelled` and no pending state, so cancelling ends the record now (a mission, a
 *    transaction).
 *  - `none`: the lifecycle declares neither, so a cancellation has no state to move to; composition warns.
 *
 * One rule for the detail view, the card, the workflow transition, its cancel dialog and its store. Before it, four
 * copies each assumed a billing period whenever the lifecycle had no `cancelled` state, so Transaction read "Cancel at
 * period end" and its generated app cancelled into a `pending_cancellation` state Transaction does not have.
 */
export type CancellationMode = 'deferred' | 'immediate' | 'none';

export function cancellationMode(states: readonly unknown[] | undefined): CancellationMode {
  const declared = (states ?? []).map(String);
  if (declared.includes('pending_cancellation')) return 'deferred';
  if (declared.includes('cancelled')) return 'immediate';
  return 'none';
}

/**
 * s221-m01 (#2479, learning #781): the lifecycle states a record may be cancelled from. The detail's action bar offers
 * "Cancel" only in these; it offered Cancel whatever the state, so a cancelled transaction said "Cancel transaction" and
 * the generated store then refused the click. This mirrors the store's own guard in workflow-data-emitter.ts exactly (a
 * record pending cancellation or terminated never cancels, nor one immediate cancellation has ended), which stays as it
 * was so no generated store moves; test/codegen/action-state.s221.spec.ts checks the two agree for every Stateful
 * workflow object and each state its samples reach. None when the lifecycle has no state to cancel into.
 *
 * s247-m01: where the object declares the order of its states (`order`, declared-order.ts), Cancel follows the order: a
 * record may be cancelled only from a state whose declared targets include the state cancelling moves to, `cancelled`,
 * or `pending_cancellation` where the lifecycle cancels at a period's end. A final state, or any state the order does not
 * let move there, offers no Cancel. Without an order the rule is the lifecycle's names, exactly as before.
 */
export function cancellableStates(states: readonly unknown[] | undefined, order?: Readonly<Record<string, readonly string[]>>): string[] {
  const mode = cancellationMode(states);
  if (mode === 'none') return [];
  if (order) {
    const target = mode === 'deferred' ? 'pending_cancellation' : 'cancelled';
    return (states ?? []).map(String).filter(state => (order[state] ?? []).includes(target));
  }
  return (states ?? []).map(String).filter(state => state !== 'terminated' && state !== 'pending_cancellation'
    && !(mode === 'immediate' && ['completed', 'cancelled', 'final'].includes(state)));
}
