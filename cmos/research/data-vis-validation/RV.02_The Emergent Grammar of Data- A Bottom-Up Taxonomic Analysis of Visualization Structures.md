The Emergent Grammar of Data: A Bottom-Up Taxonomic Analysis of Visualization Structures
1. Introduction: The Necessity of Blind Categorization
The classification of data visualization has traditionally been an exercise in semantic labeling. Taxonomies have historically been constructed "top-down," driven by the intended utility of the graphic—grouping charts by whether they show a "distribution," a "comparison," or a "relationship." While functional for a novice selecting a chart type, this approach fails to capture the fundamental structural and phylogenetic relationships between visualization forms. It is akin to classifying animals by whether they fly (grouping bats with birds and insects) rather than by their genetic and skeletal architecture. To truly understand the mechanics of visual communication, we must adopt a "bottom-up" approach, conducting a "blind categorization" of the corpus based strictly on observable visual and functional properties.   

This report presents a comprehensive, emergent taxonomy derived from a granular analysis of a diverse corpus of visualization types ranging from standard rectilinear charts to complex algorithmic flows like Streamgraphs and high-dimensional glyphs like Chernoff Faces. "Blind categorization," in this research context, functions as a methodological constraint: we ignore the common names of charts (e.g., "Bar Chart" vs. "Histogram") and instead analyze them as collections of geometric primitives—marks, channels, coordinate systems, and retinal variables. By deconstructing these visualizations into their atomic grammatical units, we reveal hidden structural kinships and expose the sources of ambiguity that plague modern information design.   

1.1 The Theoretical Imperative: Bottom-Up vs. Top-Down
The distinction between bottom-up and top-down methodologies is not merely procedural; it is epistemological. The research context provided highlights this dichotomy in fields as varied as peace education and biological omics. In peace building, top-down approaches (agreements imposed by leaders) often collapse because the "ground below has not been prepared," whereas bottom-up approaches build capacity from the community level, breaking down stereotypes through the recognition of individual properties. Similarly, in molecular biology, "bottom-up molecular approaches" (genomics, proteomics) provide the foundational data necessary to understand complex biological rewiring, whereas top-down views can be myopic.   

Applying this lens to data visualization, a top-down view sees a "Pie Chart" and a "Donut Chart" as two distinct choices in a menu. A bottom-up view, however, sees a single topological genus—the Radial Area Encoding—where the Donut is simply a variation with a modified inner radius (r 
min
​
 >0). This shift in perspective is critical for identifying "hard-to-classify" instances  and "ambiguous" structures  that defy simple labeling. For instance, is a Horizon Chart a line chart or an area chart? Top-down taxonomies struggle with this hybridity; bottom-up analysis resolves it by identifying the specific combination of "slicing" and "layering" operations performed on a continuous time-series signal.   

1.2 Defining the Observable Properties
To execute this blind categorization, we must define the specific "observable properties" that serve as the axes of our taxonomy. Drawing from the "Grammar of Graphics" framework and semiotic theory, we isolate the following structural variables:

Coordinate System: The mathematical space in which the visualization exists. The primary divide is between Cartesian (x,y), Polar (r,θ), and Flux/Force-Directed systems.   

Mark Type: The fundamental geometric object used to represent a data point—Point, Line, Area, or Glyph.   

Encoding Channels: The visual attributes of the mark that are bound to data values. These include Position, Length, Angle, Area, Curvature, Color (Hue/Saturation), and Texture.   

Topological Connectivity: Whether the marks are discrete (independent items) or connected (implying flow, hierarchy, or sequence).   

Data Density and Aggregation: Whether the visualization displays raw "units" (Unit Viz) or aggregated statistics (Bar Chart), and the degree of data compression (e.g., Horizon Charts).   

Through the rigorous application of these criteria, we generate an "emergent category structure"  that groups visualizations into five distinct "Clades" or evolutionary families. This structure reveals that the most effective visualizations—such as Minard's Map of Napoleon's Campaign—are often those that defy simple categorization, acting as "hybrid" organisms that seamlessly blend grammars from multiple clades. The following sections detail these clades, analyzing the specific mechanics, advantages, and ambiguities of each.   

