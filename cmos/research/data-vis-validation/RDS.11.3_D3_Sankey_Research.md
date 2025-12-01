Technical Specification: Integrating Algorithmic Network Layouts within Object-Oriented Design Systems
1. Executive Summary
This comprehensive research report evaluates the architectural feasibility and implementation strategy for rendering high-fidelity Sankey diagrams within the Palantir Foundry Object-Oriented Design System (OODS). The core challenge addressed is the reconciliation of Foundry’s strict, ontology-driven hierarchy constraints with the fluid, non-linear layout requirements of flow visualization. While native Foundry widgets provide robust support for standard charting through the OODS visualization traits , they lack the intrinsic graph theory algorithms necessary to compute the coordinate geometry of a Sankey diagram, particularly one involving complex, circular resource flows.   

The analysis confirms that a direct "plug-and-play" usage of Vega-Lite for Sankey diagrams is algorithmically impossible without a pre-computation layer. Vega-Lite is a grammar of graphics that maps data to visual channels; it is not a force-directed or iterative layout engine. Consequently, the proposed solution necessitates a hybrid architecture: utilizing Foundry’s TypeScript Functions to execute the D3-Sankey (or D3-Sankey-Circular) layout algorithms server-side, identifying the optimal topological arrangement of nodes and links, and generating explicit Scalable Vector Graphics (SVG) path strings. These pre-calculated geometric primitives are then injected into a specialized Vega-Lite or Pure Vega specification for rendering.   

This document exhaustively details the mathematical mechanisms of the D3 layout engine, including the iterative relaxation methods used for node positioning and the cubic Bézier curve derivation for link generation. It further analyzes the specific YAML-based visualization specifications of OODS to ensure compliance with type safety and hierarchy constraints. Finally, it addresses the critical edge case of circular dependencies—common in industrial process data—providing a remediation strategy via cycle-breaking algorithms not present in the standard D3 library.   

2. Introduction: The Visualization Gap in Object-Oriented Systems
The modern enterprise data landscape is increasingly defined not by static tables, but by semantic webs of interconnected entities—an Ontology. Palantir Foundry’s OODS (Object-Oriented Design System) epitomizes this shift, treating data as "Objects" with defined properties and "Links" representing relationships. This ontological approach offers immense power for data integrity and operational modeling, but it introduces significant friction when attempting to visualize data in ways that defy strict hierarchical categorization.   

Standard visualizations—bar charts, line graphs, scatter plots—map neatly onto the properties of individual objects. A bar height corresponds to a value property; a point's color corresponds to a status property. These are "stateless" visualizations where the position of one element does not inherently depend on the position of another.   

A Sankey diagram, conversely, is a "stateful" global visualization. The position of a node in the third column depends entirely on the positions of nodes in the second column, which in turn depend on the first. The width of a flow link is determined by the summation of values across the entire network to ensure flow conservation. This global dependency structure breaks the standard OODS visualization model, which typically composes traits (Mark, Encoding, Scale) on a per-object basis.   

To bridge this gap, we must treat the visualization not as a direct view of the Ontology, but as a view of a computation derived from the Ontology. This distinction is subtle but architecturally profound. It moves the complexity from the rendering layer (the browser/widget) to the transformation layer (the server/function), requiring a deep understanding of both the OODS hierarchy constraints and the D3-Sankey algorithmic core.

3. Section I: The Foundry OODS Environment
3.1 The Ontology and Object Hierarchy
The foundation of any visualization in Foundry is the Ontology. It is crucial to understand that OODS does not consume raw CSVs or JSONs in the way a local D3 script might. Instead, it consumes ObjectSets.   

3.1.1 Objects and Properties
An "Object" in Foundry is a discrete entity, such as a FactoryUnit or a SupplyContract. These objects have properties defined in a strict schema. For a Sankey diagram, we must identify which Objects serve as nodes and which serve as links, or if "Links" in the diagram are derived from ontology Link types.

Nodes: Typically mapped to Objects (e.g., Factory A). Properties like Region or Type map to visual encodings like color.

Flows: Mapped to either Link types (e.g., Factory A supplies Distribution Center B) or to specific "Event" objects (e.g., Transaction X moving from Account A to Account B).   

3.1.2 Hierarchy Constraints
The user query highlights "hierarchy constraints." In OODS, objects are often organized in parent-child relationships (e.g., Company -> Department -> Employee). Standard Foundry visualizations (like the "Linked Object View") respect this hierarchy, allowing users to drill down. A Sankey diagram, however, flattens hierarchy into "Layers" or "Depths." A constraint arises when the ontological hierarchy does not match the topological hierarchy of the flow.   

