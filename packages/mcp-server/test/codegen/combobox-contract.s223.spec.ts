/**
 * s223-m02 (#2527 ruling 11): code.generate's prop contract for Combobox. A saved schema that places the documented example
 * (or any of the four control sizes, a named, required or invalid field) compiles for React and Vue; a size outside the
 * control sizes or an option without its label is refused before it reaches a target compiler.
 */
import { sharedScenarios } from '@oods/component-contracts';
import { describe, expect, it } from 'vitest';

import { preflightTargetContracts } from '../../src/codegen/target-contracts.js';
import type { UiSchema } from '../../src/schemas/generated.js';

const example = sharedScenarios.find((scenario) => scenario.oodsComponentId === 'Combobox')!;
const schema = (props: Record<string, unknown>): UiSchema => ({ version: '1.0', screens: [{ id: 'combobox-node', component: 'Combobox', props }] } as UiSchema);
const issues = (props: Record<string, unknown>, framework: 'react' | 'vue') => preflightTargetContracts(schema(props), framework).issues.map((issue) => issue.message);

describe('s223-m02 code.generate accepts the Combobox contract', () => {
  for (const framework of ['react', 'vue'] as const) {
    it(`${framework}: the documented example and each control size pass`, () => {
      expect(issues(example.props, framework)).toEqual([]);
      for (const size of ['xs', 'sm', 'md', 'lg']) {
        expect(issues({ ...example.props, size, name: 'country', required: true, disabled: false, defaultValue: 'ca', validation: { state: 'error', message: 'Choose a country' } }, framework), size).toEqual([]);
      }
    });

    it(`${framework}: refuses a size outside the control sizes and an option without its label`, () => {
      expect(issues({ ...example.props, size: 'xl' }, framework).join(' ')).toMatch(/size/);
      expect(issues({ ...example.props, options: [{ value: 'ca' }] }, framework).join(' ')).toMatch(/options/);
    });
  }
});