2. Clade I: Rectilinear-Linear Aggregates
The first and most foundational clade identified in the corpus is the family of Rectilinear-Linear Aggregates. These visualizations share two immutable properties: they exist in a Cartesian coordinate system (orthogonal x and y axes) and they utilize linear extent (length or position) as the primary encoding channel for quantitative magnitude. While top-down taxonomies distinguish between "Bar Charts," "Column Charts," "Bullet Charts," and "Slope Graphs," blind categorization reveals them to be structural variations of a single archetype: the linear magnitude comparator.

2.1 The Architecture of the Bar and the Bullet
The Bar Chart is the simplest expression of this clade. A nominal scale (categories) is mapped to one axis, and a ratio scale (quantities) is mapped to the other. The "Mark" is a rectangle, but its significant visual property is length. The width of the bar is non-informative in the standard form.   

The Bullet Chart, often treated as a specialized dashboard widget, is revealed through bottom-up analysis to be a High-Density Layered Bar Chart. Developed to replace the space-inefficient gauge, the Bullet Chart encodes multiple data points onto a single linear track using layer superposition (z-ordering).   

The Feature Measure: A central, dark bar represents the actual metric (e.g., current revenue).

The Comparative Measure: A perpendicular line segment (symbol mark) represents the target or benchmark.   

The Qualitative Context: The background is divided into shaded bands (e.g., gray scales) representing qualitative ranges (Poor, Satisfactory, Good).   

From a grammatical perspective, the Bullet Chart is a "composite mark." It combines a stacked bar (the background ranges) with a standard bar (the measure) and a point marker (the target) into a single coordinate unit. This layering allows the viewer to perform complex boolean logic—Is the value above the target? Is it in the 'good' zone?—without the eye movements required by side-by-side bar charts. The corpus notes that this structure "saves space and reduces visual clutter" by compressing comparative context into the linear footprint of the data itself. It is a "hybrid" only in the sense that it mixes mark types (bar + line + area), but it remains firmly rooted in the linear encoding logic of Clade I.   

2.2 The Visualization of Delta: Dumbbell and Slope Graphs
A distinct sub-group within Clade I abandons the "distance from zero" encoding of the bar chart to focus exclusively on the difference (delta) between two states. This includes the Dumbbell Chart (Connected Dot Plot) and the Slope Graph.

The Dumbbell Chart: Visually, this chart consists of two point marks connected by a line segment. The position of the points encodes the values of two variables (e.g., 2020 Sales vs. 2021 Sales), while the length of the connecting line encodes the absolute difference.   

Structural Efficiency: By removing the "bar" that connects the value to the zero-line, the Dumbbell chart drastically reduces the "data-ink ratio" (a concept linked to Tufte in the literature), allowing the viewer to focus purely on the gap between the two states.   

Contextual Application: The snippets highlight its utility in sports analytics (Home vs. Away performance) and pre-post intervention studies. It is effectively a "Minimally Connected Scatterplot" constrained to one dimension of variation.   

The Slope Graph: When the two data points of a Dumbbell chart are separated onto parallel vertical axes (Time 1 and Time 2) and connected by a line, the visualization transforms into a Slope Graph.   

Encoding Shift: The primary perceptual attribute shifts from "length of gap" to "slope of line." A steep slope indicates a rapid rate of change; a flat line indicates stability.   

The Parallel Coordinates Connection: Blind categorization identifies the Slope Graph as the "atomic unit" of the Parallel Coordinates Plot. A Parallel Coordinates plot is simply a chain of multiple Slope Graphs sharing axes (Axis 1 → Axis 2 → Axis 3...). This reveals a deep structural link: complex high-dimensional visualizations like Parallel Coordinates are built from the same grammatical primitives as the simple Slope Graph. They are "overgrown slope plots," as noted in snippet , utilizing the same "line-crossing" logic to reveal correlations (parallel lines = positive correlation; crossing lines = negative correlation).   

2.3 The Ambiguity of the Horizon Chart
The Horizon Chart presents a significant classification challenge. Is it a Line Chart (Clade I) or an Area Chart (Clade II)? The corpus describes it as a technique that "splits and superimposes a line chart vertically".   

The Mechanism of Slicing: The Horizon Chart takes a time-series line, divides the y-axis into equal bands (e.g., 0-50, 50-100, 100-150), and then collapses them onto a single baseline. Higher values are represented by darker color saturation or different hues.   

