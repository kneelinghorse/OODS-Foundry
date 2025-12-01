Technical Specification and Architectural Analysis for OODS Foundry Visualization Layer: Direct Data Pass-Through Implementation
1. Architectural Imperatives of Direct Data Pass-Through
The evolution of modern data visualization architectures has increasingly favored a "Direct Data Pass-Through" (DDPT) methodology, particularly for enterprise-grade systems like the OODS Foundry. In this paradigm, the burden of data structural transformation is shifted entirely from the client-side browser to the server-side processing layer. This architectural decision is not merely a matter of preference but a necessity for performance optimization when dealing with high-cardinality, hierarchical, and relational datasets. Traditional "fat-client" architectures, where the server transmits normalized, flat data sets (e.g., CSV or SQL-like row sets) and relies on the client's CPU to iterate, nest, and format this data for rendering, introduce unacceptable latency—specifically "Time to Interactive" (TTI) and "Time to First Frame" (TTFF).   

For the OODS Foundry, the objective is to define rigid data schemas that allow backend systems to generate JSON payloads that map 1:1 to the native series.data properties of the Apache ECharts library. This approach effectively treats the backend API response as a pre-computed view model. By aligning the server-side data serialization strictly with ECharts' internal data structures, the frontend visualization layer achieves maximal rendering performance, as it bypasses the costly JavaScript execution cycles required for data parsing, recursion, and layout calculation.   

This report provides an exhaustive technical analysis of the implementation specifications for four complex visualization modules: Treemap, Sunburst, Graph, and Sankey diagrams. Unlike Cartesian charts (Bar, Line) which benefit from ECharts' dataset component for handling flat table data, these four types represent topological and hierarchical data structures that resist flat representation. Consequently, they require specialized, often recursive, schemas to function in a DDPT environment. The analysis that follows dissects the native JSON requirements, identifies critical constraints regarding layout and interaction, and establishes the exact schemas OODS Foundry must implement.

1.1 The Dataset vs. Series Data Dichotomy in ECharts
A foundational constraint identified in the ECharts architecture, which fundamentally shapes the OODS Foundry specification, is the distinction between the dataset component (introduced in ECharts 4) and the series.data property. The dataset component was designed to manage flat, tabular data (dimensions and measures) separate from the visual definition, enabling data reuse across multiple charts.   

However, the research materials explicitly highlight a critical limitation: specialized charts such as Treemap, Graph, Sankey, and Sunburst generally do not support the dataset mechanism effectively. While ECharts 5 introduced extensive data transform capabilities (filtering, sorting), the documentation and community discussions confirm that complex hierarchical mapping from a flat dataset to these topological charts is either unsupported or requires complex, non-standard client-side transforms.   

Architectural Consequence: The OODS Foundry cannot rely on a generic, flat "data lake" API response. The backend must assume the responsibility of data shaping. For a Treemap, the backend must perform the tree traversal and nesting; for a Graph, it must construct the node-edge topology. This necessitates distinct API endpoints or serialization profiles for each visualization type, rather than a single universal data endpoint.

1.2 State Management and Interaction
To ensure a robust user experience, the data schemas must encompass not just value data but also state and interaction metadata. ECharts supports a sophisticated event system and state model (normal, emphasis, blur, select). A true DDPT implementation requires the backend to inject state-specific style overrides directly into the data items if specific business logic dictates it (e.g., a "Critical Alert" node in a graph should carry a specific red color definition in its payload, rather than relying on frontend conditional logic).   

The following sections detail the exact technical specifications for each chart type.

2. Hierarchical Data Specifications: Treemap and Sunburst
Hierarchical visualizations are essential for displaying part-to-whole relationships and multi-level categorizations. Both Treemap and Sunburst charts in ECharts utilize a recursive children array structure. The OODS Foundry schema for these modules must generate a strictly nested JSON object, handling the recursion logic server-side to spare the client browser from stack-intensive operations.

2.1 Treemap Visualization Specification
The Treemap functions as a visualization composed of nested rectangles, where the area of each rectangle represents a specific dimension (usually quantity), and the color often represents another (e.g., performance or category). It is the standard for maximizing data density in a constrained screen space.   

