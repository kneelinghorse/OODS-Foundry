// Dashboard-level a11y narrative (sprint-115 m04).
//
// A cross-panel narrative {summary, keyFindings} DERIVED from the computed KPI flags
// (trendDirection / delta / thresholdBreached / anomaly) — the decision-centric
// signal of a metric-overview dashboard. This folds in the twice-deferred
// anomaly-narration: the narrative is the agent-readable summary embedded in the
// HTML export.
//
// The author-override fallback is REUSED from narrative-generator.ts
// (applyNarrativeOverride) rather than reimplemented, so an author-supplied
// narrative wins with byte-identical precedence to the single-chart path.

import { applyNarrativeOverride, type MeasureNarrativeContext, type ProvidedNarrative } from './narrative-generator.js';
import { narrateFormatted, narrateNumber } from './format.js';

/** One KPI's computed signal, projected for narration. */
export interface DashboardKpiSummary {
  /** Display label (panel title, falling back to the metric field). */
  readonly label: string;
  /** Deterministic string form of the KPI value. */
  readonly formatted: string;
  readonly trendDirection: 'increasing' | 'decreasing' | 'flat';
  /** value − baseline; null when no comparison basis resolved. */
  readonly delta: number | null;
  readonly thresholdBreached?: boolean;
  readonly anomaly?: boolean;
  /**
   * Governed-measure context (sprint-129 m02) — present only when a measure resolved
   * under resolveMeasures. The SAME shared shape m01 put on the single-chart narrative
   * input (no fork). When present, the unit annotates the formatted value and the
   * governed threshold value enriches the breach flag; absent === byte-identical to s116.
   */
  readonly measureContext?: MeasureNarrativeContext;
}

export interface DashboardNarrative {
  readonly summary: string;
  readonly keyFindings: readonly string[];
}

/**
 * Derive a cross-panel narrative from the KPI signals. Pure + deterministic: the
 * summary aggregates the metric count + how many breached threshold / flagged
 * anomalous; each key finding restates a KPI's value, trend, delta, and any flag.
 */
export function deriveDashboardNarrative(
  kpis: readonly DashboardKpiSummary[],
): { summary?: string; keyFindings: string[] } {
  if (kpis.length === 0) {
    return { summary: undefined, keyFindings: [] };
  }

  const breaches = kpis.filter((k) => k.thresholdBreached);
  const anomalies = kpis.filter((k) => k.anomaly);

  const summaryParts = [
    `${narrateNumber(kpis.length, 'kpi-count', String(kpis.length))} key metric${kpis.length === 1 ? '' : 's'} tracked.`,
  ];
  if (breaches.length > 0) {
    summaryParts.push(
      `${narrateNumber(breaches.length, 'kpi-breach-count', String(breaches.length))} ${breaches.length === 1 ? 'metric' : 'metrics'} breached threshold.`
    );
  }
  if (anomalies.length > 0) {
    summaryParts.push(`${narrateNumber(anomalies.length, 'kpi-anomaly-count', String(anomalies.length))} flagged anomalous.`);
  }

  const keyFindings = kpis
    .map((k) => {
      // s160 m4: WAS raw `${k.delta}` — a formatter-contract bypass; now tagged + shared-formatted.
      const deltaPhrase = k.delta === null ? '' : `, delta ${narrateNumber(k.delta, 'kpi-delta')}`;
      // Measure-context (sprint-129 m02): the governed unit annotates the value and the
      // governed threshold value enriches the breach flag. Absent === byte-identical to s116.
      const unit = k.measureContext?.unit;
      const formatted = narrateFormatted('kpi-value', unit ? `${k.formatted} ${unit}` : k.formatted);
      const thresholdValue = k.measureContext?.thresholdValue;
      // s130-m02: name the RESOLVED comparison baseline the delta was computed against. Only the
      // 'target' basis carries a static value to verbalize; the `vs target N` literal is IDENTICAL
      // to the single-chart emit site in narrative-generator.ts (describeMeasureContext) — no fork.
      const targetPhrase =
        k.measureContext?.comparisonBasis === 'target' && k.measureContext.comparisonValue !== undefined
          ? ` vs target ${narrateNumber(k.measureContext.comparisonValue, 'kpi-target')}`
          : '';
      const flags: string[] = [];
      if (k.thresholdBreached) {
        // s160 m4: WAS raw `${thresholdValue}` — bypass killed; tagged + shared-formatted.
        flags.push(
          thresholdValue !== undefined
            ? `threshold ${narrateNumber(thresholdValue, 'kpi-threshold')} breached`
            : 'threshold breached'
        );
      }
      if (k.anomaly) {
        flags.push('anomaly');
      }
      const flagPhrase = flags.length > 0 ? ` — ${flags.join(', ')}` : '';
      return `${k.label}: ${formatted} (${k.trendDirection}${deltaPhrase}${targetPhrase})${flagPhrase}`;
    })
    .slice(0, 5);

  return { summary: summaryParts.join(' '), keyFindings };
}

/**
 * Resolve the dashboard narrative: an author-supplied narrative wins (shared
 * override precedence); otherwise the KPI-derived narrative; otherwise the
 * dashboard description as the fallback summary.
 */
export function resolveDashboardNarrative(
  authorNarrative: ProvidedNarrative | undefined,
  kpis: readonly DashboardKpiSummary[],
  fallbackSummary: string,
): DashboardNarrative {
  const derived = deriveDashboardNarrative(kpis);
  const { summary, keyFindings } = applyNarrativeOverride(authorNarrative, derived, fallbackSummary);
  return { summary, keyFindings };
}
