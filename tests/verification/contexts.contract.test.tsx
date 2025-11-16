import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CardView,
  ChartView,
  DashboardView,
  DetailView,
  FormView,
  InlineView,
  ListView,
  TimelineView,
} from '../../src/contexts/index.js';
import { REGION_ORDER, type RegionMap } from '../../src/types/regions.js';

type ContextEntry = {
  readonly name: string;
  readonly Component: (props: { regions: RegionMap; className?: string }) => JSX.Element;
};

const CONTEXTS: readonly ContextEntry[] = [
  { name: 'list', Component: ListView },
  { name: 'detail', Component: DetailView },
  { name: 'form', Component: FormView },
  { name: 'timeline', Component: TimelineView },
  { name: 'card', Component: CardView },
  { name: 'inline', Component: InlineView },
  { name: 'chart', Component: ChartView },
  { name: 'dashboard', Component: DashboardView },
];

const EXPECTED_REGIONS_BY_CONTEXT: Record<string, readonly string[]> = {
  list: REGION_ORDER,
  detail: REGION_ORDER,
  form: REGION_ORDER,
  timeline: REGION_ORDER,
  card: ['pageHeader', 'main', 'contextPanel'],
  inline: ['pageHeader', 'viewToolbar', 'main'],
  chart: REGION_ORDER,
  dashboard: REGION_ORDER,
};

function createRegionMap(overrides: Partial<RegionMap> = {}): RegionMap {
  const baseline = Object.fromEntries(REGION_ORDER.map((region) => [region, null])) as RegionMap;
  return {
    ...baseline,
    ...overrides,
  };
}

function createSyntheticRegionMap(): RegionMap {
  return createRegionMap(
    Object.fromEntries(
      REGION_ORDER.map((region) => [
        region,
        <div data-stub-region={region} key={region}>
          {region}
        </div>,
      ])
    )
  );
}

describe('B3.2 — Context Templates', () => {
  describe.each(CONTEXTS)('%s context template', ({ name, Component }) => {
    it('renders with an empty RegionMap without throwing', () => {
      const regions = createRegionMap();
      const render = () => renderToStaticMarkup(<Component regions={regions} />);
      expect(render).not.toThrow();
    });

    it('renders synthetic region payload for configured canonical regions', () => {
      const regions = createSyntheticRegionMap();
      const markup = renderToStaticMarkup(<Component regions={regions} />);
      const expectedRegions = EXPECTED_REGIONS_BY_CONTEXT[name] ?? REGION_ORDER;

      for (const region of expectedRegions) {
        expect(
          markup.includes(`data-region="${region}"`),
          `Expected markup to include data-region="${region}"`
        ).toBe(true);
        expect(
          markup.includes(`data-stub-region="${region}"`),
          `Expected stub content for region "${region}"`
        ).toBe(true);
      }

      const unexpectedRegions = REGION_ORDER.filter((region) => !expectedRegions.includes(region));

      for (const region of unexpectedRegions) {
        expect(
          markup.includes(`data-stub-region="${region}"`),
          `Context ${name} should not surface region "${region}".`
        ).toBe(false);
      }

      expect(
        /data-region="(banner|tabs|toast|notification)"/i.test(markup),
        `Context ${name} should not embed forbidden structural regions.`
      ).toBe(false);
    });
  });
});
