Architectural Evaluation of Trait Engine Specification v0.1: A Portability and Semantic Drift Analysis for Vega-Lite and Observable Plot Translation
Executive Summary
This report presents a formal architectural evaluation of the 'Trait Engine Specification v0.1' (TEP) and its mechanical translation into two target visualization libraries: Vega-Lite and Observable Plot. The TEP, as the foundational 'normalized OODS visualization spec', is analyzed as an abstract model, with Vega-Lite and Observable Plot serving as concrete "compilation targets." The analysis validates the TEP's portability by mapping its core "Trait Execution Pipeline" (TEP) stages and specified collision scenarios to the dataflow and interaction models of both libraries.

Key findings of this evaluation are as follows:

TEP-to-Vega-Lite Translation (High Fidelity / Low Drift): The TEP's abstract, declarative model maps with high fidelity to the architecture of Vega-Lite. Vega-Lite's self-contained, declarative JSON specification  and its rigid, multi-stage dataflow pipeline  provide a 1:1 mapping for TEP traits, including complex, non-commutative operations. The semantic drift is minimal, allowing for a translation process that can be treated as a reliable specification-to-specification compilation.   

TEP-to-Observable-Plot Translation (High Friction / High Drift): The TEP maps with high friction and significant semantic drift to the JavaScript-native, stateless architecture of Observable Plot. The translation is not a 1:1 "specification port" but rather a 1:M "software re-implementation." Key TEP concepts such as "interaction" and "type safety" do not translate into a declarative specification; they must be re-implemented as imperative JavaScript code, shifting logical responsibility from the TEP runtime to the developer.   

Collision Scenario Validation (High Fidelity in VL, Opinionated in Plot): The TEP's defined "collision scenarios" were successfully validated.

'Non-Commutative' Filter/Aggregate: Vega-Lite's architecture can declaratively model both states of this collision (e.g., Filter-then-Aggregate and Aggregate-then-Filter) by precise use of its two-stage pipeline.   

'Stateful vs. Static' Zoom: Vega-Lite's interaction grammar can declaratively model both zoom behaviors ('Stateful/Domain' zoom via a transform filter  and 'Static/Visual' zoom via a scale binding ).   

Observable Plot's idiomatic architecture is opinionated, strongly favoring one state of each collision ('Filter-then-Aggregate' via function composition  and 'Stateful/Domain' zoom via its host reactive dataflow ). The alternative TEP states, while possible to implement, are non-idiomatic and result in high semantic drift.   

Critical Ancillary Trait Drifts: Semantic drift was identified in two critical ancillary areas. First, TEP's explicit type system (e.g., requires: 'temporal') maps 1:1 to Vega-Lite  but suffers total semantic drift in Plot, which relies on type inference. A TEP type definition must be translated into an imperative JavaScript data-wrangling script for Plot. Second, TEP's cross-layer data lookup (e.g., a tooltip on one layer reading data from another) is a "hard collision" for both libraries, which operate on a mark-scoped, not view-scoped, data model. This requires a mandatory data-unification (e.g., pivot) pre-processing step to be inserted by the TEP compiler.   

Actionable Deliverables: This report provides a comprehensive Portability Mapping Table (Section 4.1) as a tactical guide for TEP translation. It also proposes a two-pronged Semantic Validation Framework (Section 4.2), combining Specification-Level (JSON) and Render-Level (SVG) diffing to ensure the correctness of TEP compiler output.

1.0 Introduction and Architectural Mapping
This analysis validates the portability of the Trait Engine Specification v0.1 (TEP) by mapping its abstract model to the concrete architectures of Vega-Lite and Observable Plot. The TEP is treated as the foundational, platform-agnostic specification, while the target libraries are evaluated as "compilation targets." The success of this translation is measured by "semantic drift"—the degree to which the TEP's declarative intent is preserved or lost upon compilation.

