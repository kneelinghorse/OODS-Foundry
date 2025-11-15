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
    specPath: 'examples/viz/patterns/grouped-bar.spec.json',
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
    specPath: 'examples/viz/patterns/stacked-bar.spec.json',
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
    specPath: 'examples/viz/patterns/stacked-100-bar.spec.json',
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
    specPath: 'examples/viz/patterns/diverging-bar.spec.json',
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
    specPath: 'examples/viz/patterns/multi-series-line.spec.json',
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
    specPath: 'examples/viz/patterns/target-band-line.spec.json',
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
    specPath: 'examples/viz/patterns/running-total-area.spec.json',
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
    specPath: 'examples/viz/patterns/bubble-distribution.spec.json',
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
    specPath: 'examples/viz/patterns/correlation-scatter.spec.json',
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
    specPath: 'examples/viz/patterns/time-grid-heatmap.spec.json',
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
    specPath: 'examples/viz/patterns/correlation-matrix.spec.json',
    heuristics: {
      measures: { min: 1, max: 1 },
      dimensions: { min: 2, max: 2 },
      goal: ['relationship', 'intensity'],
      matrix: true,
      density: 'dense',
    },
    related: ['time-grid-heatmap'],
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