Taxonomic Resolution: While it uses area fill to distinguish bands, its primary function is to preserve the linear resolution of a time series in a compressed vertical space. The "mirroring" of negative values (flipping them up and coloring them red, for instance) creates a high-density "signal" visualization. Therefore, it is best classified as a Compressed Linear Aggregate, existing at the boundary of Clade I and Clade II. It leverages the "pre-attentive" processing of color intensity to allow the eye to spot peaks in a dense data stream.   

3. Clade II: Rectilinear-Area Encodings and Partitioning
The second major clade shifts the primary encoding channel from 1D Length to 2D Area. In these visualizations, the value of a data point is represented by the surface area (width×height) of a shape within a Cartesian boundary. This shift introduces significant perceptual challenges, as human cognition is less adept at judging area differences than length differences.   

3.1 The Mosaic and Marimekko: Bivariate Area Logic
The Marimekko Chart (also known as the Mekko or Mosaic Plot) represents the evolution of the stacked bar chart into two dimensions. In a standard stacked bar, the width of the bar is fixed and meaningless. In a Marimekko, the width of the column scales to represent a second variable.   

Structural Mechanics: The chart is a unit square (or rectangle) partitioned into smaller rectangles. The height of a segment represents the percentage share of a sub-category, while the width of the column represents the total volume of the primary category.   

Observable Property: The total area of each segment represents the absolute value of that intersection (e.g., Market Share % × Total Market Size = Revenue).

Ambiguity and "Hard-to-Classify" Status: The research identifies a persistent confusion between "Marimekko Charts" and "Mosaic Plots." Visually, they are identical—tiled rectangles of varying aspect ratios. However, functional blind categorization reveals a distinction in data constraints. A true Mosaic Plot is used for visualizing contingency tables and statistical independence; if the variables are independent, the tiles align in a grid. A Marimekko is a more general business chart for segmentation. The corpus notes that Marimekko charts are "hard to read" because they generate segments with widely varying aspect ratios (tall/thin vs. short/wide), which are notoriously difficult for the human eye to compare.   

3.2 Treemaps: The Topology of Containment
The Treemap is the hierarchical sibling of the Marimekko. Both fill a rectangular space with smaller rectangles. However, where the Marimekko is a "matrix" (Row × Column), the Treemap is a recursive "nest" (Parent ⊃ Child ⊃ Grandchild).   

Algorithmic Tiling: Treemaps rely on algorithms like "squarified" tiling to generate rectangles that are as close to squares as possible, minimizing the aspect ratio problem found in Marimekkos.   

Circle Packing (The "Circle Treemap"): A variation identified in the corpus is Circle Packing, which maps the same hierarchical containment data into nested circles.   

Trade-off: The Circle Packing visualization introduces "negative space" (the empty voids between circles), which makes it less space-efficient than the rectangular Treemap. However, circles are often perceived as more organic and distinct, potentially aiding in the recognition of clusters. This demonstrates a trade-off between Data Density (Treemap) and Cluster Recognition (Circle Packing).   

3.3 The Ambiguity of Stacked Area Charts
The Stacked Area Chart sits on the border of this clade. It is constructed by stacking line charts (Clade I), but the resulting visual object is a filled area. The magnitude of a category at any point in time is represented by the vertical height of its colored band.   

Bottom-Up Insight: Unlike the Marimekko, the Stacked Area chart implies continuous change over time. It shares the "part-to-whole" logic of the Treemap but applies it to a continuous x-axis. This creates potential readability issues, as the baseline for the upper layers is constantly shifting, making it difficult to judge the pattern of any series other than the bottom one. This limitation drives the evolution toward the Streamgraph (discussed in Clade IV).

4. Clade III: Polar and Cyclic Encodings
This clade represents a fundamental shift in the "canvas" of the visualization: the move from Cartesian (x,y) to Polar (r,θ) coordinates. This transformation is not merely aesthetic; it fundamentally alters the mathematical relationship between the data and the visual mark, introducing "non-linear" distortions that are critical to understanding visual perception.

4.1 The Geometry of the Circle: Pie and Donut Charts
The Pie Chart is the most recognizable member of this clade. It encodes data as angles at the center of a circle, which translates perceptually to arc lengths on the perimeter and sector areas.   

The Donut Ambiguity: The Donut Chart is visually distinct due to its empty center but structurally identical to the Pie Chart in terms of data encoding. The corpus notes that the hole "frees up space for extra information" (icons, totals) but removes the central angle as a visual cue.   

