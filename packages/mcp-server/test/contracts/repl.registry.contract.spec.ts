import { describe, expect, it } from 'vitest';
import { componentRenderers } from '../../src/render/component-map.js';
import { loadComponentRegistry } from '../../src/tools/repl.utils.js';

const BASIC_COMPONENTS = ['Button', 'Card', 'Grid', 'Stack', 'Text', 'Input', 'Checkbox', 'DatePicker', 'Select', 'Textarea', 'Badge', 'Banner', 'Table', 'Tabs'];
// s222-m02 (#2502 ruling 11): Switch and Dialog join the 110.
const EXPECTED_COMPONENT_COUNT = 114; // s223-m02 (#2527): SegmentedControl and Combobox join the 112.

describe('REPL registry contract', () => {
  it('includes all registry components and the basic primitives', () => {
    const registry = loadComponentRegistry();

    for (const component of BASIC_COMPONENTS) {
      expect(registry.names.has(component)).toBe(true);
    }

    expect(registry.names.size).toBe(EXPECTED_COMPONENT_COUNT);
  });

  it('includes every component that has a mapped renderer', () => {
    const registry = loadComponentRegistry();

    for (const rendererComponentName of Object.keys(componentRenderers)) {
      expect(registry.names.has(rendererComponentName)).toBe(true);
    }
  });
});