2.1.1 Native Data Schema Requirements
The ECharts Treemap implementation mandates a recursive TreeItem structure. The top level of the series.data array expects one or more root nodes.

Constraint Checklist & Schema Definition:

The following schema defines the rigid structure required for the OODS Foundry JSON payload.

Field	Type	Mandate	Description & Technical Context
name	String	Required	
The identifier for the node, displayed in the label and breadcrumb. Must be unique within siblings for animation consistency.

value	Number | Array	Required	
Determines the area of the rectangle. For leaf nodes, this is the raw metric. For branch nodes, this should ideally be the sum of children values. If an array is passed (e.g., [sales, profit]), visualDimension must be set in the series options to map a specific index to the area calculation.

children	Array	Optional	A recursive array of TreeItem objects. Presence implies the node is a branch; absence implies a leaf.
id	String	Recommended	
Unique ID for the node. Critical for universalTransition animations and dispatchAction events.

itemStyle	Object	Optional	Style overrides (color, border width) specific to this node. Used for backend-driven highlighting (e.g., "alert state").
path	String	Optional	Custom field for OODS metadata, useful for linking to external resources upon click events.
  
Critical Constraint: Flat Data Incompatibility ECharts Treemaps do not natively accept flat data (e.g., an array of objects with id and parentId). While external algorithms (like Stratify in d3.js) can convert flat data to trees, relying on them violates the DDPT principle.   

Requirement: The OODS Foundry backend must perform the recursive nesting. The API response must be a completed tree structure.

2.1.2 Visual Encoding and Layout Logic
To enable rich insight, the schema must support multi-dimensional mapping.

Visual Mapping: The schema supports passing an array for value. The OODS Foundry specification should leverage this to separate the "Size" dimension from the "Color" dimension. For example, a rectangle's size could represent Revenue (index 0), while its color intensity represents Profit Margin (index 1). This requires the global chart configuration (outside the data payload) to set visualDimension: 1 and configure a visualMap component.   

Levels Configuration: The visual hierarchy is reinforced through the levels property. While usually part of the static chart option, if OODS Foundry requires dynamic styling per level (e.g., Level 0 borders are 5px, Level 1 are 2px), this configuration must be generated alongside the data. This provides depth perception cues crucial for user orientation in deep hierarchies.   

2.1.3 Drill-Down and Navigation Constraints
One of the Treemap's primary interactive features is drill-down.

Leaf Depth: The leafDepth property controls the initial rendering depth. If OODS Foundry sets leafDepth: 1, only the root and its immediate children are rendered. Clicking a node triggers a drill-down.

Implication: This feature assumes the entire tree is loaded in the series.data payload. ECharts does not natively support "fetch-on-drill" (asynchronous loading) without custom event handling that completely replaces the series data. For a pure DDPT experience, the full dataset must be sent, or the application must treat each drill-down as a navigation event that requests a new chart payload.   

Breadcrumbs: ECharts manages breadcrumbs automatically (breadcrumb: { show: true }). The backend schema does not need to define the breadcrumb structure, but it must ensure the name fields are human-readable to create a coherent navigation trail.   

2.1.4 Interaction and Legend Limitations
A significant limitation identified in the research is the Treemap's interaction with the Legend component.

Legend constraint: The standard ECharts legend generation logic only creates items for the root nodes of the Treemap. It does not extract categories from leaf nodes. For example, if the Treemap shows "Regional Sales" (Root), the legend will only show "Regional Sales." It will not automatically show legends for "Technology," "Furniture," etc., unless they are separate roots.   

Workaround/Requirement: If OODS Foundry requires a functional legend for internal categories (e.g., coloring nodes by "Industry"), the payload must include a separate, dummy series (like a Scatter plot with no data but valid name and itemStyle) to force the Legend component to render those categories. This is a critical schema augmentation for the backend.

