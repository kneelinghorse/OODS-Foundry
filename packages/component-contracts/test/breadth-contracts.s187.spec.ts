import { describe, expect, it } from 'vitest';
import { componentContracts, NUCLEUS_COMPONENT_IDS, sharedScenarios } from '../src/index.js';

const FAMILIES = [
  'ArchiveSummary', 'ArchivePill', 'CancellationBadge', 'CancellationForm', 'PriceCardMeta',
  'OwnerBadge', 'OwnershipSummary', 'OwnershipMeta', 'TagSummary','LabelCell', 'InlineLabel', 'FormLabelGroup', 'ClassificationBadge', 'ClassificationEditor'] as const;
describe('Sprint 187 fresh composition contracts', () => {
  it.each(FAMILIES)('%s has one governed contract and scenario without invented edit events', (id) => {
    expect(NUCLEUS_COMPONENT_IDS.filter((entry) => entry === id)).toEqual([id]);
    const scenarios = sharedScenarios.filter((entry) => entry.oodsComponentId === id);
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0]!.renderExpectation.name).toBe('render');
    expect(componentContracts[id].events).toEqual([]);
    expect(componentContracts[id].props).not.toContain('field');
    expect(componentContracts[id].slots).toEqual(['default']);
  });
  it('records the HTML semantics and unresolved directives instead of asserting an editor action', () => {
    expect(componentContracts.ClassificationEditor.compatibility).toContain('Presentational native controls only');
    expect(componentContracts.ClassificationEditor.compatibility).toContain('maxTagsParameter');
    expect(componentContracts.ClassificationBadge.compatibility).toContain('tagPreviewField is consumed unbound');
    expect(componentContracts.LabelCell.compatibility).toContain('three-dot suffix');
    expect(componentContracts.InlineLabel.compatibility).toContain('field binds label');
    expect(componentContracts.FormLabelGroup.compatibility).toContain('htmlFor/for/inputId');
  });
});