Perceptual Consequence: By removing the center, the Donut chart forces the user to rely almost exclusively on Arc Length. This makes it slightly harder to estimate proportions compared to a Pie Chart, where the angle is visible. However, the corpus suggests that for "simple part-to-whole messages," the Donut is a viable stylistic alternative that reduces visual weight.   

The Semicircle Donut: A variation mentioned is the "Half Moon" or Semicircle Donut, which serves the same function but on a 180 
∘
  scale. This linearizes the bottom edge, potentially aiding in alignment with other page elements.   

4.2 The Nightingale Rose: The Danger of Radial Area
Florence Nightingale's "Rose Diagram" (or Polar Area Diagram) is a critical case study in the taxonomy of observable properties. It is often confused with a Pie Chart, but its geometry is fundamentally different.

Pie Chart: Constant Radius (r), Variable Angle (θ).

Rose Chart: Constant Angle (θ), Variable Radius (r).   

The Squaring Effect: The most profound insight from the blind categorization of the Rose Chart is the mathematical distortion inherent in its construction. Because the data value controls the radius, but the visual impact is determined by the area of the wedge, the visual magnitude scales with the square of the data (Area∝r 
2
 ).   

Implication: A value that is twice as large as another will appear four times larger in a Rose Chart. Snippet  explicitly notes that this "exaggerates the proportional size of data." While Nightingale used this effectively to dramatize the scale of preventable deaths in the Crimean War , from a strict data fidelity perspective, it introduces a massive error unless the radius is scaled by the square root of the value.   

Taxonomic Placement: This places the Rose Chart in a distinct "Radial-Proportional" category. It acts more like a "Circular Bar Chart" than a Pie Chart, but with the added peril of quadratic scaling.

4.3 Spiral Plots: Visualizing Periodicity
The Spiral Plot utilizes the polar coordinate system to solve a specific problem: the visualization of periodic time-series data.

The Archimedean Mechanic: The time axis is mapped to an Archimedean spiral (r=a+bθ). As the spiral winds outward, it aligns temporal cycles (e.g., 24-hour periods) along radial vectors.   

Functional Insight: This alignment allows the viewer to detect patterns that repeat at specific intervals (e.g., a spike in server load every day at 9:00 AM) which would be visually separated by "flat" stretches in a linear line chart.   

Emergent Categorization: Blind categorization groups Spiral Plots with Radar Charts (Spider Charts) in a "Cyclic-Temporal" sub-clade. Both use radial alignment to compare cycles. However, the Spiral Plot creates a Continuous Time Manifold, whereas the Radar Chart typically compares Discrete Categories or fixed time points (e.g., monthly sales). The Spiral is highlighted in the corpus as being particularly useful for "high-dimensional time series" and detecting "cyclical patterns, trends, and deviations".   

5. Clade IV: Flow, Connection, and Continuous Dynamics
This clade departs from the static representation of values (magnitude/proportion) to focus on the relationships, transitions, and flows between entities. The primary marks here are links, ribbons, and bands that connect nodes or flow through a coordinate system.

5.1 The Physics of Flow: Sankey and Chord Diagrams
Sankey Diagrams are defined by the Conservation of Width. The width of the link (flow) is directly proportional to the quantity of the flow.   

Observable Property: The sum of the widths of the inflow arrows at a node must equal the sum of the widths of the outflow arrows (assuming no loss). This visual physics makes the Sankey ideal for visualizing "energy transfers," "material flows," or "process stages" (e.g., student answer patterns).   

Chord Diagrams: The Chord Diagram is the radial equivalent of the Sankey. Entities are arranged on the periphery of a circle, and relationships are drawn as arcs (chords) crossing the interior.   

Structural Comparison: Like the Sankey, the width of the chord represents the relationship strength (e.g., migration volume, trade value). However, the circular layout emphasizes the inter-connectedness of a closed group (e.g., trade between all G20 nations), whereas the Sankey emphasizes directional progress from stage A to stage B.   

Optimization: The corpus notes that Chord diagrams are ideal for "comparing similarities within a dataset" or "gene interactions," utilizing the central space to show the density of connections.   

5.2 Streamgraphs: The Organic River
The Streamgraph is a specialized, algorithmic evolution of the Stacked Area Chart (Clade II) that abandons the rigid x-axis baseline.   

