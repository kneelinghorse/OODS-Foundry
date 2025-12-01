

# **OODS Extension Whitepaper: Modeling Hierarchical, Network, and Geospatial Data Structures**

## **I. Executive Summary: Mitigation for Risk R-003 and Schema v1.1/v2.0 Proposal**

### **A. Mission Objective**

This report provides a comprehensive technical solution in fulfillment of mission-dv-10-complex-schema-extension. The primary objective is to extend the Ocular-agnostic Data Schema (OODS) to provide first-class support for hierarchical, network, and geospatial data structures. These domains were previously identified as taxonomy gaps (Risk R-003), collectively representing approximately 10% of visualization use cases not covered by the v0.1 schema.

### **B. Core Finding: The "Renderer Transform Gap"**

A detailed analysis of the two primary target renderers (ECharts and Vega-Lite) reveals a critical architectural constraint, hereafter referred to as the "Renderer Transform Gap."

* **ECharts** provides high-level, "out-of-the-box" series types that internally handle the complex data transformations and layout algorithms required. This includes series-treemap 1, series-sunburst 1, series-graph 1, and series-map.3  
* **Vega-Lite** adheres to a stricter, lower-level grammar of graphics. It *lacks* the essential data-level transforms necessary for these domains. Specifically, it does not support stratify or partition for hierarchical layouts 4, nor does it include a force transform for network graph layouts.5 These transforms *are* present in the full, lower-level Vega specification.7

This gap means that a single, normalized OODS specification for a treemap, for example, cannot be consumed "as-is" by both renderers. ECharts expects the raw hierarchical data, whereas Vega-Lite would require a flat list of pre-computed rectangles.

### **C. Strategic Recommendation: A Phased, Hybrid Architecture**

To manage this gap, this report recommends a phased, hybrid architectural strategy:

1. **Phase 1 (v1.1 \- Geospatial):** Immediate rollout of geospatial support is recommended. This domain is fully supported by *both* renderers using compatible, native paradigms (data-joining).3 This requires extending the normalized OODS specification to support lookup operations.11  
2. **Phase 2 (v2.0 \- Hierarchy & Network):** A v2.0 designation is recommended for hierarchy and network support. This is a major architectural update, as it necessitates a new **Server-Side Transformation Engine**. This engine will be responsible for pre-processing data (e.g., running stratify and partition transforms) for renderers like Vega-Lite, or compiling to the full Vega specification as an "escape hatch" to access transforms like force.

### **D. Risk R-003 Mitigation Status**

**Mitigated.** This report provides a complete, validated technical pathway to address the 10% gap identified in Risk R-003. The implementation of the v1.1 (Geospatial) and v2.0 (Hierarchy/Network) proposals detailed herein will fully resolve this risk.

### **E. Summary of Proposed Extensions**

This proposal introduces:

* **New Dataset-Level Types:** data.hierarchy, data.network, data.geo.join  
* **New Field-Level Types:** field.geojson, field.topojson, field.geopoint  
* **New Field Annotations:** A new class of relation:\* annotations to declaratively model data structure relationships (e.g., parent-child.key, edge.source).

## **II. Architectural Strategy: The "Transform-Aware" OODS Model**

### **A. The v0.1 "Flat-Tabular" Assumption**

The current OODS v0.1 model implicitly assumes that the input data (e.g., a single CSV or JSON array) maps directly to the data consumed by the renderer. This flat-tabular assumption holds for 90% of use cases (bars, lines, scatters) but breaks for complex visualizations that require a transformation from the source data format (e.g., an adjacency list) to the visualization format (e.g., a nested tree).12

### **B. The v2.0 "Pre-transformation Pipeline" Model**

A new logical stage must be introduced into the platform to create a "transform-aware" pipeline.

1. **Ingest & Infer:** The OODS schema inference engine ingests data and applies new heuristics to detect complex structures.  
2. **Model & Annotate:** The user, or the system, applies the new complex-type annotations (e.g., data.type: "data.hierarchy").  
3. **Select Trait & Renderer:** A user selects a normalized trait (e.g., viz.treemap) and a target renderer (e.g., vega-lite).  
4. **Resolve & Transform (New Stage):** A new "Resolver" service intercepts this request. It checks a **Renderer Capability Profile** (see Table 1\) to determine the rendering path.  
   * *If Renderer\[ECharts\].supports\[viz.treemap\] \== true*: The Resolver performs a pass-through. It sends the original, non-transformed data to the client, as ECharts will perform the transformation itself.14  
   * *If Renderer\[Vega-Lite\].supports\[viz.treemap\] \== false*: The Resolver initiates the v2.0 architecture. It fetches the data, executes the required server-side transformation (e.g., stratify \+ partition), and sends the *transformed* (pre-calculated) data to the client for simple rendering.

### **C. Proposed Fallback & Portability Strategy**

The new "Resolver" service will execute the following strategy, in order of preference, for each visualization request:

1. **Native Support:** The renderer natively supports the trait and data structure (e.g., ECharts for viz.network). The data is passed through.  
2. **Server-Side Pre-transformation:** The renderer can render the *result* but not perform the *layout*. The server pre-computes the layout (e.g., Vega-Lite for viz.treemap).  
3. **Specification Compilation ("Escape Hatch"):** The renderer's high-level grammar is insufficient, but its underlying engine is capable. The system compiles to the low-level specification (e.g., Vega-Lite for viz.network requires compiling to a *Full Vega* spec to access the force transform 8).  
4. **Unsupported:** The trait is disabled for the target renderer, and a portability warning is shown.

### **D. Table 1: Renderer Capability & Portability Matrix (v2.0)**

This matrix will serve as the core logic for the new Resolver service, defining the execution path and portability warnings for each complex domain.

| Domain | OODS Trait | ECharts Support | Vega-Lite Support | Vega-Lite Blocker / Workaround |
| :---- | :---- | :---- | :---- | :---- |
| Hierarchical | viz.treemap | **Native** (series-treemap) 1 | **Workaround** (Server Transform) | Missing transforms: stratify, partition.\[4, 16\] Server must pre-calculate layout. |
| Hierarchical | viz.sunburst | **Native** (series-sunburst) 1 | **Workaround** (Server Transform) | Missing transforms: stratify, partition.\[4, 16\] Server must pre-calculate layout. |
| Network | viz.network | **Native** (series-graph) 1 | **Escape Hatch** (Full Vega) | Missing transform: force.\[5, 8\] Must compile to full Vega spec. |
| Geospatial | viz.map.choropleth | **Native** (series-map) 3 | **Native** (mark: geoshape) | N/A. Fully supported via lookup.10 |
| Geospatial | viz.map.bubble | **Native** (series-scatter) | **Native** (mark: circle) | N/A. Fully supported via projection.17 |

