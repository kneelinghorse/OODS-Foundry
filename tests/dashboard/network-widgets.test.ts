import { describe, expect, it } from 'vitest';
import {
  NETWORK_WIDGET_DEFAULTS,
  NETWORK_WIDGET_MIN_SIZES,
  NETWORK_WIDGET_CATEGORIES,
  NETWORK_WIDGET_DATA_REQUIREMENTS,
  resolveNetworkGridSpan,
  registerNetworkDashboardWidgets,
  createTreemapWidget,
  createSunburstWidget,
  createForceGraphWidget,
  createSankeyWidget,
  validateWidgetData,
  type NetworkDashboardWidget,
  type NetworkDashboardWidgetKind,
} from '@/dashboard/widgets/network-widgets.jsx';

describe('Network Widget Constants', () => {
  describe('NETWORK_WIDGET_DEFAULTS', () => {
    it('defines default grid spans for all widget types', () => {
      expect(NETWORK_WIDGET_DEFAULTS.treemap).toEqual({ cols: 4, rows: 3 });
      expect(NETWORK_WIDGET_DEFAULTS.sunburst).toEqual({ cols: 3, rows: 3 });
      expect(NETWORK_WIDGET_DEFAULTS['force-graph']).toEqual({ cols: 4, rows: 4 });
      expect(NETWORK_WIDGET_DEFAULTS.sankey).toEqual({ cols: 4, rows: 3 });
    });
  });

  describe('NETWORK_WIDGET_MIN_SIZES', () => {
    it('defines minimum sizes for all widget types', () => {
      expect(NETWORK_WIDGET_MIN_SIZES.treemap).toEqual({ cols: 2, rows: 2 });
      expect(NETWORK_WIDGET_MIN_SIZES.sunburst).toEqual({ cols: 2, rows: 2 });
      expect(NETWORK_WIDGET_MIN_SIZES['force-graph']).toEqual({ cols: 3, rows: 3 });
      expect(NETWORK_WIDGET_MIN_SIZES.sankey).toEqual({ cols: 3, rows: 2 });
    });
  });

  describe('NETWORK_WIDGET_CATEGORIES', () => {
    it('maps widget types to data categories', () => {
      expect(NETWORK_WIDGET_CATEGORIES.treemap).toBe('hierarchy');
      expect(NETWORK_WIDGET_CATEGORIES.sunburst).toBe('hierarchy');
      expect(NETWORK_WIDGET_CATEGORIES['force-graph']).toBe('network');
      expect(NETWORK_WIDGET_CATEGORIES.sankey).toBe('flow');
    });
  });

  describe('NETWORK_WIDGET_DATA_REQUIREMENTS', () => {
    it('defines hierarchical requirements for treemap', () => {
      const req = NETWORK_WIDGET_DATA_REQUIREMENTS.treemap;
      expect(req.trait).toBe('hierarchical');
      expect(req.minRows).toBe(2);
      expect(req.requiredFields).toContain('name');
      expect(req.requiredFields).toContain('value');
    });

    it('defines network requirements for force-graph', () => {
      const req = NETWORK_WIDGET_DATA_REQUIREMENTS['force-graph'];
      expect(req.trait).toBe('networkable');
      expect(req.minRows).toBe(2);
      expect(req.requiredFields).toContain('nodes');
      expect(req.requiredFields).toContain('links');
    });

    it('defines flow requirements for sankey', () => {
      const req = NETWORK_WIDGET_DATA_REQUIREMENTS.sankey;
      expect(req.trait).toBe('flowable');
      expect(req.requiredFields).toContain('source');
      expect(req.requiredFields).toContain('target');
      expect(req.requiredFields).toContain('value');
    });
  });
});

describe('resolveNetworkGridSpan', () => {
  it('returns default span when no custom span provided', () => {
    const span = resolveNetworkGridSpan('treemap');
    expect(span).toEqual(NETWORK_WIDGET_DEFAULTS.treemap);
  });

  it('uses custom span when provided', () => {
    const span = resolveNetworkGridSpan('treemap', { cols: 6, rows: 4 });
    expect(span).toEqual({ cols: 6, rows: 4 });
  });

  it('collapses to single column on narrow viewport', () => {
    const span = resolveNetworkGridSpan('force-graph', { cols: 4, rows: 4 }, 600);
    expect(span).toEqual({ cols: 1, rows: 4 });
  });

  it('preserves columns on wide viewport', () => {
    const span = resolveNetworkGridSpan('force-graph', { cols: 4, rows: 4 }, 1200);
    expect(span).toEqual({ cols: 4, rows: 4 });
  });

  it('uses default span for each widget type', () => {
    const kinds: NetworkDashboardWidgetKind[] = ['treemap', 'sunburst', 'force-graph', 'sankey'];
    for (const kind of kinds) {
      const span = resolveNetworkGridSpan(kind);
      expect(span).toEqual(NETWORK_WIDGET_DEFAULTS[kind]);
    }
  });
});