The "ThemeRiver" Layout: Instead of stacking layers from y=0 upwards, the Streamgraph stacks them around a central, fluctuating baseline. This creates a flowing, organic shape that mimics a river.   

Perceptual Trade-off: The corpus highlights a fierce debate regarding this form. It is described as "sexy" and aesthetically engaging but "hard to read" for precise values because the baseline for every layer is moving.   

Taxonomic Insight: The Streamgraph prioritizes the Trend of the Whole and the Relative Swell of the parts over the precise magnitude of any single layer. It belongs to the "Continuous Flow" sub-clade, sharing the organic aesthetic of the Sankey but applied to a continuous time-series domain. It excels at showing "shifts over time" in complex datasets (e.g., unemployment across 20 industries) where a standard line chart would be a tangled mess of "spaghetti".   

5.3 The Minard Map: The "Super-Hybrid"
No discussion of flow and connection is complete without analyzing Charles Minard’s Map of Napoleon’s Russian Campaign, which appears repeatedly in the corpus as a benchmark of visualization.   

Deconstruction of a Hybrid: Minard’s map is not a single chart type; it is a complex composite that defies simple classification.

Channel 1 (Line Width): Encodes the size of the army (Clade IV - Flow).

Channel 2 (Color): Encodes the direction of movement (Advance vs. Retreat) (Clade I/IV).

Channel 3/4 (X/Y Position): Encodes geography (Cartesian/Map).

Channel 5 (Line/Text): The bottom chart encodes temperature over time (Clade I - Line Chart).   

The Lesson of Integration: Minard’s map demonstrates that the most powerful visualizations often break taxonomic boundaries. It fuses a Flow Map (Sankey logic) with a Time-Series Line Chart and a Geospatial Plot. This integration allows it to tell a "multivariate story" of cause and effect (temperature drop → army shrinkage) that no single chart type could convey.   

6. Clade V: Unit, Glyphic, and High-Dimensional Representations
This final clade abandons the aggregation of data into abstract bars or lines. Instead, it maintains the identity of individual data points or utilizes complex metaphoric glyphs to encode high-dimensional data.

6.1 Isotype and the Return of the Unit
Isotype (International System of Typographic Picture Education) visualization is defined by the repetition of countable units. Instead of a bar of length 10, an Isotype chart displays 10 icons, each representing a distinct quantity (e.g., 1 icon = 1 million people).   

The "Neurath" Legacy: Developed by Otto Neurath and Marie Reidemeister, Isotype was a socially conscious design language intended to make statistical facts accessible to the masses ("Statistics and Proletariat").   

Grammar of Graphics Exception: The literature notes that Unit Visualizations like Isotype "don't neatly fit into most grammars of graphics" because they involve a "multiplication" operation—generating multiple marks from a single data value—rather than a simple mapping.   

Cognitive Engagement: Research suggests that "Constructive" visualizations like Isotype (and its abstract cousin, the Dot Plot) can improve memory and engagement because they force the user to "construct" the meaning by observing the constituent units.   

6.2 Chernoff Faces: Biological Encoding
Chernoff Faces represent a radical experiment in high-dimensional encoding. They map multivariate data to the features of a human face (e.g., Eye Size = Variable A, Mouth Curve = Variable B, Eyebrow Angle = Variable C).   

The Biological Hypothesis: The design exploits the human brain's specialized, pre-attentive capacity for facial recognition (fusiform face area) to detect patterns and outliers in complex datasets.   

The "Emotive" Bias: While theoretically sound, blind categorization reveals a flaw: the encoding channels are not perceptually equal. A "frown" (mouth curve) carries a strong emotional signal that may overshadow a subtle change in "eye spacing." The corpus notes that this can lead to "false assumptions" or biased interpretations, as the face is read as a gestalt (e.g., "sad face") rather than a collection of data points. This makes Chernoff Faces a "Metaphoric Glyph" that is powerful but dangerous.   

6.3 High-Dimensional Glyphs in Practice
The Star Plot and Radar Chart (discussed in Clade III) can also be seen as glyphs. When small multiples of Radar Charts are used to compare entities (e.g., sports teams), each chart becomes a "glyph" representing that entity's multi-dimensional footprint. This highlights the fluidity of the taxonomy: a Radar Chart is a chart when used singly, but becomes a glyph when used as a mark within a larger "Small Multiples" display.   