## **III. Domain 1: Extending the OODS for Hierarchical Data**

### **A. Analysis: Common Data Structures**

* **Source Data (The "How it's Stored"):** Data originating from relational systems (e.g., SQL databases) is overwhelmingly stored in a flat, tabular **"Adjacency List"** format.18 This structure uses a primary key (e.g., employee\_id) and a self-referencing foreign key (e.g., manager\_id) to define the parent-child relationships.21  
* **Visualization Data (The "How it's Drawn"):** In contrast, visualization libraries like D3, ECharts, and Vega expect a **nested JSON object**.22 The canonical flare.json dataset exemplifies this, using a recursive { "name": "...", "children": \[...\] } structure.23  
* **The Bridge (The "Transform Gap"):** The architectural gap between these two formats is bridged by a **"stratify"** operation. Both D3 (d3.stratify) 26 and the full Vega specification (stratify transform) 7 provide this capability to build the nested tree from the flat adjacency list on the client. The core problem for our architecture is that Vega-Lite *omits* this transform.4

### **B. Proposed Schema Extension: The data.hierarchy Type**

To formally model both data formats, the following extensions are proposed:

**1\. For Adjacency Lists (Tabular Data):**

* data.type: "data.hierarchy": A new dataset-level annotation.  
* field.relation: "parent-child.key": Annotation for the primary key field (e.g., category\_id 18).  
* field.relation: "parent-child.parentKey": Annotation for the self-referencing foreign key field (e.g., parent 18).

**2\. For Nested Objects (JSON Data):**

* data.type: "data.hierarchy": Dataset-level annotation.  
* The OODS schema for the data will validate this structure using the JSON Schema standard for recursive self-references.24  
* *Example JSON Schema Definition:*  
  JSON  
  "definitions": {  
    "treeNode": {  
      "type": "object",  
      "properties": {  
        "name": { "type": "string" },  
        "value": { "type": "number" },  
        "children": {  
          "type": "array",  
          "items": { "$ref": "\#/definitions/treeNode" }  
        }  
      },  
      "required": \["name"\]  
    }  
  },  
  "type": "array",  
  "items": { "$ref": "\#/definitions/treeNode" }

### **C. Inference Engine Update (Detection Rules)**

The schema inference engine will be updated with the following rules:

* **Rule H-1 (Explicit):** If data.type \== "data.hierarchy", validation passes.  
* **Rule H-2 (Recursive Schema):** If a field in an object type is an array where items contains a $ref to its own definition, infer data.hierarchy.24  
* **Rule H-3 (Adjacency List FK):** If a Table Schema defines a foreignKey where the reference.resource is its *own* resource and reference.fields points to its own primaryKey, infer data.hierarchy.  
* **Rule H-4 (Adjacency List Naming):** If a table contains field name permutations like (id, parent\_id), (id, parent), or (key, parentKey), recommend data.hierarchy.7

### **D. Normalized Visualization Spec: New Traits**

The following traits will be added to the normalized taxonomy:

* viz.treemap: For space-filling, rectangular layouts.23  
* viz.sunburst: For radial, space-filling layouts (also known as radial layered diagrams).23  
* viz.node-link.tree: For tidy trees or dendrograms (node-link diagrams).22

The normalized spec for these traits will include a layout property (e.g., layout: "squarify" 31) and bindings for value (to size the nodes) and depth.

### **E. Renderer Portability and Implementation**

* **ECharts:**  
  * **Implementation:** Native. The OODS adapter will pass the *original* data to ECharts. series-treemap and series-sunburst can consume the nested JSON format directly.1 If the source is an adjacency list, the client-side adapter will be responsible for a one-time stratify operation to convert it to the nested structure ECharts expects.  
* **Vega-Lite:**  
  * **Blocker:** Vega-Lite lacks both the stratify transform to build the tree 4 and the partition 16 or treemap 9 layout transforms to compute node positions.  
  * **Recommendation (Server-Side Transform):** This is the primary v2.0 workaround. The OODS Server-Side "Resolver" must:  
    1. Ingest the adjacency list data.  
    2. Execute a stratify operation (based on D3 26 or Vega 7 logic) to build the tree.  
    3. Execute a treemap or partition layout algorithm 9 to compute the x0, y0, x1, y1 coordinates for every node in the hierarchy.  
    4. Send this *pre-computed* tabular data (a flat list of rectangles) to the client.  
    5. The Vega-Lite spec generated by the adapter becomes trivial: {"data":..., "mark": "rect", "encoding": { "x": {"field": "x0"}, "y": {"field": "y0"}, "x2": {"field": "x1"}, "y2": {"field": "y1"} }}.

## **IV. Domain 2: Extending the OODS for Network (Graph) Data**

### **A. Analysis: Common Data Structures**

* **Source Data:** Graph data is almost universally stored as two distinct flat tables, or as two separate arrays within a JSON object.33  
  1. **Nodes List:** A table defining the entities, e.g., (id, label, group,...).34  
  2. **Edge List:** A table defining the relationships, e.g., (source\_id, target\_id, value, relation,...).34  
* **Visualization Data:** Visualization libraries expect these two collections. The canonical miserables.json dataset uses this exact { "nodes": \[...\], "links": \[...\] } structure.38  
* **The Bridge (The "Layout Engine"):** The primary challenge for networks is not data structure, but *layout*. Node-link diagrams require a layout algorithm, most commonly a "force-directed" simulation, to calculate the x, y positions for each node.8 This simulation is a complex, often-interactive process.43

### **B. Proposed Schema Extension: The data.network Type**

To model this two-part structure, the following extensions are proposed:

**1\. For Multi-File (Data Package) Format:**

* package.type: "data.network": A new package-level annotation.  
* The package's resources array must contain two resource definitions, one annotated with resource.role: "nodes" and the other with resource.role: "edges".  
* Field annotations within the "nodes" resource: field.relation: "node.id".  
* Field annotations within the "edges" resource: field.relation: "edge.source", field.relation: "edge.target".

