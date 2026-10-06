/**
 * C3 — Review/recovery emitter (sprint-99 m04).
 *
 * Third non-prescriptive fidelity on the OODS fidelity ladder (D2), and the
 * FIRST renderer that consumes the oods.confidence_decomposition field that
 * sprint-97 F1 shipped. Until now, confidence_decomposition was a write-only
 * field — Forge could emit it and concordance could store it, but no Forge
 * consumer had read it. C3 closes that gap.
 *
 * Per decision #448 (2026-05-16), scope is renderer fidelity — NOT a
 * new MCP tool. The renderer reuses the C1/C2 emitter pattern + data-*
 * attribute contract, so a future interactive editor / triage tool can
 * consume the same DOM without re-implementing the confidence-reading logic.
 *
 * Visual language:
 *   - Entities render as cards (similar baseline to C2 wireframe, NOT C1
 *     boxes-and-arrows which is relationship-focused).
 *   - Each entity displays a confidence badge with one of four tiers:
 *       high ≥0.8 (green), medium 0.5–0.8 (yellow), low <0.5 (red),
 *       unknown (gray, when oods.confidence_decomposition is absent).
 *   - Entities below reviewThreshold (default 0.7) — or with unknown tier —
 *     get a visible "REVIEW NEEDED" header banner AND a slot-level breakdown
 *     listing the top 3 lowest-confidence sub-signals from
 *     confidence_decomposition.signals[]. Above-threshold entities render
 *     compact (badge only, no breakdown).
 *   - data-entity-urn / data-confidence-score / data-confidence-tier
 *     attributes mirror C1/C2 so a future triage tool can find and group
 *     review-needed entities without parsing visible text.
 *
 * Consumes runPreEmit() per entity (same as C1/C2; the third consumer of the
 * PreEmitContext shape and the empirical rule-of-three trigger). Reads
 * oods.confidence_decomposition explicitly from the entity input — not via
 * CatalogAnnotations — so the renderer's data dependency is honest. (pre-emit
 * also surfaces the field, but reading from the source makes the coupling
 * unambiguous.)
 */

import type {
  ObjectCatalogManifest,
  OodsConfidenceDecomposition,
  OodsConfidenceSignal,
  OodsSlot,
  SemanticEntity,
} from '../object-catalog/types.js';
import { dataAttr, escapeHtml } from './html-utils.js';
import { runPreEmit, type CatalogAnnotations } from './pre-emit.js';

export type ReviewFramework = 'review';

export type ConfidenceTier = 'high' | 'medium' | 'low' | 'unknown';

export interface ReviewOptions {
  /** Optional render title shown in the document <title> + <h1>. Defaults to "OODS Review — <source-agent>". */
  title?: string;
  /** When false, inline CSS is omitted. Default: true. */
  includeStyles?: boolean;
  /** Variant selector forwarded to runPreEmit() per entity. */
  variant?: string;
  /**
   * Threshold below which an entity gets the REVIEW NEEDED banner +
   * signal breakdown. Defaults to 0.7. Tier classification (high/medium/low)
   * is independent of this threshold; the banner is purely about
   * "should a human re-check this entity."
   */
  reviewThreshold?: number;
}

export interface ReviewIssue {
  code: string;
  message: string;
  entity?: string;
}

export interface ReviewResult {
  status: 'ok' | 'error';
  framework: ReviewFramework;
  code: string;
  fileExtension: '.html';
  warnings: ReviewIssue[];
  errors?: ReviewIssue[];
  meta: {
    entitiesRendered: number;
    /** Number of entities whose tier ended up REVIEW NEEDED (below threshold OR unknown). */
    entitiesFlaggedForReview: number;
    /** Count per tier — useful for dashboards consuming the emitter output. */
    tierCounts: Record<ConfidenceTier, number>;
    catalogVersion?: string;
    sourceAgent?: string;
    /** Effective threshold applied to this render — surfaced for reproducibility. */
    reviewThreshold: number;
  };
}

const DEFAULT_REVIEW_THRESHOLD = 0.7;

// ---------------------------------------------------------------------------
// Confidence classification
// ---------------------------------------------------------------------------

