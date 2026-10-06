import { describe, expect, it } from 'vitest';
import {
  analyzeSankey,
  generateAccessibleTable,
  generateNarrativeSummary,
  type MeasureNarrativeContext,
  type SankeyInput,
} from '@oods/viz-core';

// Sprint-129 m01 — "narrative speaks over governed measures." The deterministic
// narrative gains an OPTIONAL measure-context (unit/format/threshold from a resolved
// measure-registry entry) carried alongside the pre-built analysis. These tests pin
// that the context surfaces in keyFindings, that an ABSENT or governed-content-free
// context is byte-identical to the s128 output, that the ONE applyNarrativeOverride
// precedence path still lets an author win, and that the table caption names the unit.

const SANKEY: SankeyInput = {
  nodes: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
  links: [
    { source: 'A', target: 'B', value: 5 },
    { source: 'A', target: 'C', value: 15 },
    { source: 'B', target: 'C', value: 8 },
  ],
};

// The full s128 (pre-measure-context) keyFindings for analyzeSankey(SANKEY) with the
// 'Flow' measure label. Encoded here so any drift on the absent-context path reds.
const S128_FINDINGS = ['High Flow: Flow 15 (A → C)', 'Low Flow: Flow 5 (A → B)', 'Total Flow: 28'];

const MEASURE_CTX: MeasureNarrativeContext = { unit: '1000 USD', format: 'currency', thresholdValue: 350 };

describe('generateNarrativeSummary — measure-context (sprint-129 m01)', () => {
  it('absent measureContext is byte-identical to the s128 narrative output', () => {
    const narrative = generateNarrativeSummary({
      analysis: analyzeSankey(SANKEY),
      chartLabel: 'Corridor flows',
      measureLabel: 'Flow',
    });
    expect(narrative.summary).toBe('Corridor flows covers 3 data points totaling 28 Flow.');
    expect(narrative.keyFindings).toEqual(S128_FINDINGS);
  });

  it('surfaces the governed unit/format/threshold as a LEADING key finding', () => {
    const narrative = generateNarrativeSummary({
      analysis: analyzeSankey(SANKEY),
      chartLabel: 'Corridor flows',
      measureLabel: 'Flow',
      measureContext: MEASURE_CTX,
    });
    // The measure frame leads; the data findings follow UNCHANGED (purely additive).
    expect(narrative.keyFindings[0]).toBe('Measure: Flow; unit 1000 USD; format currency; threshold 350');
    expect(narrative.keyFindings.slice(1)).toEqual(S128_FINDINGS);
    // measure-context enriches ONLY the findings; the summary is byte-identical.
    expect(narrative.summary).toBe('Corridor flows covers 3 data points totaling 28 Flow.');
  });

  it('surfaces each governed field independently (partial context)', () => {
    const onlyThreshold = generateNarrativeSummary({
      analysis: analyzeSankey(SANKEY),
      measureLabel: 'Flow',
      measureContext: { thresholdValue: 100 },
    });
    expect(onlyThreshold.keyFindings[0]).toBe('Measure: Flow; threshold 100');

    const onlyUnit = generateNarrativeSummary({
      analysis: analyzeSankey(SANKEY),
      measureLabel: 'Flow',
      measureContext: { unit: 'USD' },
    });
    expect(onlyUnit.keyFindings[0]).toBe('Measure: Flow; unit USD');
  });

  it('a governed-content-free ({}) measureContext stays byte-identical (no measure finding)', () => {
    const base = generateNarrativeSummary({ analysis: analyzeSankey(SANKEY), measureLabel: 'Flow' });
    const empty = generateNarrativeSummary({
      analysis: analyzeSankey(SANKEY),
      measureLabel: 'Flow',
      measureContext: {},
    });
    expect(empty.keyFindings).toEqual(base.keyFindings);
    expect(empty.keyFindings.some((f) => f.startsWith('Measure:'))).toBe(false);
  });

  it('an author override still WINS through the ONE precedence path, suppressing the measure finding', () => {
    const narrative = generateNarrativeSummary({
      analysis: analyzeSankey(SANKEY),
      measureLabel: 'Flow',
      measureContext: MEASURE_CTX,
      narrative: { summary: 'Hand-written.', keyFindings: ['Only this'] },
    });
    expect(narrative.summary).toBe('Hand-written.');
    expect(narrative.keyFindings).toEqual(['Only this']);
  });
});