2.2 Sunburst Visualization Specification
The Sunburst chart is structurally identical to the Treemap (using the recursive children model) but employs a radial layout. It is particularly effective for visualizing the depth of layers in a hierarchy and the cumulative size of sectors.   

2.2.1 Data Schema Requirements
The schema for Sunburst is a strict subset of the recursive Tree schema, with specific visual attributes relevant to radial geometry.

Schema Structure:

Field	Type	Mandate	Description
name	String	Required	Label text displayed within the arc.
value	Number	Required	The arc length magnitude. Unlike Treemaps, Sunbursts rarely use array values; a single scalar is standard.
children	Array	Optional	Recursive nesting for inner/outer rings.
link	String	Optional	
Native support for hyperlinks. Clicking a sector can open this URL.

itemStyle	Object	Optional	
Defines color and borderRadius. Rounding corners (borderRadius) is a modern feature (ECharts 5+) that improves aesthetics but requires specific backend flags.

label	Object	Optional	
Critical for readability. Fields like rotate and align determine if text flows radially or tangentially.

  
2.2.2 Sorting and Layout Constraints
Ordering is far more visually significant in a Sunburst than in a Treemap, as the radial sequence often implies a cycle or priority.

Sorting Behavior: By default, ECharts sorts Sunburst sectors by value descending to optimize packing. However, this often destroys semantic ordering (e.g., data representing "Step 1, Step 2, Step 3").

Constraint: To enforce a specific sort order (e.g., chronological), the OODS Foundry chart configuration must explicitly set sort: null (or sort: undefined). This forces the rendering engine to respect the order of the children array provided in the JSON payload. The backend is responsible for pre-sorting the array.   

The "Virtual Root": Sunbursts often have a center circle. If the root node in the data has a name but is not intended to be visible (e.g., a "Global" container for a multi-root chart), the visualization configuration must set radius: [0, '90%']. If the center should be empty (Donut Sunburst), the inner radius must be greater than 0 (e.g., ['15%', '90%']).   

2.2.3 Interaction Models: Highlight Policy
Sunburst charts support complex "focus" modes that allow users to trace lineage.

Focus Modes: The emphasis.focus property supports descendant (highlights the node and its subtree), ancestor (highlights the path to the root), or self.

Requirement: OODS Foundry specs should default to emphasis: { focus: 'descendant' } for top-down exploration or ancestor for root-cause analysis. This interaction is handled by the engine, provided the children structure is intact.   

3. Network and Flow Specifications: Graph and Sankey
Graph and Sankey charts represent relational data (nodes and edges). These structures fundamentally differ from trees as they allow cyclic connections, many-to-many relationships, and disconnected subgraphs. The OODS Foundry implementation for these must pivot from recursive nesting to "Node-Link" list structures.

3.1 Graph Visualization Specification (Force-Directed & Cartesian)
ECharts Graph series (formerly force in older versions) are powerful tools for visualizing complex networks, dependencies, and clusters. The data model consists of two distinct flat arrays: nodes (vertices) and links (edges).   

3.1.1 Data Schema Requirements
The OODS Foundry graph schema must generate a payload containing a data array and a links array.

Node Schema (series.data):

Field	Type	Mandate	Description
id	String	Required	
Unique identifier. If omitted, ECharts uses the array index, which is brittle for dynamic data updates.

name	String	Required	Display label. Can be the same as id.
x	Number	Conditional	Required if layout: 'none' (Cartesian). Initial seed position if layout: 'force'.
y	Number	Conditional	Required if layout: 'none'.
fixed	Boolean	Optional	
If true, the node is "pinned" and will not move during force simulation. Essential for user-defined layouts.

category	Int/String	Optional	
Index or name referring to the categories array. Essential for Legend functionality.

symbolSize	Number	Optional	Node radius. Can be mapped to a metric (e.g., centrality).
  
Link Schema (series.links):

Field	Type	Mandate	Description
source	String	Required	The name or id of the source node.
target	String	Required	The name or id of the target node.
value	Number	Optional	Weight of the edge. In force layouts, this can influence the edgeLength distance.
lineStyle	Object	Optional	
Edge-specific styling (e.g., curveness: 0.2 for multi-edges between same nodes).

  
3.1.2 Layout Constraints: The "Direct Pass-Through" Challenge
The primary architectural challenge for Graphs is the layout positioning mechanism.