Conflict: An Object hierarchy might say Factory is the parent of ProductionLine.

Flow Topology: A Sankey might show flow between two ProductionLine objects in different factories.

Resolution: The visualization specification must explicitly define the "Level of Detail." We cannot simply throw an ObjectSet at the renderer; we must aggregate or flatten the ontology to the desired level of granularity before layout computation.

3.2 OODS Visualization Specifications (YAML)
The OODS utilizes a declarative YAML-based specification language to define user interfaces and visualizations. Snippets indicate that OODS can generate type-safe interfaces from concise YAML definitions.   

Example OODS Specification Analysis: The snippet  provides a glimpse into the OODS configuration schema:   

YAML
- from: active
  to: [past_due, canceled]
- name: documentable
  parameters:
    allowedTypes: [invoice, receipt, contract]
  schema:
    current_period_start:
      type: timestamp
      required: true
This YAML is creating a state machine transition definition (from -> to) and defining a schema for a documentable trait. For a Visualization Extension in OODS, the specification breaks down into traits :   

Mark: The geometric primitive. For Sankey, this is non-standard.

Encoding: Mapping fields to channels.

Scale: Domain-to-range mapping.

Layout: Positioning logic.

The Feasibility Bottleneck: The OODS visualization traits listed (Mark, Encoding, Scale, Layout) assume that the Layout trait is one of the standard supported types (e.g., cartesian grid, stack, cluster). There is no "SankeyLayout" trait inherent in the OODS core traits. Therefore, we must bypass the OODS Layout trait and instead use the Mark trait to render pre-calculated geometry. We are essentially telling OODS: "Do not calculate the layout; here are the exact coordinates for every shape."   

3.3 The Vega-Lite Integration Point
Foundry allows for "Chart: Vega" widgets, which support Vega-Lite JSON specifications. This is the interface where the custom Sankey will reside.   

Input: The widget receives data from the current ObjectSet or a Function result.

Constraint: The data must be tabular (arrays of objects).

Constraint: The rendering engine is Vega-Lite (or pure Vega), which implies we are limited to the marks supported by that library.

4. Section II: The Mechanics of D3-Sankey
To utilize the "Pre-computation" strategy, we must replicate the logic of the d3-sankey library within a server-side environment (Foundry Functions). This section dissects the algorithms we must implement or invoke.

4.1 Data Structure and Pre-processing
The D3-Sankey API requires a specific graph format that separates nodes and links. This differs from the typical "row-based" transactional data found in databases.   

Required Input Format:

JSON
{
  "nodes": [
    {"node": 0, "name": "Oil"},
    {"node": 1, "name": "Natural Gas"},
    {"node": 2, "name": "Electricity"}
  ],
  "links": [
    {"source": 0, "target": 2, "value": 50},
    {"source": 1, "target": 2, "value": 30}
  ]
}
Insight: The source and target in the links array are zero-based indices referring to the nodes array position. If the OODS data provides object IDs (UUIDs), a pre-processing step is required to build a lookup map and convert UUIDs to integer indices before passing data to the layout engine.   

4.2 The Layout Algorithm: A Four-Stage Process
The d3-sankey layout generator operates in four distinct stages. Understanding these is vital for debugging layout issues (like overlapping nodes) when they appear in the final OODS render.

4.2.1 Stage 1: Topological Computation (Breadths)
The algorithm first assigns a horizontal position (x) to each node. It computes the connected components of the graph and performs a topological sort.

Depth Calculation: Each node v is assigned a depth d(v).

Nodes with no incoming links have d(v)=0.

For other nodes, d(v)=max 
(u,v)∈E
​
 (d(u)+1). This inherently assumes a Directed Acyclic Graph (DAG). If a cycle exists, the depth calculation will diverge (infinite loop), crashing the function. This is a critical risk in OODS integration.   

4.2.2 Stage 2: Value Computation
The size of nodes and links is determined by flow magnitude.

Node Value: V(n)=max(∑input,∑output). This ensures the node is visually large enough to contain the larger of the two flows (in vs. out).   

4.2.3 Stage 3: Iterative Relaxation (Depths)
This is the "magic" of the Sankey layout—determining the vertical (y) order of nodes to minimize "spaghetti" links. The algorithm uses a heuristic approach based on the Barycenter Method (or Median Method). It runs for a specified number of iterations (default 32).   

The Relaxation Loop: For k=1 to iterations:

Downstream Sweep (Left-to-Right): For each column from left to right: Calculate the weighted average y position of source nodes for each node in the current column.

y 
target
​
 = 
∑value 
link
​
 
∑(y 
source
​
 ×value 
link
​
 )