1.1 The TEP as a Normalized OODS Visualization Spec
The TEP is understood as a declarative, OODS (Once-Over-Data-Structure) specification, likely in a JSON format. Its core architectural feature is the "Trait Execution Pipeline," a formal model that implies a directed acyclic graph (DAG) of operations. This pipeline defines discrete, ordered stages (e.g., data loading, view-level transformations, encoding-level transformations, interaction binding, and rendering). This structure, particularly its formal definition of non-commutative operations and interaction states, serves as the "source of truth" for this analysis.

1.2 The Vega-Lite Execution Model: A Declarative, Self-Contained Dataflow
1.2.1 Core Architecture
Vega-Lite (VL) is a high-level, declarative JSON grammar for describing interactive and statistical graphics. Its primary architectural function is to serve as a high-level language that compiles into a more complex, lower-level Vega specification. This resulting Vega specification is a complete, self-contained definition of a dataflow graph.   

This "spec-to-spec" compilation model makes VL an ideal target for the TEP. A TEP-to-VL compiler would be a data-transformation task: mapping one JSON schema (TEP) to another (VL). The VL runtime, powered by Vega, is then responsible for executing the entire dataflow, from data loading to interaction, as defined in the compiled spec.

1.2.2 The Data Ingestion Stage
The VL data model is explicitly tabular. The specification defines a data property that can be populated either by inline values or by providing a url from which to load data. This provides a direct, 1:1 mapping for a TEP "Data-Source" trait, preserving the declarative nature of data binding.   

1.2.3 The Transformation Pipeline: A Rigid, Two-Stage Execution
The most critical architectural mapping for the TEP is the VL data transformation pipeline. This pipeline is not a flat list of operations; it is an explicit, multi-stage process with a fixed execution order, which is essential for modeling the TEP's "Non-Commutative" operations.

As documented in the VL specification, the pipeline is as follows :   

Stage 1 (View-Level): The top-level transform array is executed first. The transforms within this array (e.g., filter, aggregate, bin, window, regression) are executed sequentially, in the order they are defined in the array.   

Stage 2 (Inline-Level): After the entire view-level transform array is processed, the inline transforms are executed. These are the transforms defined within the encoding block of the specification. They are always executed in a fixed, non-configurable order: bin, timeUnit, aggregate, sort, and stack.   

This rigid, two-stage architecture provides an exceptionally high-fidelity mapping for the TEP. The TEP's concept of an "Execution Pipeline" is not just a metaphor; it is a concrete, physical feature of the VL architecture. A TEP trait for "pre-aggregation filtering" (a view-level operation) maps cleanly to a VL transform: [{"filter":...}] (Stage 1). A TEP trait for "post-aggregation sorting" (an encoding-level operation) maps cleanly to an encoding: {"sort":...} (Stage 2). This declarative pipeline natively supports the TEP's logical model with minimal semantic drift.

1.3 The Observable Plot Execution Model: A Stateless Function in a Reactive Host
1.3.1 Core Architecture
Observable Plot (Plot) presents a fundamentally different architectural paradigm, which is the primary source of semantic drift when translating from the TEP. Plot is not a declarative JSON specification; it is a JavaScript-native API. Its design philosophy is "just JavaScript," and it is explicitly intended for exploratory data analysis within a reactive notebook environment, such as Observable.   

A TEP-to-Plot compiler cannot be a simple "data-transformation" task. It must be a code generator, translating the TEP's declarative JSON into imperative JavaScript. This immediately introduces significant friction and risk.

1.3.2 The Data Ingestion Stage
Plot does not have a "data ingestion" stage. It is a visualization library, not a data-loading one. It accepts data as a standard JavaScript variable (e.g., an array of objects). The TEP's declarative data: {url:...} trait cannot be translated; it must be replaced by imperative JavaScript code (e.g., const data = await d3.csv(...)) that exists outside the Plot specification itself.   

1.3.3 The Transformation Pipeline: Imperative Functional Composition
Plot does not have a "built-in" declarative transformation pipeline like Vega-Lite. Instead, data transformations are simply JavaScript functions (e.g., Plot.binX, Plot.group, Plot.filter) that are composed by the developer.   