Force Layout (layout: 'force'):

Mechanism: The frontend physics engine simulates repulsion between nodes and gravity toward the center.

Constraint: This layout is non-deterministic or "alive." It stabilizes over time. For OODS Foundry, this means the chart "wiggles" on load, which may be undesirable for static reports.

Optimization: The initLayout parameter can be set to 'circular' or specific x/y coordinates to seed the simulation, reducing the stabilization time. To "freeze" a layout after simulation, standard practice is to listen for the finished event, retrieve coordinates, and write them back to fixed: true, but this violates the server-side DDPT model.   

Recommendation: Use layout: 'force' only for exploratory analysis where the exact position is less important than the clustering structure.

Fixed/None Layout (layout: 'none'):

Mechanism: ECharts renders nodes at explicit x and y coordinates provided in the data.

Constraint: This requires the backend to calculate the layout. If OODS Foundry aims to provide consistent, pre-calculated views (e.g., specific network topologies, floor plans, or saved views), the backend must utilize a server-side graph layout library (e.g., Graphviz, d3-force-headless, or graphology) to generate the x and y values. This is the only way to achieve true "Direct Data Pass-Through" stability for graphs.   

Category Legend Mapping:

To enable legends, the series options must include a categories array (e.g., ``).

Requirement: The data nodes must strictly map to these categories via the category field. If this mapping is broken or the category names do not match, the legend will fail to filter the graph.   

3.2 Sankey Visualization Specification
Sankey diagrams visualize directed flows between nodes, where the width of the link is proportional to the flow quantity. Unlike Graphs, Sankeys in ECharts employ a strict, iterative layout algorithm (based on the Kruskal-Wallis variant) to minimize edge crossings, which imposes significant constraints on manual positioning.

3.2.1 Data Schema Requirements
The schema mirrors the Graph (Nodes/Links) but implies strict directional flow and magnitude conservation.

Node Schema:

Field	Type	Mandate	Description
name	String	Required	Unique identifier.
itemStyle	Object	Optional	Color of the node rectangle.
depth	Number	Internal	
While ECharts calculates this, manually setting it in data allows overriding the column assignment (e.g., forcing a node to the rightmost column), though this is an advanced override.

  
Link Schema:

Field	Type	Mandate	Description
source	String	Required	Sender node name.
target	String	Required	Receiver node name.
value	Number	Required	Flow magnitude. Controls the ribbon width.
3.2.2 Layout Constraints and the "Manual Position" Impossibility
A critical finding from the research is the rigidity of the Sankey layout engine.

Manual Positioning: The user request specifically inquired about manual positioning. Research confirms that ECharts Sankey nodes cannot easily be manually positioned using simple x/y coordinates in the standard layout mode. The layout engine overwrites custom positions to enforce flow logic and minimize crossings.   

Coordinate Overrides: While some documentation alludes to layout: 'none' potentially respecting coordinates, in practice for Sankeys, this disables the essential flow-path calculations that make the chart readable. The "depth" (x-axis) is determined by the topology (source -> target steps), and the "breadth" (y-axis) is determined by the sorting algorithm.

Control Levers:

Node Alignment: The backend can influence the layout using nodeAlign (justify, left, right) to control how nodes push against the edges of the canvas.   

Sorting: The nodeGap and layoutIterations settings allow tuning. Setting layoutIterations: 0 disables the automatic crossing minimization, forcing the nodes to render in the exact order they appear in the data array. This is the closest approximation to "manual layout" available for Sankeys in a DDPT context.   

3.2.3 Data Integrity and Cycles
DAG Requirement: Sankey diagrams represent Directed Acyclic Graphs (DAGs). While ECharts has improved its resilience to cycles (loops), circular data (A -> B -> A) often results in rendering artifacts or performance degradation. OODS Foundry backend validation logic must detect and break cycles before serialization.   

