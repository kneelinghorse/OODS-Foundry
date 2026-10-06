import { describe, expect, it } from 'vitest';

import {
  COMPONENT_CONTRACT_VERSION,
  COMPONENT_CONTRACT_VERSION_1_1,
  NUCLEUS_COMPONENT_IDS,
  PORTED_COMPONENT_IDS,
  componentContracts,
  sharedScenarios,
} from '../src/index.js';

const BREADTH_CONTRACTS = {
  CardHeader: {
    props: ['title', 'label', 'text', 'supporting', 'supportingText', 'subtitle', 'description', 'level', 'as'],
    renderer: 'renderCardHeader',
    scenario: 'card-header-supporting-text',
  },
  ColorSwatch: {
    props: ['color', 'value', 'state', 'label'],
    renderer: 'renderColorSwatch',
    scenario: 'color-swatch-label-and-chip',
  },
  ColorizedBadge: {
    props: ['label', 'text', 'state', 'value', 'status', 'color', 'hue', 'swatch', 'variant', 'tone', 'emphasis'],
    renderer: 'renderColorizedBadge',
    scenario: 'colorized-badge-color-marker',
  },
  DetailHeader: {
    props: ['title', 'label', 'text', 'subtitle', 'sublabel', 'description', 'metadata', 'meta', 'level', 'as'],
    renderer: 'renderDetailHeader',
    scenario: 'detail-header-heading-level',
  },
  VizAreaPreview: {
    // s213-m01: + svgWide, the chart drawn for a desktop column (Sprint 212 review finding 5).
    // s222-m02 (F7): the dark and hc renders of each size, so the chart follows its nearest [data-theme].
    props: ['svg', 'svgNarrow', 'svgWide', 'svgDark', 'svgDarkNarrow', 'svgDarkWide', 'svgHc', 'svgHcNarrow', 'svgHcWide', 'title', 'description', 'width', 'height'],
    renderer: 'renderVizAreaPreview',
    scenario: 'viz-area-preview-frame-placeholder-and-slot',
  },
} as const;