The "execution order" is not defined by a specification; it is defined by the developer's code composition. For example, to filter data before binning it, the developer must write imperative code that reflects this, such as Plot.rectY(data.filter(...), Plot.binX(...)). This shifts the burden of logical correctness from the TEP runtime (as in VL) to the TEP-to-Plot compiler's code-generation logic.   

1.3.4 The Interaction Model: Stateless Rendering + External Reactivity
This is the most significant point of architectural mismatch. Vega-Lite's interaction model is "built-in" to the specification. Plot's interaction model "requires custom code".   

Plot itself is a stateless rendering function. It does not maintain its own internal state for interactions like brushing or zooming. It is explicitly designed to leverage the host environment's reactive dataflow, such as that provided by an Observable notebook.   

The interaction loop in the Plot/Observable ecosystem is as follows:

An external JavaScript-driven interaction (e.g., a d3-brush  or an Observable Inputs.slider) is defined, often in a separate notebook cell.   

User interaction with this widget updates a JavaScript variable.

The Observable notebook's reactive runtime detects this variable change and automatically re-runs all cells that depend on it.   

The Plot.plot(...) call, which depends on that variable, is thrown away and completely re-rendered from scratch.   

This creates a "Specification vs. Application" schism. A TEP trait for "interaction" (e.g., interaction: {type: 'brush'}) would translate to Vega-Lite as data (a JSON object, {"params": [{"select": "interval"}]}). This is a 1:1 specification translation. The same TEP trait translated to Plot becomes code: an import {brush} from 'd3-brush', a separate cell defining the brush behavior, and a viewof definition to capture its value. This is not a "translation"; it is a manual re-implementation of the TEP trait's intent. This is the single greatest point of semantic drift and portability cost. The TEP must be clear on whether its goal is to define a static, self-contained chart (like VL) or a stateful, reactive application (like Plot).   

2.0 Translation Analysis of Core TEP Collision Scenarios
This section stress-tests the TEP-to-Library translation using the two high-risk collision scenarios specified in the TEP v0.1: 'Non-Commutative Operations' and 'Stateful vs. Static Zoom'.

2.1 Non-Commutative Operations (TEP Scenario: 'Filter' vs. 'Aggregate')
This scenario tests the TEP's ability to enforce a specific execution order for transformations that are non-commutative (where changing the order changes the result). The test case is "Filter-then-Aggregate" (e.g., find the mean horsepower of only European cars) versus "Aggregate-then-Filter" (e.g., find the mean horsepower for all origins, then show only the origins whose mean is greater than 100).

2.1.1 Vega-Lite Translation (High Fidelity)
Vega-Lite's rigid, two-stage pipeline  provides a deterministic, declarative solution for both states of this collision.   

TEP "Filter-then-Aggregate": This maps directly to the two-stage pipeline. The filter is placed in the Stage 1 transform array, and the aggregate is placed in the Stage 2 encoding block.

Example: {"transform": [{"filter": "datum.Origin == 'Europe'"}], "encoding": {"y": {"aggregate": "mean", "field": "Horsepower"}}}. The filter on the raw data is executed first (Stage 1), and the aggregation is executed second on that filtered subset (Stage 2).   

TEP "Aggregate-then-Filter": This also maps directly, but it is implemented entirely within the Stage 1 transform array, which executes in order.

Example: {"transform": [{"aggregate": [{"op": "mean", "field": "Horsepower", "as": "mean_hp"}], "groupby": ["Origin"]}, {"filter": "datum.mean_hp > 100"}]}. The aggregate transform runs first, creating a new table with mean_hp. The filter transform then runs second, operating on the results of the aggregation.   

Because VL's transform array is explicitly ordered , it can model any TEP-defined sequence of operations. The separation between the transform array and the encoding block provides a perfect architectural mapping for TEP traits that distinguish between "data-source transformation" and "encoding-time transformation." The translation is 1:1 and semantically identical.   

2.1.2 Observable Plot Translation (High Friction)
Plot has no declarative pipeline; order is defined imperatively by the developer's JavaScript code.   

TEP "Filter-then-Aggregate": This must be translated into developer-written JavaScript, either by filtering the data before passing it to Plot, or by composing transforms.

