/**
 * C2 — Wireframe emitter.
 *
 * Second non-prescriptive fidelity on the OODS fidelity ladder (D2). Renders an
 * Object Catalog manifest as gray-box wireframe layout — entities as solid
 * light-gray rectangles with the entity name as a header and a vertical stack
 * of dashed-border slot placeholders inside. No role colors, no trait chips,
 * no relationship arrows: wireframe fidelity is layout structure only.
 * Relationship visualization is C1's job (boxes-and-arrows); confidence
 * surfacing is C3's job (review/recovery).
 *
 * Consumes runPreEmit() per entity (same as C1). C1 + C2 sharing a single
 * PreEmitContext shape unchanged is the empirical test of decision #435 — the
 * function-shaped abstraction generalizes if both fidelities project cleanly
 * without the abstraction needing modification. If wireframe needs fields that
 * CatalogAnnotations does not expose, do not silently extend the abstraction:
 * surface the gap so D2 v2 can address it deliberately.
 *
 * data-* attribute contract preserved verbatim from C1 (data-entity-urn,
 * data-element-type, data-role, data-slot-name, data-slot-field) so a future
 * interactive editor / canvas tool can consume either renderer's output
 * without re-parsing the visual layer. Visible styling differs; semantic
 * structure does not.
 */

import type {
  ObjectCatalogManifest,
  OodsSlot,
  SemanticEntity,
} from '../object-catalog/types.js';
import { dataAttr, escapeHtml } from './html-utils.js';
import { runPreEmit, type CatalogAnnotations } from './pre-emit.js';

export type WireframeFramework = 'wireframe';

export interface WireframeOptions {
  /** Optional render title shown in the document <title> + <h1>. Defaults to the manifest source agent. */
  title?: string;
  /** When false, inline CSS is omitted. Default: true. */
  includeStyles?: boolean;
  /** Variant selector forwarded to runPreEmit() per entity. */
  variant?: string;
}

export interface WireframeIssue {
  code: string;
  message: string;
  entity?: string;
}