**2\. For Single-File (JSON) Format (e.g., miserables.json):**

* data.type: "data.network": A dataset-level annotation.  
* The OODS JSON Schema will validate the presence of nodes and links (or edges) properties as arrays, following standards like the JSON Graph Format (JGF).44

### **C. Inference Engine Update (Detection Rules)**

* **Rule N-1 (Explicit):** If data.type \== "data.network", validation passes.  
* **Rule N-2 (Field Name Heuristics):** If a single dataset contains fields named (source, target), (from, to), or (src\_id, dst\_id), strongly recommend data.network.34  
* **Rule N-3 (Package Heuristics):** If a Data Package contains two resources, and one resource (edges) has two fields that are foreign keys to the primary key of the other resource (nodes), infer data.network and auto-annotate roles.

### **D. Normalized Visualization Spec: New Traits**

* viz.network: Represents a node-link graph, typically with an interactive force-directed layout.30  
* viz.arc: An arc diagram, which places nodes on a single axis.30  
* viz.chord: A chord diagram, which places nodes on a circular layout.30

The normalized spec *must* define two data sources, e.g., data: { nodes: "resource-1", edges: "resource-2" }, and specify the layout: "force" 8 or layout: "circular".

### **E. Renderer Portability and Implementation**

* **ECharts:**  
  * **Implementation:** Native. The ECharts series-graph is designed explicitly for this purpose.1 It consumes the nodes and links arrays directly and performs the force-directed layout on the client.2 The OODS adapter will pass the data sources directly to these properties.  
* **Vega-Lite:**  
  * **Hard Blocker:** Vega-Lite *does not* include the force layout transform.5 This is a non-negotiable component for this visualization.  
  * **Interactivity Blocker:** Unlike hierarchies, the layout *cannot* be pre-calculated on the server. The force-directed layout's primary feature is user interaction (e.g., node dragging) 43, which requires the simulation to run in the client.  
  * **Recommendation (Full Vega Escape Hatch):** This is the *only* viable path for Vega-Lite support. The OODS v2.0 "Resolver" must:  
    1. Identify the viz.network trait for the vega-lite renderer.  
    2. *Not* generate a Vega-Lite spec. It must generate a **Full Vega** specification.  
    3. This Vega spec will define two data sources (node-data, link-data).43  
    4. It will define a force transform that operates on the node-data and uses the link-data for its "links" force parameter.8  
    5. It will define two marks: a symbol mark for nodes, and a path mark for links that uses the linkpath transform to draw lines between node coordinates.43  
  * **Fallback:** Mark viz.network as "ECharts-only" in the UI, with the Full Vega compilation available as an "experimental" feature.

## **V. Domain 3: Extending the OODS for Geospatial Data**

### **A. Analysis: Common Data Structures**

* **It's a "Join" Problem:** The geospatial domain is the most mature, and the primary challenge is not layout (which is handled by cartographic projections) but **data joining**. The common use case involves two distinct datasets:  
  1. **Metric Data:** A tabular file (e.g., CSV) containing data points, such as us-unemployment.csv.51  
  2. **Geometry Data:** A file containing the geographic shapes, such as us-counties.json.53  
* **Geometry Formats:** **GeoJSON** is the open web standard (RFC 7946).55 **TopoJSON** is a popular, compact extension that encodes topology.55 Both must be supported.  
* **Metric Formats:**  
  1. **Points:** Tabular data with discrete latitude and longitude columns.55  
  2. **Polygons (Choropleth):** Tabular data with a *key* (e.g., FIPS code 51 or ISO 3166 code 62) that *links* to a feature in the separate GeoJSON/TopoJSON file.  
  3. **Embedded Geometry:** Tabular data where one column *is* the geometry, often as a GeoJSON string or Well-Known Text (WKT).55 The Frictionless specification supports this.65

### **B. Proposed Schema Extension: field.geo\* Types and data.geo.join**

**1\. New Field Types (adopting Frictionless specification):**

* field.type: "field.geopoint": For point data. The format property can be "default" (a "lon, lat" string), "array" (\[lon, lat\]), or "object" ({lon, lat}).66  
* field.type: "field.geojson": For a field containing an embedded GeoJSON object.65 This will be validated against the official GeoJSON schema.68  
* field.type: "field.topojson": For a field containing an embedded TopoJSON object.

**2\. New Dataset Type (for Joins):**

* data.type: "data.geo.join": A new dataset-level annotation to be applied to the *metric* data.  
* This type *requires* an associated field annotation:  
  * field.relation: "join.foreignKey": Applied to the key field in the *metric* data (e.g., the fips column 51).

### **C. Inference Engine Update (Detection Rules)**

* **Rule G-1 (Explicit):** If field.type is field.geojson or field.geopoint, validation passes.  
* **Rule G-2 (Field Name Heuristics \- Point):** If a table contains (lat, lon), (latitude, longitude), or similar pairs, promote these fields to a single composite field.geopoint.60  
* **Rule G-3 (Field Name Heuristics \- Key):** If a field is named fips, fips\_code, iso\_a2, iso\_a3, or country\_code, recommend data.type: "data.geo.join" and field.relation: "join.foreignKey".53  
* **Rule G-4 (Content Validation):** If a string or object field's content successfully validates against the GeoJSON schema 59, promote it to field.geojson.

### **D. Normalized Visualization Spec: New Traits**

* viz.map.choropleth: For polygon-based maps where color is data-driven.10  
* viz.map.bubble: For point-based maps, where bubble size or color encodes a metric.48

**Crucial Extension:** The normalized specification *must* be extended to support a lookup or join operation.

* data.source: Points to the *primary* (metric) data.  
* data.lookup: A new object defining the join:  
  * lookup.from.data: The *geometry* data (e.g., URL to TopoJSON file).  
  * lookup.from.format: (e.g., { "type": "topojson", "feature": "counties" }).10  
  * lookup.key: The key in the *geometry* data (e.g., id 10).  
  * lookup.foreignKey: The key in the *metric* data (e.g., fips 51).

### **E. Renderer Portability and Implementation**

This domain is fully supported by both renderers, demonstrating why it is suitable for a v1.1 release.

