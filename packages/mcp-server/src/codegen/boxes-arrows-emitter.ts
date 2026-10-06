/**
 * C1 — Boxes-and-arrows emitter.
 *
 * First non-prescriptive fidelity on the OODS fidelity ladder (D2). Renders an
 * Object Catalog manifest as a self-contained single-HTML-file diagram: each
 * entity becomes a styled "box" article with role label, traits, and slot
 * bindings; each relationship.edge becomes a labeled "arrow" row pointing from
 * source URN to target URN.
 *
 * HTML/CSS over SVG (decision 2026-05-16): the data-* attributes
 * (data-entity-urn, data-relationship-source/target, data-trait, etc.) form
 * the semantic structure a future interactive editor (Miro/JamBoard/Lucidchart
 * -style) can hook into without re-parsing the visual layer. CSS-only arrows
 * via borders + Unicode glyphs keep the rendering deterministic and stylable.
 *
 * Consumes runPreEmit() from pre-emit.ts. The shared pre-emit pass produces a
 * CatalogAnnotations object per entity (pragmaticRole, traits, relationships,
 * slots, projectionVariants, brandOverlay, evidenceRefs, semantics summary,
 * confidenceDecomposition). This emitter is the first concrete renderer that
 * proves the runPreEmit() / PreEmitContext shape generalizes beyond the
 * existing react/vue/html code emitters.
 */

import type {
  EvidenceRef,
  ObjectCatalogManifest,
  OodsSlot,
  PragmaticRole,
  SemanticEntity,
  TypedRelationship,
} from '../object-catalog/types.js';
import { dataAttr, escapeHtml } from './html-utils.js';
import { runPreEmit, type CatalogAnnotations } from './pre-emit.js';

export type BoxesArrowsFramework = 'boxes-arrows';

export interface BoxesArrowsOptions {
  /** Optional render title shown in the document <title> + <h1>. Defaults to the manifest source agent. */
  title?: string;
  /** When false, inline CSS is omitted. Default: true. */
  includeStyles?: boolean;
  /** Variant selector forwarded to runPreEmit() per entity. */
  variant?: string;
}

export interface BoxesArrowsIssue {
  code: string;
  message: string;
  entity?: string;
}

export interface BoxesArrowsResult {
  status: 'ok' | 'error';
  framework: BoxesArrowsFramework;
  code: string;
  fileExtension: '.html';
  warnings: BoxesArrowsIssue[];
  errors?: BoxesArrowsIssue[];
  meta: {
    entitiesRendered: number;
    relationshipsRendered: number;
    catalogVersion?: string;
    sourceAgent?: string;
  };
}

const ROLE_LABEL: Record<PragmaticRole, string> = {
  primary_action: 'Primary action',
  secondary_action: 'Secondary action',
  destructive_action: 'Destructive action',
  recovery_action: 'Recovery action',
  navigation: 'Navigation',
  informational: 'Informational',
  page: 'Page',
  landing: 'Landing page',
  section: 'Section',
  index: 'Index',
};

function roleLabel(role: PragmaticRole | undefined): string {
  if (!role) return 'Unannotated';
  return ROLE_LABEL[role] ?? role;
}

// ---------------------------------------------------------------------------
// Per-entity rendering
// ---------------------------------------------------------------------------

function renderSlots(slots: OodsSlot[]): string {
  if (slots.length === 0) {
    return `        <p class="empty">No slot bindings declared.</p>`;
  }
  const items = slots
    .map(
      (slot) =>
        `          <li class="slot"${dataAttr('slot-name', slot.name)}${dataAttr(
          'slot-field',
          slot.binding.field,
        )}><span class="slot-name">${escapeHtml(slot.name)}</span><span class="slot-arrow">→</span><code class="slot-field">${escapeHtml(slot.binding.field)}</code></li>`,
    )
    .join('\n');
  return `        <ul class="slots">\n${items}\n        </ul>`;
}

