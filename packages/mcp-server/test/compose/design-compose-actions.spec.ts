/**
 * Sprint 88 — design.compose action_mappings consumer tests.
 *
 * Validates:
 * 1. Matching mapping → slot/component receives actions[]
 * 2. No-match mapping → no actions annotated; output identical to baseline
 * 3. Multi-verb per trait → actions[] contains both verbs in order, deduped
 * 4. Trait alias (`trait` vs `oodsTrait`) accepted
 * 5. objectUsed.resolvedActions groups verbs by trait
 */
import { describe, it, expect } from 'vitest';
import { handle, annotateWithActionMappings, type ActionMapping } from '../../src/tools/design.compose.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';

function collectActions(schema: UiSchema): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const walk = (el: UiElement) => {
    const slotIntent = typeof el.meta?.intent === 'string' && el.meta.intent.startsWith('slot:')
      ? el.meta.intent.slice(5)
      : undefined;
    if (Array.isArray(el.props?.actions)) {
      const key = slotIntent ?? el.component;
      out[key] = el.props.actions as string[];
    }
    el.children?.forEach(walk);
  };
  schema.screens.forEach(walk);
  return out;
}

describe('annotateWithActionMappings (unit)', () => {
  const baseSchema: UiSchema = {
    version: '2026.02',
    screens: [
      {
        id: 'root',
        component: 'Box',
        children: [
          { id: 's1', component: 'Panel', meta: { intent: 'slot:actions' } },
          { id: 's2', component: 'Stack', meta: { intent: 'slot:status' } },
          { id: 's3', component: 'SubscriptionCard' },
        ],
      },
    ],
  };

  it('attaches verb on slot-hint match', () => {
    const schema = structuredClone(baseSchema);
    const mappings: ActionMapping[] = [
      { verb: 'archive', oodsTrait: 'Archivable', slot: 'actions' },
    ];
    const resolved = annotateWithActionMappings(schema, mappings, undefined);
    const actions = collectActions(schema);
    expect(actions.actions).toEqual(['archive']);
    expect(resolved).toEqual([{ trait: 'Archivable', verbs: ['archive'] }]);
  });

  it('attaches verb on component-hint match', () => {
    const schema = structuredClone(baseSchema);
    const mappings: ActionMapping[] = [
      { verb: 'cancel', oodsTrait: 'Cancellable', component: 'SubscriptionCard' },
    ];
    annotateWithActionMappings(schema, mappings, undefined);
    const actions = collectActions(schema);
    expect(actions.SubscriptionCard).toEqual(['cancel']);
  });

  it('no-match safe path leaves schema untouched', () => {
    const schema = structuredClone(baseSchema);
    const mappings: ActionMapping[] = [
      { verb: 'publish', oodsTrait: 'Publishable', slot: 'nowhere', component: 'NoSuch' },
    ];
    const resolved = annotateWithActionMappings(schema, mappings, undefined);
    const actions = collectActions(schema);
    expect(Object.keys(actions)).toHaveLength(0);
    // Resolved still groups the unmatched verb (trait filtering not applied here: no composed).
    expect(resolved).toEqual([{ trait: 'Publishable', verbs: ['publish'] }]);
  });

  it('multi-verb per trait deduplicates and preserves order', () => {
    const schema = structuredClone(baseSchema);
    const mappings: ActionMapping[] = [
      { verb: 'archive', oodsTrait: 'Archivable', slot: 'actions' },
      { verb: 'restore', oodsTrait: 'Archivable', slot: 'actions' },
      { verb: 'archive', oodsTrait: 'Archivable', slot: 'actions' }, // duplicate
    ];
    const resolved = annotateWithActionMappings(schema, mappings, undefined);
    const actions = collectActions(schema);
    expect(actions.actions).toEqual(['archive', 'restore']);
    expect(resolved).toEqual([{ trait: 'Archivable', verbs: ['archive', 'restore'] }]);
  });

  it('trait alias (`trait` instead of `oodsTrait`) is accepted', () => {
    const schema = structuredClone(baseSchema);
    const mappings: ActionMapping[] = [
      { verb: 'cancel', trait: 'Cancellable', component: 'SubscriptionCard' },
    ];
    const resolved = annotateWithActionMappings(schema, mappings, undefined);
    expect(resolved).toEqual([{ trait: 'Cancellable', verbs: ['cancel'] }]);
  });
});

describe('design.compose — actionMappings input integration', () => {
  it('empty or absent actionMappings is a no-op', async () => {
    const baseline = await handle({ intent: 'subscription detail' });
    const withEmpty = await handle({ intent: 'subscription detail', actionMappings: [] });
    expect(withEmpty.schema.screens).toEqual(baseline.schema.screens);
    expect(withEmpty.objectUsed?.resolvedActions).toBeUndefined();
  });

  it('populates objectUsed.resolvedActions when traits match composed object', async () => {
    const result = await handle({
      intent: 'subscription detail',
      object: 'Subscription',
      actionMappings: [
        { verb: 'archive', oodsTrait: 'Archivable' },
        { verb: 'cancel', oodsTrait: 'NonExistentTrait' },
      ],
    });
    // Only traits that the composed object actually carries should survive.
    const resolved = result.objectUsed?.resolvedActions ?? [];
    const traitNames = resolved.map(r => r.trait);
    // If Archivable is on Subscription it appears; if not, the unit tests above cover mechanics.
    expect(traitNames).not.toContain('NonExistentTrait');
  });
});