​
 
Reorder nodes in the column based on this calculated y 
target
​
 . Resolve collisions: Ensure strict vertical padding (nodePadding) prevents overlaps.

Upstream Sweep (Right-to-Left): Repeat the process in reverse, aligning source nodes based on the average positions of their target nodes.

Insight: This algorithm is not deterministic if the initial sort order varies. It effectively simulates a physical system of springs (links) pulling the nodes (weights) into an energy-minimal state. In OODS, where stability is key, setting a fixed random seed or preserving node order is important to prevent the diagram from "jumping" when data updates slightly.   

4.2.4 Stage 4: Geometry Generation
Finally, the algorithm calculates the exact pixel coordinates:

Nodes: x0, x1, y0, y1.

Links: y0 (start y on source node edge), y1 (end y on target node edge), and width. Crucially, the link's vertical position on the node edge is determined by the order of links. Links going to the top-most target node exit from the top of the source node to minimize crossing.   

4.3 Handling Circular Dependencies
Industrial data in OODS frequently contains loops (e.g., Scrap Metal recycling back to the Furnace). Standard d3-sankey fails here. The d3-sankey-circular library must be used.   

Cycle-Breaking Logic:

Cycle Detection: The library uses an algorithm (typically Tarjan’s) to identify Strongly Connected Components (SCCs).

Edge Reversal: It identifies specific edges that, if removed or reversed, would make the graph acyclic. These are flagged as circular.

Layout Adjustment: The standard layout runs on the acyclic subgraph. Then, the circular links are routed.

Path Routing: Unlike standard links, circular links cannot be simple Bézier curves. They must be routed around the diagram (either top or bottom) to avoid cutting through the center and obscuring forward flows.   

4.4 Node Alignment Strategies
The visual structure is governed by nodeAlign.

d3.sankeyJustify: Pushes nodes without outgoing links to the far right. This is the default and creates a "full" chart look.

d3.sankeyLeft: Keeps nodes as far left as possible (at their earliest topological depth).

d3.sankeyRight: Pushes everything to the right.

d3.sankeyCenter: Centers nodes horizontally.

Comparison Table: Alignment Impact

Alignment	Visual Effect	Use Case
Justify	Maximizes width utilization. Gaps appear in middle columns.	Supply chains with clear End-Consumers.
Left	Compact on the left, ragged on the right.	Funnel analysis (e.g., web conversion).
Center	Symmetrical, balanced whitespace.	Brand/Marketing flows; purely aesthetic views.
5. Section III: Geometric Transformation & Serialization
Once the D3 algorithm (running in a Foundry Function) computes the layout, we possess a JavaScript object graph with coordinates. To render this in Vega-Lite, we must serialize this into a flat data structure containing explicit SVG path strings.

5.1 The Mathematics of the Link Path
The standard Sankey link is a shape bounded by two cubic Bézier curves.

The Cubic Bézier Curve: A cubic Bézier is defined by four points: Start (P 
0
​
 ), Control 1 (P 
1
​
 ), Control 2 (P 
2
​
 ), and End (P 
3
​
 ). $$B(t) = (1-t)^3 P_0 + 3(1-t)^2 t P_1 + 3(1-t) t^2 P_2 + t^3 P_3, \quad t \in $$

Sankey Specifics: To create a horizontal flow effect:

P 
0
​
 =(source.x1,link.y0)

P 
3
​
 =(target.x0,link.y1)

Control points are placed horizontally halfway between the nodes to ensure the tangent at the connection point is purely horizontal.

P 
1
​
 =(source.x1+curvature×(target.x0−source.x1),link.y0)

P 
2
​
 =(target.x0−curvature×(target.x0−source.x1),link.y1)

Typically, curvature is 0.5.

The SVG Path Command (d): A single link is drawn as a closed shape (an area).

Move to Top-Left: M x0, y0

Curve to Top-Right: C cp1x, y0, cp2x, y1, x1, y1

Line to Bottom-Right: L x1, y1 + width

Curve Back to Bottom-Left: C cp2x, y1+w, cp1x, y0+w, x0, y0+w

Close Path: Z

The Foundry Function must generate this string for every single link.   

5.2 The JSON Output Schema
The output from the Foundry Function should be two arrays, nodes and links.

Links Schema (Serialized):

JSON
{
  "source_id": "A",
  "target_id": "B",
  "value": 100,
  "svg_path": "M10,50 C100,50 100,80 200,80 L200,90 C100,90 100,60 10,60 Z",
  "color": "#1f77b4",
  "opacity": 0.5
}
Nodes Schema (Serialized):