describe('Sprint 185 component breadth contracts', () => {
  it('registers the measured additions in the nucleus with exactly one shared scenario per member', () => {
    expect(NUCLEUS_COMPONENT_IDS).toEqual([...NUCLEUS_COMPONENT_IDS].sort());
    expect(Object.keys(componentContracts)).toEqual(NUCLEUS_COMPONENT_IDS);
    expect(sharedScenarios.map(({ oodsComponentId }) => oodsComponentId)).toEqual(NUCLEUS_COMPONENT_IDS);
    expect(new Set(sharedScenarios.map(({ id }) => id)).size).toBe(NUCLEUS_COMPONENT_IDS.length);

    for (const id of Object.keys(BREADTH_CONTRACTS)) {
      expect(NUCLEUS_COMPONENT_IDS).toContain(id);
      expect(PORTED_COMPONENT_IDS).not.toContain(id);
    }
  });

  for (const [id, expected] of Object.entries(BREADTH_CONTRACTS)) {
    it(`${id} governs its measured props and mirrors the named HTML renderer`, () => {
      const contract = componentContracts[id as keyof typeof BREADTH_CONTRACTS];
      expect(contract.id).toBe(id);
      expect(contract.version).toBe(id === 'VizAreaPreview' ? COMPONENT_CONTRACT_VERSION_1_1 : COMPONENT_CONTRACT_VERSION);
      expect([...contract.props].sort()).toEqual([...expected.props].sort());
      expect(new Set(contract.props).size).toBe(contract.props.length);
      expect(contract.props).not.toContain('field'); // Generic field bindings are lowered before component rendering.
      expect(contract.slots).toEqual(['default']);
      expect(contract.events).toEqual([]);
      expect(contract.compatibility).toContain(expected.renderer);
    });

    it(`${id} has a named behavioral scenario using only its governed interface`, () => {
      const contract = componentContracts[id as keyof typeof BREADTH_CONTRACTS];
      const scenarios = sharedScenarios.filter(({ oodsComponentId }) => oodsComponentId === id);
      expect(scenarios).toHaveLength(1);
      const scenario = scenarios[0]!;
      expect(scenario.id).toBe(expected.scenario);
      for (const prop of Object.keys(scenario.props)) expect(contract.props).toContain(prop);
      for (const slot of Object.keys(scenario.slots)) expect(contract.slots).toContain(slot);
      expect(Object.keys(scenario.props).length + Object.keys(scenario.slots).length).toBeGreaterThan(0);
      expect(scenario.renderExpectation.name).toBe('render');
      expect(scenario.renderExpectation.trigger).toBeTruthy();
      expect(scenario.renderExpectation.expected).toBeTruthy();
      expect(scenario.assertions.length).toBeGreaterThan(0);
    });
  }

  it('retains the static SVG and prior amendments when all governed contracts reach v1.1', () => {
    const amended = Object.values(componentContracts)
      .filter(({ version }) => version === COMPONENT_CONTRACT_VERSION_1_1)
      .map(({ id }) => id)
      .sort();
    expect(amended).toEqual([...NUCLEUS_COMPONENT_IDS].sort());
    const original = Object.values(componentContracts)
      .filter(({ version }) => version === '1.0.0')
      .map(({ id }) => id)
      .sort();
    expect(original).toEqual([...NUCLEUS_COMPONENT_IDS].filter((id) => !amended.includes(id)).sort());
    expect(componentContracts.Card.compatibility).toContain('CardHeader');
    expect(componentContracts.Card.version).toBe(COMPONENT_CONTRACT_VERSION);
    expect(componentContracts.Card.props).toEqual(['elevated', 'as']);
    expect(componentContracts.Card.slots).toEqual(['default']);
  });

  it('requires real headings with measured defaults and visible supporting information', () => {
    for (const [id, fallback] of [['DetailHeader', 'h2'], ['CardHeader', 'h3']] as const) {
      const accessibility = componentContracts[id].accessibility.join(' ');
      expect(accessibility).toContain('real heading element');
      expect(accessibility).toContain('as/level');
      expect(accessibility).toContain(`default ${fallback}`);
      expect(accessibility).toContain('visible');
    }
    const detail = sharedScenarios.find(({ oodsComponentId }) => oodsComponentId === 'DetailHeader')!;
    expect(detail.props).toMatchObject({ as: 'h1', level: 2 });
    expect(detail.assertions).toContain('as takes precedence over level');
    const card = sharedScenarios.find(({ oodsComponentId }) => oodsComponentId === 'CardHeader')!;
    expect(card.props.supportingText).toBeTruthy();
    expect(card.initialState).toEqual({ heading: 'h2' });
  });

  it('keeps color supplementary to visible text and preserves Badge status semantics', () => {
    for (const id of ['ColorSwatch', 'ColorizedBadge'] as const) {
      const accessibility = componentContracts[id].accessibility.join(' ');
      expect(accessibility).toContain('visible text label always');
      expect(accessibility).toContain('decorative');
      expect(accessibility).toContain('Color is never the sole');
      const scenario = sharedScenarios.find(({ oodsComponentId }) => oodsComponentId === id)!;
      expect(scenario.props.label).toBeTruthy();
      expect(scenario.renderExpectation.trigger).toContain('forced-colors');
      expect(scenario.assertions.some((assertion) => assertion.includes('without color'))).toBe(true);
    }
    expect(componentContracts.ColorizedBadge.accessibility.join(' ')).toContain('Badge inline noninteractive status label semantics');
    expect(componentContracts.ColorizedBadge.states).toEqual(componentContracts.Badge.states);
    expect(componentContracts.ColorizedBadge.compatibility).toContain('renderBadgePrimitive');
    expect(componentContracts.ColorizedBadge.compatibility).toContain('default variant colorized');
  });

  it('makes the preview frame limitation and placeholder-versus-slot behavior explicit', () => {
    const contract = componentContracts.VizAreaPreview;
    expect(contract.compatibility).toContain('With svg, renders a labelled figure preserving static SVG IDs and ARIA');
    expect(contract.compatibility).toContain('without svg, the placeholder remains unchanged');
    expect(contract.compatibility).toContain('renderVizPreview');
    expect(contract.compatibility).toContain('data-viz-preview-type=area');
    expect(contract.compatibility).toContain('640x360');
    expect(contract.compatibility).toContain('placeholder appears only without authored content');
    expect(contract.states).toEqual(['placeholder', 'content']);
    const scenario = sharedScenarios.find(({ oodsComponentId }) => oodsComponentId === 'VizAreaPreview')!;
    expect(scenario.props).toEqual({ width: 640, height: 360 });
    expect(scenario.slots.default).toBeTruthy();
    expect(scenario.renderExpectation.trigger).toBe('remove the default slot and then restore it');
    expect(scenario.assertions).toContain('renders no chart pixels');
    expect(scenario.assertions).toContain('not visualization evidence');
  });
});