Example: Plot.rectY(penguins.filter(d => d.species === "Adelie"), Plot.groupX({y: "mean"}, {x: "island"})).   

TEP "Aggregate-then-Filter": This becomes even more complex, requiring nested transforms or, more idiomatically, a separate data-wrangling step outside the Plot.plot call (e.g., using d3.rollups or Arquero).

Example (Nested): Plot.rectY(penguins, Plot.filter(d => d.mean_bill_length > 40, Plot.groupX({y: "mean"}, {x: "island", y: {value: "bill_length_mm", as: "mean_bill_length"}})))

The TEP spec's declarative intent ("filter-then-aggregate") is lost in translation. It becomes the developer's responsibility to write JavaScript code that correctly implements this logic. This is a high-friction, high-risk translation. A bug in the TEP compiler would result in broken JavaScript code, whereas a bug in the VL compiler results in invalid JSON data, which is easier to debug. This shifts the "burden of proof" for correctness from the TEP runtime to the human engineer.   

2.2 Zoom Trait Portability (TEP Scenario: 'Stateful/Domain' vs. 'Static/Visual' Zoom)
This scenario tests the TEP's interaction model by defining two mutually exclusive types of zoom, particularly in the context of a layered chart (e.g., a scatterplot with a regression trendline).

'Stateful/Domain' Zoom: An interaction (e.g., brushing) filters the source data. All subsequent transforms (e.g., the regression trendline) must be re-computed on the new, smaller, filtered dataset.

'Static/Visual' Zoom: An interaction only changes the visual axis domain (the "camera"). The underlying data for all layers remains the entire, unfiltered dataset. The trendline, therefore, would not change, as it is still computed on the full data.

2.2.1 Vega-Lite Translation (High Fidelity)
Vega-Lite's built-in interaction grammar, known as Parameters (formerly Selections), can model both TEP scenarios declaratively and with perfect fidelity.   

First, an interaction "parameter" (e.g., a brush) is defined in the specification: {"params": [{"name": "brush", "select": {"type": "interval"}}]}.   

TEP "Static/Visual" Zoom: This TEP trait is translated by binding the brush parameter to the scale domain.

Example: ... "encoding": {"x": {"scale": {"domain": {"param": "brush"}}}}....   

Result: As confirmed by , this "does not change the data in the plot, and so the y scale [and any layered transforms like regression] remains constant." This is a perfect 1:1 translation of the 'Static/Visual' TEP trait.   

TEP "Stateful/Domain" Zoom: This TEP trait is translated by binding the brush parameter to a filter transform.

Example: ... "transform": [{"filter": {"param": "brush"}}]....   

Result: This filters the data source before it reaches the encoding/rendering stages. Any layered transform, such as regression , will be re-calculated on the filtered data subset. This is also a perfect 1:1 translation of the 'Stateful/Domain' TEP trait.   

The fact that a single Vega-Lite param  can be bound to either a scale.domain  or a transform.filter  demonstrates that VL's architecture natively comprehends the TEP's "Stateful vs. Static" collision. The semantic drift is zero. The TEP can define a flag (e.g., zoomType: 'domain' | 'visual') that maps directly to which VL property the param is bound.   

2.2.2 Observable Plot Translation (High Friction & Opinionated)
As established, Plot has no built-in interaction model. It relies on the host's reactivity.   

TEP "Stateful/Domain" Zoom: This is the idiomatic, native way to implement zoom in the Observable ecosystem.

Example: An external d3-brush  provides a selection value. An Observable cell filters the data: filteredData = allData.filter(d => d.x >= selection && d.x <= selection). The plot cell, which depends on filteredData, automatically re-runs.   

Result: Plot.plot({ marks: }). The linearRegressionY transform is always re-computed on the new, filtered data. This is a 1:1 mapping only for the "Stateful" TEP trait.   

TEP "Static/Visual" Zoom: This is non-idiomatic and high-friction.

Example: The developer must manually fight the reactive re-render model.   

Result: Plot.plot({ x: {domain: selection}, marks: }). The developer must force Plot to use allData for both layers, while only passing the selection variable to the x.domain property.   