describe('registerNetworkDashboardWidgets', () => {
  const mockRender = () => null;

  const testWidget: NetworkDashboardWidget = {
    id: 'test-widget',
    title: 'Test Widget',
    description: 'A test widget',
    kind: 'treemap',
    category: 'hierarchy',
    dataRequirements: NETWORK_WIDGET_DATA_REQUIREMENTS.treemap,
    render: mockRender,
  };

  it('creates ViewExtension from widget definition', () => {
    const extensions = registerNetworkDashboardWidgets({
      traitId: 'TestTrait',
      widgets: [testWidget],
    });

    expect(extensions).toHaveLength(1);
    expect(extensions[0].id).toBe('TestTrait:test-widget');
    expect(extensions[0].region).toBe('main');
    expect(extensions[0].type).toBe('section');
    expect(extensions[0].priority).toBe(50);
  });

  it('includes metadata with tags and data requirements', () => {
    const extensions = registerNetworkDashboardWidgets({
      traitId: 'TestTrait',
      widgets: [testWidget],
    });

    const metadata = extensions[0].metadata;
    expect(metadata?.sourceTrait).toBe('TestTrait');
    expect(metadata?.tags).toContain('network-widget');
    expect(metadata?.tags).toContain('treemap');
    expect(metadata?.tags).toContain('hierarchy');
    expect(metadata?.tags).toContain('dashboard');
    expect(metadata?.notes).toBe('A test widget');
    expect(metadata?.dataRequirements).toEqual(NETWORK_WIDGET_DATA_REQUIREMENTS.treemap);
  });

  it('respects custom region', () => {
    const extensions = registerNetworkDashboardWidgets({
      traitId: 'TestTrait',
      widgets: [testWidget],
      region: 'contextPanel',
    });

    expect(extensions[0].region).toBe('contextPanel');
  });

  it('increments priority for multiple widgets', () => {
    const widgets = [
      { ...testWidget, id: 'widget-1' },
      { ...testWidget, id: 'widget-2' },
      { ...testWidget, id: 'widget-3' },
    ];

    const extensions = registerNetworkDashboardWidgets({
      traitId: 'TestTrait',
      widgets,
    });

    expect(extensions[0].priority).toBe(50);
    expect(extensions[1].priority).toBe(51);
    expect(extensions[2].priority).toBe(52);
  });
});

describe('Widget Factory Functions', () => {
  const mockRender = () => null;

  describe('createTreemapWidget', () => {
    it('creates treemap widget with correct defaults', () => {
      const widget = createTreemapWidget({
        id: 'my-treemap',
        title: 'My Treemap',
        render: mockRender,
      });

      expect(widget.kind).toBe('treemap');
      expect(widget.category).toBe('hierarchy');
      expect(widget.dataRequirements.trait).toBe('hierarchical');
      expect(widget.rendererNote).toBe('Requires ECharts (v1.0)');
    });
  });

  describe('createSunburstWidget', () => {
    it('creates sunburst widget with correct defaults', () => {
      const widget = createSunburstWidget({
        id: 'my-sunburst',
        title: 'My Sunburst',
        render: mockRender,
      });

      expect(widget.kind).toBe('sunburst');
      expect(widget.category).toBe('hierarchy');
      expect(widget.dataRequirements.trait).toBe('hierarchical');
    });
  });

  describe('createForceGraphWidget', () => {
    it('creates force-graph widget with correct defaults', () => {
      const widget = createForceGraphWidget({
        id: 'my-graph',
        title: 'My Graph',
        render: mockRender,
      });

      expect(widget.kind).toBe('force-graph');
      expect(widget.category).toBe('network');
      expect(widget.dataRequirements.trait).toBe('networkable');
    });
  });

  describe('createSankeyWidget', () => {
    it('creates sankey widget with correct defaults', () => {
      const widget = createSankeyWidget({
        id: 'my-sankey',
        title: 'My Sankey',
        render: mockRender,
      });

      expect(widget.kind).toBe('sankey');
      expect(widget.category).toBe('flow');
      expect(widget.dataRequirements.trait).toBe('flowable');
    });
  });
});

describe('validateWidgetData', () => {
  describe('hierarchical data (treemap/sunburst)', () => {
    it('validates nested hierarchy format', () => {
      const data = {
        type: 'nested',
        data: { name: 'Root', children: [{ name: 'Child', value: 10 }] },
      };

      const result = validateWidgetData('treemap', data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates adjacency list format', () => {
      const data = {
        type: 'adjacency_list',
        data: [
          { id: '1', parentId: null, value: 0 },
          { id: '2', parentId: '1', value: 10 },
        ],
      };

      const result = validateWidgetData('sunburst', data);
      expect(result.valid).toBe(true);
    });

    it('rejects invalid hierarchy format', () => {
      const data = { nodes: [], links: [] };

      const result = validateWidgetData('treemap', data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Hierarchical data must have type: "nested" or "adjacency_list" with data property'
      );
    });
  });

  describe('network data (force-graph)', () => {
    it('validates network format with nodes and links', () => {
      const data = {
        nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        links: [{ source: 'a', target: 'b' }, { source: 'b', target: 'c' }],
      };

      const result = validateWidgetData('force-graph', data);
      expect(result.valid).toBe(true);
    });

    it('rejects missing nodes array', () => {
      const data = { links: [{ source: 'a', target: 'b' }] };

      const result = validateWidgetData('force-graph', data);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('nodes'))).toBe(true);
    });

    it('rejects nodes array with insufficient items', () => {
      const data = {
        nodes: [{ id: 'a' }],
        links: [],
      };

      const result = validateWidgetData('force-graph', data);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('at least 2 items'))).toBe(true);
    });
  });

  describe('flow data (sankey)', () => {
    it('validates sankey format with nodes and links', () => {
      const data = {
        nodes: [{ name: 'A' }, { name: 'B' }],
        links: [{ source: 'A', target: 'B', value: 100 }],
      };

      const result = validateWidgetData('sankey', data);
      expect(result.valid).toBe(true);
    });
  });

  it('rejects null data', () => {
    const result = validateWidgetData('treemap', null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Data is required');
  });

  it('rejects undefined data', () => {
    const result = validateWidgetData('treemap', undefined);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Data is required');
  });
});
