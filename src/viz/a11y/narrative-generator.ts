import type { NormalizedVizSpec } from '../spec/normalized-viz-spec.js';
import {
  analyzeVizSpec,
  describeDataPoint,
  getEncodingBinding,
  type VizDataAnalysis,
} from './data-analysis.js';
import { formatNumeric, formatPercent } from './format.js';

export interface NarrativeResult {
  readonly status: 'ready' | 'insufficient-data';
  readonly summary: string;
  readonly keyFindings: readonly string[];
  readonly analysis: VizDataAnalysis;
}

interface NarrativeLabels {
  readonly chartLabel: string;
  readonly measureLabel?: string;
  readonly dimensionLabel?: string;
  readonly colorLabel?: string;
}

export function generateNarrativeSummary(spec: NormalizedVizSpec): NarrativeResult {
  const analysis = analyzeVizSpec(spec);
  const labels: NarrativeLabels = {
    chartLabel: spec.name ?? spec.a11y.ariaLabel ?? spec.id ?? 'This visualization',
    measureLabel: resolveFieldLabel(spec, 'y'),
    dimensionLabel: resolveFieldLabel(spec, 'x'),
    colorLabel: resolveFieldLabel(spec, 'color'),
  };

  const derived = deriveNarrativeFromData(analysis, labels);
  const providedSummary = spec.a11y.narrative?.summary?.trim();
  const providedFindings = spec.a11y.narrative?.keyFindings?.filter((finding) => finding && finding.trim() !== '') ?? [];

  const summary = (providedSummary || derived.summary || spec.a11y.description).trim();
  const keyFindings = providedFindings.length > 0 ? providedFindings : derived.keyFindings;

  return {
    status: summary.length > 0 ? 'ready' : 'insufficient-data',
    summary,
    keyFindings,
    analysis,
  } satisfies NarrativeResult;
}

function deriveNarrativeFromData(analysis: VizDataAnalysis, labels: NarrativeLabels): {
  readonly summary?: string;
  readonly keyFindings: string[];
} {
  const summaryParts: string[] = [];
  switch (analysis.mark) {
    case 'line': {
      if (analysis.first && analysis.last) {
        const directionLabel =
          analysis.trend === 'increasing'
            ? 'rises'
            : analysis.trend === 'decreasing'
              ? 'declines'
              : 'remains relatively flat';
        summaryParts.push(
          `${labels.chartLabel} ${directionLabel} from ${formatNumeric(analysis.first.value)} (${analysis.first.label}) to ${formatNumeric(analysis.last.value)} (${analysis.last.label}).`
        );
        if (analysis.trendDelta !== undefined && analysis.first.value !== 0) {
          const percent = analysis.trendDelta / Math.max(Math.abs(analysis.first.value), 1);
          summaryParts.push(`Overall change of ${formatPercent(percent)} across the period.`);
        }
      }
      break;
    }
    case 'bar':
    case 'area': {
      if (analysis.max && analysis.min) {
        summaryParts.push(
          `${labels.chartLabel} compares ${labels.dimensionLabel ?? 'categories'}; ${analysis.max.label} leads at ${formatNumeric(analysis.max.value)} while ${analysis.min.label} is lowest at ${formatNumeric(analysis.min.value)}.`
        );
      }
      break;
    }
    case 'point': {
      if (analysis.correlation !== undefined) {
        summaryParts.push(
          `${labels.chartLabel} shows a ${describeCorrelation(analysis.correlation)} relationship between ${labels.dimensionLabel ?? 'x'} and ${labels.measureLabel ?? 'y'}.`
        );
      }
      break;
    }
    default: {
      if (analysis.total !== undefined && analysis.rowCount > 0) {
        summaryParts.push(
          `${labels.chartLabel} covers ${analysis.rowCount} data points totaling ${formatNumeric(analysis.total)} ${labels.measureLabel ?? ''}.`
        );
      }
    }
  }

  const keyFindings = buildKeyFindings(analysis, labels);
  return {
    summary: summaryParts.join(' ').trim() || undefined,
    keyFindings,
  };
}

function buildKeyFindings(analysis: VizDataAnalysis, labels: NarrativeLabels): string[] {
  const findings: string[] = [];
  if (analysis.max) {
    findings.push(`High ${labels.measureLabel ?? 'value'}: ${describeDataPoint(analysis.max, labels.measureLabel)}`);
  }
  if (analysis.min && (!analysis.max || analysis.min.label !== analysis.max.label || analysis.min.value !== analysis.max.value)) {
    findings.push(`Low ${labels.measureLabel ?? 'value'}: ${describeDataPoint(analysis.min, labels.measureLabel)}`);
  }
  if (analysis.trend && analysis.trendDelta !== undefined) {
    const percent = analysis.first && analysis.first.value !== 0 ? analysis.trendDelta / analysis.first.value : undefined;
    findings.push(
      `Trend ${analysis.trend}: ${percent !== undefined ? formatPercent(percent) : formatNumeric(analysis.trendDelta)}`
    );
  }
  if (analysis.total !== undefined) {
    findings.push(`Total ${labels.measureLabel ?? 'value'}: ${formatNumeric(analysis.total)}`);
  }
  if (analysis.colorCategories.length > 0 && labels.colorLabel) {
    findings.push(`${labels.colorLabel}: ${analysis.colorCategories.join(', ')}`);
  }
  if (analysis.correlation !== undefined) {
    findings.push(`Correlation coefficient: ${analysis.correlation}`);
  }
  if (analysis.rowCount > 0 && findings.length === 0) {
    findings.push(`${analysis.rowCount} rows analysed.`);
  }
  return findings.slice(0, 5);
}

function resolveFieldLabel(spec: NormalizedVizSpec, channel: keyof NormalizedVizSpec['encoding']): string | undefined {
  const binding = getEncodingBinding(spec, channel);
  if (!binding) {
    return undefined;
  }
  if (binding.title && binding.title.trim() !== '') {
    return binding.title;
  }
  if (binding.field && binding.field.trim() !== '') {
    return humanize(binding.field);
  }
  return undefined;
}

function humanize(value: string): string {
  const withSpaces = value
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function describeCorrelation(value: number): string {
  const magnitude = Math.abs(value);
  if (magnitude >= 0.75) {
    return value >= 0 ? 'strong positive' : 'strong negative';
  }
  if (magnitude >= 0.4) {
    return value >= 0 ? 'moderate positive' : 'moderate negative';
  }
  return value >= 0 ? 'weak positive' : 'weak negative';
}