Plot's entire architecture is opinionated and defaults to Stateful/Domain Zoom. The reactive dataflow paradigm of the Observable platform  is semantically identical to the TEP's "Stateful/Domain" zoom concept. Conversely, the "Static/Visual" zoom breaks this paradigm, as the plot must be re-rendered (by passing the new domain) without changing its core data dependency. This is possible but awkward and fragile. Therefore, translating the "Static/Visual" TEP trait to Plot results in high semantic drift.   

3.0 Semantic Drift in Ancillary TEP Trait Translation
This section explores other critical translation mismatches identified during research, focusing on the "metadata" and "compositional" traits of the TEP.

3.1 Type System Portability (TEP Trait: requires: {type: 'temporal'})
This tests the TEP's requires clause, which functions as its formal type system, ensuring data fields are interpreted correctly (e.g., as dates, numbers, or categories).

3.1.1 Vega-Lite Translation (High Fidelity)
Vega-Lite's API requires explicit type assertion. The type property (e.g., "quantitative", "temporal", "ordinal", or "nominal") is a required property for encoding fields in most cases.   

Example: {"field": "date", "type": "temporal"}.   

This explicit type system is an advantage for TEP translation. A formal TEP will have a formal type system. Vega-Lite's grammar also has a formal, explicit type system. This allows for a 1:1, low-friction mapping. TEP requires: {field: "date", type: "temporal"} maps directly to the VL JSON, and the VL runtime will enforce this type coercion.   

3.1.2 Observable Plot Translation (Total Semantic Drift)
Observable Plot's API infers data types from the data itself. This creates a critical point of failure in the translation. As  explicitly warns in its "Plot for D3 Users" guide: "A number or date stored as a string will be rendered like a string."   

This represents a total semantic drift. If the TEP specifies a field is temporal, but the raw data source provides it as a string (e.g., "2023-01-01"), Plot will infer "string" and fail to render a time-series chart, instead producing a categorical axis.   

The TEP-to-Plot compiler cannot enforce the type in the Plot.plot call. Instead, it must translate the TEP's declarative type metadata into an imperative execution step. It must generate pre-processing JavaScript code (e.g., const typedData = data.map(d => ({...d, date: new Date(d.date)}))) and then pass this newly manufactured typedData variable to Plot. This is a high-friction, high-drift translation that moves a core TEP concept from the realm of metadata to the realm of imperative scripting.

3.2 Data-Source Collision (TEP Trait: Cross-Layer Tooltips)
This scenario tests a TEP trait for compositional interactions. In a layered chart (e.g., a scatterplot with a layered trendline), the TEP specifies a tooltip that, upon hovering a point on the scatterplot, displays data from both the point and the corresponding value from the trendline. This implies a "cross-layer" or "cross-source" data lookup at interaction time.

3.2.1 Vega-Lite Translation (Hard Collision / Workaround Required)
This TEP trait is semantically incompatible with Vega-Lite's core data model. VL's layer operator allows composing views , but its tooltip system works on a per-mark, per-layer basis. The tooltip handler for the point layer is scoped to the data object of that specific point; it has no mechanism to query or look up data from the separate regression layer.   

The Solution : The data must be unified before rendering. This requires the TEP compiler to inject a complex transform block. This block must use the pivot transform to merge the scatterplot data and the regression data into a single, wide data source, grouped by a common key (e.g., date).   

Example Transform: {"transform": [{"pivot": "layer_name", "value": "value", "groupby": ["date"]}]}.   

Result: The TEP's "cross-layer lookup" trait (which implies a "query-time" lookup) must be re-implemented as a "compile-time" data-unification step. This is a "hard collision" requiring a non-obvious, structural workaround.

3.2.2 Observable Plot Translation (Hard Collision / Workaround Required)
Observable Plot suffers from the exact same limitation. It features layered marks  and a tip mark for tooltips. However, as confirmed by , this model is also mark-scoped: "The tooltip by default would only show me the data for the single channel that I'm hovering."   