7. Synthesis: Emergence, Ambiguity, and the Future of Visual Language
The blind categorization process undertaken in this report yields a critical insight: the boundaries between visualization types are not rigid walls but continuous gradients. The "Taxonomy of Observable Properties" reveals that chart types often morph into one another through the manipulation of a single variable.

7.1 The Continuum of Form
Bar → Bullet → Box Plot: These are distinct only in their level of aggregation and contextual layering. The Bullet Chart is simply a Bar Chart with a "contextual background layer."

Slope Graph → Parallel Coordinates: A Slope Graph is a Parallel Coordinates plot with n=2 axes. Adding a third axis does not create a new "type" of chart; it merely extends the existing grammar.   

Pie → Donut → Gauge: The Donut is a Pie with r 
inner
​
 >0. The Gauge is a Donut with θ 
total
​
 <360 
∘
 .

7.2 The Role of Ambiguity
The "ambiguity" cited in the research  is often a signal of hybridity. A chart that is "hard to classify" (e.g., the Horizon Chart) is usually one that has optimized a specific trade-off (e.g., density vs. precision) by borrowing features from multiple clades (Line + Area).   

Taxonomic Recommendation: Future automated classification systems (like the "CLIMB" framework mentioned in ) should not attempt to bin these charts into rigid categories. Instead, they should classify them by their feature vector: ``. This "bottom-up" feature approach allows for the description of novel, generative visualizations that have no common name.   

7.3 Data-Driven Generation
The implications of this bottom-up taxonomy extend to Automated Insight Generation and Generative AI. As noted in the snippets regarding "Ambiguity in Graph Layouts"  and "Text-to-Viz" ambiguities , a system that understands the grammar of graphics (e.g., "this data requires a cyclical encoding") is far more robust than one that simply picks from a list of templates. The "Sankey" is not just a template; it is the correct topological answer to the question of "flow conservation." The "Spiral" is the correct geometric answer to "periodic time series."   

By adopting this structural, bottom-up view, we move beyond the "blind categorization" of static types and toward a dynamic understanding of visualization as a language—a language where new "words" (chart types) can be constructed from the fundamental alphabet of marks, channels, and coordinates to suit the ever-evolving complexity of the data we seek to understand.

Table 1: The Emergent Taxonomy of Visualization Clades
Clade	Primary Observable Property	Coordinate System	Key Members (Corpus)	Primary Visual Channel	Structural & Functional Insight
I. Rectilinear-Linear	Linear Extent / Position	Cartesian (x,y)	Bar, Column, Bullet, Dumbbell, Slope	Length (l) / Position (x,y)	Optimized for precise magnitude comparison. Bullet Charts add contextual density via layering. Dumbbell/Slope focus on delta (Δ) by removing the zero-anchor.
II. Rectilinear-Area	2D Partitioning / Tiling	Cartesian (x,y)	Marimekko, Mosaic, Treemap, Circle Packing	Area (w×h)	Encodes two variables simultaneously. Marimekko visualizes segmentation; Mosaic visualizes statistical independence. Treemaps visualize hierarchical containment.
III. Polar-Cyclic	Radial Geometry	Polar (r,θ)	Pie, Donut, Nightingale Rose, Spiral, Radar	Angle (θ) / Arc (s) / Radius (r)	Best for periodic/cyclic data. Rose Charts suffer from quadratic area distortion (A∝r 
2
 ). Donut Charts trade angle cues for annotation space.
IV. Flow & Connection	Links / Ribbons / Bands	Cartesian or Radial	Sankey, Chord, Streamgraph, Arc Diagram	Width of Link (w)	Visualizes movement/transition. Sankey follows conservation of mass. Streamgraph visualizes organic trend/volume over continuous time.
V. Unit & Glyphic	Discrete Countable Marks	Any	Isotype, Dot Plot, Chernoff Faces, Star Plot	Count / Repetition / Shape	Maps data to identity. Isotype uses pictograms for cognitive engagement. Chernoff Faces exploit biological recognition but introduce emotive bias.
VI. Temporal-Density	Sliced / Layered Bands	Cartesian (Time)	Horizon Chart, Ridgeline Plot	Color Intensity / Vertical Offset	Horizon Chart compresses high-variance time series into small vertical space by slicing value ranges and overlaying them.
8. Conclusion: The "Ground Below"
Returning to the metaphor of peace education found in the opening of our research context: "Many top-down agreements collapse because the ground below has not been prepared". The same is true for data visualization. Top-down taxonomies that impose rigid labels often collapse when faced with the messy reality of complex, high-dimensional, or hybrid data. They fail to account for the "ground below"—the fundamental grammatical structures of marks and channels.   

