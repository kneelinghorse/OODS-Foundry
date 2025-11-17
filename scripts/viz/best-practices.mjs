#!/usr/bin/env node
import { parseArgs } from 'node:util';

const optionSpec = {
  options: {
    goal: { type: 'string', short: 'g' },
    data: { type: 'string', short: 'd' },
    layout: { type: 'string', short: 'l' },
    rows: { type: 'string', short: 'r' },
    interactions: { type: 'string', short: 'i' },
    output: { type: 'string', short: 'o' }
  },
  allowPositionals: true
};

const {
  values,
  positionals
} = parseArgs(optionSpec);

const scenario = {
  goal: (values.goal || positionals[0] || 'comparison').toLowerCase(),
  data: (values.data || '1Q+1N').trim(),
  layout: (values.layout || 'single').toLowerCase(),
  rows: Number(values.rows || 0),
  interactions: (values.interactions || '').split(',').map((val) => val.trim()).filter(Boolean)
};

const signature = parseSignature(scenario.data);
const chart = recommendChart({ ...scenario, ...signature });
const layoutAdvice = recommendLayout({ ...scenario, ...signature });
const perfAdvice = recommendPerformance({ ...scenario, ...signature, chart });
const a11yAdvice = recommendA11y({ ...scenario, ...signature });

const reportLines = [
  `Scenario: goal=${scenario.goal} data=${scenario.data} layout=${scenario.layout} rows=${scenario.rows || 'n/a'} interactions=${scenario.interactions.join(',') || 'none'}`,
  '',
  `Chart Recommendation: ${chart.summary}`,
  `- Reference: docs/viz/chart-selection-decision-tree.md`,
  '',
  `Layout Guidance: ${layoutAdvice.summary}`,
  `- Reference: docs/viz/best-practices.md#layout-selection-guide-facet-vs-layer-vs-concat`,
  '',
  `Performance Checklist: ${perfAdvice.summary}`,
  `- Reference: docs/viz/performance-optimization.md`,
  '',
  `Accessibility Checklist: ${a11yAdvice.summary}`,
  `- Reference: docs/viz/accessibility-checklist.md`,
  '',
  `Anti-patterns to watch: ${chart.antiPatternHint}`,
  `Before/After example: ${layoutAdvice.exampleRef}`
];

const output = values.output ? values.output.trim().toLowerCase() : null;
if (output === 'json') {
  const payload = {
    scenario,
    signature,
    chart,
    layout: layoutAdvice,
    performance: perfAdvice,
    accessibility: a11yAdvice,
    docs: {
      bestPractices: 'docs/viz/best-practices.md',
      decisionTree: 'docs/viz/chart-selection-decision-tree.md',
      performance: 'docs/viz/performance-optimization.md',
      accessibility: 'docs/viz/accessibility-checklist.md',
      antiPatterns: 'docs/viz/anti-patterns.md'
    }
  };
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
} else {
  process.stdout.write(`${reportLines.join('\n')}\n`);
}

function parseSignature(signature) {
  const measures = Number(signature.match(/(\d+)Q/i)?.[1] || 1);
  const dimensions = Number(signature.match(/(\d+)N/i)?.[1] || 1);
  const temporals = Number(signature.match(/(\d+)T/i)?.[1] || 0);
  return { measures, dimensions, temporals };
}