The Solution: The workaround is identical to Vega-Lite's, but imperative. The developer (or TEP-to-Plot compiler) must manually join, merge, or pivot the scatterplot data and the regression data in JavaScript before calling Plot.plot().

The fact that neither library can fulfill this TEP trait directly is a major finding. It reveals that both VL and Plot are "mark-scoped" in their interaction and data models. The TEP's desire for "view-scoped" or "cross-source" interactions is semantically misaligned with both targets. This suggests a potential flaw in the TEP's design, as it specifies a feature that is architecturally complex and non-performant in practice. The TEP should be revised to mandate the pre-pivoting of data as a pre-condition for this trait.

4.0 TEP Portability Mapping and Validation Framework
This section delivers the report's actionable artifacts: a detailed Portability Mapping Table to guide engineering efforts for 'mission-dv-5-portability-translation' and a formal proposal for a validation framework to ensure translation correctness.

4.1 The Portability Mapping Table
The following table synthesizes the findings from Sections 1-3 into a tactical, trait-by-trait guide. It serves as a "Rosetta Stone" for TEP compilation, mapping the Abstract (TEP Trait) to the Concrete (VL/Plot code) and providing a Risk Assessment (Semantic Drift).

Table 4.1.1: TEP Portability and Semantic Drift Mapping

TEP Trait / Stage	TEP Definition (Abstract)	Vega-Lite Translation (JSON)	Observable Plot Translation (JavaScript)	Semantic Drift & Implementation Guidance
Data Ingestion	A declarative pointer to a data source (e.g., URL or inline name).	
{"data": {"url": "..."}} or {"data": {"values": [...]}} 

const data = await d3.csv("...") Plot.plot({ marks: [Plot.dot(data)] }) 

VL: Low. 1:1 mapping. VL's runtime handles data loading. Plot: High. TEP trait is not "translated"; it is replaced by imperative JS data-loading code external to the plot definition. TEP compiler must generate this surrounding code.
Type System	A metadata clause requiring a field to be treated as a specific type. requires: {field: "date", type: "temporal"}	
{"field": "date", "type": "temporal"} 

const typedData = data.map(d => ({...d, date: new Date(d.date)})) Plot.plot({ marks: }) 

VL: Low. 1:1 mapping. VL's explicit, required typing is a direct match for TEP's formal type system. Plot: High (Total Drift). TEP's metadata is translated into an imperative data-wrangling script to pre-process the data. Plot's type inference  is a source of failure if data is not clean.

Transform: Filter-then-Aggregate	Filter source data, then aggregate the results.	
{"transform": [{"filter":...}], "encoding": {"y": {"aggregate": "mean",...}}} [3, 28]

Plot.rectY(data.filter(d =>...), Plot.groupX({y: "mean"},...)) 

VL: Low. 1:1 mapping to VL's rigid 2-stage pipeline. The logic is declarative and enforced by the VL runtime. Plot: High. TEP's declarative intent is lost. Must be imperatively re-implemented in JS, shifting logic to the developer. TEP compiler must generate correct functional-composition code.
Transform: Aggregate-then-Filter	Aggregate source data, then filter the results of the aggregation.	
{"transform": [{"aggregate":..., "groupby": [...]}, {"filter": "datum.result > X"}]} 

const aggregated = d3.rollups(...); const filtered = aggregated.filter(...); Plot.barY(filtered,...) 

VL: Low. 1:1 mapping to VL's ordered transform array. The sequence is declarative and guaranteed. Plot: High. Requires complex JS composition or, more idiomatically, data pre-processing outside the Plot.plot call.
Interaction: 'Static/Visual' Zoom	Zoom changes only the axis domain. Layered transforms (e.g., trendline) are not re-calculated.	
{"params": [{"name": "brush",...}], "encoding": {"x": {"scale": {"domain": {"param": "brush"}}}}} 

Plot.plot({ x: {domain: selection}, marks: }) 

VL: Low. 1:1 mapping. VL's grammar natively supports this by binding the interaction parameter to the scale, not the data. Plot: High. This is non-idiomatic. It fights Plot's reactive re-render model , requiring the developer to manually "pin" the allData source to the layers.