4. Advanced Interaction and Performance Constraints
4.1 Event Handling and DispatchAction
DDPT extends beyond rendering to interaction. The OODS Foundry schema must support the frontend's ability to act on data.

Event Payload Pass-Through: ECharts events (click, mouseover) pass the raw data object from the backend to the handler. This allows OODS Foundry to include "invisible" metadata (e.g., link_url, database_id, custom_metric_raw) in the series.data objects. This data is not rendered but is fully accessible to the click handler, enabling rich drill-throughs without secondary API calls.   

Programmatic Control: The dispatchAction API allows the application to trigger behaviors like highlighting or showing tooltips. To use this effectively, the backend must ensure every node has a deterministic id or unique name so the frontend can target it (e.g., chart.dispatchAction({ type: 'highlight', name: 'Server_A' })).   

4.2 The "Universal Transition" Constraint
ECharts 5 introduced universalTransition to morph between chart types (e.g., Treemap -> Sunburst).

Constraint: This feature relies on data item identity. If OODS Foundry allows a user to toggle between a Treemap view and a Sunburst view of the same data, the backend must ensure the name (or groupId) fields in both payloads are identical. If the names match, ECharts will animate the geometric transformation of the element; if they differ, it will perform a standard fade-out/fade-in.   

4.3 Performance: TypedArrays and Large Data
For datasets exceeding 10,000 nodes, standard JSON parsing becomes a bottleneck.

Optimization: ECharts supports TypedArray (e.g., Float32Array) for flat, dense data (like Heatmaps or Line charts).

Constraint for OODS: The target charts (Treemap, Graph, Sankey) are object-heavy and property-rich (nested children, string names). They generally do not support TypedArray inputs or the appendData streaming method. OODS Foundry must treat these charts as atomic payloads. If the dataset is too large (e.g., >5MB JSON), the backend must perform aggregation (clustering) to reduce the node count before transmission.   

4.4 Rendering Engine: Canvas vs. SVG
Canvas: Default. Better for large numbers of elements (high node count graphs).

SVG: Better for text clarity and lower memory usage on mobile, but performance degrades with thousands of nodes.

Recommendation: OODS Foundry should default to Canvas for Graph and Treemap modules to ensure smooth interaction (zooming/panning), while considering SVG for static exports or simple Sankeys.   

5. Technical Implementation: Schema Reference
The following JSON schemas represent the strict output format required from OODS Foundry services to achieve Direct Data Pass-Through.

5.1 Treemap Schema (Recursive)
JSON
{
  "series":
          },
          {
            "name": "Europe",
            "value": 700,
            "children": [...]
          }
        ]
      }
    ]
  }]
}
5.2 Graph Schema (Force Layout with Categories)
JSON
{
  "series":,
    "force": {
      "repulsion": 200,
      "edgeLength": 100,
      "initLayout": "circular"
    },
    "data":,
    "links":
  }]
}
5.3 Sankey Schema (Standard Flow)
JSON
{
  "series":,
    "links":
  }]
}
6. Synthesis and Strategic Recommendations
The transition to a Direct Data Pass-Through architecture within the OODS Foundry represents a significant maturity step in visualization capability. By adhering to the rigid schemas defined above, the system decouples the "view" logic from the frontend, placing it correctly within the data domain of the backend.

Critical Takeaways for Implementation:

Backend as Layout Engine: For hierarchical charts, the backend must construct the tree. For fixed-layout graphs, the backend must calculate the topology coordinates.

Explicit Sorting: Do not rely on ECharts' default sorting for Sunbursts or Sankeys if data sequence is meaningful. Send sort: null or layoutIterations: 0 commands in the payload.

Interaction Metadata: Always include stable id and name fields to enable universalTransition, legend filtering, and event handling.

Avoid Dataset: Explicitly avoid the dataset component for these four chart types. Target series.data directly to prevent rendering errors and layout failures.

This specification provides the blueprint for a high-performance, scalable visualization layer that leverages the full native power of Apache ECharts without the bottleneck of client-side data processing.