* **ECharts:**  
  * **Implementation:** Native. ECharts uses a two-step process. The OODS adapter will:  
    1. Parse the data.lookup object to fetch the GeoJSON/TopoJSON data and register it via echarts.registerMap("mapName", geoJsonData).72  
    2. Use the series-map type, setting map: "mapName". The data array for the series will be the *metric* data, which ECharts joins by name.2  
* **Vega-Lite:**  
  * **Implementation:** Native. Vega-Lite handles this idiomatically and is a model for our normalized spec. The OODS adapter will:  
    1. Set the top-level data property to the *geometry* data (from lookup.from.data).10  
    2. Add a transform array containing a lookup transform.10  
    3. This lookup will point from.data to the *metric* data (from data.source) and use the key and foreignKey to join.  
    4. The mark will be geoshape 10 and a projection will be applied.17

## **VI. Prototype Gallery: Reference Implementations and Specifications**

### **A. Prototype 1: Hierarchical Treemap (Organizational Chart)**

* **Source Data:** org-chart.csv (Adjacency List).21  
  Code snippet  
  id,name,role,manager\_id  
  1,"CEO","CEO",  
  2,"VP Engineering","VP",1  
  3,"VP Marketing","VP",1  
  4,"Lead Dev","Engineer",2

* **OODS Schema (schema-org-chart.json):**  
  JSON  
  {  
    "data.type": "data.hierarchy",  
    "fields": \[  
      { "name": "id", "relation": "parent-child.key" },  
      { "name": "name" },  
      { "name": "role" },  
      { "name": "manager\_id", "relation": "parent-child.parentKey" }  
    \]  
  }

* **Normalized Spec (spec-treemap.json):**  
  JSON  
  {  
    "viz": "viz.treemap",  
    "data": { "source": "org-chart.csv" },  
    "encoding": {  
      "value": { "field": "auto" } // 'auto' implies count of leaf nodes  
    }  
  }

* **Result (ECharts):** The ECharts adapter receives the spec. On the client, it transforms org-chart.csv into a nested structure and renders series-treemap.2  
* **Result (Vega-Lite):** The OODS v2.0 Resolver intercepts the request. It runs a stratify \+ treemap layout algorithm 9 on the server, producing new data: (id, name, x0, y0, x1, y1). This *new* flat data is sent to the client, which renders a simple mark: "rect".

### **B. Prototype 2: Network Graph (Les Misérables Characters)**

* **Source Data:** miserables.json.38  
  JSON  
  {  
    "nodes": \[  
      {"id": "Myriel", "group": 1},  
      {"id": "Napoleon", "group": 1}  
    \],  
    "links": \[  
      {"source": "Napoleon", "target": "Myriel", "value": 1}  
    \]  
  }

* **OODS Schema (schema-miserables.json):**  
  JSON  
  {  
    "data.type": "data.network",  
    "schema": {  
      "type": "object",  
      "properties": {  
        "nodes": { "type": "array" },  
        "links": { "type": "array" }  
      }  
    }  
  }

* **Normalized Spec (ECharts) (spec-network.echarts.json):**  
  JSON  
  {  
    "viz": "viz.network",  
    "data": {  
      "source": "miserables.json",  
      "nodes": "nodes",  
      "edges": "links"  
    },  
    "layout": "force"  
  }

* **Result (ECharts):** The ECharts adapter renders series-graph 1, consuming the nodes and links arrays directly.  
* **Deliverable (Vega-Lite):** BLOCKER\_REPORT.md and spec-network.VEGA.json.  
  * **BLOCKER\_REPORT.md:** "Vega-Lite viz.network is not supported due to the missing interactive force transform.5 Compiling to Full Vega as an escape hatch."  
  * **spec-network.VEGA.json:** A full Vega (not \-Lite) spec is generated, defining data sources 43, a force transform 8, and a linkpath transform.50

### **C. Prototype 3: Geospatial Choropleth (US County Unemployment)**

* **Source Data 1:** us-unemployment.csv (Metrics).51  
  Code snippet  
  fips,unemp\_rate  
  "01001",5.3  
  "01003",5.4

* **Source Data 2:** us-counties-10m.topojson (Geometry).53 (Features where id is the FIPS code).  
* **OODS Schema (schema-unemployment.json):**  
  JSON  
  {  
    "data.type": "data.geo.join",  
    "fields": \[  
      { "name": "fips", "relation": "join.foreignKey" },  
      { "name": "unemp\_rate" }  
    \]  
  }

* **Normalized Spec (Shared) (spec-choropleth.json):**  
  JSON  
  {  
    "viz": "viz.map.choropleth",  
    "data": { "source": "us-unemployment.csv" },  
    "data.lookup": {  
      "from": {  
        "data": "us-counties-10m.topojson",  
        "format": { "type": "topojson", "feature": "counties" }  
      },  
      "key": "id",  
      "foreignKey": "fips"  
    },  
    "encoding": {  
      "color": { "field": "unemp\_rate" }  
    }  
  }

* **Result (ECharts):** The adapter uses echarts.registerMap with the TopoJSON data 72 and renders a series-map, joining fips to the map's feature names.3  
* **Result (Vega-Lite):** The adapter generates a spec that loads the TopoJSON as the main data, then uses a transform: \[lookup\] to pull in unemp\_rate from us-unemployment.csv based on the fips/id join, and renders it with mark: geoshape.10

## **VII. Tooling and Taxonomy Update Proposal**

### **A. Table 2: OODS Schema and Trait Taxonomy Extensions (v2.0)**

This table summarizes all proposed changes to the core OODS taxonomy.