export interface WireframeResult {
  status: 'ok' | 'error';
  framework: WireframeFramework;
  code: string;
  fileExtension: '.html';
  warnings: WireframeIssue[];
  errors?: WireframeIssue[];
  meta: {
    entitiesRendered: number;
    slotsRendered: number;
    catalogVersion?: string;
    sourceAgent?: string;
  };
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

function renderEntity(annotations: CatalogAnnotations): string {
  const { urn, element, pragmaticRole, slots } = annotations;

  const lines: string[] = [];
  lines.push(
    `    <article class="entity"${dataAttr('entity-urn', urn)}${dataAttr(
      'role',
      pragmaticRole,
    )}${dataAttr('element-type', element.type)}${dataAttr(
      'element-object',
      element.object,
    )}${dataAttr('element-action', element.action)}${dataAttr(
      'slot-count',
      slots.length,
    )}>`,
  );
  lines.push(`      <header class="entity-header">`);
  lines.push(`        <h2 class="entity-name">${escapeHtml(element.name)}</h2>`);
  lines.push(`      </header>`);
  lines.push(`      <section class="slots-block" aria-label="Slots">`);
  lines.push(renderSlotsBlock(slots));
  lines.push(`      </section>`);
  lines.push(`    </article>`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Embedded stylesheet — wireframe gray-box
// ---------------------------------------------------------------------------

const STYLE = `
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0; padding: 1.5rem; background: #f6f7f9; color: #1f2329; line-height: 1.45; }
  h1 { font-size: 1.4rem; margin: 0 0 0.25rem; font-weight: 600; }
  h2 { font-size: 1rem; margin: 0; font-weight: 600; color: #1f2329; }
  code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 0.85em; color: #5b6471; }
  .catalog-header { margin-bottom: 1.5rem; }
  .catalog-meta { color: #5b6471; font-size: 0.85em; }
  .entities { display: flex; flex-direction: column; gap: 1rem; }
  .entity { background: #e8eaed; border: 2px solid #5b6471; border-radius: 0.25rem; padding: 1rem; }
  .entity-header { padding-bottom: 0.5rem; margin-bottom: 0.5rem; border-bottom: 1px solid #b0b6c0; }
  .slots { display: flex; flex-direction: column; gap: 0.5rem; }
  .slot { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; background: #ffffff; border: 1.5px dashed #b0b6c0; border-radius: 0.25rem; }
  .slot-name { font-size: 0.85em; font-weight: 500; color: #1f2329; min-width: 5rem; }
  .slot-field { font-size: 0.8em; color: #5b6471; }
  .empty { color: #8a8f99; font-style: italic; font-size: 0.85em; margin: 0; padding: 0.5rem 0.75rem; background: #ffffff; border: 1.5px dashed #b0b6c0; border-radius: 0.25rem; text-align: center; }
  .legend { margin-top: 2rem; padding: 0.75rem 1rem; background: #ffffff; border: 1px solid #c8cdd4; border-radius: 0.25rem; font-size: 0.85em; color: #5b6471; }
  .legend strong { color: #1f2329; }
`.trim();

// ---------------------------------------------------------------------------
// Top-level emit
// ---------------------------------------------------------------------------

export function emit(
  manifest: ObjectCatalogManifest,
  options: WireframeOptions = {},
): WireframeResult {
  const warnings: WireframeIssue[] = [];
  const errors: WireframeIssue[] = [];
  const includeStyles = options.includeStyles !== false;

  const entityBlocks: string[] = [];
  let slotsRendered = 0;
  for (const entity of manifest.entities as SemanticEntity[]) {
    try {
      const ctx = runPreEmit(entity, { variant: options.variant });
      if (!ctx.catalog) {
        warnings.push({
          code: 'OODS-WF-001',
          message: 'PreEmitContext lacked catalog annotations for entity',
          entity: entity.urn,
        });
        continue;
      }
      entityBlocks.push(renderEntity(ctx.catalog));
      slotsRendered += ctx.catalog.slots.length;
    } catch (err) {
      errors.push({
        code: 'OODS-WF-002',
        message: `Failed to render entity: ${(err as Error).message}`,
        entity: entity.urn,
      });
    }
  }

  const sourceAgent = manifest.source?.agent;
  const catalogVersion = manifest.source?.oods_catalog_version;
  const capturedAt = manifest.source?.captured_at;
  const titleText = options.title ?? `OODS Wireframe — ${sourceAgent ?? 'Unknown source'}`;

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
    `<body${dataAttr('catalog-version', catalogVersion)}${dataAttr('source-agent', sourceAgent)}${dataAttr('captured-at', capturedAt)}${dataAttr('fidelity', 'wireframe')}>`,
  );
  docParts.push('  <header class="catalog-header">');
  docParts.push(`    <h1>${escapeHtml(titleText)}</h1>`);
  docParts.push(
    `    <p class="catalog-meta">Catalog v${escapeHtml(catalogVersion ?? '1.0.0')} · ${manifest.entities.length} entit${manifest.entities.length === 1 ? 'y' : 'ies'}${capturedAt ? ` · captured ${escapeHtml(capturedAt)}` : ''}</p>`,
  );
  docParts.push('  </header>');
  docParts.push('  <section class="entities" aria-label="Entities">');
  docParts.push(entityBlocks.join('\n'));
  docParts.push('  </section>');
  docParts.push('  <aside class="legend">');
  docParts.push(
    '    <p><strong>Legend</strong> · solid gray box = entity, dashed rectangle = slot placeholder. Wireframe fidelity: no role color, no traits, no relationships. See boxes-and-arrows for relationship structure.</p>',
  );
  docParts.push('  </aside>');
  docParts.push('</body>');
  docParts.push('</html>');
  docParts.push('');

  return {
    status: errors.length === 0 ? 'ok' : 'error',
    framework: 'wireframe',
    code: docParts.join('\n'),
    fileExtension: '.html',
    warnings,
    ...(errors.length > 0 ? { errors } : {}),
    meta: {
      entitiesRendered: entityBlocks.length,
      slotsRendered,
      catalogVersion,
      sourceAgent,
    },
  };
}
