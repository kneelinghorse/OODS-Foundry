export type ChartType = 'bar' | 'line' | 'area' | 'scatter' | 'heatmap';
export type IntentGoal =
  | 'comparison'
  | 'trend'
  | 'composition'
  | 'part-to-whole'
  | 'relationship'
  | 'intensity'
  | 'distribution';
export type FieldType = 'quantitative' | 'temporal' | 'nominal' | 'ordinal';
export type DensityPreference = 'sparse' | 'dense' | 'flex';

export interface PatternField {
  readonly role: 'measure' | 'dimension';
  readonly type: FieldType;
  readonly name: string;
  readonly example: string;
  readonly description: string;
}

export interface PatternSchemaBlueprint {
  readonly structure: string;
  readonly description: string;
  readonly fields: ReadonlyArray<PatternField>;
  readonly derived?: ReadonlyArray<string>;
}

export interface RangeConstraint {
  readonly min: number;
  readonly max?: number;
}

export interface PatternHeuristics {
  readonly measures: RangeConstraint;
  readonly dimensions: RangeConstraint;
  readonly temporals?: RangeConstraint;
  readonly goal: ReadonlyArray<IntentGoal>;
  readonly stacking?: 'required' | 'preferred' | 'avoid';
  readonly matrix?: boolean;
  readonly concatPreferred?: boolean;
  readonly partToWhole?: boolean;
  readonly multiMetrics?: boolean;
  readonly requiresGrouping?: boolean;
  readonly allowNegative?: boolean;
  readonly density?: DensityPreference;
}

export interface PatternGuidance {
  readonly bestFor: ReadonlyArray<string>;
  readonly caution: ReadonlyArray<string>;
  readonly a11y: ReadonlyArray<string>;
}

export interface ConfidenceSignal {
  readonly level: 'High' | 'Medium';
  readonly score: number;
  readonly rationale: string;
  readonly source: string;
}

export interface ChartPattern {
  readonly id: string;
  readonly name: string;
  readonly chartType: ChartType;
  readonly summary: string;
  readonly schema: PatternSchemaBlueprint;
  readonly composition: ReadonlyArray<string>;
  readonly usage: PatternGuidance;
  readonly confidence: ConfidenceSignal;
  readonly specPath: string;
  readonly heuristics: PatternHeuristics;
  readonly related?: ReadonlyArray<string>;
}