Interaction: 'Stateful/Domain' Zoom	Zoom filters the data source. Layered transforms (e.g., trendline) are re-calculated.	
{"params": [{"name": "brush",...}], "transform": [{"filter": {"param": "brush"}}]} 

filteredData = allData.filter(...) Plot.plot({ marks: }) [11, 33]

VL: Low. 1:1 mapping. The parameter is bound to a filter. Plot: Low. This is the idiomatic, default behavior of the Plot/Observable ecosystem. The TEP trait maps perfectly to the intent of the host architecture.

Interaction: Cross-Layer Tooltip	Tooltip on Layer 1 (e.g., point) shows data from Layer 2 (e.g., regression).	
{"transform": [{"pivot": "layer_name", "value": "value", "groupby": [...]}]... "tooltip": [...]} 

const mergedData = myJoin(points, regression); Plot.plot({ marks: })	
VL/Plot: Hard Collision. The TEP trait is semantically incompatible with both libraries' mark-scoped interaction models. Requires a mandatory, complex data-unification transform as a pre-processing step. The TEP specification should be revised to reflect this constraint.

  
4.2 A Proposed Semantic Validation Framework
Given the identification of significant semantic drift, particularly in the TEP-to-Plot translation, a formal methodology is required to prove that a TEP-to-Library translation is correct. A simple unit test of the compiler is insufficient; the validation must test the output of the compiler, both statically and dynamically.

4.2.1 Specification-Level Validation (Static Analysis)
Applicability: TEP-to-Vega-Lite.

Methodology: This approach validates the JSON output of the TEP-to-VL compiler. It uses "semantically aware" diff tools for tree-like structures  rather than simple text-based diffing.   

Implementation:

A "golden set" of TEP specifications is created, representing key traits and collisions.

A corresponding "golden set" of hand-authored, known-good Vega-Lite specifications is created.

The TEP-to-VL compiler is executed against the TEP set.

The compiler's output JSON is programmatically compared against the "golden VL set" using a tool like Graphtage.   

Rationale: Standard text-based diff utilities are unreliable for comparing JSON, as differences in key order or whitespace will cause false negatives, even if the files are semantically identical. A tool like Graphtage is semantically aware of JSON's (unordered) dict structure and can validate that the logical structure of the compiled VL spec is identical to the golden set, ignoring cosmetic differences. This validates the compiler logic itself.   

4.2.2 Render-Level Validation (Dynamic Analysis)
Applicability: TEP-to-Vega-Lite and TEP-to-Observable-Plot.

Methodology: This approach validates the final rendered output and interactive behavior of the compiled specification. It uses a visual regression testing framework to analyze the rendered SVG and simulate user interactions.   

Implementation :   

A test runner, such as Cypress, is used to load a web page containing the rendered visualization (either VL or Plot).

Cypress commands are used to functionally test the chart's structure, ensuring it has fully rendered before testing. This is critical for dynamic or animated charts (e.g., cy.get('g.dataset-0 rect').should('have.length', 4)).   

Cypress commands are used to trigger interactions, simulating user input (e.g., cy.trigger('mousemove') to test tooltips , or programmatically controlling a d3-brush ).   

A visual regression plugin (e.g., Applitools  or a perceptual diff tool ) is used to take a DOM snapshot of the specific chart element (e.g., cy.eyesCheckWindow({selector: '.chart'})). This snapshot is compared against a pre-approved "baseline" image.   

Rationale: This is the only universally applicable validation method and the only way to test the TEP-to-Plot translation.

For Plot, it validates the result of the "black box" of generated JavaScript.

For both libraries, it is the only way to catch semantic drift in the final render (e.g., bugs in scaling, layout, or projection logic) that would not be visible in the JSON spec.

Critically, by taking a snapshot after a simulated interaction (e.g., post-brush), this framework can objectively prove that the TEP's "Stateful vs. Static" zoom trait was correctly translated. The test can assert that the d attribute of a trendline's SVG <path> element did or did not change, providing objective, machine-readable proof of semantic correctness.   


vega.github.io
Overview - Vega-Lite
Opens in a new window

