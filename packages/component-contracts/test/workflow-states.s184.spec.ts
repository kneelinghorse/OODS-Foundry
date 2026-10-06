import { describe, expect, it } from 'vitest';

import {
  NUCLEUS_COMPONENT_IDS,
  UI_WORKFLOW_STATES,
  componentContracts,
} from '../src/index.js';

describe('Sprint 184 workflow-state vocabulary', () => {
  it('exports the exact ordered cross-component vocabulary', () => {
    expect(UI_WORKFLOW_STATES).toEqual(['loading', 'empty', 'error', 'success']);
  });

  it('keeps workflow states separate from component-local state contracts', () => {
    expect(Object.keys(componentContracts).sort()).toEqual([...NUCLEUS_COMPONENT_IDS].sort());
    for (const contract of Object.values(componentContracts)) {
      expect(contract).not.toHaveProperty('workflowStates');
    }
  });
});