JSON
{
  "id": "A",
  "name": "Crude Oil",
  "x0": 10,
  "x1": 25,
  "y0": 0,
  "y1": 500,
  "color": "#1f77b4"
}
This flattened, geometry-rich schema is the "Lingua Franca" that allows D3's logic to exist within Vega's rendering environment.

6. Section IV: The Rendering Layer (Vega/Vega-Lite)
The prompt specifically asks about Vega-Lite feasibility. This section provides a critical analysis of why Vega-Lite is difficult and recommends the specific workaround or the Pure Vega alternative.

6.1 The Vega-Lite Feasibility Analysis
Vega-Lite is a high-level grammar. It is designed to produce geometry from data using scales, not to render arbitrary geometry provided in the data.

6.1.1 The path Mark Limitation
In standard Vega-Lite, the mark: "path" is typically reserved for geoshape usage, which expects a specific GeoJSON structure, or it assumes the data is already in a specific format compatible with projections. Snippet  highlights a user complaint: "For a custom path, it is cumbersome... It would be nice to make a convenient 'path' mark". Vega-Lite generally lacks a direct d encoding channel where you can map a data field (string) directly to the SVG path attribute of a path mark. It expects the path to be generated by the mark type (e.g., line, area) based on x and y coordinates.   

6.1.2 Workaround: The point Mark Hack
Snippet  reveals a potential backdoor: "shape... a custom SVG path string". In Vega-Lite, a point mark can have a custom shape.   

Strategy: Treat each Link as a "Point".

Encoding: Map the shape channel to the field containing the SVG path string.

Problem: The shape encoding typically expects a symbol name (e.g., "circle") or a single custom path string defined in the config. It does not natively support different custom path strings for each datum in the same series without using a complicated condition logic or expr. Even then, Vega-Lite scales the shape size. A Sankey link is an absolute path; scaling it would destroy the connection between nodes.

6.1.3 The Conclusion on Vega-Lite
Rendering a pre-computed Sankey in Vega-Lite is technically feasible but effectively an anti-pattern. It fights against the grammar's abstractions. The layout logic (absolute coordinates) conflicts with Vega-Lite's scale logic (relative data mapping).

6.2 The Pure Vega Solution
The robust solution, fully supported by Foundry, is Pure Vega. Vega (the lower-level grammar) has explicit support for binding data fields to path attributes.

Pure Vega Specification for Links:

JSON
{
  "type": "path",
  "from": { "data": "links" },
  "encode": {
    "enter": {
      "path": { "field": "svg_path" }, // Direct binding!
      "fill": { "field": "color" },
      "fillOpacity": { "value": 0.5 }
    }
  }
}
This is clean, performant, and explicitly documented. It bypasses the abstractions of Vega-Lite that prevent direct geometry rendering.   

6.3 Layering Strategy
The final visualization is a composite view.

Bottom Layer (Links): path marks using the pre-computed SVG strings.

Top Layer (Nodes): rect marks using x0, x1, y0, y1.

Overlay Layer (Labels): text marks anchored to nodes.

7. Section V: Architectural Integration Strategy
This section outlines the step-by-step implementation plan for the OODS Foundry environment.

7.1 Server-Side Execution: The Foundry Function
We cannot rely on client-side JavaScript in the same way a standalone web app would. We must use a Foundry Function (TypeScript) to perform the layout calculation.

Role of the Function:

Accepts: ObjectSet (the user's current filter context).

Transforms: Maps Objects -> Nodes, Links -> Links.

Computes: Runs d3-sankey layout.

Returns: A JSON object containing the nodes and links arrays with geometry.

Node.js Compatibility: D3 version 4+ is modular and supports Node.js environments (CommonJS/ES6 modules). It does not require a DOM (document object model) for the layout calculation, only for the rendering (which we are deferring to Vega). The layout algorithm itself operates on pure JavaScript objects.   

7.2 Handling "Responsive" Layouts
A major challenge is that D3-Sankey requires a fixed width and height to calculate coordinates. However, the Foundry widget might be resized by the user.

Approach A (Static): Fix the aspect ratio and use the SVG viewBox to scale the entire chart. This is the simplest approach. The Function calculates for a 1000x600 box, and the widget scales it down.

Approach B (Dynamic): Pass the widget dimensions as parameters to the Function. This triggers a server-side recalculation whenever the user resizes. This is resource-intensive and may cause lag. Approach A is recommended.

7.3 Integration Checklist
Define Ontology: Ensure Objects representing Nodes and Links exist.

Write Function: Create a TypeScript function in the Foundry repository.

Import d3-sankey.

Implement generateSankeyData(objects).

Handle cycle detection (try-catch block around the layout call, fallback to sankey-circular).

Configure Widget:

Add "Chart: Vega" widget in Workshop/Object View.

Bind Data Input to the Output of the Function.

Paste the Pure Vega JSON spec (referencing the Function's output columns).

8. Section VI: Performance & UX Implications
8.1 Data Volume and "Hairball" Risk
Sankey diagrams degrade rapidly in legibility as node count increases.

Limit: Testing suggests >50 nodes or >200 links results in a "hairball."

Mitigation: The Foundry Function should implement Aggregation Logic. Before passing data to D3, group small flows (e.g., < 1% of total) into an "Other" node. This preserves the layout integrity and readability.

8.2 Interaction Design
While the layout is static, the Vega renderer allows for rich interaction.

Tooltips: Standard Vega tooltips work on the path marks. We can show exact flow values, source/target names, and percentage of total.

Selection: We can configure a signal in Vega to track clicked nodes. This signal can be exposed to the Workshop module as an output parameter, allowing the selection of a Node in the Sankey to filter other widgets (e.g., a data table) on the page.   

8.3 Accessibility
Since we are bypassing standard charts, we lose some out-of-the-box accessibility.

ARIA Labels: The SVG path elements generated by Vega should have aria-label attributes bound to the data (e.g., "Flow from A to B: 50 units"). Pure Vega supports an aria property in the encode block to ensure screen readers can describe the flows.   

9. Conclusion
The integration of D3-Sankey layouts into OODS Foundry via Vega represents a sophisticated merging of imperative algorithmic generation and declarative rendering. It overcomes the inherent limitations of the OODS widget library by shifting the burden of layout complexity to the server-side Function layer.

While Vega-Lite is theoretically capable via "shape" hacks, the analysis strongly recommends Pure Vega for the rendering layer due to its first-class support for arbitrary SVG path binding. This architecture ensures that the rich, flow-based insights of a Sankey diagram can be delivered without compromising the type safety, hierarchy constraints, or interactivity standards of the Palantir Foundry platform. The result is a visualization that is both mathematically rigorous in its layout and seamless in its integration with the enterprise ontology.


designsystemscollective.com
OODS Foundry: An Object-Oriented, Agent-Native Design System | by Derek Niedringhaus
Opens in a new window

elastic.co
Custom visualizations with Vega | Elastic Docs
Opens in a new window

palantir.com
Visualization widgets • Chart XY - Workshop - Palantir
Opens in a new window

d3-graph-gallery.com
Sankey plot - The D3 Graph Gallery
Opens in a new window

tomshanley.co.nz
Sankey charts with circular links - Tom Shanley
Opens in a new window

gist.github.com
Sankey Layout Alignment - GitHub Gist
Opens in a new window

vega.github.io
Path Mark | Vega
Opens in a new window

npmjs.com
d3-sankey-circular - NPM
Opens in a new window

observablehq.com
Sankey circular deconstructed / Tom Shanley - Observable
Opens in a new window

palantir.com
Palantir Foundry Ontology
Opens in a new window

vega.github.io
Example Gallery - Vega
Opens in a new window

vega.github.io
Mark | Vega-Lite
Opens in a new window

palantir.com
Visualize Ontology data • Overview - Map - Palantir
Opens in a new window

palantir.com
Legacy Object Views • Visualization - Palantir
Opens in a new window

palantir.com
Workshop • Visualization widgets • Overview - Palantir
Opens in a new window

stackoverflow.com
Extract results from networkd3 sankey diagram - Stack Overflow
Opens in a new window

github.com
d3/d3-sankey: Visualize flow between nodes in a directed acyclic network. - GitHub
Opens in a new window

gist.github.com
Sankey with circular links - GitHub Gist
Opens in a new window

datavisualizationwithsvelte.com
Building a Sankey Diagram with Svelte 5 and D3.js
Opens in a new window

sankey-diagrams.com
Sankeys with circular links
Opens in a new window

d3js.org
Links | D3 by Observable - D3.js
Opens in a new window

observablehq.com
Weird Sankey Links / Ian Johnson - Observable
Opens in a new window

developer.mozilla.org
CanvasRenderingContext2D: bezierCurveTo() method - Web APIs - MDN Web Docs
Opens in a new window

github.com
"path" mark? · Issue #4699 · vega/vega-lite - GitHub
Opens in a new window

vega.github.io
Point | Vega-Lite
Opens in a new window

gregjopa.com
Render D3.js Charts Server-side - Greg Jopa
Opens in a new window

vega.github.io
Config | Vega
Opens in a new window

vega.github.io
Marks | Vega