vega.github.io
A High-Level Grammar of Interactive Graphics - Vega-Lite
Opens in a new window

vega.github.io
Transformation | Vega-Lite
Opens in a new window

observablehq.com
Plot & Vega-Lite / Observable | Observable
Opens in a new window

news.ycombinator.com
As soon as I saw this, I thought: 'how is this different from vega lite'. An ans... | Hacker News
Opens in a new window

observablehq.com
Plot for D3 Users / Observable | Observable
Opens in a new window

vega.github.io
Selection Parameters | Vega-Lite
Opens in a new window

vega.github.io
Interactive Plots with Selections | Vega-Lite
Opens in a new window

stackoverflow.com
Scale domain vs filter selection in vega-lite: automatic axis scaling - Stack Overflow
Opens in a new window

observablehq.com
Transforms | Plot - Observable
Opens in a new window

observablehq.com
Use linked brushing to explore patterns across dimensions, space ...
Opens in a new window

vega.github.io
Type - Vega-Lite
Opens in a new window

talk.observablehq.com
Showing combined data in tooltip for stacked plots - The Observable Forum
Opens in a new window

stackoverflow.com
How to get 'tooltip' information from two separate layers in Vega-Lite ...
Opens in a new window

observablehq.com
Introduction to Vega-Lite / UW Interactive Data Lab | Observable
Opens in a new window

vega.github.io
View API | Vega
Opens in a new window

vega.github.io
Documentation - Vega
Opens in a new window

vega.github.io
Vega – A Visualization Grammar
Opens in a new window

vega.github.io
Data | Vega
Opens in a new window

vega.github.io
Data - Vega-Lite
Opens in a new window

vega.github.io
Transformation - Vega-Lite
Opens in a new window

vega.github.io
Aggregation | Vega-Lite
Opens in a new window

vega.github.io
Regression | Vega-Lite
Opens in a new window

observablehq.com
Reshaping data for visualizations with D3 and Observable Plot
Opens in a new window

observablehq.com
Plot Cheatsheets - Transforms - Observable
Opens in a new window

vis4.net
Review of Observable Plot - vis4.net
Opens in a new window

d3js.org
d3-brush | D3 by Observable - D3.js
Opens in a new window

vda-lab.github.io
Filter and aggregate | Data Visualisation in Data Science
Opens in a new window

stackoverflow.com
Filtering an aggregated chart with another aggregation field - Stack Overflow
Opens in a new window

vega.github.io
Vega-Lite View Specification
Opens in a new window

vega.github.io
Interactive Plots with Selections | Vega-Lite
Opens in a new window

observablehq.com
Interaction / UW Interactive Data Lab | Observable
Opens in a new window

observablehq.com
Learning Observable: Observable Plot
Opens in a new window

vega.github.io
Type | Vega-Lite
Opens in a new window

vega.github.io
Composing Layered & Multi-view Plots | Vega-Lite
Opens in a new window

vega.github.io
Tooltip | Vega-Lite
Opens in a new window

vega.github.io
Mark - Vega-Lite
Opens in a new window

observablehq.com
Marks | Plot - Observable
Opens in a new window

observablehq.com
Interactions | Plot - Observable
Opens in a new window

youtube.com
How to elevate your data visualization with Observable Plot's Tooltips - YouTube
Opens in a new window

blog.trailofbits.com
Graphtage: A New Semantic Diffing Tool -The Trail of Bits Blog
Opens in a new window

dev.to
Diff JSON – A Complete Guide to Comparing JSON Data - DEV Community
Opens in a new window

glebbahmutov.com
Testing a chart with Cypress and Applitools | Better world by better ...
Opens in a new window

sourceforge.net
Perceptual Image Diff download | SourceForge.net
Opens in a new window

github.com
rtulke/pdiff: Perceptual Diff pdiff is an fast image comparison utility that makes use of a computational model of the human visual system to compare two images. - GitHub
Opens in a new window

w3.org
Document Structure — SVG 2
Opens in a new window

arxiv.org
An SVG Chart Corpus with Fine-Grained Semantic Labels - arXiv