function recommendChart(ctx) {
  const { goal, measures, dimensions, temporals } = ctx;
  if (goal === 'composition') {
    return {
      summary: measures > 1 ? 'Stacked or 100 percent stacked bar for part-to-whole stories.' : 'Stacked bar for part-to-whole comparisons.',
      antiPatternHint: 'Avoid pie/donut usage (anti-pattern #1).'
    };
  }
  if (temporals > 0) {
    if (measures >= 3) {
      return { summary: 'Trend vs target band (layered line + area).', antiPatternHint: 'Ensure layers have ids (anti-pattern #10).' };
    }
    if (measures === 2) {
      return { summary: 'Multi-series line with shared axes.', antiPatternHint: 'Keep sampling grids consistent (anti-pattern #3).' };
    }
    return { summary: 'Running total area or grouped bar if the timeline is bucketed.', antiPatternHint: 'Validate axis intervals for accessibility.' };
  }
  if (dimensions >= 2) {
    return {
      summary: goal === 'intensity' ? 'Time-grid heatmap with dense matrix coverage.' : 'Grouped bar or correlation matrix depending on symmetry.',
      antiPatternHint: 'Do not use sparse heatmaps (anti-pattern #2).'
    };
  }
  if (measures >= 3) {
    return {
      summary: 'Bubble distribution (size encodes measure #3).',
      antiPatternHint: 'Color encodings must represent one concept (anti-pattern #4).'
    };
  }
  if (goal === 'relationship' || measures === 2) {
    return {
      summary: 'Correlation scatter with highlight interactions.',
      antiPatternHint: 'Renderer drift appears when scatter density climbs without ECharts (anti-pattern #8).'
    };
  }
  return {
    summary: 'Standard bar/column comparison.',
    antiPatternHint: 'Ensure a11y narratives exist (anti-pattern #5).'
  };
}

function recommendLayout(ctx) {
  const { layout, dimensions, temporals } = ctx;
  if (layout === 'facet') {
    return {
      summary: 'Use LayoutFacet with shared scales and <=9 panels.',
      exampleRef: 'examples/viz/before-after/facet-small-multiples/after.spec.json'
    };
  }
  if (layout === 'layer') {
    return {
      summary: 'Assign mark ids/order hints and keep visible layers <=3.',
      exampleRef: 'examples/viz/patterns-v2/trend-target-band.spec.json'
    };
  }
  if (layout === 'concat') {
    return {
      summary: 'Ensure each section has filters and document aria flow order. Consider downgrading to facets when charts share encodings.',
      exampleRef: 'examples/viz/before-after/facet-small-multiples/before.spec.json'
    };
  }
  if (layout === 'dashboard') {
    return {
      summary: 'Mix concat + facet strategically and capture responsive plans (`pnpm vrt:layouts`).',
      exampleRef: 'docs/viz/layout-adapter-guide.md'
    };
  }
  // single layout fallback
  if (dimensions >= 2 && temporals === 0) {
    return {
      summary: 'Plan for responsive legend placement and consider facetting if reviewers need per-dimension focus.',
      exampleRef: 'examples/viz/patterns-v2/grouped-bar.spec.json'
    };
  }
  return {
    summary: 'Single layout. Document how interactions behave on mobile and keep padding consistent with tokens.',
    exampleRef: 'examples/viz/bar-chart.spec.json'
  };
}

function recommendPerformance(ctx) {
  const { rows, chart, goal } = ctx;
  if (rows >= 10000) {
    return { summary: 'High density: run perf benchmarks immediately and prefer ECharts for highlight parity.' };
  }
  if (rows >= 500) {
    return { summary: 'Medium density: verify renderer choice via benchmarks and attach the artifact to your PR. Chart recommendation: ' + chart.summary };
  }
  if (goal === 'relationship') {
    return { summary: 'Relationship charts often require zoom/pan. Budget for those interactions even if data rows are small.' };
  }
  return { summary: 'Low density: still run smoke benchmarks when changing renderers; focus on interaction cost rather than payload size.' };
}

function recommendA11y(ctx) {
  const { interactions } = ctx;
  const needsFocusParity = interactions.some((entry) => entry && !/focus/i.test(entry));
  if (needsFocusParity) {
    return { summary: 'Mirror hover behaviors with focus events and ensure table fallbacks are enabled.' };
  }
  return { summary: 'Confirm the 15-rule checklist: narrative, table fallback, aria labels, and non-pointer guidance for interactions.' };
}