echarts.apache.org
Features - Apache ECharts
Opens in a new window

echarts.apache.org
Features - Apache ECharts
Opens in a new window

apache.github.io
Data Transform - Concepts - Handbook - Apache ECharts
Opens in a new window

apache.github.io
Dataset - Concepts - Handbook - Apache ECharts
Opens in a new window

github.com
Add Dataset support to Treemap, Graph, Lines, Sankey · Issue #15093 · apache/echarts
Opens in a new window

echarts.apache.org
5.6 - What's New - Basics - Handbook - Apache ECharts
Opens in a new window

tableau.com
Understanding and Using Tree Maps | Tableau
Opens in a new window

stackoverflow.com
ECharts: Display Legend for Treemap? - Stack Overflow
Opens in a new window

stackoverflow.com
Understanding `treemap.data.label.formatter` in Baidu's ECharts - Stack Overflow
Opens in a new window

echarts.apache.org
What's New in Apache ECharts 5.2.0
Opens in a new window

stackoverflow.com
Convert array of flat objects to nested objects - Stack Overflow
Opens in a new window

ipecharts.readthedocs.io
ipecharts.option.seriesitems.treemap module
Opens in a new window

learn.wynenterprise.com
TreeMap EChart | Wyn Documentation
Opens in a new window

github.com
Breadcrumb emphasis in treemap has no effect · Issue #15741 · apache/echarts - GitHub
Opens in a new window

openobserve.ai
Custom Charts with Nested Data - OpenObserve Documentation
Opens in a new window

amcharts.com
Anatomy of a Sunburst Diagram – amCharts 4 Documentation
Opens in a new window

echarts.apache.org
Documentation - Apache ECharts
Opens in a new window

echarts.apache.org
5.3 - What's New - Basics - Handbook - Apache ECharts
Opens in a new window

stackoverflow.com
How to format values in an Echarts sunburst? - Stack Overflow
Opens in a new window

echarts.apache.org
Basic Line Chart - Examples - Apache ECharts
Opens in a new window

stackoverflow.com
Sort function in Sunburst graph pyecharts - python - Stack Overflow
Opens in a new window

stackoverflow.com
echarts sunburst virtual root node behavior - Stack Overflow
Opens in a new window

github.com
Releases · apache/echarts - GitHub
Opens in a new window

stackoverflow.com
On graph data is there any way to add margin between nodes and links - Stack Overflow
Opens in a new window

stackoverflow.com
Make node fixed in echarts force graph - Stack Overflow
Opens in a new window

stackoverflow.com
Echarts 4 graph plot: specify symbol per category - Stack Overflow
Opens in a new window

pkg.go.dev
opts package - github.com/go-echarts/go-echarts/v2/opts - Go Packages
Opens in a new window

github.com
Graph becomes crazy when zooming in or out · Issue #11024 · apache/echarts - GitHub
Opens in a new window

stackoverflow.com
How to get the node's coordinates after force layout in Apache ECharts? - Stack Overflow
Opens in a new window

docs.evidence.dev
Sankey Diagram - Evidence Docs
Opens in a new window

stackoverflow.com
javascript - d3 sankey charts - manually position node along x axis - Stack Overflow
Opens in a new window

echarts4r.john-coene.com
Sankey — e_sankey - echarts4r
Opens in a new window

alibabacloud.com
Echarts Sankey diagram - DataV - Alibaba Cloud Documentation Center
Opens in a new window

api.highcharts.com
series.sankey.nodeAlignment | highcharts API Reference
Opens in a new window

stackoverflow.com
Echarts sankey diagram rendering - Stack Overflow
Opens in a new window

echarts.apache.org
Changelog - Apache ECharts
Opens in a new window

apache.github.io
Event and Action - Concepts - Handbook - Apache ECharts
Opens in a new window

echarts.apache.org
Drag - Interaction - How To Guides - Handbook - Apache ECharts
Opens in a new window

stackoverflow.com
Is it possible to make the hover and click effects programmatically on a echarts sunburst (Angular)? - Stack Overflow
