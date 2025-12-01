/**
 * Network & Flow Visualization Components
 *
 * Barrel export for all four Network & Flow visualization types:
 * - Treemap: Hierarchical data as nested rectangles
 * - Sunburst: Hierarchical data as radial arcs
 * - ForceGraph: Network data as force-directed graph
 * - Sankey: Flow data as directed weighted diagram
 *
 * All components use ECharts exclusively in v1.0. The renderer prop exists
 * for future extensibility but defaults to 'echarts' and shows a warning
 * for other values.
 *
 * @example
 * ```tsx
 * import { Treemap, Sunburst, ForceGraph, Sankey } from './network-index';
 *
 * <Treemap data={hierarchyData} width={600} height={400} />
 * <Sunburst data={hierarchyData} width={500} height={500} />
 * <ForceGraph data={networkData} width={800} height={600} />
 * <Sankey data={flowData} width={900} height={500} />
 * ```
 */

// Hierarchy components
export { Treemap } from './Treemap.js';
export type { TreemapProps, TreemapNode } from './Treemap.js';

export { Sunburst } from './Sunburst.js';
export type { SunburstProps, SunburstNode } from './Sunburst.js';

// Network component
export { ForceGraph } from './ForceGraph.js';
export type { ForceGraphProps, GraphNode, GraphLink } from './ForceGraph.js';

// Flow component
export { Sankey } from './Sankey.js';
export type { SankeyProps, SankeyNodeOutput, SankeyLinkOutput } from './Sankey.js';

// Accessibility fallback components
export { TreemapA11yFallback } from './a11y/TreemapA11yFallback.js';
export type { TreemapA11yFallbackProps } from './a11y/TreemapA11yFallback.js';

export { SunburstA11yFallback } from './a11y/SunburstA11yFallback.js';
export type { SunburstA11yFallbackProps } from './a11y/SunburstA11yFallback.js';

export { GraphA11yFallback } from './a11y/GraphA11yFallback.js';
export type { GraphA11yFallbackProps } from './a11y/GraphA11yFallback.js';

export { SankeyA11yFallback } from './a11y/SankeyA11yFallback.js';
export type { SankeyA11yFallbackProps } from './a11y/SankeyA11yFallback.js';
