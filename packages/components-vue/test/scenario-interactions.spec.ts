import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { describe, expect, it } from 'vitest';
import { componentContracts, NUCLEUS_COMPONENT_IDS, sharedScenarios } from '@oods/component-contracts';
import { assertScenarioSemantics, executeScenarioTrigger } from '../../../scripts/product-reality/scenario-interactions.js';
import { renderSharedScenario } from './scenario-fixtures.js';

describe('Vue measured scenario interactions', () => {
  it('accounts for every root as interactive or not applicable', () => {
    expect(sharedScenarios.map(scenario => scenario.oodsComponentId)).toEqual(NUCLEUS_COMPONENT_IDS);
    expect(sharedScenarios).toHaveLength(NUCLEUS_COMPONENT_IDS.length);
  });
  for (const scenario of sharedScenarios) {
    it(`${scenario.oodsComponentId}: structured role and name`, () => {
      const wrapper = mount(defineComponent({ render: () => h('main', {}, [renderSharedScenario(scenario)]) }), { attachTo: document.body });
      try { assertScenarioSemantics(wrapper.element as HTMLElement, componentContracts[scenario.oodsComponentId]); }
      finally { wrapper.unmount(); }
    });
    if (scenario.interaction === 'none') it(`${scenario.oodsComponentId}: not-applicable with reason`, () => {
      expect(scenario.interactionReason?.length).toBeGreaterThan(20);
      expect(scenario.event).toEqual([]);
      expect(componentContracts[scenario.oodsComponentId].keyboard).toEqual({});
    });
    for (const [index, trigger] of scenario.event.entries()) it(`${scenario.oodsComponentId}: ${index} ${trigger.trigger} ${trigger.key ?? trigger.action}`, async () => {
      const calls: unknown[] = [];
      const wrapper = mount(defineComponent({ render: () => h('main', {}, [renderSharedScenario(scenario, value => calls.push(value))]) }), { attachTo: document.body });
      try { await executeScenarioTrigger(wrapper.element as HTMLElement, trigger, calls); }
      finally { wrapper.unmount(); }
    });
  }
});
