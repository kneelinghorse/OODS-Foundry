import assert from 'node:assert/strict';
import { describe, expect, it } from 'vitest';
import { componentContracts, NUCLEUS_COMPONENT_IDS, sharedScenarios, type ComponentContract, type SharedScenario } from '../src/index.js';

function assertMeasuredContract(contract: ComponentContract, scenario: SharedScenario) {
  assert.equal(contract.version, '1.1.0');
  assert(contract.role && contract.name?.strategy && contract.name.target && contract.keyboard, `${contract.id}: structured semantics required`);
  assert.equal(scenario.oodsComponentId, contract.id);
  if (scenario.interaction === 'none') {
    assert(scenario.interactionReason && scenario.interactionReason.length > 20);
    assert.deepEqual(scenario.event, []);
    assert.deepEqual(contract.keyboard, {});
  } else {
    assert(scenario.event.length > 0);
    assert(Object.keys(contract.keyboard).length > 0);
    for (const key of Object.keys(contract.keyboard)) assert(scenario.event.some(trigger => trigger.trigger === 'keyboard' && trigger.key === key), `${contract.id}: ${key} has no executable assertion`);
    for (const trigger of scenario.event) {
      assert(trigger.target && trigger.effect.kind);
      if (trigger.trigger === 'keyboard') assert(trigger.key && contract.keyboard[trigger.key]);
      else assert(trigger.action);
    }
  }
}

describe('governed semantics and interaction coverage', () => {
  it('measures every governed root, with no omitted or duplicate scenario', () => {
    expect(NUCLEUS_COMPONENT_IDS.length).toBeGreaterThan(0);
    expect(sharedScenarios.map(scenario => scenario.oodsComponentId)).toEqual(NUCLEUS_COMPONENT_IDS);
    for (const scenario of sharedScenarios) assertMeasuredContract(componentContracts[scenario.oodsComponentId], scenario);
  });
  it('rejects prose-only contracts and keyboard claims with no executable trigger', () => {
    const scenario = sharedScenarios.find(scenario => scenario.oodsComponentId === 'Tabs')!;
    expect(() => assertMeasuredContract({ ...componentContracts.Tabs, keyboard: undefined }, scenario)).toThrow(/structured semantics/);
    expect(() => assertMeasuredContract(componentContracts.Tabs, { ...scenario, event: scenario.event.filter(trigger => trigger.key !== 'ArrowRight') })).toThrow(/ArrowRight/);
  });
  it('rejects a dropped axe scenario at the same exact-membership gate the framework loops use', () => {
    const ids = sharedScenarios.slice(1).map(scenario => scenario.oodsComponentId);
    expect(() => assert.deepEqual(ids, NUCLEUS_COMPONENT_IDS)).toThrow();
  });
});
