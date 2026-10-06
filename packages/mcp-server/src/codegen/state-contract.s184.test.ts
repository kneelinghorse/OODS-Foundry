import {
  NUCLEUS_COMPONENT_IDS,
  UI_WORKFLOW_STATES,
} from '@oods/component-contracts';
import { describe, expect, it } from 'vitest';

import type { UiElement, UiSchema } from '../schemas/generated.js';
import { handle as codeGenerate } from '../tools/code.generate.js';
import { validateSchema } from '../tools/repl.utils.js';
import { normalizeSchemaForFramework } from './framework-normalization.js';
import {
  collectUiStateBranches,
  preflightStateContract,
} from './state-contract.js';

function schemaFor(state: string, component = 'Stack'): UiSchema {
  return {
    version: '1.0',
    screens: [{ id: 'state-branch', component, state }],
  };
}

describe('Sprint 184 UI workflow-state contract', () => {
  it('keeps the structural schema open so profile-aware semantic validation owns names', () => {
    for (const state of [...UI_WORKFLOW_STATES, 'prospective']) {
      expect(validateSchema(schemaFor(state)), state).toEqual([]);
    }

    expect(validateSchema(schemaFor(''))).toEqual([
      expect.objectContaining({ code: 'OODS-V007', path: '/screens/0/state' }),
    ]);
    expect(validateSchema(schemaFor(42 as unknown as string))).toEqual([
      expect.objectContaining({ code: 'OODS-V007', path: '/screens/0/state' }),
    ]);
  });

  it('collects nested declarations once in document order, including draft-unknown names', () => {
    const screens: UiElement[] = [{
      id: 'root',
      component: 'Stack',
      state: 'loading',
      children: [{
        id: 'child',
        component: 'Text',
        state: 'prospective',
        children: [{ id: 'leaf', component: 'Banner', state: 'error' }],
      }],
    }];

    expect(collectUiStateBranches(screens)).toEqual([
      { nodeId: 'root', component: 'Stack', state: 'loading' },
      { nodeId: 'child', component: 'Text', state: 'prospective' },
      { nodeId: 'leaf', component: 'Banner', state: 'error' },
    ]);
  });

  it.each((['react', 'vue'] as const).flatMap((framework) => (
    NUCLEUS_COMPONENT_IDS.map((component, index) => ({
      framework,
      component,
      state: UI_WORKFLOW_STATES[index % UI_WORKFLOW_STATES.length]!,
    }))
  )))('$framework accepts canonical $state on governed $component', ({ framework, component, state }) => {
    expect(preflightStateContract(schemaFor(state, component).screens, framework)).toEqual([]);
  });

  it('returns exact ordered V164 issues for unknown names', () => {
    const screens: UiElement[] = [{
      id: 'root',
      component: 'Stack',
      children: [
        { id: 'first', component: 'Banner', state: 'waiting' },
        { id: 'second', component: 'StatusBadge', state: 'settled' },
      ],
    }];

    expect(preflightStateContract(screens, 'react')).toEqual([
      expect.objectContaining({
        code: 'OODS-V164',
        nodeId: 'first',
        component: 'Banner',
        message: expect.stringContaining('"waiting"'),
      }),
      expect.objectContaining({
        code: 'OODS-V164',
        nodeId: 'second',
        component: 'StatusBadge',
        message: expect.stringContaining('"settled"'),
      }),
    ]);
  });

  it('preserves a state-tagged simple Tabs child instead of collapsing its branch into items', () => {
    const schema: UiSchema = {
      version: '1.0',
      screens: [{
        id: 'tabs',
        component: 'Tabs',
        children: [{
          id: 'loading-panel',
          component: 'Text',
          state: 'loading',
          props: { content: 'Loading account' },
        }],
      }],
    };

    for (const framework of ['react', 'vue'] as const) {
      const normalized = normalizeSchemaForFramework(schema, framework);
      expect(normalized.screens[0].children).toEqual([
        expect.objectContaining({ id: 'loading-panel', state: 'loading' }),
      ]);
    }
  });

  it.each(['react', 'vue'] as const)(
    '%s makes an unknown name blocking at build and advisory at draft',
    async (framework) => {
      const build = await codeGenerate({ framework, profile: 'build', schema: schemaFor('waiting') });
      const draft = await codeGenerate({ framework, profile: 'draft', schema: schemaFor('waiting') });

      expect(build.status).toBe('error');
      expect(build.artifact).toBeUndefined();
      expect(build.code).toBe('');
      expect(build.errors).toEqual([
        expect.objectContaining({ code: 'OODS-V164', nodeId: 'state-branch' }),
      ]);
      expect(build.validationReceipt.checks).toContain('state-contract');

      expect(draft.status).toBe('ok');
      expect(draft.artifact).toBeDefined();
      expect(draft.errors).toBeUndefined();
      expect(draft.warnings).toEqual([
        expect.objectContaining({ code: 'OODS-V164', nodeId: 'state-branch' }),
      ]);
      expect(draft.validationReceipt.checks).toContain('state-contract');
    },
  );

  it('preserves canonical HTML states as selectable sample views under build and draft', async () => {
    for (const profile of ['build', 'draft'] as const) {
      const result = await codeGenerate({ framework: 'html', profile, schema: schemaFor('loading') });
      expect(result.status).toBe('ok');
      expect(result.errors).toBeUndefined();
      expect(result.code).toContain('data-oods-view-state="loading"');
      expect(result.code).toContain('data-oods-sample-state');
      expect(result.validationReceipt.checks).toContain('state-contract');
    }
  });
});
