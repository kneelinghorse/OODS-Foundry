import { describe, expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { listObjects } from '../../src/objects/object-loader.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';

/**
 * s204-m02 (c): every lifecycle/Stateful detail carried an "Allowed transitions: None recorded" row,
 * because the status-timeline pattern rule paired a status with a second field matched on NAME alone
 * and `/transition/i` also matches Stateful's `allowed_transitions` — a `string[]` of state names,
 * an internal field, and not a moment in time at all (s203-m04 measured it; the review ruled it
 * fixed here in #2180).
 *
 * A StatusTimeline pairs a status with the moment it was last set, so the second field has to hold a
 * time. These tests hold the rule at its cause rather than at the string it printed: the pattern may
 * not pair a field whose declared type is not a date.
 */

function walk(el: UiElement, visit: (node: UiElement) => void): void {
  visit(el);
  el.children?.forEach(child => walk(child, visit));
}

function nodes(schema: UiSchema | undefined): UiElement[] {
  const found: UiElement[] = [];
  (schema?.screens ?? []).forEach(screen => walk(screen, node => found.push(node)));
  return found;
}

/** The label the defect printed, as a reader saw it. */
const isAllowedTransitionsRow = (node: UiElement): boolean =>
  node.component === 'Text' && /^allowed transitions$/i.test(String(node.props?.content ?? ''));

const bare = (type: string) => type.replace(/\?$/, '');

describe('s204-m02 (c) — a status timeline pairs a status with a real moment in time', () => {
  it('never labels a row "Allowed transitions" on any detail in the registry', async () => {
    const offenders: string[] = [];
    let composedCount = 0;
    for (const object of listObjects()) {
      for (const context of ['detail', 'workflow'] as const) {
        let schema: UiSchema | undefined;
        try { schema = (await compose({ object, context })).schema; } catch { continue; }
        if (schema) composedCount += 1;
        if (nodes(schema).some(isAllowedTransitionsRow)) offenders.push(`${object}/${context}`);
      }
    }
    // s205-m01: this loop iterated `listObjects().map(entry => entry.name)` — undefined for every entry, because
    // listObjects returns names — so it composed nothing and passed vacuously. The count keeps it honest.
    expect(composedCount).toBeGreaterThanOrEqual(listObjects().length);
    expect(offenders).toEqual([]);
  });

  it('binds the status-timeline group only to fields the object declares as a date', async () => {
    // The cause, not the symptom: whatever the pattern pairs must be date-typed. An object that grows
    // a `transition_note: string` tomorrow must not be able to reintroduce the defect under a name
    // this test does not know about.
    const offenders: string[] = [];
    let composedCount = 0;
    for (const object of listObjects()) {
      for (const context of ['detail', 'workflow', 'dashboard'] as const) {
        let composed: Awaited<ReturnType<typeof compose>>;
        // `dashboard` is a layout, not a context (s205-m01): passed as a context it never composed a dashboard.
        try { composed = await compose(context === 'dashboard' ? { object, layout: 'dashboard' } : { object, context }); } catch { continue; }
        if (composed.schema) composedCount += 1;
        const objectSchema = composed.schema?.objectSchema ?? {};
        for (const node of nodes(composed.schema)) {
          if (!node.id?.includes('status-timeline')) continue;
          const field = node.props?.field;
          if (typeof field !== 'string') continue;
          const declared = objectSchema[field];
          // A status-timeline node binds either the status itself or the moment it was set. Only the
          // second is constrained here; a status field is an enum or a string by design.
          if (!declared || declared.enum?.length) continue;
          const type = bare(String(declared.type));
          if (type === 'date' || type === 'datetime') continue;
          if (type === 'string') continue; // the status field itself
          offenders.push(`${object}/${context}: ${field} is ${declared.type}`);
        }
      }
    }
    expect(composedCount).toBeGreaterThanOrEqual(2 * listObjects().length);
    expect(offenders).toEqual([]);
  });

  it('still pairs a status with its timestamp where the object declares one', async () => {
    // The fix must not be a deletion. Subscription declares both a status and `updated_at`, and the
    // group that used to pair with `allowed_transitions` re-pairs with the real timestamp — which is
    // exactly the reshape this mission re-certifies Subscription for.
    // s213-m01: Sprint 212 m01 composes a dashboard from its object's detail recipes (#2325). Subscription's header now
    // pairs its status with its timestamped state history, and this group is no longer placed there
    // (sprint-213/m01/base-failures.md). Article has the same Stateful shape (a status, `updated_at` and
    // `allowed_transitions`) and still carries the group, so the pairing is held there.
    // s221-m01: the public dashboard is the dashboard layout; context enumerates no 'dashboard', and since s220-m01 (#2464)
    // MarkBar's own dashboard view is all the out-of-schema context composes.
    const subscription = await compose({ object: 'Subscription', context: 'detail', layout: 'dashboard' });
    const header = nodes(subscription.schema).filter(node => node.component === 'StatusTimeline');
    expect(header.map(node => node.props?.historyField)).toEqual(['state_history']);
    expect(subscription.schema?.objectSchema?.state_history?.type).toBe('StateTransition[]');
    const composed = await compose({ object: 'Article', context: 'dashboard' });
    expect(composed.schema?.objectSchema).toHaveProperty('allowed_transitions');
    const objectSchema = composed.schema?.objectSchema ?? {};
    const timeline = nodes(composed.schema).filter(node => node.id?.includes('status-timeline'));
    expect(timeline.length).toBeGreaterThan(0);
    const dated = timeline
      .map(node => node.props?.field)
      .filter((field): field is string => typeof field === 'string')
      .filter(field => ['date', 'datetime'].includes(bare(String(objectSchema[field]?.type ?? ''))));
    expect(dated).toContain('updated_at');
    expect(dated).not.toContain('allowed_transitions');
  });
});