describe('generateNarrativeSummary — no-measureLabel summary omits the stray space (s151 m05)', () => {
  it('emits "...totaling 28." with NO trailing space when no measureLabel is given (fails at HEAD: "28 .")', () => {
    const narrative = generateNarrativeSummary({
      analysis: analyzeSankey(SANKEY),
      chartLabel: 'Corridor flows',
    });
    // The default summary branch previously left a hard space before the period when the
    // measure label was empty ("...totaling 28 ."); the conditional-space fix drops it.
    expect(narrative.summary).toBe('Corridor flows covers 3 data points totaling 28.');
    expect(narrative.summary).not.toMatch(/\d \./);
  });

  it('with a measureLabel the summary is byte-identical (the space rides WITH the label)', () => {
    // Guards the ZERO-golden promise: adding the conditional must not move the with-label path.
    const narrative = generateNarrativeSummary({
      analysis: analyzeSankey(SANKEY),
      chartLabel: 'Corridor flows',
      measureLabel: 'Flow',
    });
    expect(narrative.summary).toBe('Corridor flows covers 3 data points totaling 28 Flow.');
  });
});

describe('generateNarrativeSummary — comparison-basis "vs target" (sprint-130 m02)', () => {
  it('appends "vs target N" when the RESOLVED comparison basis is target (the IDENTICAL cross-panel literal)', () => {
    const narrative = generateNarrativeSummary({
      analysis: analyzeSankey(SANKEY),
      measureLabel: 'Flow',
      measureContext: { ...MEASURE_CTX, comparisonBasis: 'target', comparisonValue: 300 },
    });
    // The clause rides INSIDE the leading measure finding, after the governed threshold.
    expect(narrative.keyFindings[0]).toBe('Measure: Flow; unit 1000 USD; format currency; threshold 350; vs target 300');
    expect(narrative.keyFindings.slice(1)).toEqual(S128_FINDINGS);
  });

  it('does NOT verbalize a non-target basis (prior_period/window carry no static value to name)', () => {
    const prior = generateNarrativeSummary({
      analysis: analyzeSankey(SANKEY),
      measureLabel: 'Flow',
      measureContext: { thresholdValue: 100, comparisonBasis: 'prior_period' },
    });
    expect(prior.keyFindings[0]).toBe('Measure: Flow; threshold 100');
    expect(prior.keyFindings.some((f) => f.includes('vs target'))).toBe(false);
  });

  it('requires BOTH basis=target AND a present value — a target basis with no value adds no clause', () => {
    const narrative = generateNarrativeSummary({
      analysis: analyzeSankey(SANKEY),
      measureLabel: 'Flow',
      measureContext: { unit: 'USD', comparisonBasis: 'target' },
    });
    expect(narrative.keyFindings[0]).toBe('Measure: Flow; unit USD');
  });
});

describe('generateAccessibleTable — measure-context unit caption (sprint-129 m01)', () => {
  it('names the governed unit in the resolved caption when present', () => {
    const table = generateAccessibleTable({
      analysis: analyzeSankey(SANKEY),
      measureContext: { unit: '1000 USD' },
    });
    expect(table.status).toBe('ready');
    if (table.status !== 'ready') return;
    expect(table.caption).toBe('Data table for Visualization (1000 USD)');
  });

  it('names the unit alongside a caller-supplied caption', () => {
    const table = generateAccessibleTable({
      analysis: analyzeSankey(SANKEY),
      caption: 'Corridor flows',
      measureContext: { unit: '1000 USD' },
    });
    expect(table.status).toBe('ready');
    if (table.status !== 'ready') return;
    expect(table.caption).toBe('Corridor flows (1000 USD)');
  });

  it('is byte-identical when measureContext is absent or carries no unit', () => {
    const absent = generateAccessibleTable({ analysis: analyzeSankey(SANKEY) });
    const noUnit = generateAccessibleTable({
      analysis: analyzeSankey(SANKEY),
      measureContext: { format: 'currency', thresholdValue: 350 },
    });
    expect(absent.status).toBe('ready');
    expect(noUnit.status).toBe('ready');
    if (absent.status !== 'ready' || noUnit.status !== 'ready') return;
    expect(absent.caption).toBe('Data table for Visualization');
    expect(noUnit.caption).toBe('Data table for Visualization');
  });
});
