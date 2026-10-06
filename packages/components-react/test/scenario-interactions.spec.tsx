import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { componentContracts, NUCLEUS_COMPONENT_IDS, sharedScenarios } from '@oods/component-contracts';
import { assertScenarioSemantics, executeScenarioTrigger } from '../../../scripts/product-reality/scenario-interactions.js';
import { renderSharedScenario } from './scenario-fixtures.js';

afterEach(cleanup);
describe('React measured scenario interactions', () => {
  it('accounts for every root as interactive or not applicable', () => {
    expect(sharedScenarios.map(scenario => scenario.oodsComponentId)).toEqual(NUCLEUS_COMPONENT_IDS);
    expect(sharedScenarios).toHaveLength(NUCLEUS_COMPONENT_IDS.length);
  });
  for (const scenario of sharedScenarios) {
    it(`${scenario.oodsComponentId}: structured role and name`, () => {
      const { container } = render(<main>{renderSharedScenario(scenario)}</main>);
      assertScenarioSemantics(container, componentContracts[scenario.oodsComponentId]);
    });
    if (scenario.interaction === 'none') it(`${scenario.oodsComponentId}: not-applicable with reason`, () => {
      expect(scenario.interactionReason?.length).toBeGreaterThan(20);
      expect(scenario.event).toEqual([]);
      expect(componentContracts[scenario.oodsComponentId].keyboard).toEqual({});
    });
    for (const [index, trigger] of scenario.event.entries()) it(`${scenario.oodsComponentId}: ${index} ${trigger.trigger} ${trigger.key ?? trigger.action}`, async () => {
      const calls: unknown[] = [];
      const { container } = render(<main>{renderSharedScenario(scenario, { onEvent: value => calls.push(value) })}</main>);
      await executeScenarioTrigger(container, trigger, calls);
    });
  }
});