This report’s bottom-up, blind categorization prepares that ground. It reveals that the Bullet Chart is not a unique species but a highly evolved Bar Chart; that the Spiral Plot is the necessary geometric response to Periodicity; and that the Nightingale Rose is a beautiful but dangerous distortion of radial math. By understanding these structural truths, we empower practitioners not just to choose charts, but to construct them—building visual arguments that are as nuanced and robust as the data they represent.


scribd.com
Intro To Peace Edu | PDF - Scribd
Opens in a new window

frontiersin.org
Top-down and bottom-up approaches to video quality of experience studies; overview and proposal of a new model - Frontiers
Opens in a new window

scribd.com
Principles of Brain Dynamics - Global State Interactions 2012 | PDF - Scribd
Opens in a new window

aclanthology.org
Identifying & Interactively Refining Ambiguous User Goals for Data Visualization Code Generation - ACL Anthology
Opens in a new window

researchgate.net
iPOP Goes the World: Integrated Personalized Omics Profiling and the Road toward Improved Health Care - ResearchGate
Opens in a new window

medium.com
Imbalanced Data Techniques Pros and Cons | by Esraa Ahmed - Medium
Opens in a new window

arxiv.org
TiVy: Time Series Visual Summary for Scalable Visualization - arXiv
Opens in a new window

hammer.purdue.edu
CROWDSOURCING GRAPHICAL PERCEPTION OF TIME-SERIES VISUALIZATION ON MOBILE PHONES - Purdue University Graduate School
Opens in a new window

arxiv.org
ggtime: A Grammar of Temporal Graphics - arXiv
Opens in a new window

mathresearch.utsa.edu
Part-to-part ratios & Part-to-whole ratios - Department of Mathematics at UTSA
Opens in a new window

pmc.ncbi.nlm.nih.gov
ATOM: A Grammar for Unit Visualizations - PMC - NIH
Opens in a new window

arxiv.org
Manipulable Semantic Components: a Computational Representation of Data Visualization Scenes - arXiv
Opens in a new window

info3312.infosci.cornell.edu
AE 01: Building a complicated, layered graphic using the grammar of graphics
Opens in a new window

observablehq.com
Data Types, Graphical Marks, and Visual Encoding Channels - Observable
Opens in a new window

researchgate.net
How Neural Networks Organize Concepts: Introducing Concept Trajectory Analysis for Deep Learning Interpretability - ResearchGate
Opens in a new window

cs.ubc.ca
Smart Intersection Visualization - UBC Computer Science
Opens in a new window

microsoft.com
A Unifying Framework for Animated and Interactive Unit Visualizations - Microsoft
Opens in a new window

knowledgehut.com
Time Series Data Visualization: Types, Techniques & Platforms - KnowledgeHut
Opens in a new window

andrewheiss.com
Exploring Minard's 1812 plot with ggplot2 - Andrew Heiss
Opens in a new window

observablehq.com
Data Visualization Glossary - Observable
Opens in a new window

docs.anychart.com
Bullet Chart | Basic Charts - AnyChart Documentation
Opens in a new window

fanruan.com
What is a Bullet Chart and How Does It Work
Opens in a new window

docs.cloud.google.com
Bullet chart reference | Looker Studio - Google Cloud Documentation
Opens in a new window

pass4sure.com
Creating Insightful Bullet Charts in Tableau: A Complete Exploration - Pass4sure
Opens in a new window

concordusa.com
Tableau 201: How to Make Bullet Graphs - Concord USA
Opens in a new window

psy652.colostate.edu
Data Visualization - Foundations in Data Science
Opens in a new window

s3.amazonaws.com
VitaraCharts User Guide - Amazon S3
Opens in a new window

medium.com
Creating Dumbbell Charts in R. And otheR stuff | by Harsh Krishna | Analytics Vidhya
Opens in a new window