function renderTraits(traits: string[]): string {
  if (traits.length === 0) {
    return `        <p class="empty">No traits declared.</p>`;
  }
  const chips = traits
    .map(
      (trait) =>
        `          <li class="trait"${dataAttr('trait', trait)}>${escapeHtml(trait)}</li>`,
    )
    .join('\n');
  return `        <ul class="traits">\n${chips}\n        </ul>`;
}

function renderEvidenceRefs(refs: EvidenceRef[]): string {
  if (refs.length === 0) return '';
  const items = refs
    .map(
      (ref) =>
        `          <li${dataAttr('evidence-protocol', ref.protocol)}${dataAttr(
          'evidence-provenance',
          ref.provenance,
        )}><code>${escapeHtml(ref.id)}</code> <span class="evidence-kind">${escapeHtml(ref.kind)}</span> <span class="evidence-weight">w=${ref.weight}</span></li>`,
    )
    .join('\n');
  return [
    `      <details class="evidence">`,
    `        <summary>Evidence (${refs.length})</summary>`,
    `        <ul>`,
    items,
    `        </ul>`,
    `      </details>`,
  ].join('\n');
}

function renderEntity(annotations: CatalogAnnotations): string {
  const {
    urn,
    element,
    pragmaticRole,
    traits,
    semantics,
    slots,
    brandOverlay,
    projectionVariants,
    states,
    preconditions,
    effects,
    evidenceRefs,
    confidenceDecomposition,
  } = annotations;

  const traitAttrs = traits.map((t) => dataAttr('trait', t)).join('');
  const variantSurfaces = projectionVariants.map((v) => v.surface).join(',');

  const lines: string[] = [];
  lines.push(
    `    <article class="entity"${dataAttr('entity-urn', urn)}${dataAttr(
      'role',
      pragmaticRole,
    )}${dataAttr('element-type', element.type)}${dataAttr(
      'element-object',
      element.object,
    )}${dataAttr('element-action', element.action)}${traitAttrs}${dataAttr(
      'brand-overlay',
      brandOverlay,
    )}${dataAttr('projection-surfaces', variantSurfaces || undefined)}>`,
  );
  lines.push(`      <header class="entity-header">`);
  lines.push(`        <p class="role"${dataAttr('role-label', pragmaticRole ?? 'unannotated')}>${escapeHtml(roleLabel(pragmaticRole))}</p>`);
  lines.push(`        <h2 class="entity-name">${escapeHtml(element.name)}</h2>`);
  lines.push(`        <p class="urn"><code>${escapeHtml(urn)}</code></p>`);
  lines.push(`        <p class="element-type"><span class="label">Element:</span> <code>${escapeHtml(element.type)}</code></p>`);
  if (element.object) {
    lines.push(`        <p class="element-object"${dataAttr('element-object', element.object)}><span class="label">Object:</span> ${escapeHtml(element.object)}</p>`);
  }
  if (element.action) {
    lines.push(`        <p class="element-action"${dataAttr('element-action', element.action)}><span class="label">Action:</span> ${escapeHtml(element.action)}</p>`);
  }
  lines.push(`      </header>`);

  lines.push(`      <section class="semantics">`);
  lines.push(`        <p class="purpose"><span class="label">Purpose:</span> ${escapeHtml(semantics.purpose)}</p>`);
  lines.push(`        <p class="meaning">${escapeHtml(semantics.humanMeaning)}</p>`);
  lines.push(`      </section>`);

  lines.push(`      <section class="traits-block">`);
  lines.push(`        <h3>Traits</h3>`);
  lines.push(renderTraits(traits));
  lines.push(`      </section>`);

  lines.push(`      <section class="slots-block">`);
  lines.push(`        <h3>Slots</h3>`);
  lines.push(renderSlots(slots));
  lines.push(`      </section>`);

  if (states.length > 0 || preconditions.length > 0 || effects.length > 0) {
    lines.push(`      <section class="state-block">`);
    if (states.length > 0) {
      lines.push(`        <p class="states"><span class="label">States:</span> ${states.map((s) => `<code>${escapeHtml(s)}</code>`).join(', ')}</p>`);
    }
    if (preconditions.length > 0) {
      lines.push(`        <p class="preconditions"><span class="label">Pre:</span> ${preconditions.map((p) => `<code>${escapeHtml(p)}</code>`).join(', ')}</p>`);
    }
    if (effects.length > 0) {
      lines.push(`        <p class="effects"><span class="label">Effects:</span> ${effects.map((e) => `<code>${escapeHtml(e)}</code>`).join(', ')}</p>`);
    }
    lines.push(`      </section>`);
  }

  if (confidenceDecomposition) {
    lines.push(`      <section class="confidence"${dataAttr('confidence-total', confidenceDecomposition.total)}>`);
    lines.push(`        <p><span class="label">Confidence:</span> <strong>${confidenceDecomposition.total}</strong></p>`);
    lines.push(`      </section>`);
  }

  const evidenceBlock = renderEvidenceRefs(evidenceRefs);
  if (evidenceBlock) lines.push(evidenceBlock);

  lines.push(`    </article>`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Relationships rendering
// ---------------------------------------------------------------------------

function renderRelationship(rel: TypedRelationship, knownUrns: Set<string>): string {
  const targetExternal = !knownUrns.has(rel.to);
  const sourceExternal = !knownUrns.has(rel.from);
  const direction = rel.direction ?? 'out';
  const arrow = direction === 'in' ? '←' : direction === 'undirected' ? '↔' : '→';
  const labelPieces: string[] = [escapeHtml(rel.type)];
  if (rel.via) labelPieces.push(`<span class="rel-via">(via ${escapeHtml(rel.via)})</span>`);
  if (typeof rel.weight === 'number') labelPieces.push(`<span class="rel-weight">w=${rel.weight}</span>`);
  return [
    `    <div class="relationship"${dataAttr('relationship-type', rel.type)}${dataAttr(
      'relationship-source',
      rel.from,
    )}${dataAttr('relationship-target', rel.to)}${dataAttr(
      'relationship-direction',
      direction,
    )}${dataAttr('relationship-via', rel.via)}${dataAttr(
      'relationship-provenance',
      rel.provenance,
    )}${dataAttr('relationship-source-external', sourceExternal ? 'true' : null)}${dataAttr(
      'relationship-target-external',
      targetExternal ? 'true' : null,
    )}>`,
    `      <code class="rel-from"${dataAttr('external', sourceExternal ? 'true' : null)}>${escapeHtml(rel.from)}</code>`,
    `      <span class="rel-arrow" aria-label="${escapeHtml(rel.type)}">${arrow} ${labelPieces.join(' ')} ${arrow}</span>`,
    `      <code class="rel-to"${dataAttr('external', targetExternal ? 'true' : null)}>${escapeHtml(rel.to)}</code>`,
    rel.reason ? `      <p class="rel-reason">${escapeHtml(rel.reason)}</p>` : '',
    `    </div>`,
  ]
    .filter((s) => s !== '')
    .join('\n');
}

// ---------------------------------------------------------------------------
// Embedded stylesheet — boxes + arrows
// ---------------------------------------------------------------------------

const STYLE = `
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0; padding: 1.5rem; background: #f6f7f9; color: #1f2329; line-height: 1.45; }
  h1 { font-size: 1.4rem; margin: 0 0 0.25rem; }
  h2 { font-size: 1.1rem; margin: 0; }
  h3 { font-size: 0.75rem; margin: 0.75rem 0 0.25rem; text-transform: uppercase; letter-spacing: 0.05em; color: #5b6471; }
  code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 0.85em; background: #eef0f4; padding: 0.05em 0.35em; border-radius: 0.25em; }
  .label { color: #5b6471; font-size: 0.85em; }
  .catalog-header { margin-bottom: 1.5rem; }
  .catalog-meta { color: #5b6471; font-size: 0.85em; }
  .entities { display: flex; flex-direction: column; gap: 1rem; }
  .entity { background: #ffffff; border: 2px solid #1f2329; border-radius: 0.5rem; padding: 1rem 1.25rem; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
  .entity[data-role="primary_action"] { border-color: #1351c4; }
  .entity[data-role="destructive_action"] { border-color: #c4263b; }
  .entity[data-role="recovery_action"] { border-color: #1e8f4a; }
  .entity[data-role="navigation"] { border-color: #7b3aa5; }
  .entity[data-role="informational"] { border-color: #3a3f47; }
  .entity[data-role="page"] { border-color: #0e7c86; }
  .entity[data-role="landing"] { border-color: #b25e09; }
  .entity[data-role="section"] { border-color: #5a6470; }
  .entity[data-role="index"] { border-color: #8a6d1f; }
  .entity-header { border-bottom: 1px solid #e5e7eb; padding-bottom: 0.5rem; margin-bottom: 0.5rem; }
  .entity-header .role { display: inline-block; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; background: #1f2329; color: #ffffff; padding: 0.1rem 0.5rem; border-radius: 0.25rem; margin: 0 0 0.25rem; }
  .entity[data-role="primary_action"] .role { background: #1351c4; }
  .entity[data-role="destructive_action"] .role { background: #c4263b; }
  .entity[data-role="recovery_action"] .role { background: #1e8f4a; }
  .entity[data-role="navigation"] .role { background: #7b3aa5; }
  .entity[data-role="page"] .role { background: #0e7c86; }
  .entity[data-role="landing"] .role { background: #b25e09; }
  .entity[data-role="section"] .role { background: #5a6470; }
  .entity[data-role="index"] .role { background: #8a6d1f; }
  .urn { margin: 0.25rem 0 0; font-size: 0.85em; }
  .traits { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .trait { display: inline-block; padding: 0.15rem 0.55rem; background: #eef0f4; border: 1px solid #c8cdd4; border-radius: 1rem; font-size: 0.8em; }
  .slots { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.25rem; }
  .slot { display: grid; grid-template-columns: minmax(6rem, max-content) auto 1fr; gap: 0.5rem; align-items: center; font-size: 0.9em; }
  .slot-arrow { color: #5b6471; }
  .empty { color: #8a8f99; font-style: italic; font-size: 0.85em; margin: 0; }
  .relationships { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1.5rem; }
  .relationship { background: #ffffff; border: 1px dashed #5b6471; border-radius: 0.5rem; padding: 0.75rem 1rem; display: grid; grid-template-columns: 1fr auto 1fr; gap: 0.75rem; align-items: center; }
  .relationship .rel-arrow { text-align: center; font-weight: 600; color: #1351c4; }
  .relationship .rel-reason { grid-column: 1 / -1; margin: 0.5rem 0 0; font-size: 0.85em; color: #5b6471; font-style: italic; }
  .relationship .rel-from[data-external="true"], .relationship .rel-to[data-external="true"] { background: #fff4d6; border: 1px solid #c0a000; }
  .rel-via, .rel-weight { color: #5b6471; font-size: 0.85em; font-weight: 400; margin-left: 0.35rem; }
  .evidence { margin-top: 0.5rem; font-size: 0.85em; }
  .evidence summary { cursor: pointer; color: #5b6471; }
  .confidence { margin-top: 0.5rem; font-size: 0.9em; }
  .legend { margin-top: 2rem; padding: 0.75rem 1rem; background: #ffffff; border: 1px solid #c8cdd4; border-radius: 0.5rem; font-size: 0.85em; color: #5b6471; }
  .legend strong { color: #1f2329; }
`.trim();

// ---------------------------------------------------------------------------
// Top-level emit
// ---------------------------------------------------------------------------

function collectAllRelationships(manifest: ObjectCatalogManifest): TypedRelationship[] {
  const all: TypedRelationship[] = [];
  for (const entity of manifest.entities) {
    if (entity.relationships?.edges) all.push(...entity.relationships.edges);
  }
  if (manifest.relationships) all.push(...manifest.relationships);
  return all;
}

export function emit(
  manifest: ObjectCatalogManifest,
  options: BoxesArrowsOptions = {},
): BoxesArrowsResult {
  const warnings: BoxesArrowsIssue[] = [];
  const errors: BoxesArrowsIssue[] = [];
  const includeStyles = options.includeStyles !== false;

  const knownUrns = new Set<string>(manifest.entities.map((e: SemanticEntity) => e.urn));

  const entityBlocks: string[] = [];
  for (const entity of manifest.entities) {
    try {
      const ctx = runPreEmit(entity, { variant: options.variant });
      if (!ctx.catalog) {
        warnings.push({
          code: 'OODS-BA-001',
          message: 'PreEmitContext lacked catalog annotations for entity',
          entity: entity.urn,
        });
        continue;
      }
      entityBlocks.push(renderEntity(ctx.catalog));
    } catch (err) {
      errors.push({
        code: 'OODS-BA-002',
        message: `Failed to render entity: ${(err as Error).message}`,
        entity: entity.urn,
      });
    }
  }

  const relationships = collectAllRelationships(manifest);
  const relationshipBlocks = relationships.map((rel) => renderRelationship(rel, knownUrns));

  const sourceAgent = manifest.source?.agent;
  const catalogVersion = manifest.source?.oods_catalog_version;
  const capturedAt = manifest.source?.captured_at;
  const titleText = options.title ?? `OODS Object Catalog — ${sourceAgent ?? 'Unknown source'}`;

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
    `<body${dataAttr('catalog-version', catalogVersion)}${dataAttr('source-agent', sourceAgent)}${dataAttr('captured-at', capturedAt)}>`,
  );
  docParts.push('  <header class="catalog-header">');
  docParts.push(`    <h1>${escapeHtml(titleText)}</h1>`);
  docParts.push(
    `    <p class="catalog-meta">Catalog v${escapeHtml(catalogVersion ?? '1.0.0')} · ${manifest.entities.length} entit${manifest.entities.length === 1 ? 'y' : 'ies'} · ${relationships.length} relationship${relationships.length === 1 ? '' : 's'}${capturedAt ? ` · captured ${escapeHtml(capturedAt)}` : ''}</p>`,
  );
  docParts.push('  </header>');
  docParts.push('  <section class="entities" aria-label="Entities">');
  docParts.push(entityBlocks.join('\n'));
  docParts.push('  </section>');
  if (relationshipBlocks.length > 0) {
    docParts.push('  <section class="relationships" aria-label="Relationships">');
    docParts.push(`    <h2>Relationships</h2>`);
    docParts.push(relationshipBlocks.join('\n'));
    docParts.push('  </section>');
  }
  docParts.push('  <aside class="legend">');
  docParts.push(
    '    <p><strong>Legend</strong> · solid border = entity, dashed border = relationship. Border color encodes the entity\'s <code>pragmatic_role</code>. URNs highlighted yellow reference external entities not present in this manifest.</p>',
  );
  docParts.push('  </aside>');
  docParts.push('</body>');
  docParts.push('</html>');
  docParts.push('');

  return {
    status: errors.length === 0 ? 'ok' : 'error',
    framework: 'boxes-arrows',
    code: docParts.join('\n'),
    fileExtension: '.html',
    warnings,
    ...(errors.length > 0 ? { errors } : {}),
    meta: {
      entitiesRendered: entityBlocks.length,
      relationshipsRendered: relationshipBlocks.length,
      catalogVersion,
      sourceAgent,
    },
  };
}
