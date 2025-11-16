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

function createRegionMap(overrides: Partial<RegionMap> = {}): RegionMap {
  const base = Object.fromEntries(
    REGION_ORDER.map((region) => [region, null])
  ) as RegionMap;

  return {
    ...base,
    ...overrides,
  };
}

describe('Context templates', () => {
  describe('ListView', () => {
    it('renders required slots when regions are empty', () => {
      const regions = createRegionMap();
      const render = () => renderToStaticMarkup(<ListView regions={regions} />);

      expect(render).not.toThrow();
      expect(render()).toMatchSnapshot();
    });

    it('renders optional slots in deterministic order', () => {
      const regions = createRegionMap({
        globalNavigation: <div>Shell</div>,
        pageHeader: <header>List Header</header>,
        breadcrumbs: <nav>Trail</nav>,
        viewToolbar: <div>Filters</div>,
        main: <section>Main Area</section>,
        contextPanel: <aside>KPIs</aside>,
      });

      const markup = renderToStaticMarkup(<ListView regions={regions} />);
      expect(markup).toMatchSnapshot();
    });
  });

  describe('DetailView', () => {
    it('renders required slots when regions are empty', () => {
      const regions = createRegionMap();
      const render = () => renderToStaticMarkup(<DetailView regions={regions} />);

      expect(render).not.toThrow();
      expect(render()).toMatchSnapshot();
    });

    it('renders populated slots alongside context panel', () => {
      const regions = createRegionMap({
        globalNavigation: <div>Shell</div>,
        pageHeader: <header>Detail Header</header>,
        breadcrumbs: <nav>Trail</nav>,
        viewToolbar: <div>Actions</div>,
        main: <section>Details</section>,
        contextPanel: <aside>Timeline</aside>,
      });

      const markup = renderToStaticMarkup(<DetailView regions={regions} />);
      expect(markup).toMatchSnapshot();
    });
  });

  describe('FormView', () => {
    it('renders required slots when regions are empty', () => {
      const regions = createRegionMap();
      const render = () => renderToStaticMarkup(<FormView regions={regions} />);

      expect(render).not.toThrow();
      expect(render()).toMatchSnapshot();
    });

    it('renders optional toolbar and supporting panel', () => {
      const regions = createRegionMap({
        globalNavigation: <div>Shell</div>,
        pageHeader: <header>Form Header</header>,
        breadcrumbs: <nav>Trail</nav>,
        viewToolbar: <div>Save Actions</div>,
        main: <section>Form</section>,
        contextPanel: <aside>Helper</aside>,
      });

      const markup = renderToStaticMarkup(<FormView regions={regions} />);
      expect(markup).toMatchSnapshot();
    });
  });

  describe('TimelineView', () => {
    it('renders required slots when regions are empty', () => {
      const regions = createRegionMap();
      const render = () => renderToStaticMarkup(<TimelineView regions={regions} />);

      expect(render).not.toThrow();
      expect(render()).toMatchSnapshot();
    });

    it('renders meta inside main content with supporting panel', () => {
      const regions = createRegionMap({
        globalNavigation: <div>Shell</div>,
        breadcrumbs: <nav>Trail</nav>,
        pageHeader: <header>Timeline Header</header>,
        viewToolbar: <div>Feed Filters</div>,
        main: <section>Activity Feed</section>,
        contextPanel: <aside>Related Threads</aside>,
      });

      const markup = renderToStaticMarkup(<TimelineView regions={regions} />);
      expect(markup).toMatchSnapshot();
    });
  });

  describe('CardView', () => {
    it('renders required slots when regions are empty', () => {
      const regions = createRegionMap();
      const render = () => renderToStaticMarkup(<CardView regions={regions} />);

      expect(render).not.toThrow();
      expect(render()).toMatchSnapshot();
    });

    it('renders header and supporting content when provided', () => {
      const regions = createRegionMap({
        pageHeader: <header>Card Header</header>,
        main: <section>Card Body</section>,
        contextPanel: <aside>Annotations</aside>,
      });

      const markup = renderToStaticMarkup(<CardView regions={regions} />);
      expect(markup).toMatchSnapshot();
    });
  });

  describe('InlineView', () => {
    it('renders required slots when regions are empty', () => {
      const regions = createRegionMap();
      const render = () => renderToStaticMarkup(<InlineView regions={regions} />);

      expect(render).not.toThrow();
      expect(render()).toMatchSnapshot();
    });

    it('renders header row with badges when supplied', () => {
      const regions = createRegionMap({
        pageHeader: <header>Inline Header</header>,
        viewToolbar: <div>Badges</div>,
        main: <section>Inline Content</section>,
      });

      const markup = renderToStaticMarkup(<InlineView regions={regions} />);
      expect(markup).toMatchSnapshot();
    });
  });

  describe('ChartView', () => {
    it('renders required slots when regions are empty', () => {
      const regions = createRegionMap();
      const render = () => renderToStaticMarkup(<ChartView regions={regions} />);
      expect(render).not.toThrow();
      expect(render()).toMatchSnapshot();
    });

    it('renders hero, toolbar, and insight rail when provided', () => {
      const regions = createRegionMap({
        pageHeader: <header>Chart Hero</header>,
        viewToolbar: <div>Filters</div>,
        main: <section>Chart Body</section>,
        contextPanel: <aside>Insights</aside>,
      });

      const markup = renderToStaticMarkup(<ChartView regions={regions} />);
      expect(markup).toMatchSnapshot();
    });
  });

  describe('DashboardView', () => {
    it('renders required slots when regions are empty', () => {
      const regions = createRegionMap();
      const render = () => renderToStaticMarkup(<DashboardView regions={regions} />);
      expect(render).not.toThrow();
      expect(render()).toMatchSnapshot();
    });

    it('renders chrome, grid, and insight rail when populated', () => {
      const regions = createRegionMap({
        pageHeader: <header>Dashboard Hero</header>,
        viewToolbar: <div>Dashboard Toolbar</div>,
        main: <section>Dashboard Grid</section>,
        contextPanel: <aside>Dashboard Insights</aside>,
      });

      const markup = renderToStaticMarkup(<DashboardView regions={regions} />);
      expect(markup).toMatchSnapshot();
    });
  });
});
