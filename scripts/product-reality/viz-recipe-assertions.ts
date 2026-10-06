import { expect } from 'vitest';
import type { SharedScenario } from '@oods/component-contracts';

/** SVG bytes and authored field meaning must survive the recipe boundary. */
export function assertVizRecipeScenario(scenario: SharedScenario, root: Element) {
  const id = scenario.oodsComponentId;
  if (id.endsWith('Preview')) {
    const holder = root.querySelector('[data-viz-svg]');
    expect(holder?.querySelectorAll('path,rect,circle,line').length).toBeGreaterThan(3);
    const expected = document.createElement('div'); expected.innerHTML = String(scenario.props.svg);
    expect(holder?.innerHTML).toBe(expected.innerHTML);
    expect(root.getAttribute('role')).toBe('img');
    expect(root.getAttribute('aria-label')).toBe(scenario.props.title);
    expect(root.querySelector('[data-viz-preview-placeholder]')).toBeNull();
    return;
  }
  const expected: Record<string, string[]> = {
    VizAxisSummary: ['period', 'Period', 'ascending'], VizOpacitySummary: ['0.8'], VizScaleSummary: ['value', 'linear'], VizSizeSummary: ['size', 'linear'], VizEncodingBadge: ['X: period'], VizRoleBadge: ['Chart: bar'],
  };
  if (expected[id]) { for (const value of expected[id]) expect(root.textContent).toContain(value); return; }
  expect(root.tagName).toBe('FIELDSET');
  expect(root.querySelector('legend')?.textContent?.trim().length).toBeGreaterThan(0);
  expect(root.querySelectorAll('input,select').length).toBeGreaterThan(0);
  for (const field of Array.from(root.querySelectorAll<HTMLInputElement>('input,select'))) {
    expect(field.labels?.length).toBe(1);
    expect(field.value.length).toBeGreaterThan(0);
  }
  if (id === 'VizColorControls' || id === 'VizColorLegendConfig') {
    expect(root.textContent).toContain('#2563eb'); expect(root.textContent).toContain('#b45309');
  }
}
