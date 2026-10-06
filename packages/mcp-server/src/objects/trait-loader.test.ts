/**
 * Sprint 87 — trait-loader: state_machine and actions field wiring
 *
 * Verifies that:
 * 1. normalize() preserves state_machine when present in trait YAML
 * 2. normalize() preserves actions when present in trait YAML
 * 3. Traits without state_machine/actions load cleanly (undefined, not null)
 * 4. StateMachineDefinition shape is correct (states, initial, transitions)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { loadTrait, clearTraitCache } from './trait-loader.js';

beforeEach(() => {
  clearTraitCache();
});

// ---- state_machine field ----

describe('trait state_machine field', () => {
  const STATE_MACHINE_TRAITS = ['InteractionHighlight', 'InteractionTooltip'];

  it.each(STATE_MACHINE_TRAITS)('%s loads with state_machine defined', (name) => {
    const trait = loadTrait(name);
    expect(trait.state_machine).toBeDefined();
  });

  it.each(STATE_MACHINE_TRAITS)('%s state_machine has required shape', (name) => {
    const trait = loadTrait(name);
    const sm = trait.state_machine!;
    expect(Array.isArray(sm.states)).toBe(true);
    expect(sm.states.length).toBeGreaterThan(0);
    expect(typeof sm.initial).toBe('string');
    expect(sm.states).toContain(sm.initial);
    expect(Array.isArray(sm.transitions)).toBe(true);
    expect(sm.transitions.length).toBeGreaterThan(0);
  });

  it('InteractionHighlight state_machine has idle/highlighted states', () => {
    const trait = loadTrait('InteractionHighlight');
    const sm = trait.state_machine!;
    expect(sm.states).toContain('idle');
    expect(sm.states).toContain('highlighted');
    expect(sm.initial).toBe('idle');
  });

  it('InteractionHighlight transitions include idle→highlighted trigger:select', () => {
    const trait = loadTrait('InteractionHighlight');
    const sm = trait.state_machine!;
    const t = sm.transitions.find((tr) => tr.from === 'idle' && tr.to === 'highlighted');
    expect(t).toBeDefined();
    expect(t!.trigger).toBe('select');
  });

  it('InteractionTooltip state_machine has hidden/visible states', () => {
    const trait = loadTrait('InteractionTooltip');
    const sm = trait.state_machine!;
    expect(sm.states).toContain('hidden');
    expect(sm.states).toContain('visible');
    expect(sm.initial).toBe('hidden');
  });

  it('traits without state_machine return undefined (not null)', () => {
    const trait = loadTrait('Archivable');
    expect(trait.state_machine).toBeUndefined();
  });

  it('core traits without state_machine return undefined', () => {
    const trait = loadTrait('Addressable');
    expect(trait.state_machine).toBeUndefined();
  });
});

// ---- actions field ----

describe('trait actions field', () => {
  it('traits without actions return undefined (not null)', () => {
    const trait = loadTrait('Archivable');
    expect(trait.actions).toBeUndefined();
  });

  it('Stateful loads without actions field', () => {
    const trait = loadTrait('Stateful');
    expect(trait.actions).toBeUndefined();
  });

  it('actions field is array when defined', () => {
    // No traits currently define actions — verify the type contract by ensuring
    // any trait that DOES define actions returns an array.
    // We validate by checking that all loaded traits have actions as array | undefined.
    const traits = ['InteractionHighlight', 'InteractionTooltip', 'Archivable', 'Stateful', 'Addressable'];
    for (const name of traits) {
      const trait = loadTrait(name);
      expect(
        trait.actions === undefined || Array.isArray(trait.actions),
        `${name}: actions must be array or undefined`,
      ).toBe(true);
    }
  });
});

// ---- backward compatibility ----

describe('trait loader backward compatibility', () => {
  it('existing fields still load correctly alongside new fields', () => {
    const trait = loadTrait('InteractionHighlight');
    // Existing fields
    expect(trait.trait.name).toBe('InteractionHighlight');
    expect(trait.trait.category).toBe('viz.interaction');
    expect(trait.parameters.length).toBeGreaterThan(0);
    expect(trait.schema).toBeDefined();
    expect(trait.semantics).toBeDefined();
    expect(trait.tokens).toBeDefined();
    expect(Array.isArray(trait.dependencies)).toBe(true);
    expect(trait.metadata).toBeDefined();
    // New fields co-exist
    expect(trait.state_machine).toBeDefined();
  });

  it('non-viz trait loads with all expected existing fields', () => {
    const trait = loadTrait('Stateful');
    expect(trait.trait.name).toBe('Stateful');
    expect(trait.trait.category).toBe('lifecycle');
    expect(trait.parameters.length).toBeGreaterThan(0);
    expect(trait.view_extensions).toBeDefined();
    // New fields absent but not breaking
    expect(trait.state_machine).toBeUndefined();
    expect(trait.actions).toBeUndefined();
  });
});