/**
 * Classify a confidence_decomposition.total score into a visual tier.
 * Returns 'unknown' when the score is null (confidence_decomposition absent
 * on the entity). The thresholds are fixed per the mission spec; the
 * REVIEW NEEDED threshold (reviewThreshold) is independent.
 */
export function classifyTier(score: number | null): ConfidenceTier {
  if (score === null || score === undefined || Number.isNaN(score)) return 'unknown';
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

/**
 * An entity needs human review when (a) its tier is unknown (no
 * confidence_decomposition emitted at all — that's a signal worth surfacing),
 * or (b) its total score is strictly below reviewThreshold.
 *
 * Strictly-less-than is deliberate: an entity exactly at threshold is
 * considered acceptable. Reviewers should be able to set threshold=score to
 * shrink the review surface.
 */
export function needsReview(
  score: number | null,
  reviewThreshold: number,
): boolean {
  if (score === null || score === undefined || Number.isNaN(score)) return true;
  return score < reviewThreshold;
}

/**
 * Sort signals ascending by score (lowest first) and take the top-N. Stable
 * for ties: preserves source order. Useful for "show the 3 weakest sub-
 * signals" in the breakdown.
 */
export function lowestSignals(
  signals: OodsConfidenceSignal[],
  n: number,
): OodsConfidenceSignal[] {
  if (n <= 0 || signals.length === 0) return [];
  // Decorated index sort to keep stable for ties.
  return signals
    .map((sig, idx) => ({ sig, idx }))
    .sort((a, b) => (a.sig.score - b.sig.score) || (a.idx - b.idx))
    .slice(0, n)
    .map(({ sig }) => sig);
}

// ---------------------------------------------------------------------------
// Per-entity rendering
// ---------------------------------------------------------------------------

function renderSlotPlaceholder(slot: OodsSlot): string {
  return [
    `        <div class="slot"${dataAttr('slot-name', slot.name)}${dataAttr(
      'slot-field',
      slot.binding.field,
    )}>`,
    `          <span class="slot-name">${escapeHtml(slot.name)}</span>`,
    `          <code class="slot-field">${escapeHtml(slot.binding.field)}</code>`,
    `        </div>`,
  ].join('\n');
}

function renderSlotsBlock(slots: OodsSlot[]): string {
  if (slots.length === 0) {
    return `        <p class="empty">No slots</p>`;
  }
  return [
    `        <div class="slots">`,
    slots.map(renderSlotPlaceholder).join('\n'),
    `        </div>`,
  ].join('\n');
}

function renderSignalRow(signal: OodsConfidenceSignal): string {
  // Format score to 2 decimals for display; the data-signal-score attribute
  // carries the raw value for downstream consumers.
  const display = signal.score.toFixed(2);
  return [
    `          <li class="signal-row"${dataAttr('signal-name', signal.name)}${dataAttr(
      'signal-score',
      signal.score,
    )}>`,
    `            <span class="signal-name">${escapeHtml(signal.name)}</span>`,
    `            <span class="signal-score">${escapeHtml(display)}</span>`,
    signal.hint
      ? `            <span class="signal-hint">${escapeHtml(signal.hint)}</span>`
      : '',
    `          </li>`,
  ]
    .filter(Boolean)
    .join('\n');
}

function renderReviewBreakdown(decomposition: OodsConfidenceDecomposition | null): string {
  if (decomposition === null) {
    return [
      `        <div class="review-breakdown" data-breakdown="missing">`,
      `          <p class="breakdown-empty">No confidence_decomposition emitted by source.</p>`,
      `        </div>`,
    ].join('\n');
  }
  const lowest = lowestSignals(decomposition.signals, 3);
  if (lowest.length === 0) {
    return [
      `        <div class="review-breakdown" data-breakdown="empty">`,
      `          <p class="breakdown-empty">No sub-signals available.</p>`,
      `        </div>`,
    ].join('\n');
  }
  return [
    `        <div class="review-breakdown" data-breakdown="ranked">`,
    `          <p class="breakdown-label">Lowest sub-signals (top ${lowest.length}):</p>`,
    `          <ol class="signal-list">`,
    lowest.map(renderSignalRow).join('\n'),
    `          </ol>`,
    `        </div>`,
  ].join('\n');
}

function renderEntity(
  annotations: CatalogAnnotations,
  decomposition: OodsConfidenceDecomposition | null,
  reviewThreshold: number,
): { html: string; tier: ConfidenceTier; flagged: boolean } {
  const { urn, element, slots } = annotations;
  const score = decomposition ? decomposition.total : null;
  const tier = classifyTier(score);
  const flagged = needsReview(score, reviewThreshold);

  // Score display: '—' for unknown; 2-decimal otherwise.
  const scoreDisplay = score === null ? '—' : score.toFixed(2);

  const lines: string[] = [];
  lines.push(
    `    <article class="entity tier-${tier}${flagged ? ' flagged' : ''}"` +
      `${dataAttr('entity-urn', urn)}` +
      `${dataAttr('element-type', element.type)}` +
      `${dataAttr('element-object', element.object)}` +
      `${dataAttr('element-action', element.action)}` +
      `${dataAttr('confidence-score', score === null ? '' : score)}` +
      `${dataAttr('confidence-tier', tier)}` +
      `${dataAttr('flagged-for-review', flagged ? 'true' : 'false')}` +
      `${dataAttr('slot-count', slots.length)}>`,
  );

  if (flagged) {
    lines.push(`      <div class="review-banner" role="alert">`);
    lines.push(`        <span class="review-banner-label">REVIEW NEEDED</span>`);
    lines.push(
      `        <span class="review-banner-reason">${escapeHtml(
        tier === 'unknown'
          ? 'Confidence not provided'
          : `Score ${scoreDisplay} below threshold ${reviewThreshold.toFixed(2)}`,
      )}</span>`,
    );
    lines.push(`      </div>`);
  }

  lines.push(`      <header class="entity-header">`);
  lines.push(`        <h2 class="entity-name">${escapeHtml(element.name)}</h2>`);
  lines.push(
    `        <span class="confidence-badge tier-${tier}"${dataAttr('tier', tier)}>` +
      `<span class="badge-label">${escapeHtml(tier.toUpperCase())}</span>` +
      ` <span class="badge-score">${escapeHtml(scoreDisplay)}</span>` +
      `</span>`,
  );
  lines.push(`      </header>`);

  lines.push(`      <section class="slots-block" aria-label="Slots">`);
  lines.push(renderSlotsBlock(slots));
  lines.push(`      </section>`);

  if (flagged) {
    lines.push(`      <section class="review-section" aria-label="Review breakdown">`);
    lines.push(renderReviewBreakdown(decomposition));
    lines.push(`      </section>`);
  }

  lines.push(`    </article>`);
  return { html: lines.join('\n'), tier, flagged };
}

// ---------------------------------------------------------------------------
// Embedded stylesheet — review/recovery
// ---------------------------------------------------------------------------

const STYLE = `
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0; padding: 1.5rem; background: #f6f7f9; color: #1f2329; line-height: 1.45; }
  h1 { font-size: 1.4rem; margin: 0 0 0.25rem; font-weight: 600; }
  h2 { font-size: 1rem; margin: 0; font-weight: 600; color: #1f2329; }
  code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 0.85em; color: #5b6471; }
  .catalog-header { margin-bottom: 1.5rem; }
  .catalog-meta { color: #5b6471; font-size: 0.85em; }
  .summary { display: flex; gap: 1rem; padding: 0.75rem 1rem; background: #ffffff; border: 1px solid #c8cdd4; border-radius: 0.25rem; margin: 0.75rem 0 1.5rem; font-size: 0.85em; }
  .summary-pill { padding: 0.15rem 0.5rem; border-radius: 999px; font-weight: 500; }
  .summary-pill.tier-high { background: #e6f4ec; color: #0a8a4a; }
  .summary-pill.tier-medium { background: #fff5dd; color: #aa6f00; }
  .summary-pill.tier-low { background: #fcebe9; color: #c0392b; }
  .summary-pill.tier-unknown { background: #eef0f4; color: #5b6471; }
  .entities { display: flex; flex-direction: column; gap: 1rem; }
  .entity { background: #ffffff; border: 1px solid #c8cdd4; border-radius: 0.375rem; padding: 1rem; }
  .entity.flagged { border-color: #c0392b; box-shadow: 0 0 0 1px #fcebe9 inset; }
  .entity-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 0.5rem; margin-bottom: 0.5rem; border-bottom: 1px solid #ebedf0; }
  .confidence-badge { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.2rem 0.55rem; border-radius: 999px; font-size: 0.75em; font-weight: 600; letter-spacing: 0.02em; }
  .confidence-badge.tier-high { background: #e6f4ec; color: #0a8a4a; }
  .confidence-badge.tier-medium { background: #fff5dd; color: #aa6f00; }
  .confidence-badge.tier-low { background: #fcebe9; color: #c0392b; }
  .confidence-badge.tier-unknown { background: #eef0f4; color: #5b6471; }
  .badge-score { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
  .review-banner { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; background: #fcebe9; border-bottom: 1px solid #f3c9c2; margin: -1rem -1rem 1rem -1rem; border-radius: 0.375rem 0.375rem 0 0; }
  .review-banner-label { background: #c0392b; color: #ffffff; padding: 0.15rem 0.5rem; border-radius: 0.2rem; font-size: 0.7em; font-weight: 700; letter-spacing: 0.04em; }
  .review-banner-reason { color: #7a2a1f; font-size: 0.8em; }
  .slots { display: flex; flex-direction: column; gap: 0.4rem; }
  .slot { display: flex; align-items: center; gap: 0.75rem; padding: 0.4rem 0.6rem; background: #f6f7f9; border: 1px solid #ebedf0; border-radius: 0.25rem; }
  .slot-name { font-size: 0.85em; font-weight: 500; color: #1f2329; min-width: 5rem; }
  .slot-field { font-size: 0.8em; color: #5b6471; }
  .empty { color: #8a8f99; font-style: italic; font-size: 0.85em; margin: 0; padding: 0.4rem 0.6rem; background: #f6f7f9; border: 1px solid #ebedf0; border-radius: 0.25rem; text-align: center; }
  .review-section { margin-top: 0.75rem; }
  .review-breakdown { padding: 0.5rem 0.6rem; background: #fdf4f3; border: 1px solid #f3c9c2; border-radius: 0.25rem; }
  .breakdown-label { margin: 0 0 0.4rem; font-size: 0.8em; color: #7a2a1f; font-weight: 600; }
  .breakdown-empty { margin: 0; font-size: 0.8em; font-style: italic; color: #7a2a1f; }
  .signal-list { margin: 0; padding-left: 1.25rem; display: flex; flex-direction: column; gap: 0.3rem; }
  .signal-row { display: flex; align-items: baseline; gap: 0.5rem; font-size: 0.8em; color: #5b6471; }
  .signal-name { font-weight: 500; color: #1f2329; }
  .signal-score { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; color: #c0392b; min-width: 2.5rem; }
  .signal-hint { color: #5b6471; font-style: italic; }
  .legend { margin-top: 2rem; padding: 0.75rem 1rem; background: #ffffff; border: 1px solid #c8cdd4; border-radius: 0.25rem; font-size: 0.85em; color: #5b6471; }
  .legend strong { color: #1f2329; }
`.trim();

// ---------------------------------------------------------------------------
// Top-level emit
// ---------------------------------------------------------------------------

export function emit(
  manifest: ObjectCatalogManifest,
  options: ReviewOptions = {},
): ReviewResult {
  const warnings: ReviewIssue[] = [];
  const errors: ReviewIssue[] = [];
  const includeStyles = options.includeStyles !== false;
  const reviewThreshold =
    typeof options.reviewThreshold === 'number' &&
    Number.isFinite(options.reviewThreshold)
      ? options.reviewThreshold
      : DEFAULT_REVIEW_THRESHOLD;

  const tierCounts: Record<ConfidenceTier, number> = {
    high: 0,
    medium: 0,
    low: 0,
    unknown: 0,
  };

  const entityBlocks: string[] = [];
  let flaggedCount = 0;

  for (const entity of manifest.entities as SemanticEntity[]) {
    try {
      const ctx = runPreEmit(entity, { variant: options.variant });
      if (!ctx.catalog) {
        warnings.push({
          code: 'OODS-REV-001',
          message: 'PreEmitContext lacked catalog annotations for entity',
          entity: entity.urn,
        });
        continue;
      }
      // Read confidence_decomposition explicitly from the input, not from
      // the catalog annotations — keeps the renderer's data dependency on
      // the F1 field surface explicit.
      const decomposition = entity.oods?.confidence_decomposition ?? null;
      const rendered = renderEntity(ctx.catalog, decomposition, reviewThreshold);
      entityBlocks.push(rendered.html);
      tierCounts[rendered.tier] += 1;
      if (rendered.flagged) flaggedCount += 1;
    } catch (err) {
      errors.push({
        code: 'OODS-REV-002',
        message: `Failed to render entity: ${(err as Error).message}`,
        entity: entity.urn,
      });
    }
  }

  const sourceAgent = manifest.source?.agent;
  const catalogVersion = manifest.source?.oods_catalog_version;
  const capturedAt = manifest.source?.captured_at;
  const titleText = options.title ?? `OODS Review — ${sourceAgent ?? 'Unknown source'}`;

  const docParts: string[] = [];
  docParts.push('<!DOCTYPE html>');
  docParts.push('<html lang="en">');
  docParts.push('<head>');
  docParts.push(`  <meta charset="utf-8">`);
  docParts.push(`  <title>${escapeHtml(titleText)}</title>`);
  if (includeStyles) {
    docParts.push(`  <style>\n${STYLE}\n  </style>`);
  }
  docParts.push('</head>');
  docParts.push(
    `<body${dataAttr('catalog-version', catalogVersion)}${dataAttr('source-agent', sourceAgent)}${dataAttr('captured-at', capturedAt)}${dataAttr('fidelity', 'review')}${dataAttr('review-threshold', reviewThreshold)}${dataAttr('entities-flagged', flaggedCount)}>`,
  );
  docParts.push('  <header class="catalog-header">');
  docParts.push(`    <h1>${escapeHtml(titleText)}</h1>`);
  docParts.push(
    `    <p class="catalog-meta">Catalog v${escapeHtml(catalogVersion ?? '1.0.0')} · ${manifest.entities.length} entit${manifest.entities.length === 1 ? 'y' : 'ies'}${capturedAt ? ` · captured ${escapeHtml(capturedAt)}` : ''} · threshold ${reviewThreshold.toFixed(2)}</p>`,
  );
  docParts.push('  </header>');
  docParts.push('  <section class="summary" aria-label="Confidence summary">');
  docParts.push(`    <span class="summary-pill tier-high"${dataAttr('tier', 'high')}${dataAttr('count', tierCounts.high)}>HIGH · ${tierCounts.high}</span>`);
  docParts.push(`    <span class="summary-pill tier-medium"${dataAttr('tier', 'medium')}${dataAttr('count', tierCounts.medium)}>MEDIUM · ${tierCounts.medium}</span>`);
  docParts.push(`    <span class="summary-pill tier-low"${dataAttr('tier', 'low')}${dataAttr('count', tierCounts.low)}>LOW · ${tierCounts.low}</span>`);
  docParts.push(`    <span class="summary-pill tier-unknown"${dataAttr('tier', 'unknown')}${dataAttr('count', tierCounts.unknown)}>UNKNOWN · ${tierCounts.unknown}</span>`);
  docParts.push('  </section>');
  docParts.push('  <section class="entities" aria-label="Entities">');
  docParts.push(entityBlocks.join('\n'));
  docParts.push('  </section>');
  docParts.push('  <aside class="legend">');
  docParts.push(
    `    <p><strong>Legend</strong> · green = high ≥0.8, yellow = medium 0.5–0.8, red = low &lt;0.5, gray = unknown (no confidence_decomposition emitted). Entities below threshold ${reviewThreshold.toFixed(2)} or with unknown tier display a REVIEW NEEDED banner and the 3 lowest sub-signals.</p>`,
  );
  docParts.push('  </aside>');
  docParts.push('</body>');
  docParts.push('</html>');
  docParts.push('');

  return {
    status: errors.length === 0 ? 'ok' : 'error',
    framework: 'review',
    code: docParts.join('\n'),
    fileExtension: '.html',
    warnings,
    ...(errors.length > 0 ? { errors } : {}),
    meta: {
      entitiesRendered: entityBlocks.length,
      entitiesFlaggedForReview: flaggedCount,
      tierCounts,
      catalogVersion,
      sourceAgent,
      reviewThreshold,
    },
  };
}