homepage.divms.uiowa.edu
Visualizing Two Numeric Variables - College of Liberal Arts & Sciences, The University of Iowa
Opens in a new window

quanthub.com
Data Storytelling: Visualizing Comparisons - QuantHub
Opens in a new window

medium.com
Multiple Sorts. A Visualization Anti-Pattern | by Max Goldstein | Medium
Opens in a new window

arxiv.org
Which One Changes More? A Novel Radial Visualization for State Change Comparison
Opens in a new window

pmc.ncbi.nlm.nih.gov
an R package for visualizing data on spirals - PMC - PubMed Central
Opens in a new window

kclpure.kcl.ac.uk
Reclaiming the Horizon: Novel Visualization Designs for Time-Series Data with Large Value Ranges - King's College London Research Portal
Opens in a new window

g2.antv.antgroup.com
Nightingale Rose Chart | G2 The Concise and Progressive
Opens in a new window

datylon.com
80 types of charts & graphs for data visualization (with examples) - Datylon
Opens in a new window

jaspersoft.com
What is a Marimekko Chart? - Jaspersoft
Opens in a new window

en.wikipedia.org
Mosaic plot - Wikipedia
Opens in a new window

quanthub.com
Decoding the Visual Language of Data: A Guide to Chart Types that Show Composition
Opens in a new window

observablehq.com
Reshaping data for visualizations with D3 and Observable Plot
Opens in a new window

frontiersin.org
Toward a Taxonomy for Adaptive Data Visualization in Analytics Applications - Frontiers
Opens in a new window

surveymonkey.com
When And How To Use SurveyMonkey's Most Popular Chart Types
Opens in a new window

flerlagetwins.com
Tableau Coxcomb Chart Template - The Flerlage Twins
Opens in a new window

powerofbi.org
Florence Nightingale's Rose Diagram - Power of Business Intelligence
Opens in a new window

marketplace.microsoft.com
Spiral Plot By Office Solution - Microsoft Marketplace
Opens in a new window

2024.sci-hub.se
A Survey of Time Series Data Visualization Research - Sci-Hub
Opens in a new window

sai-mat-group.github.io
meutzner-psr-2018.pdf - SAI MATerials Group
Opens in a new window

escholarship.org
Proceedings of the Annual Meeting of the Cognitive Science Society, Volume 41
Opens in a new window

yusufadigun17968.medium.com
5 Visualization Tools Most Data Experts Don't Want You To Know About.
Opens in a new window

datavizcatalogue.com
[VIDEO] Expanding Your Data Visualisation Vocabulary
Opens in a new window

idl.uw.edu
2. Data Types, Graphical Marks, and Visual Encoding Channels
Opens in a new window

visualisingdata.com
Making sense of streamgraphs - Data Viz Excellence, Everywhere
Opens in a new window

idl.cs.washington.edu
Visualizing a Million Time Series with the Density Line Chart - University of Washington
Opens in a new window

hackmd.io
Visualizations and the grammar of graphics - HackMD
Opens in a new window

hh2022f.amason.sites.carleton.edu
Is Minard's Map the Best Statistical Graphic? - Hacking the Humanities 2022F
Opens in a new window

observablehq.com
Lesson 4: Presentation, Uncertainty, ISOTYPE - Observable
Opens in a new window

datavizblog.com
DataViz History: ISOTYPE Charts: The Vintage Visual Language That Gave Rise to Modern Infographics
Opens in a new window

jedem.org
Isotype Visualizations - eJournal of eDemocracy and Open Government
Opens in a new window

zcliu.org
Data-Driven Guides: Supporting Expressive Design for Information Graphics - Zhicheng Liu
Opens in a new window

ivmooc.cns.iu.edu
Atlas of Knowledge - IVMOOC - Indiana University
Opens in a new window

arxiv.org
Data Verbalisation: What is Text Doing in a Data Visualisation? - arXiv
Opens in a new window

arxiv.org
AmbiGraph-Eval: Can LLMs Effectively Handle Ambiguous Graph Queries? - arXiv
Opens in a new window

aclanthology.org
Building Data-Driven Occupation Taxonomies: A Bottom-Up Multi-Stage Approach via Semantic Clustering and Multi-Agent Collaboration
Opens in a new window

researchgate.net
(PDF) AmbiguityVis: Visualization of Ambiguity in Graph Layouts - ResearchGate