const registry = [
  {
    id: 'grouped-bar',
    name: 'Grouped Bar',
    chartType: 'bar',
    summary:
      'Compare a quantitative measure for two categorical dimensions (e.g., quarter × segment) using grouped bars with color-encoded series.',
    schema: {
      structure: '1Q + 2N',
      description: 'Quantitative metric aggregated by a primary bucket (x-axis) and a comparison dimension rendered via color.',
      fields: [
        {
          role: 'dimension',
          type: 'nominal',
          name: 'Group bucket',
          example: 'Quarter',
          description: 'Primary x-axis bucket that controls grouping and spacing.',
        },
        {
          role: 'dimension',
          type: 'nominal',
          name: 'Comparison series',
          example: 'Segment',
          description: 'Secondary grouping rendered through color and legend.',
        },
        {
          role: 'measure',
          type: 'quantitative',
          name: 'Metric',
          example: 'Pipeline coverage',
          description: 'Aggregated numeric field plotted on the y-axis.',
        },
      ],
      derived: [
        'Uses EncodingColor + legend to keep ≤5 comparisons legible.',
        'Sort the primary dimension to emphasize deltas or chronological order.',
      ],
    },
    composition: [
      'MarkBar with grouped offset for category × series layout.',
      'EncodingPositionX for the category bucket and EncodingPositionY for the aggregated metric.',
      'EncodingColor drives comparison dimension with consistent palette tokens.',
    ],
    usage: {
      bestFor: [
        'Quarter-over-quarter comparisons for 2–4 sales segments.',
        'Benchmarking pipeline or volume metrics by region + channel.',
      ],
      caution: [
        'Avoid more than five series; use filtering when cardinality grows.',
        'Requires aligned units across series to keep comparisons honest.',
      ],
      a11y: [
        'Ensure color palette meets ΔL ≥ 10 to differentiate adjacent bars.',
        'Always provide a table fallback for screen-reader users.',
      ],
    },
    confidence: {
      level: 'High',
      score: 0.93,
      rationale: 'RDS.7 schema coverage #12 (Grouped comparisons) validated across 14 studies.',
      source: 'RDS.7 Synthesis',
    },
    specPath: 'examples/viz/patterns-v2/grouped-bar.spec.json',
    heuristics: {
      measures: { min: 1, max: 1 },
      dimensions: { min: 2, max: 2 },
      goal: ['comparison'],
      requiresGrouping: true,
      density: 'flex',
    },
    related: ['stacked-bar', 'stacked-100-bar'],
  },
  {
    id: 'stacked-bar',
    name: 'Stacked Bar',
    chartType: 'bar',
    summary:
      'Shows total volume and contributions of a secondary category by stacking bars; highlights composition + overall magnitude in one frame.',
    schema: {
      structure: '1Q + 2N',
      description: 'Aggregated measure distributed across a secondary dimension that should sum to a meaningful total.',
      fields: [
        {
          role: 'dimension',
          type: 'nominal',
          name: 'Primary bucket',
          example: 'Month',
          description: 'Axis bucket controlling stack grouping.',
        },
        {
          role: 'dimension',
          type: 'nominal',
          name: 'Contribution category',
          example: 'Support category',
          description: 'Dimension stacked within each bar.',
        },
        {
          role: 'measure',
          type: 'quantitative',
          name: 'Total metric',
          example: 'Hours logged',
          description: 'Value aggregated before stacking to show magnitude.',
        },
      ],
      derived: [
        'Ordering the contribution dimension stabilizes reading order.',
        'Use totals in tooltips to mitigate stacked-label clutter.',
      ],
    },
    composition: [
      'MarkBar with stack transform for contribution dimension.',
      'EncodingColor communicates the contribution dimension using sys tokens.',
      'EncodingPositionY uses aggregate sum to reflect totals.',
    ],
    usage: {
      bestFor: [
        'Part-to-whole stories where totals still matter (support mix, spend mix).',
        'Highlighting shifts in how contributions change quarter to quarter.',
      ],
      caution: [
        'Harder to compare categories within stacks; add inline delta annotations when comparisons matter.',
        'Four or fewer contribution categories recommended for clarity.',
      ],
      a11y: [
        'Stack ordering must be consistent across the chart to aid tracking.',
        'Prefer hatching or text annotations when colors are perceptually similar.',
      ],
    },
    confidence: {
      level: 'High',
      score: 0.9,
      rationale: 'Validated via RDS.7 part-to-whole playbook with 0.89 reader confidence.',
      source: 'RDS.7 Synthesis',
    },
    specPath: 'examples/viz/patterns-v2/stacked-bar.spec.json',
    heuristics: {
      measures: { min: 1, max: 1 },
      dimensions: { min: 2, max: 2 },
      goal: ['composition'],
      stacking: 'required',
      density: 'flex',
      partToWhole: true,
    },
    related: ['stacked-100-bar'],
  },
  {
    id: 'stacked-100-bar',
    name: '100% Stacked Bar',
    chartType: 'bar',
    summary:
      'Forces each stack to 100% to emphasize share of total across cohorts; ideal for mix-shift stories.',
    schema: {
      structure: '1Q (share) + 2N',
      description: 'Normalized composition where the quantitative value is a percent share.',
      fields: [
        {
          role: 'dimension',
          type: 'nominal',
          name: 'Cohort bucket',
          example: 'Region',
          description: 'Axis bucket that frames comparisons.',
        },
        {
          role: 'dimension',
          type: 'nominal',
          name: 'Share category',
          example: 'Channel',
          description: 'Dimension stacked to 100%.',
        },
        {
          role: 'measure',
          type: 'quantitative',
          name: 'Percent share',
          example: 'Share of win source',
          description: 'Normalized metric that should sum to 1 (or 100%).',
        },
      ],
      derived: ['Requires stack transform with normalize flag to guarantee totals.'],
    },
    composition: [
      'Stack normalize transform calculates offsets + ensures 100% domain.',
      'Color ramp communicates contributions; consider diverging tokens when share can be negative (avoid ideally).',
      'Percentage axes plus inline percentages in tooltip clarify totals.',
    ],
    usage: {
      bestFor: ['Mix shift storytelling', 'Audience share, spend allocation, seat mix tracking'],
      caution: [
        'Obscures absolute volume; pair with sparkline or table when totals matter.',
        'Sensitive to rounding; keep decimals consistent in tooltips.',
      ],
      a11y: [
        'Always label 0%, 50%, 100% ticks for orientation.',
        'Narrative should call out meaningful differences since absolute bars uniform.',
      ],
    },
    confidence: {
      level: 'High',
      score: 0.88,
      rationale: 'RDS.7 confirms normalized stacks outperform pie charts for multi-cohort comparisons.',
      source: 'RDS.7 Synthesis',
    },
    specPath: 'examples/viz/patterns-v2/stacked-100-bar.spec.json',
    heuristics: {
      measures: { min: 1, max: 1 },
      dimensions: { min: 2, max: 2 },
      goal: ['part-to-whole'],
      stacking: 'required',
      partToWhole: true,
      density: 'flex',
    },
    related: ['stacked-bar'],
  },
  {
    id: 'diverging-bar',
    name: 'Diverging Bar',
    chartType: 'bar',
    summary:
      'Centers bars around zero to highlight directionality (positive vs negative impact) for a single dimension.',
    schema: {
      structure: '1Q (+/-) + 1N',
      description: 'Single dimension with signed quantitative metric.',
      fields: [
        {
          role: 'dimension',
          type: 'nominal',
          name: 'Category',
          example: 'Experience driver',
          description: 'Ordered dimension (descending by magnitude works best).',
        },
        {
          role: 'measure',
          type: 'quantitative',
          name: 'Net impact',
          example: 'NPS delta',
          description: 'Signed metric where zero is neutral.',
        },
      ],
      derived: ['Include reference line at zero with annotation.'],
    },
    composition: [
      'MarkBar with symmetrical scale domain to balance positive vs negative bars.',
      'EncodingColor uses semantic tokens (--sys-status) for positive/negative cues.',
      'Optional rule mark for goal/neutral threshold.',
    ],
    usage: {
      bestFor: ['Satisfaction drivers', 'Plan vs actual deltas', 'Backlog value vs effort scoring'],
      caution: ['Needs both positive and negative values; avoid when data only >0.', 'Sort to minimize zig-zag scanning.'],
      a11y: [
        'Pair color with iconography in tooltips for color-blind parity.',
        'State the meaning of zero and thresholds explicitly in the narrative.',
      ],
    },
    confidence: {
      level: 'Medium',
      score: 0.82,
      rationale: 'User research shows diverging bars shorten “where do negatives sit?” scan by 35%.',
      source: 'RDS.7 Usability labs',
    },
    specPath: 'examples/viz/patterns-v2/diverging-bar.spec.json',
    heuristics: {
      measures: { min: 1, max: 1 },
      dimensions: { min: 1, max: 2 },
      goal: ['comparison'],
      allowNegative: true,
      density: 'sparse',
    },
    related: ['grouped-bar'],
  },
  {
    id: 'multi-series-line',
    name: 'Multi-series Line',
    chartType: 'line',
    summary:
      'Tracks a quantitative measure over time with an additional grouping dimension; best for cohort comparisons over timelines.',
    schema: {
      structure: '1Q + 1T + 1N',
      description: 'Time-series metric grouped by a categorical series.',
      fields: [
        {
          role: 'dimension',
          type: 'temporal',
          name: 'Time grain',
          example: 'Week',
          description: 'Chronological axis; should be uniformly spaced.',
        },
        {
          role: 'dimension',
          type: 'nominal',
          name: 'Series',
          example: 'Plan tier',
          description: 'Grouping dimension shown via color or dash.',
        },
        {
          role: 'measure',
          type: 'quantitative',
          name: 'Metric',
          example: 'Active users',
          description: 'Value plotted along y-axis.',
        },
      ],
      derived: ['Add smoothing (curve monotone) when telemetry is noisy.'],
    },
    composition: [
      'MarkLine per series (EncodingColor + legend).',
      'EncodingPositionX uses temporal scale with iso formatting.',
      'Optional highlight + tooltip traits for focus interactions.',
    ],
    usage: {
      bestFor: ['Retention curves', 'Burn-down or burn-up comparisons', 'Release adoption tracking'],
      caution: ['Keep ≤4 series before switching to small multiples.', 'Use consistent sampling interval; irregular spacing confuses trends.'],
      a11y: [
        'Line styles (dash) help differentiate when colors converge.',
        'Narratives should call out inflection points rather than raw values.',
      ],
    },
    confidence: {
      level: 'High',
      score: 0.95,
      rationale: 'RDS.7 identifies multi-series line as default for time-series comparisons (confidence rank #1).',
      source: 'RDS.7 Synthesis',
    },
    specPath: 'examples/viz/patterns-v2/multi-series-line.spec.json',
    heuristics: {
      measures: { min: 1, max: 1 },
      dimensions: { min: 2, max: 2 },
      temporals: { min: 1, max: 1 },
      goal: ['trend'],
      requiresGrouping: true,
      density: 'flex',
    },
    related: ['target-band-line'],
  },
  {
    id: 'target-band-line',
    name: 'Trend vs Target Band',
    chartType: 'line',
    summary:
      'Shows an actual line with shaded target band (min/max or SLA range) to communicate compliance bands over time.',
    schema: {
      structure: '3Q + 1T',
      description: 'Actual metric plus lower/upper bounds along a timeline.',
      fields: [
        {
          role: 'dimension',
          type: 'temporal',
          name: 'Time',
          example: 'Sprint week',
          description: 'Chronological axis shared by line and band.',
        },
        {
          role: 'measure',
          type: 'quantitative',
          name: 'Actual',
          example: 'Lead time (days)',
          description: 'Primary trend line.',
        },
        {
          role: 'measure',
          type: 'quantitative',
          name: 'Lower bound',
          example: 'SLA low',
          description: 'Band baseline (MarkArea stack start).',
        },
        {
          role: 'measure',
          type: 'quantitative',
          name: 'Upper bound',
          example: 'SLA high',
          description: 'Band ceiling.',
        },
      ],
      derived: ['Band uses MarkArea with custom opacity to stay behind line.'],
    },
    composition: [
      'MarkArea draws confidence/target band; MarkLine overlays actual metric.',
      'EncodingColor stays neutral to avoid implying categorical meaning.',
      'Tooltip surfaces all three values for context.',
    ],
    usage: {
      bestFor: ['SLA compliance windows', 'Forecast vs tolerance', 'Range-of-possible scenarios'],
      caution: ['Needs min+max or p10/p90 data; avoid if bounds missing.', 'Ensure area opacity ≥ 0.25 for WCAG contrast.'],
      a11y: ['Annotate out-of-band segments in narrative to reinforce significance.', 'Provide textual definition for the shaded band.'],
    },
    confidence: {
      level: 'Medium',
      score: 0.86,
      rationale: 'Derived from RDV.2 canonical archetype “Confidence Band” with tester comprehension 88%.',
      source: 'RDV.2 Archetypes',
    },
    specPath: 'examples/viz/patterns-v2/target-band-line.spec.json',
    heuristics: {
      measures: { min: 1, max: 3 },
      dimensions: { min: 1, max: 1 },
      temporals: { min: 1, max: 1 },
      goal: ['trend'],
      multiMetrics: true,
      density: 'flex',
    },
    related: ['multi-series-line', 'running-total-area'],
  },
  {
    id: 'running-total-area',
    name: 'Running Total Area',
    chartType: 'area',
    summary:
      'Highlights accumulation (burn-up/burn-down) across time using a filled area to emphasize magnitude and progress.',
    schema: {
      structure: '1Q + 1T',
      description: 'Single metric area chart over time.',
      fields: [
        {
          role: 'dimension',
          type: 'temporal',
          name: 'Time grain',
          example: 'Month',
          description: 'Ordered timeline for accumulation.',
        },
        {
          role: 'measure',
          type: 'quantitative',
          name: 'Running total',
          example: 'ARR added',
          description: 'Metric plotted as area height.',
        },
      ],
      derived: ['Optionally add transform for cumulative sum when data is incremental.'],
    },
    composition: [
      'MarkArea baseline zero for accumulation, optional gradient fill.',
      'EncodingPositionX (temporal) + EncodingPositionY (metric).',
      'Can include goal reference line for target burn-up.',
    ],
    usage: {
      bestFor: ['Cumulative ARR goals', 'Burn-up / burn-down in sprint reviews', 'Cohort adoption progress'],
      caution: ['Area hides per-interval contributions; add tooltip/narrative for increments.', 'Avoid using area for signed values (diverging area).'],
      a11y: ['Ensure area fill meets 3:1 contrast with background', 'Narrative should restate baseline + target.'],
    },
    confidence: {
      level: 'High',
      score: 0.91,
      rationale: 'Adopted as OODS burn-up default after RDV.2 readability sessions.',
      source: 'RDV.2 Archetypes',
    },
    specPath: 'examples/viz/patterns-v2/running-total-area.spec.json',
    heuristics: {
      measures: { min: 1, max: 1 },
      dimensions: { min: 1, max: 1 },
      temporals: { min: 1, max: 1 },
      goal: ['trend', 'composition'],
      density: 'flex',
    },
    related: ['target-band-line'],
  },
  {
    id: 'bubble-distribution',
    name: 'Bubble Distribution',
    chartType: 'scatter',
    summary:
      'Extends scatterplots with bubble size to encode a third quantitative value; great for portfolio prioritization.',
    schema: {
      structure: '3Q + 1N',
      description: 'Two quantitative axes plus bubble area and categorical label.',
      fields: [
        {
          role: 'measure',
          type: 'quantitative',
          name: 'X metric',
          example: 'CSAT delta',
          description: 'Mapped to x-axis.',
        },
        {
          role: 'measure',
          type: 'quantitative',
          name: 'Y metric',
          example: 'Revenue impact',
          description: 'Mapped to y-axis.',
        },
        {
          role: 'measure',
          type: 'quantitative',
          name: 'Bubble size',
          example: 'User count',
          description: 'Controls area/size channel.',
        },
        {
          role: 'dimension',
          type: 'nominal',
          name: 'Label',
          example: 'Initiative',
          description: 'Color + tooltip label for each bubble.',
        },
      ],
      derived: ['Use sqrt scale for bubble radius to keep perceptual area honest.'],
    },
    composition: [
      'MarkPoint with EncodingSize + EncodingColor per bubble.',
      'Axis titles describe metrics + units (log vs linear).',
      'Interactions highlight + tooltip show all values at once.',
    ],
    usage: {
      bestFor: ['Prioritization matrices', 'Customer health mapping', 'Investment landscape diagrams'],
      caution: ['Ensure zero baseline is meaningful; otherwise offset to domain of interest.', 'Limit labels to short names; rely on tooltip for detail.'],
      a11y: ['Provide text summary grouping bubbles into quadrants.', 'Size legend clarifies mapping for low-vision readers.'],
    },
    confidence: {
      level: 'Medium',
      score: 0.84,
      rationale: 'RDS.7 quadrant tasks scored 0.84 user confidence with bubble overlays.',
      source: 'RDS.7 Task Trials',
    },
    specPath: 'examples/viz/patterns-v2/bubble-distribution.spec.json',
    heuristics: {
      measures: { min: 3, max: 3 },
      dimensions: { min: 1, max: 2 },
      goal: ['relationship'],
      multiMetrics: true,
      density: 'sparse',
    },
    related: ['correlation-scatter'],
  },
  {
    id: 'correlation-scatter',
    name: 'Correlation Scatter',
    chartType: 'scatter',
    summary:
      'Classic X/Y scatter for identifying correlation across cohorts, optionally layering regression or quadrant cues.',
    schema: {
      structure: '2Q + 1N',
      description: 'Two quantitative axes plus categorical color.',
      fields: [
        {
          role: 'measure',
          type: 'quantitative',
          name: 'Predictor',
          example: 'Latency',
          description: 'X-axis field.',
        },
        {
          role: 'measure',
          type: 'quantitative',
          name: 'Outcome',
          example: 'Conversion %',
          description: 'Y-axis field.',
        },
        {
          role: 'dimension',
          type: 'nominal',
          name: 'Group',
          example: 'Segment',
          description: 'Color-coded grouping for quick scanning.',
        },
      ],
      derived: ['Add zero/target lines or quadrants when hypotheses rely on thresholds.'],
    },
    composition: [
      'MarkPoint glyphs sized consistently for legibility.',
      'EncodingColor for grouping plus highlight/tooltip interactions.',
      'Optional reference line (MarkRule) for regression overlay.',
    ],
    usage: {
      bestFor: ['Latency vs conversion', 'Debt ratio vs churn', 'Feature adoption vs retention'],
      caution: ['Small data sets (<6 rows) may be better communicated via table.', 'Outliers should be annotated to avoid misinterpretation.'],
      a11y: ['Prefer outlines + filled shapes for high-contrast interactions.', 'Quadrant summary text helps readers who cannot parse scatter quickly.'],
    },
    confidence: {
      level: 'High',
      score: 0.9,
      rationale: 'Correlation scatter delivered 0.9 comprehension across RDV.2 archetype review.',
      source: 'RDV.2 Archetypes',
    },
    specPath: 'examples/viz/patterns-v2/correlation-scatter.spec.json',
    heuristics: {
      measures: { min: 2, max: 2 },
      dimensions: { min: 1, max: 2 },
      goal: ['relationship', 'distribution'],
      density: 'flex',
    },
    related: ['bubble-distribution'],
  },
  {
    id: 'time-grid-heatmap',
    name: 'Time Grid Heatmap',
    chartType: 'heatmap',
    summary:
      'Uses MarkRect grid for two categorical/temporal axes (e.g., day × hour) with color intensity representing volume.',
    schema: {
      structure: '1Q + 2N/ordinal',
      description: 'Heatmap with two discrete axes and a quantitative metric.',
      fields: [
        {
          role: 'dimension',
          type: 'nominal',
          name: 'Axis 1',
          example: 'Day',
          description: 'Rows of the grid.',
        },
        {
          role: 'dimension',
          type: 'nominal',
          name: 'Axis 2',
          example: 'Hour',
          description: 'Columns of the grid.',
        },
        {
          role: 'measure',
          type: 'quantitative',
          name: 'Intensity metric',
          example: 'Tickets',
          description: 'Mapped to color scale.',
        },
      ],
      derived: ['Consider sorting axes by magnitude or time-of-day sequence.'],
    },
    composition: [
      'MarkRect + EncodingColor linear scale.',
      'Band scales keep tiles equidistant; adjust padding to 0.1 for breathing room.',
      'Tooltip + highlight interactions for drill-down.',
    ],
    usage: {
      bestFor: ['Usage heatmaps (day/hour)', 'Availability monitoring', 'Calendar heatmaps'],
      caution: ['Requires rectangular dataset with complete matrix; fill missing combos explicitly.', 'Color ramps must be perceptually uniform (see OKLCH guardrails).'],
      a11y: ['Include textual summary describing hottest + coolest cells.', 'Use annotation markers for extremes so color-only cues are optional.'],
    },
    confidence: {
      level: 'High',
      score: 0.92,
      rationale: 'Interviewees correctly identified spikes 92% of the time with this layout.',
      source: 'RDS.7 Task Trials',
    },
    specPath: 'examples/viz/patterns-v2/time-grid-heatmap.spec.json',
    heuristics: {
      measures: { min: 1, max: 1 },
      dimensions: { min: 2, max: 2 },
      goal: ['intensity'],
      matrix: true,
      density: 'dense',
    },
    related: ['correlation-matrix'],
  },
  {
    id: 'correlation-matrix',
    name: 'Correlation Matrix',
    chartType: 'heatmap',
    summary:
      'A symmetric matrix heatmap that compares each metric pair; ideal for spotting strong correlations quickly.',
    schema: {
      structure: '1Q + 2N (same domain)',
      description: 'Two categorical axes referencing identical domains (metrics, features).',
      fields: [
        {
          role: 'dimension',
          type: 'nominal',
          name: 'Metric / feature (row)',
          example: 'Feature name',
          description: 'Y-axis domain, matches column list.',
        },
        {
          role: 'dimension',
          type: 'nominal',
          name: 'Metric / feature (column)',
          example: 'Metric name',
          description: 'X-axis domain.',
        },
        {
          role: 'measure',
          type: 'quantitative',
          name: 'Correlation value',
          example: 'Pearson r',
          description: 'Mapped to diverging color scale (-1 to 1).',
        },
      ],
      derived: ['Upper triangle may mirror lower triangle; annotate duplicates appropriately.'],
    },
    composition: [
      'MarkRect with diverging color scale centered at 0.',
      'Optional stroke/border for diagonal to highlight self-correlation.',
      'Tooltip includes pair + coefficient to reduce guesswork.',
    ],
    usage: {
      bestFor: ['Feature correlation', 'KPI dependency mapping', 'Risk adjacency matrices'],
      caution: ['Input must be normalized (-1…1) before encoding.', 'Large matrices (>10×10) should switch to interactive filters.'],
      a11y: ['Annotate highest and lowest correlations via text callouts.', 'Use symmetrical palette with adequate neutral midpoint contrast.'],
    },
    confidence: {
      level: 'Medium',
      score: 0.85,
      rationale: 'RDV.2 scored correlation matrices at 0.85 comprehension when middle palette anchored at 0.',
      source: 'RDV.2 Archetypes',
    },
    specPath: 'examples/viz/patterns-v2/correlation-matrix.spec.json',
    heuristics: {
      measures: { min: 1, max: 1 },
      dimensions: { min: 2, max: 2 },
      goal: ['relationship', 'intensity'],
      matrix: true,
      density: 'dense',
    },
    related: ['time-grid-heatmap'],
  },
  {
    id: 'facet-small-multiples-line',
    name: 'Facet Small Multiples (Line)',
    chartType: 'line',
    summary:
      'Facet grid of synchronized sparklines that compare a temporal metric across two grouping dimensions (region × segment).',
    schema: {
      structure: '1Q + 1T + 2N (facet)',
      description: 'Temporal metric rendered as a small multiple per region/segment pair.',
      fields: [
        {
          role: 'dimension',
          type: 'temporal',
          name: 'Time grain',
          example: 'Week',
          description: 'Chronological bucket shared across every facet.',
        },
        {
          role: 'dimension',
          type: 'nominal',
          name: 'Primary facet',
          example: 'Region',
          description: 'Facet row dimension.',
        },
        {
          role: 'dimension',
          type: 'nominal',
          name: 'Secondary facet',
          example: 'Segment',
          description: 'Facet column dimension.',
        },
        {
          role: 'measure',
          type: 'quantitative',
          name: 'Metric',
          example: 'Active users',
          description: 'Temporal value plotted inside each panel.',
        },
      ],
      derived: ['Facet layout keeps per-panel axes short while maintaining shared scales.'],
    },
    composition: [
      'LayoutFacet orchestrates row (region) × column (segment) panels with shared temporal scale.',
      'MarkLine per panel with EncodingColor for the comparison series.',
      'Hover interaction broadcasts tooltips for quick cohort scans.',
    ],
    usage: {
      bestFor: ['Weekly health checks filtered by geo × segment', 'Rolling KPI reviews that need consistency at a glance'],
      caution: [
        'Keep panels ≤12 to avoid wall-of-chart fatigue.',
        'Align axes across panels and call out key findings in the caption for screen readers.',
      ],
      a11y: [
        'Ensure each panel has accessible aria-labels referencing region and segment.',
        'Provide tabular fallback that mirrors the region × segment grouping.',
      ],
    },
    confidence: {
      level: 'High',
      score: 0.9,
      rationale: 'Facet grid outperformed single dense charts by 38% in comprehension tests (RDS.8).',
      source: 'RDS.8 Composite Viz',
    },
    specPath: 'examples/viz/patterns-v2/facet-small-multiples-line.spec.json',
    heuristics: {
      measures: { min: 1, max: 1 },
      dimensions: { min: 2, max: 3 },
      temporals: { min: 1, max: 1 },
      goal: ['trend', 'comparison'],
      requiresGrouping: true,
      density: 'flex',
    },
    related: ['multi-series-line'],
  },
  {
    id: 'layered-line-area',
    name: 'Layered Actual vs Target',
    chartType: 'area',
    summary: 'Overlays an area for actual performance with target and capacity lines to highlight variance over time.',
    schema: {
      structure: '1Q + 1T (actual/target)',
      description: 'Temporal metric with paired reference series.',
      fields: [
        {
          role: 'dimension',
          type: 'temporal',
          name: 'Time grain',
          example: 'Week',
          description: 'Horizontal axis shared by all layers.',
        },
        {
          role: 'measure',
          type: 'quantitative',
          name: 'Actual metric',
          example: 'Net retention',
          description: 'Primary series rendered as an area fill.',
        },
        {
          role: 'measure',
          type: 'quantitative',
          name: 'Target',
          example: 'SLA goal',
          description: 'Reference line to compare against actual.',
        },
        {
          role: 'measure',
          type: 'quantitative',
          name: 'Capacity',
          example: 'Ceiling',
          description: 'Optional secondary line for capacity or threshold.',
        },
      ],
    },
    composition: [
      'LayoutLayer keeps lines + area perfectly aligned and synchronized.',
      'Area channel encodes actual values while MarkLine traces reference thresholds.',
      'Tooltip describes deltas (actual minus target) for precision.',
    ],
    usage: {
      bestFor: ['SLA compliance dashboards', 'Burn-up vs capacity storytelling'],
      caution: ['Use smoothing sparingly; business audiences expect hard numbers.', 'Color tokens must contrast against the filled area.'],
      a11y: ['Narrative must describe whether actual stays above/below targets.', 'Keep stroke widths ≥2px for visibility.'],
    },
    confidence: {
      level: 'High',
      score: 0.88,
      rationale: 'Layered treatments reduced SLA miss-detection time by 41% in usability studies.',
      source: 'RDS.8 Composite Viz',
    },
    specPath: 'examples/viz/patterns-v2/layered-line-area.spec.json',
    heuristics: {
      measures: { min: 1, max: 1 },
      dimensions: { min: 1, max: 2 },
      temporals: { min: 1, max: 1 },
      goal: ['trend', 'comparison'],
      stacking: 'preferred',
      multiMetrics: true,
      density: 'flex',
    },
    related: ['target-band-line'],
  },
  {
    id: 'stacked-area-projection',
    name: 'Channel Contribution Area',
    chartType: 'area',
    summary: 'Stacked area comparison showing how channels contribute to the total forecast at each time slice.',
    schema: {
      structure: '1Q + 2N',
      description: 'Temporal measure broken into contribution dimension (channel).',
      fields: [
        {
          role: 'dimension',
          type: 'ordinal',
          name: 'Time bucket',
          example: 'Month',
          description: 'Ordered dimension plotted along the x-axis.',
        },
        {
          role: 'dimension',
          type: 'nominal',
          name: 'Contribution dimension',
          example: 'Channel',
          description: 'Defines each stacked area.',
        },
        {
          role: 'measure',
          type: 'quantitative',
          name: 'Contribution value',
          example: 'ARR ($M)',
          description: 'Metric summed per bucket.',
        },
      ],
      derived: ['Requires normalized units to keep stacked areas comparable.'],
    },
    composition: [
      'MarkArea with stack transform (sum) ensures totals reflect channel contributions.',
      'Color palette uses sequential order for intuitive blending.',
      'Hover interaction isolates a single channel and dims the rest.',
    ],
    usage: {
      bestFor: ['Channel mix reviews', 'Spend allocation updates'],
      caution: ['Limit channel count to ≤5; switch to facet grid when cardinality explodes.', 'Always annotate the total line or call out maxima.'],
      a11y: ['Narrate which band owns the largest share.', 'Keep ΔL ≥ 10 between adjacent channel colors.'],
    },
    confidence: {
      level: 'Medium',
      score: 0.84,
      rationale: 'Area stacks outperform pie charts for mix-shift comprehension per RDV.3.',
      source: 'RDV.3 Allocation Studies',
    },
    specPath: 'examples/viz/patterns-v2/stacked-area-projection.spec.json',
    heuristics: {
      measures: { min: 1, max: 1 },
      dimensions: { min: 2, max: 2 },
      goal: ['composition', 'trend'],
      stacking: 'required',
      partToWhole: true,
      density: 'flex',
    },
    related: ['stacked-bar'],
  },
  {
    id: 'linked-brush-scatter',
    name: 'Linked Brush Scatter',
    chartType: 'scatter',
    summary: 'Scatter with linked brush + cohort tooltips to explore relationships between engagement and retention.',
    schema: {
      structure: '2Q + 1N',
      description: 'Two quantitative axes plus cohort metadata.',
      fields: [
        {
          role: 'measure',
          type: 'quantitative',
          name: 'X metric',
          example: '% engaged',
          description: 'Horizontal axis metric.',
        },
        {
          role: 'measure',
          type: 'quantitative',
          name: 'Y metric',
          example: '% retained',
          description: 'Vertical axis metric.',
        },
        {
          role: 'dimension',
          type: 'nominal',
          name: 'Segment or cohort',
          example: 'Customer segment',
          description: 'Color-coded dimension for comparison.',
        },
      ],
      derived: ['Supports brush interaction to highlight cohorts and maintain persistence.'],
    },
    composition: [
      'MarkPoint for scatter glyphs plus EncodingColor for cohorts.',
      'Interval selection drives brush overlays for both axes.',
      'Tooltip shows retention + engagement deltas per cohort.',
    ],
    usage: {
      bestFor: ['Engagement vs retention diagnostics', 'Experiment readouts with segments'],
      caution: ['Keep point count manageable; switch to density heatmap when >1k points.', 'Add regression overlays when trend strength matters.'],
      a11y: ['Provide textual summary of clusters in docs.', 'Ensure focus ring style meets WCAG.'],
    },
    confidence: {
      level: 'High',
      score: 0.9,
      rationale: 'Linked brushing improved anomaly detection accuracy by 32% in RSIP studies.',
      source: 'RSIP Pattern Tests',
    },
    specPath: 'examples/viz/patterns-v2/linked-brush-scatter.spec.json',
    heuristics: {
      measures: { min: 2, max: 2 },
      dimensions: { min: 1, max: 2 },
      goal: ['relationship', 'comparison'],
      density: 'flex',
      multiMetrics: true,
    },
    related: ['correlation-scatter'],
  },
  {
    id: 'focus-context-line',
    name: 'Focus + Context Line',
    chartType: 'line',
    summary: 'Vertical concat pairs an overview timeseries with a zoomed focus panel for a specific cohort.',
    schema: {
      structure: '1Q + 1T + 1N',
      description: 'Temporal metric grouped by a region or cohort dimension and presented in overview + focus panes.',
      fields: [
        {
          role: 'dimension',
          type: 'temporal',
          name: 'Time grain',
          example: 'Week',
          description: 'Shared axis used by both overview and focus panels.',
        },
        {
          role: 'dimension',
          type: 'nominal',
          name: 'Grouping dimension',
          example: 'Region',
          description: 'Controls which focus panel is rendered.',
        },
        {
          role: 'measure',
          type: 'quantitative',
          name: 'Metric',
          example: 'Revenue',
          description: 'Value plotted in both panels.',
        },
      ],
    },
    composition: [
      'LayoutConcat renders overview (all cohorts) plus filtered focus panel.',
      'Hover sync ties tooltips together so viewers compare context vs detail.',
      'Guiding text reminds readers which region is highlighted.',
    ],
    usage: {
      bestFor: ['Executive scorecards wanting population context + focus region', 'Story-driven updates with spotlight narratives'],
      caution: ['Limit focus to one cohort per view; create story controls otherwise.', 'Ensure color tokens remain consistent between panels.'],
      a11y: [
        'Label the focus panel to announce region for screen readers.',
        'Provide textual summary describing divergence between panels.',
      ],
    },
    confidence: {
      level: 'Medium',
      score: 0.83,
      rationale: 'Focus+context layouts shorten question-asking loops by 27% in RSIP evaluations.',
      source: 'RSIP Pattern Tests',
    },
    specPath: 'examples/viz/patterns-v2/focus-context-line.spec.json',
    heuristics: {
      measures: { min: 1, max: 1 },
      dimensions: { min: 2, max: 2 },
      temporals: { min: 1, max: 1 },
      goal: ['trend'],
      requiresGrouping: true,
      density: 'flex',
      concatPreferred: true,
    },
    related: ['multi-series-line'],
  },
  {
    id: 'detail-overview-bar',
    name: 'Detail-overview Bar',
    chartType: 'bar',
    summary: 'Dashboard concat pattern that shows total bookings plus product-specific panels filtered via layout sections.',
    schema: {
      structure: '1Q + 2N',
      description: 'Categorical metric decomposed by product and segment.',
      fields: [
        {
          role: 'dimension',
          type: 'nominal',
          name: 'Primary grouping',
          example: 'Segment',
          description: 'Axis bucket for the overview panel.',
        },
        {
          role: 'dimension',
          type: 'nominal',
          name: 'Detail dimension',
          example: 'Product',
          description: 'Filters subsequent panels.',
        },
        {
          role: 'measure',
          type: 'quantitative',
          name: 'Metric',
          example: 'Bookings ($M)',
          description: 'Aggregated per grouping combination.',
        },
      ],
    },
    composition: [
      'LayoutConcat with horizontal sections for overview + per-product detail.',
      'MarkBar drives each panel, reusing encoding but filtered via section definitions.',
      'Tooltip acts as lightweight drill-down to show bookings vs target.',
    ],
    usage: {
      bestFor: ['Executive rollups needing drill-down but not navigation changes', 'Product line reviews'],
      caution: ['Do not exceed three detail panels; pivot to dedicated dashboard if needed.', 'Maintain consistent y-scale to avoid misreads.'],
      a11y: ['Each section should include heading text for context.', 'Narrative needs to summarize takeaways from overview vs details.'],
    },
    confidence: {
      level: 'Medium',
      score: 0.8,
      rationale: 'Detail+overview pattern matched expected decisions in 78% of pilot interviews.',
      source: 'RSIP Pattern Tests',
    },
    specPath: 'examples/viz/patterns-v2/detail-overview-bar.spec.json',
    heuristics: {
      measures: { min: 1, max: 1 },
      dimensions: { min: 2, max: 2 },
      goal: ['comparison'],
      requiresGrouping: true,
      density: 'flex',
      concatPreferred: true,
    },
    related: ['grouped-bar'],
  },
  {
    id: 'sparkline-grid',
    name: 'KPI Sparkline Grid',
    chartType: 'line',
    summary: 'High-density sparkline grid for >6 KPIs with shared time axis and aligned baselines.',
    schema: {
      structure: '1Q + 1T + 1N',
      description: 'Temporal metric repeated per KPI dimension.',
      fields: [
        {
          role: 'dimension',
          type: 'temporal',
          name: 'Time bucket',
          example: 'Week',
          description: 'Shared horizontal axis.',
        },
        {
          role: 'dimension',
          type: 'nominal',
          name: 'KPI name',
          example: 'Activation rate',
          description: 'Facet dimension mapping to each sparkline.',
        },
        {
          role: 'measure',
          type: 'quantitative',
          name: 'KPI value',
          example: 'Percentage',
          description: 'Metric plotted inside each panel.',
        },
      ],
    },
    composition: [
      'LayoutFacet arranges sparks into a responsive grid with wrap logic.',
      'MarkLine renders each KPI while keeping scales independent vertically.',
      'Tooltip enumerates KPI name, week, and value.',
    ],
    usage: {
      bestFor: ['Scorecards where trend direction matters more than exact values', 'Chromatic high-density baselines for regression testing'],
      caution: ['Use inline labels/narrative to highlight anomalies; don’t expect readers to inspect every panel.', 'Avoid mixing units.'],
      a11y: ['Pair with textual summary describing KPIs with biggest swings.', 'Enable table fallback with metric × week matrix.'],
    },
    confidence: {
      level: 'High',
      score: 0.89,
      rationale: 'Sparkline grids reduce scroll depth by consolidating KPIs into a single viewport.',
      source: 'VRT Benchmarks',
    },
    specPath: 'examples/viz/patterns-v2/sparkline-grid.spec.json',
    heuristics: {
      measures: { min: 1, max: 1 },
      dimensions: { min: 2, max: 2 },
      temporals: { min: 1, max: 1 },
      goal: ['trend'],
      requiresGrouping: true,
      density: 'dense',
    },
    related: ['facet-small-multiples-line'],
  },
  {
    id: 'facet-target-band',
    name: 'Facet Target Band',
    chartType: 'line',
    summary: 'Small multiples showing SLA band (area) with actual line per region.',
    schema: {
      structure: '1Q + 1T + 1N',
      description: 'Temporal actuals per region with paired tolerance band.',
      fields: [
        {
          role: 'dimension',
          type: 'ordinal',
          name: 'Week',
          example: 'W01',
          description: 'Chronological bucket.',
        },
        {
          role: 'dimension',
          type: 'nominal',
          name: 'Region',
          example: 'Amer',
          description: 'Facet dimension.',
        },
        {
          role: 'measure',
          type: 'quantitative',
          name: 'Actual value',
          example: 'Case SLA minutes',
          description: 'Metric to compare against the target band.',
        },
      ],
      derived: ['Band thickness derived from lower/upper fields defined per datum.'],
    },
    composition: [
      'MarkArea encodes SLA tolerance band while MarkLine traces actual.',
      'LayoutFacet repeats the pair across each region.',
      'Tooltip lists actual plus bounds to highlight risk.',
    ],
    usage: {
      bestFor: ['Operational dashboards requiring SLA compliance per location'],
      caution: ['Bands only meaningful when lower/upper columns are kept in sync with units.', 'Keep panel count limited to maintain readability.'],
      a11y: ['Describe whether actual values breach lower/upper bounds in docs.', 'Provide captions for each region facet.'],
    },
    confidence: {
      level: 'Medium',
      score: 0.81,
      rationale: 'Band overlays highlight out-of-range trends faster than textual SLA lists (RDV.3).',
      source: 'RDV.3 SLA Validation',
    },
    specPath: 'examples/viz/patterns-v2/facet-target-band.spec.json',
    heuristics: {
      measures: { min: 1, max: 1 },
      dimensions: { min: 2, max: 2 },
      goal: ['trend', 'comparison'],
      temporals: { min: 1, max: 1 },
      multiMetrics: true,
      density: 'flex',
    },
    related: ['target-band-line'],
  },
  {
    id: 'drilldown-stacked-bar',
    name: 'Drill-down Stacked Bar (Facet)',
    chartType: 'bar',
    summary: 'Faceted stack showing pipeline composition per region with drill interaction on quarter × stage.',
    schema: {
      structure: '1Q + 2N',
      description: 'Quarterly pipeline aggregated by stage and split into region facets.',
      fields: [
        {
          role: 'dimension',
          type: 'nominal',
          name: 'Quarter',
          example: 'Q1',
          description: 'Primary axis bucket.',
        },
        {
          role: 'dimension',
          type: 'nominal',
          name: 'Stage',
          example: 'Sales',
          description: 'Stack contribution dimension.',
        },
        {
          role: 'dimension',
          type: 'nominal',
          name: 'Region',
          example: 'Amer',
          description: 'Facet grouping.',
        },
        {
          role: 'measure',
          type: 'quantitative',
          name: 'Pipeline value',
          example: '$M',
          description: 'Metric aggregated per combination.',
        },
      ],
    },
    composition: [
      'MarkBar with stack + EncodingDetail for region-specific labeling.',
      'LayoutFacet splits each region while sharing axes for easier comparison.',
      'Click interaction surfaces stage totals for drill-down storytelling.',
    ],
    usage: {
      bestFor: ['Ops reviews seeking quick read on quarter/channel mix per region'],
      caution: ['Sort stacks consistently across facets to limit cognitive load.', 'If quarters exceed four, switch to scroll or pagination.'],
      a11y: ['Narrative should describe which region has the highest share.', 'Enable table fallback for stage × region breakdown.'],
    },
    confidence: {
      level: 'Medium',
      score: 0.82,
      rationale: 'Facet + stack improved comparative accuracy by 24% vs single stacked view.',
      source: 'RDS.8 Composite Viz',
    },
    specPath: 'examples/viz/patterns-v2/drilldown-stacked-bar.spec.json',
    heuristics: {
      measures: { min: 1, max: 1 },
      dimensions: { min: 2, max: 3 },
      goal: ['composition', 'comparison'],
      stacking: 'required',
      requiresGrouping: true,
      density: 'flex',
    },
    related: ['stacked-bar', 'grouped-bar'],
  },
] as const satisfies ReadonlyArray<ChartPattern>;

export const chartPatterns = registry;

const patternIndex = new Map(registry.map((pattern) => [pattern.id, pattern] as const));

export type ChartPatternId = (typeof registry)[number]['id'];

export function listPatterns(): ChartPattern[] {
  return [...registry];
}

export function getPatternById(id: ChartPatternId): ChartPattern | undefined {
  return patternIndex.get(id);
}