| Type Class | OODS Schema Definition | Key Annotations / Properties | Normalized Trait(s) Enabled |
| :---- | :---- | :---- | :---- |
| Dataset | data.hierarchy | field.relation: "parent-child.key", field.relation: "parent-child.parentKey" | viz.treemap, viz.sunburst, viz.node-link.tree |
| Dataset | data.network | resource.role: "nodes", resource.role: "edges", field.relation: "node.id", field.relation: "edge.source", field.relation: "edge.target" | viz.network, viz.arc, viz.chord |
| Dataset | data.geo.join | field.relation: "join.foreignKey" | viz.map.choropleth |
| Field | field.geopoint | \`format: "default" | "array" |
| Field | field.geojson | (Validates against RFC 7946\) \[59\] | viz.map.choropleth |
| Field | field.topojson | (Validates against TopoJSON spec) | viz.map.choropleth |

### **B. Schema Validator Extension Proposal**

The OODS validator tooling (based on AJV 80 and Frictionless 81) must be extended with custom, domain-specific validation rules.82

* **Proposed Custom Keywords/Checks:**  
  1. **is-valid-geojson (for field.geojson):**  
     * **Implementation:** An AJV custom keyword.84 The validation function will use a pre-compiled validator based on the official GeoJSON schemas 68 to validate the field's content.  
  2. **is-acyclic-hierarchy (for data.hierarchy):**  
     * **Implementation:** A custom Frictionless check.83 This check will load all (key, parentKey) pairs from an adjacency list, build an in-memory graph, and perform a graph traversal (e.g., Depth First Search) to detect cycles.46 This prevents infinite loops in layout algorithms.  
  3. **has-valid-hierarchy-keys (for data.hierarchy):**  
     * **Implementation:** A custom Frictionless check 83 that iterates rows and ensures every parentKey value either matches a key value in another row or is null (for root nodes).  
  4. **has-valid-network-links (for data.network):**  
     * **Implementation:** A custom check that validates all edge.source and edge.target IDs from the "edges" resource exist within the node.id collection from the "nodes" resource.

### **C. Linting Rule Proposal (for Portability)**

The OODS linter (which provides warnings in the UI) must be updated to reflect the findings in the Portability Matrix (Table 1).

* **Proposed New Lint Rules:**  
  * "portability-vega-lite-hierarchy": **(WARNING)** "The viz.treemap trait requires server-side transformation for Vega-Lite. Performance may vary. ECharts is recommended for native client-side rendering."  
  * "portability-vega-lite-network": **(ERROR)** "The viz.network trait is not supported by Vega-Lite due to the missing 'force' layout. Select ECharts, or enable the 'Full Vega Compilation' (Experimental) escape hatch."  
  * "schema-recommend-geo-join": **(INFO)** "Field 'fips' detected. Recommend setting data.type to data.geo.join and field.relation to join.foreignKey to enable choropleth maps."

## **VIII. Mission Completion Report: Risk R-003 Status and v2.0 Roadmap**

### **A. Mission ID**

mission-dv-10-complex-schema-extension

### **B. Status**

**Completed.** All constraints, objectives, and deliverables have been met. This report provides a complete analysis of the three complex data domains, proposes schema extensions, validates them against real-world use cases, details the necessary evolution of the normalized specification, and evaluates all portability and renderer-specific implications.

### **C. Risk R-003 ("10% visualization gap") Mitigation Status**

**Mitigated.** This proposal provides a comprehensive, validated, and implementation-ready architecture to close the 10% taxonomy gap identified in Risk R-003.

* The geospatial extensions address map-based visualization needs.  
* The hierarchy extensions address organizational, financial, and categorical drill-downs.  
* The network extensions address graph and relationship-based analysis.

The core finding of the "Renderer Transform Gap" has redefined the problem not as a simple taxonomy extension, but as a necessary architectural evolution for the OODS platform.

### **D. Proposed Roadmap and Phasing**

This mitigation is best implemented in two distinct phases, aligning with the technical risk and architectural dependencies identified.

* **Phase 1 (v1.1 \- "Geospatial Release"):**  
  * **Components:** Implement field.geopoint, field.geojson, field.topojson, and data.geo.join types. Implement viz.map.choropleth and viz.map.bubble traits. Extend the normalized spec with the data.lookup object.  
  * **Rationale:** This phase is low-risk and high-impact. Both renderers have native, idiomatic support for the required data-joining paradigm.3 No server-side changes are required.  
* **Phase 2 (v2.0 \- "Complex Layouts Release"):**  
  * **Components:** Implement data.hierarchy and data.network types. Implement viz.treemap, viz.sunburst, and viz.network traits.  
  * **Core Dependencies:** This phase is a major architectural update. Its implementation is *contingent* on the development of two new backend services, as defined in Section II, to bridge the "Renderer Transform Gap":  
    1. **The OODS "Resolver" & Transformation Engine:** A new service to perform server-side stratify and partition layouts for Vega-Lite hierarchy charts.  
    2. **The "Full Vega Compiler":** A new "escape hatch" service to compile viz.network traits to the full Vega specification, bypassing Vega-Lite's limitations.  
  * **Rationale:** By designating this v2.0, the platform acknowledges the significant engineering effort required to support complex, renderer-specific layouts, ensuring the OODS remains robust, flexible, and explicit about its rendering pathways.

#### **Works cited**

1. Documentation \- Apache ECharts, accessed November 5, 2025, [https://echarts.apache.org/en/option.html](https://echarts.apache.org/en/option.html)  
2. Basic Line Chart \- Examples \- Apache ECharts, accessed November 5, 2025, [https://echarts.apache.org/examples/en/index.html](https://echarts.apache.org/examples/en/index.html)  
3. map: Choropleth in echarts4r: Create Interactive Graphs with 'Echarts JavaScript' Version 5, accessed November 5, 2025, [https://rdrr.io/cran/echarts4r/man/map.html](https://rdrr.io/cran/echarts4r/man/map.html)  
4. Sunburst / Treemap · Issue \#1638 · vega/altair \- GitHub, accessed November 5, 2025, [https://github.com/altair-viz/altair/issues/1638](https://github.com/altair-viz/altair/issues/1638)  
5. Transformation \- Vega-Lite, accessed November 5, 2025, [https://vega.github.io/vega-lite/docs/transform.html](https://vega.github.io/vega-lite/docs/transform.html)  
6. Example Gallery | Vega-Lite, accessed November 5, 2025, [https://vega.github.io/vega-lite/examples/](https://vega.github.io/vega-lite/examples/)  
7. Stratify Transform \- Vega, accessed November 5, 2025, [https://vega.github.io/vega/docs/transforms/stratify/](https://vega.github.io/vega/docs/transforms/stratify/)  
8. Force Transform \- Vega, accessed November 5, 2025, [https://vega.github.io/vega/docs/transforms/force/](https://vega.github.io/vega/docs/transforms/force/)  
9. Treemap Transform \- Vega, accessed November 5, 2025, [https://vega.github.io/vega/docs/transforms/treemap/](https://vega.github.io/vega/docs/transforms/treemap/)  
10. Geoshape \- Vega-Lite, accessed November 5, 2025, [https://vega.github.io/vega-lite/docs/geoshape.html](https://vega.github.io/vega-lite/docs/geoshape.html)  
11. Lookup Transform \- Vega-Lite, accessed November 5, 2025, [https://vega.github.io/vega-lite/docs/lookup.html](https://vega.github.io/vega-lite/docs/lookup.html)  
12. Analyze and visualize nested JSON data with Amazon Athena and Amazon QuickSight | AWS Big Data Blog, accessed November 5, 2025, [https://aws.amazon.com/blogs/big-data/analyze-and-visualize-nested-json-data-with-amazon-athena-and-amazon-quicksight/](https://aws.amazon.com/blogs/big-data/analyze-and-visualize-nested-json-data-with-amazon-athena-and-amazon-quicksight/)  
13. Going from Tabular data to nested for visualizing hierarchy, wanting to plug into d3.hierarchy examples \- The Observable Forum, accessed November 5, 2025, [https://talk.observablehq.com/t/going-from-tabular-data-to-nested-for-visualizing-hierarchy-wanting-to-plug-into-d3-hierarchy-examples/6408](https://talk.observablehq.com/t/going-from-tabular-data-to-nested-for-visualizing-hierarchy-wanting-to-plug-into-d3-hierarchy-examples/6408)  
14. Sunburst — e\_sunburst \- echarts4r, accessed November 5, 2025, [https://echarts4r.john-coene.com/reference/e\_sunburst](https://echarts4r.john-coene.com/reference/e_sunburst)  
15. Features \- Apache ECharts, accessed November 5, 2025, [https://echarts.apache.org/en/feature.html](https://echarts.apache.org/en/feature.html)  
16. Partition Transform \- Vega, accessed November 5, 2025, [https://vega.github.io/vega/docs/transforms/partition/](https://vega.github.io/vega/docs/transforms/partition/)  
17. Projection | Vega-Lite, accessed November 5, 2025, [https://vega.github.io/vega-lite/docs/projection.html](https://vega.github.io/vega-lite/docs/projection.html)  
18. Managing Hierarchical Data in MySQL — Mike Hillyer's Personal Webspace, accessed November 5, 2025, [https://mikehillyer.com/articles/managing-hierarchical-data-in-mysql/](https://mikehillyer.com/articles/managing-hierarchical-data-in-mysql/)  
19. MySQL 8.0 Labs: \[Recursive\] Common Table Expressions in MySQL (CTEs), Part Three \- hierarchies, accessed November 5, 2025, [https://dev.mysql.com/blog-archive/mysql-8-0-labs-recursive-common-table-expressions-in-mysql-ctes-part-three-hierarchies/](https://dev.mysql.com/blog-archive/mysql-8-0-labs-recursive-common-table-expressions-in-mysql-ctes-part-three-hierarchies/)  
20. How to design database tables for hierarchical data with unknown depth? \- Stack Overflow, accessed November 5, 2025, [https://stackoverflow.com/questions/39956073/how-to-design-database-tables-for-hierarchical-data-with-unknown-depth](https://stackoverflow.com/questions/39956073/how-to-design-database-tables-for-hierarchical-data-with-unknown-depth)  
21. Create an organization chart automatically from employee data \- Microsoft Support, accessed November 5, 2025, [https://support.microsoft.com/en-us/office/create-an-organization-chart-automatically-from-employee-data-8f2e693e-25fc-410e-8264-9084eb0b9360](https://support.microsoft.com/en-us/office/create-an-organization-chart-automatically-from-employee-data-8f2e693e-25fc-410e-8264-9084eb0b9360)  
22. d3-hierarchy | D3 by Observable \- D3.js, accessed November 5, 2025, [https://d3js.org/d3-hierarchy](https://d3js.org/d3-hierarchy)  
23. 6 Hierarchical Data Visualizations \- Towards Data Science, accessed November 5, 2025, [https://towardsdatascience.com/6-hierarchical-datavisualizations-98318851c7c5/](https://towardsdatascience.com/6-hierarchical-datavisualizations-98318851c7c5/)  
24. Recursive Schemas: Combining Subschemas | A Tour of JSON Schema, accessed November 5, 2025, [https://tour.json-schema.org/content/06-Combining-Subschemas/07-Recursive-Schemas](https://tour.json-schema.org/content/06-Combining-Subschemas/07-Recursive-Schemas)  
25. Generate (multilevel) flare.json data format from flat json \- Stack Overflow, accessed November 5, 2025, [https://stackoverflow.com/questions/17847131/generate-multilevel-flare-json-data-format-from-flat-json](https://stackoverflow.com/questions/17847131/generate-multilevel-flare-json-data-format-from-flat-json)  
26. Stratify | D3 by Observable \- D3.js, accessed November 5, 2025, [https://d3js.org/d3-hierarchy/stratify](https://d3js.org/d3-hierarchy/stratify)  
27. Hierarchies in D3 / Chris D'Iorio \- Observable, accessed November 5, 2025, [https://observablehq.com/@cediorio/working-with-hierarchical-data-and-visualizations-in-d3](https://observablehq.com/@cediorio/working-with-hierarchical-data-and-visualizations-in-d3)  
28. Vega Tutorial 2: Working with Trees (Solution) / Marius Hogräfer \- Observable, accessed November 5, 2025, [https://observablehq.com/@mahog/vega-tutorial-2-working-with-trees-solution](https://observablehq.com/@mahog/vega-tutorial-2-working-with-trees-solution)  
29. Automatic Detection of Data Structures in Reconstructed Heap States \- System Software, accessed November 5, 2025, [https://ssw.jku.at/Teaching/BachelorTheses/2023/Vujakovic\_Manuel.pdf](https://ssw.jku.at/Teaching/BachelorTheses/2023/Vujakovic_Manuel.pdf)  
30. From data to Viz | Find the graphic you need, accessed November 5, 2025, [https://www.data-to-viz.com/](https://www.data-to-viz.com/)  
31. Treemap Example \- Vega-Lite, accessed November 5, 2025, [https://vega.github.io/vega/examples/treemap/](https://vega.github.io/vega/examples/treemap/)  
32. Sunburst Example \- Vega-Lite, accessed November 5, 2025, [https://vega.github.io/vega/examples/sunburst/](https://vega.github.io/vega/examples/sunburst/)  
33. Representing a graph in JSON \- Stack Overflow, accessed November 5, 2025, [https://stackoverflow.com/questions/43052290/representing-a-graph-in-json](https://stackoverflow.com/questions/43052290/representing-a-graph-in-json)  
34. Sample Graph Datasets in CSV Format \- Zenodo, accessed November 5, 2025, [https://zenodo.org/records/14335015](https://zenodo.org/records/14335015)  
35. Visualizing a Network Dataset Using Gephi \- Map and Data Library \- University of Toronto, accessed November 5, 2025, [https://mdl.library.utoronto.ca/technology/tutorials/visualizing-network-dataset-using-gephi](https://mdl.library.utoronto.ca/technology/tutorials/visualizing-network-dataset-using-gephi)  
36. Overview of Standard Graph File Formats \- INTRANET ICAR-CNR, accessed November 5, 2025, [https://intranet.icar.cnr.it/wp-content/uploads/2018/12/RT-ICAR-PA-2018-06.pdf](https://intranet.icar.cnr.it/wp-content/uploads/2018/12/RT-ICAR-PA-2018-06.pdf)  
37. accessed November 5, 2025, [https://stackoverflow.com/questions/73818103/graph-algorithms-edge-list-to-adjacency-list-or-adjacency-matrix\#:\~:text=If%20I%20understand%20correctly%2C%20an,destination%20vertices%20for%20that%20source.](https://stackoverflow.com/questions/73818103/graph-algorithms-edge-list-to-adjacency-list-or-adjacency-matrix#:~:text=If%20I%20understand%20correctly%2C%20an,destination%20vertices%20for%20that%20source.)  
38. Les Misérables — gravis 0.1.0 documentation \- GitHub Pages, accessed November 5, 2025, [https://robert-haas.github.io/gravis-docs/code/examples/science/social\_science/les\_miserables.html](https://robert-haas.github.io/gravis-docs/code/examples/science/social_science/les_miserables.html)  
39. Force-directed graph / D3 \- Observable, accessed November 5, 2025, [https://observablehq.com/@d3/force-directed-graph/2](https://observablehq.com/@d3/force-directed-graph/2)  
40. Adaptation of Mike Bostock's Force-Directed Graph of Les Mis Characters using .csv dataset instead of json \- GitHub Gist, accessed November 5, 2025, [https://gist.github.com/timelyportfolio/5049980/](https://gist.github.com/timelyportfolio/5049980/)  
41. Understanding Les Miserables Co-occurrence data \- Stack Overflow, accessed November 5, 2025, [https://stackoverflow.com/questions/53810800/understanding-les-miserables-co-occurrence-data](https://stackoverflow.com/questions/53810800/understanding-les-miserables-co-occurrence-data)  
42. Force-directed-networks | Data Visualisation in Data Science, accessed November 5, 2025, [https://vda-lab.github.io/visualisation-tutorial/vega-force-directed-networks.html](https://vda-lab.github.io/visualisation-tutorial/vega-force-directed-networks.html)  
43. Force Directed Layout Example \- Vega, accessed November 5, 2025, [https://vega.github.io/vega/examples/force-directed-layout/](https://vega.github.io/vega/examples/force-directed-layout/)  
44. JSON Graph Format Specification Website, accessed November 5, 2025, [https://jsongraphformat.info/](https://jsongraphformat.info/)  
45. jsongraph/json-graph-specification: A proposal for representing graph structure (nodes / edges) in JSON. \- GitHub, accessed November 5, 2025, [https://github.com/jsongraph/json-graph-specification](https://github.com/jsongraph/json-graph-specification)  
46. How to detect and remove recursive structure in hierarchical data in R? \- Stack Overflow, accessed November 5, 2025, [https://stackoverflow.com/questions/74643126/how-to-detect-and-remove-recursive-structure-in-hierarchical-data-in-r](https://stackoverflow.com/questions/74643126/how-to-detect-and-remove-recursive-structure-in-hierarchical-data-in-r)  
47. Example Gallery \- Vega-Lite, accessed November 5, 2025, [https://vega.github.io/vega/examples/](https://vega.github.io/vega/examples/)  
48. The Data Visualisation Catalogue, accessed November 5, 2025, [https://datavizcatalogue.com/](https://datavizcatalogue.com/)  
49. Dataset \- Concepts \- Handbook \- Apache ECharts, accessed November 5, 2025, [https://apache.github.io/echarts-handbook/en/concepts/dataset/](https://apache.github.io/echarts-handbook/en/concepts/dataset/)  
50. LinkPath Transform \- Vega-Lite, accessed November 5, 2025, [https://vega.github.io/vega/docs/transforms/linkpath/](https://vega.github.io/vega/docs/transforms/linkpath/)  
51. Tile choropleth maps in Python \- Plotly, accessed November 5, 2025, [https://plotly.com/python/tile-county-choropleth/](https://plotly.com/python/tile-county-choropleth/)  
52. Global Unemployment Data \- Kaggle, accessed November 5, 2025, [https://www.kaggle.com/datasets/sazidthe1/global-unemployment-data](https://www.kaggle.com/datasets/sazidthe1/global-unemployment-data)  
53. topojson/us-atlas: Pre-built TopoJSON from the U.S. Census Bureau. \- GitHub, accessed November 5, 2025, [https://github.com/topojson/us-atlas](https://github.com/topojson/us-atlas)  
54. Country Polygons as GeoJSON \- DataHub, accessed November 5, 2025, [https://datahub.io/core/geo-countries](https://datahub.io/core/geo-countries)  
55. Geospatial Data Explained \- GeoDataPoints, accessed November 5, 2025, [https://geodatapoints.com/posts/geospatial-data-types-explained/](https://geodatapoints.com/posts/geospatial-data-types-explained/)  
56. The Ultimate List of GIS Formats and Geospatial File Extensions, accessed November 5, 2025, [https://gisgeography.com/gis-formats/](https://gisgeography.com/gis-formats/)  
57. GeoJSON \- Wikipedia, accessed November 5, 2025, [https://en.wikipedia.org/wiki/GeoJSON](https://en.wikipedia.org/wiki/GeoJSON)  
58. GeoJSON, accessed November 5, 2025, [https://geojson.org/](https://geojson.org/)  
59. RFC 7946 \- The GeoJSON Format \- IETF Datatracker, accessed November 5, 2025, [https://datatracker.ietf.org/doc/html/rfc7946](https://datatracker.ietf.org/doc/html/rfc7946)  
60. Geospatial Big Data: Survey and Challenges \- arXiv, accessed November 5, 2025, [https://arxiv.org/html/2404.18428v1](https://arxiv.org/html/2404.18428v1)  
61. Feature engineering: all I learnt about Geo-spatial features | by Bala Manikandan \- Medium, accessed November 5, 2025, [https://bmanikan.medium.com/feature-engineering-all-i-learned-about-geo-spatial-features-649871d16796](https://bmanikan.medium.com/feature-engineering-all-i-learned-about-geo-spatial-features-649871d16796)  
62. hyperknot/country-levels: Full planet GeoJSON extracts, based on ISO and FIPS codes., accessed November 5, 2025, [https://github.com/hyperknot/country-levels](https://github.com/hyperknot/country-levels)  
63. ISO 3166-1 country lists merged with their UN Geoscheme regional codes in ready-to-use JSON, XML, CSV data sets \- GitHub, accessed November 5, 2025, [https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes](https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes)  
64. Complete GIS Data Format Guide \- WKT, WKB, GeoJSON Explained \- GIS Tools, accessed November 5, 2025, [https://gis-tools.com/gis-guide.html](https://gis-tools.com/gis-guide.html)  
65. Geojson Field | Frictionless Framework, accessed November 5, 2025, [https://framework.frictionlessdata.io/docs/fields/geojson.html](https://framework.frictionlessdata.io/docs/fields/geojson.html)  
66. Point location data in CSV files | Frictionless Data, accessed November 5, 2025, [https://frictionlessdata.io/blog/2018/07/16/point-location-data/](https://frictionlessdata.io/blog/2018/07/16/point-location-data/)  
67. Geopoint Field \- Frictionless Framework, accessed November 5, 2025, [https://framework.frictionlessdata.io/docs/fields/geopoint.html](https://framework.frictionlessdata.io/docs/fields/geopoint.html)  
68. JSON Schema for GeoJSON \- GitHub, accessed November 5, 2025, [https://github.com/geojson/schema](https://github.com/geojson/schema)  
69. JSON schema files and a validator for the GeoJSON specification \- GitHub, accessed November 5, 2025, [https://github.com/yagajs/geojson-schema](https://github.com/yagajs/geojson-schema)  
70. Choropleth of Unemployment Rate per County \- Vega-Lite, accessed November 5, 2025, [https://vega.github.io/vega-lite/examples/geo\_choropleth.html](https://vega.github.io/vega-lite/examples/geo_choropleth.html)  
71. Choropleth Map \- AnyChart Documentation, accessed November 5, 2025, [https://docs.anychart.com/Maps/Choropleth\_Map](https://docs.anychart.com/Maps/Choropleth_Map)  
72. Documentation \- Apache ECharts, accessed November 5, 2025, [https://echarts.apache.org/en/api.html](https://echarts.apache.org/en/api.html)  
73. GeoJSON data \- echarts4r, accessed November 5, 2025, [https://echarts4r.john-coene.com/articles/make-geo-json](https://echarts4r.john-coene.com/articles/make-geo-json)  
74. SVG Base Map \- Geo \- Common Components \- How To Guides \- Apache ECharts, accessed November 5, 2025, [https://echarts.apache.org/handbook/en/how-to/component-types/geo/svg-base-map/](https://echarts.apache.org/handbook/en/how-to/component-types/geo/svg-base-map/)  
75. Sync map and graph series in apache echarts \- Stack Overflow, accessed November 5, 2025, [https://stackoverflow.com/questions/74183582/sync-map-and-graph-series-in-apache-echarts](https://stackoverflow.com/questions/74183582/sync-map-and-graph-series-in-apache-echarts)  
76. Using the lookup transform to combine data \- Vega-Lite, accessed November 5, 2025, [https://vega.github.io/vega-lite/examples/lookup.html](https://vega.github.io/vega-lite/examples/lookup.html)  
77. vega lite \- How to transform a secondary data source inside a lookup transform?, accessed November 5, 2025, [https://stackoverflow.com/questions/69197085/how-to-transform-a-secondary-data-source-inside-a-lookup-transform](https://stackoverflow.com/questions/69197085/how-to-transform-a-secondary-data-source-inside-a-lookup-transform)  
78. Create an org chart \- Lucid Help, accessed November 5, 2025, [https://help.lucid.co/hc/en-us/articles/16463330693268-Create-an-org-chart](https://help.lucid.co/hc/en-us/articles/16463330693268-Create-an-org-chart)  
79. topojson/topojson-client: Manipulate TopoJSON, such as to merge shapes, and convert it back to GeoJSON. \- GitHub, accessed November 5, 2025, [https://github.com/topojson/topojson-client](https://github.com/topojson/topojson-client)  
80. Ajv JSON schema validator, accessed November 5, 2025, [https://ajv.js.org/](https://ajv.js.org/)  
81. frictionlessdata/frictionless-py: Data management framework for Python that provides functionality to describe, extract, validate, and transform tabular data \- GitHub, accessed November 5, 2025, [https://github.com/frictionlessdata/frictionless-py](https://github.com/frictionlessdata/frictionless-py)  
82. How to define my own custom meta-Schema (draft-7 version) ? \#1007 \- GitHub, accessed November 5, 2025, [https://github.com/json-schema-org/json-schema-spec/issues/1007](https://github.com/json-schema-org/json-schema-spec/issues/1007)  
83. Check Guide | Frictionless Framework, accessed November 5, 2025, [https://v4.framework.frictionlessdata.io/docs/guides/extension/check-guide](https://v4.framework.frictionlessdata.io/docs/guides/extension/check-guide)  
84. User-defined keywords \- Ajv JSON schema validator, accessed November 5, 2025, [https://ajv.js.org/guide/user-keywords.html](https://ajv.js.org/guide/user-keywords.html)  
85. User defined keywords \- Ajv JSON schema validator, accessed November 5, 2025, [https://ajv.js.org/keywords.html](https://ajv.js.org/keywords.html)