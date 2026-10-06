/**
 * C-track branded mockup emitter — third runPreEmit() consumer.
 *
 * Third non-prescriptive fidelity on the OODS fidelity ladder (D2). Renders an
 * Object Catalog manifest as a self-contained HTML document with branded card
 * layouts — applies brand_overlay tokens via CSS custom properties, uses
 * typography hierarchy, role-colored chips, and slot-name-driven visual
 * treatment (image placeholders for hero/avatar/thumb, headings for title,
 * buttons for primary_action, etc.).
 *
 * Differs from C1 (boxes-arrows) and C2 (wireframe) on the visual axis only;
 * the semantic data-* contract is preserved verbatim:
 *   data-entity-urn, data-element-type, data-role, data-slot-name, data-slot-field
 * plus the same secondary attrs (element-object, element-action, trait,
 * brand-overlay, projection-surfaces).
 *
 * Consumes runPreEmit() unchanged from s100-m03 state. If this mission strains
 * the abstraction the strain is surfaced as a decision (NOT silently fixed),
 * per the D2 generalization protocol. As of authoring, no abstraction change
 * was needed.
 */

import type {
  ObjectCatalogManifest,
  OodsSlot,
  PragmaticRole,
  SemanticEntity,
} from '../object-catalog/types.js';
import { dataAttr, escapeHtml } from './html-utils.js';
import { runPreEmit, type CatalogAnnotations } from './pre-emit.js';
import { resolveTokenToColor, resolveTokenValue } from '@oods/viz-core';
import { knownBrands } from '../lib/brand-registry.js';

export type BrandedMockupFramework = 'branded-mockup';

export interface BrandedMockupOptions {
  /** Optional render title shown in the document <title> + <h1>. Defaults to manifest source agent. */
  title?: string;
  /** When false, inline CSS is omitted. Default: true. */
  includeStyles?: boolean;
  /** Variant selector forwarded to runPreEmit() per entity. */
  variant?: string;
  /**
   * Overrides any catalog brand_overlay. When set, every entity renders with
   * this brand. When omitted, each entity's own oods.render.brand_overlay (or
   * the resolved variant's brand_overlay) is used; missing brand_overlay falls
   * back to Brand A.
   */
  brandOverlay?: string;
}

export interface BrandedMockupIssue {
  code: string;
  message: string;
  entity?: string;
}

export interface BrandedMockupResult {
  status: 'ok' | 'error';
  framework: BrandedMockupFramework;
  code: string;
  fileExtension: '.html';
  warnings: BrandedMockupIssue[];
  errors?: BrandedMockupIssue[];
  meta: {
    entitiesRendered: number;
    slotsRendered: number;
    brandsApplied: string[];
    catalogVersion?: string;
    sourceAgent?: string;
  };
}

// ---------------------------------------------------------------------------
// Brand-token map
// ---------------------------------------------------------------------------

const DEFAULT_BRAND = 'A';
const COLOR_TOKENS = {
  '--brand-primary': '--sys-surface-interactive-primary-default',
  '--brand-primary-contrast': '--sys-text-on-interactive',
  '--brand-primary-bg': '--sys-status-info-surface',
  '--brand-surface': '--sys-surface-canvas',
  '--brand-surface-alt': '--sys-surface-raised',
  '--brand-text': '--sys-text-primary',
  '--brand-text-muted': '--sys-text-muted',
  '--brand-border': '--sys-border-subtle',
  '--brand-border-strong': '--sys-border-strong',
  '--brand-accent': '--sys-text-accent',
  '--brand-danger': '--sys-status-critical-text',
  '--brand-success': '--sys-status-success-text',
};
const VALUE_TOKENS = {
  '--brand-font-family': '--sys-text-scale-body-md-font-family',
  '--brand-font-weight-heading': '--sys-text-scale-heading-lg-font-weight',
  '--brand-font-weight-body': '--sys-text-scale-body-md-font-weight',
  '--brand-radius': '--ref-border-radius-md',
  '--brand-radius-tight': '--ref-border-radius-sm',
};

/** A registry brand, named by its id or by its `brand-<lower-case id>` class name (s213-m04: any brand the build has). */
function canonicalBrand(brand: string): string | undefined {
  return knownBrands().find(id => brand === id || brand === `brand-${id.toLowerCase()}`);
}

function resolveBrandTokens(brand: string): Record<string, string> {
  const scope = { brand: canonicalBrand(brand), theme: 'light' as const };
  return Object.fromEntries([
    ...Object.entries(COLOR_TOKENS).map(([name, token]) => [name, resolveTokenToColor(token, scope)]),
    ...Object.entries(VALUE_TOKENS).map(([name, token]) => [name, resolveTokenValue(token, scope)]),
  ].map(([name, value]) => {
    if (value === undefined) throw new Error(`Built token for ${name} is missing in ${brand}/light`);
    return [name, value];
  }));
}

// ---------------------------------------------------------------------------
// Slot intent inference (visual treatment only; data-* contract unchanged)
// ---------------------------------------------------------------------------

type SlotKind =
  | 'image'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'meta'
  | 'price'
  | 'action'
  | 'status'
  | 'generic';

const IMAGE_SLOT_NAMES = new Set([
  'avatar', 'thumb', 'thumbnail', 'hero', 'media', 'image', 'photo', 'cover',
]);
const HEADING_SLOT_NAMES = new Set(['title', 'headline', 'heading', 'name']);
const SUBHEADING_SLOT_NAMES = new Set(['subtitle', 'byline', 'tagline']);
const BODY_SLOT_NAMES = new Set(['body', 'excerpt', 'description', 'bio', 'content']);
const META_SLOT_NAMES = new Set(['timestamp', 'date', 'meta', 'related']);
const PRICE_SLOT_NAMES = new Set(['price', 'amount', 'total', 'cost']);
const STATUS_SLOT_NAMES = new Set(['status', 'state', 'badge']);

function inferSlotKind(slot: OodsSlot): SlotKind {
  const name = slot.name.toLowerCase();
  if (IMAGE_SLOT_NAMES.has(name)) return 'image';
  if (HEADING_SLOT_NAMES.has(name)) return 'heading';
  if (SUBHEADING_SLOT_NAMES.has(name)) return 'subheading';
  if (BODY_SLOT_NAMES.has(name)) return 'body';
  if (META_SLOT_NAMES.has(name)) return 'meta';
  if (PRICE_SLOT_NAMES.has(name)) return 'price';
  if (STATUS_SLOT_NAMES.has(name)) return 'status';
  if (name.includes('action') || name === 'primary_action' || name === 'cta') return 'action';
  return 'generic';
}

// ---------------------------------------------------------------------------
// Per-entity rendering
// ---------------------------------------------------------------------------

const ROLE_LABEL: Record<PragmaticRole, string> = {
  primary_action: 'Primary',
  secondary_action: 'Secondary',
  destructive_action: 'Destructive',
  recovery_action: 'Recovery',
  navigation: 'Navigation',
  informational: 'Informational',
  page: 'Page',
  landing: 'Landing',
  section: 'Section',
  index: 'Index',
};

function renderSlot(slot: OodsSlot): string {
  const kind = inferSlotKind(slot);
  const commonAttrs = `${dataAttr('slot-name', slot.name)}${dataAttr('slot-field', slot.binding.field)}${dataAttr('slot-kind', kind)}`;
  const fieldLabel = escapeHtml(slot.binding.field);

  switch (kind) {
    case 'image':
      return `        <div class="slot slot-image"${commonAttrs}><span class="slot-image-placeholder" aria-label="${escapeHtml(slot.name)} image">${escapeHtml(slot.name)}</span><code class="slot-field-pill">${fieldLabel}</code></div>`;
    case 'heading':
      return `        <h3 class="slot slot-heading"${commonAttrs}>${escapeHtml(slot.name)} <code class="slot-field-pill">${fieldLabel}</code></h3>`;
    case 'subheading':
      return `        <p class="slot slot-subheading"${commonAttrs}>${escapeHtml(slot.name)} <code class="slot-field-pill">${fieldLabel}</code></p>`;
    case 'body':
      return `        <div class="slot slot-body"${commonAttrs}><span class="slot-body-label">${escapeHtml(slot.name)}</span><code class="slot-field-pill">${fieldLabel}</code></div>`;
    case 'meta':
      return `        <span class="slot slot-meta"${commonAttrs}>${escapeHtml(slot.name)} <code class="slot-field-pill">${fieldLabel}</code></span>`;
    case 'price':
      return `        <p class="slot slot-price"${commonAttrs}>${escapeHtml(slot.name)} <code class="slot-field-pill">${fieldLabel}</code></p>`;
    case 'status':
      return `        <span class="slot slot-status"${commonAttrs}>${escapeHtml(slot.name)} <code class="slot-field-pill">${fieldLabel}</code></span>`;
    case 'action':
      return `        <button type="button" class="slot slot-action"${commonAttrs}>${escapeHtml(slot.name)} <code class="slot-field-pill">${fieldLabel}</code></button>`;
    case 'generic':
    default:
      return `        <div class="slot slot-generic"${commonAttrs}><span class="slot-name">${escapeHtml(slot.name)}</span><code class="slot-field-pill">${fieldLabel}</code></div>`;
  }
}

function renderSlots(slots: OodsSlot[]): string {
  if (slots.length === 0) {
    return `      <p class="empty">No slots declared.</p>`;
  }
  return [
    `      <div class="slots">`,
    slots.map(renderSlot).join('\n'),
    `      </div>`,
  ].join('\n');
}

function renderRoleChip(role: PragmaticRole | undefined): string {
  if (!role) return '';
  const label = ROLE_LABEL[role] ?? role;
  return `      <span class="role-chip"${dataAttr('role-label', role)}>${escapeHtml(label)}</span>`;
}

function renderTraitChips(traits: string[]): string {
  if (traits.length === 0) return '';
  const chips = traits
    .map((t) => `        <span class="trait-chip"${dataAttr('trait', t)}>${escapeHtml(t)}</span>`)
    .join('\n');
  return [
    `      <div class="trait-strip" aria-label="Traits">`,
    chips,
    `      </div>`,
  ].join('\n');
}

function renderEntity(
  annotations: CatalogAnnotations,
  resolvedBrand: string,
): string {
  const { urn, element, pragmaticRole, traits, slots, brandOverlay, projectionVariants, semantics } = annotations;
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
      brandOverlay ?? resolvedBrand,
    )}${dataAttr('resolved-brand', resolvedBrand)}${dataAttr(
      'projection-surfaces',
      variantSurfaces || undefined,
    )}>`,
  );

  lines.push(`      <header class="entity-header">`);
  if (pragmaticRole) lines.push(renderRoleChip(pragmaticRole));
  lines.push(`        <h2 class="entity-name">${escapeHtml(element.name)}</h2>`);
  lines.push(`        <p class="entity-purpose">${escapeHtml(semantics.purpose)}</p>`);
  lines.push(`      </header>`);

  const traitStrip = renderTraitChips(traits);
  if (traitStrip) lines.push(traitStrip);

  lines.push(`      <section class="slots-block" aria-label="Slots">`);
  lines.push(renderSlots(slots));
  lines.push(`      </section>`);

  lines.push(`    </article>`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Stylesheet — branded card layout
// ---------------------------------------------------------------------------

function renderBrandRootBlock(brand: string): string {
  const tokens = resolveBrandTokens(brand);
  const declarations = Object.entries(tokens)
    .map(([k, v]) => `    ${k}: ${v};`)
    .join('\n');
  const selector = brand === DEFAULT_BRAND ? ':root' : `:root[data-brand="${brand}"], [data-resolved-brand="${brand}"]`;
  return `  ${selector} {\n${declarations}\n  }`;
}

function renderStyle(brandsUsed: ReadonlySet<string>): string {
  const brandBlocks = [DEFAULT_BRAND, ...Array.from(brandsUsed).filter((b) => b !== DEFAULT_BRAND)]
    .map(renderBrandRootBlock)
    .join('\n');

  const layout = `
  * { box-sizing: border-box; }
  body { font-family: var(--brand-font-family); margin: 0; padding: 2rem; background: var(--brand-surface-alt); color: var(--brand-text); font-weight: var(--brand-font-weight-body); line-height: 1.5; }
  h1 { font-family: var(--brand-font-family); font-size: 1.75rem; font-weight: var(--brand-font-weight-heading); margin: 0 0 0.25rem; color: var(--brand-text); }
  h2 { font-family: var(--brand-font-family); font-size: 1.25rem; font-weight: var(--brand-font-weight-heading); margin: 0; color: var(--brand-text); }
  h3 { font-family: var(--brand-font-family); font-size: 1rem; font-weight: var(--brand-font-weight-heading); margin: 0; color: var(--brand-text); }
  .catalog-header { margin-bottom: 2rem; }
  .catalog-meta { color: var(--brand-text-muted); font-size: 0.85em; margin: 0; }
  .entities { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.25rem; }
  .entity { background: var(--brand-surface); border: 1px solid var(--brand-border); border-radius: var(--brand-radius); padding: 1.25rem; box-shadow: 0 2px 6px rgba(0,0,0,0.04); display: flex; flex-direction: column; gap: 0.75rem; }
  .entity[data-role="primary_action"] { border-color: var(--brand-primary); border-width: 2px; }
  .entity[data-role="destructive_action"] { border-color: var(--brand-danger); border-width: 2px; }
  .entity[data-role="recovery_action"] { border-color: var(--brand-success); border-width: 2px; }
  .entity[data-role="navigation"] { border-color: var(--brand-accent); }
  .entity-header { display: flex; flex-direction: column; gap: 0.25rem; }
  .entity-purpose { margin: 0; color: var(--brand-text-muted); font-size: 0.9em; }
  .role-chip { align-self: flex-start; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; background: var(--brand-text); color: var(--brand-primary-contrast); padding: 0.2rem 0.6rem; border-radius: 999px; }
  .entity[data-role="primary_action"] .role-chip { background: var(--brand-primary); }
  .entity[data-role="destructive_action"] .role-chip { background: var(--brand-danger); }
  .entity[data-role="recovery_action"] .role-chip { background: var(--brand-success); }
  .entity[data-role="navigation"] .role-chip { background: var(--brand-accent); }
  .trait-strip { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .trait-chip { font-size: 0.75rem; background: var(--brand-primary-bg); color: var(--brand-primary); border: 1px solid var(--brand-primary); padding: 0.1rem 0.5rem; border-radius: 999px; }
  .slots { display: flex; flex-direction: column; gap: 0.65rem; }
  .slot-field-pill { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 0.7rem; color: var(--brand-text-muted); background: var(--brand-surface-alt); padding: 0.05em 0.4em; border-radius: var(--brand-radius-tight); margin-left: 0.35rem; }
  .slot-image { display: flex; align-items: center; gap: 0.75rem; }
  .slot-image-placeholder { display: inline-flex; align-items: center; justify-content: center; width: 4rem; height: 4rem; background: var(--brand-primary-bg); border: 2px dashed var(--brand-primary); border-radius: var(--brand-radius-tight); color: var(--brand-primary); font-size: 0.7rem; font-weight: 600; text-transform: uppercase; }
  .slot-heading { color: var(--brand-text); font-weight: var(--brand-font-weight-heading); }
  .slot-subheading { color: var(--brand-text-muted); font-size: 0.85em; margin: 0; font-style: italic; }
  .slot-body { background: var(--brand-surface-alt); padding: 0.5rem 0.75rem; border-left: 3px solid var(--brand-primary); border-radius: var(--brand-radius-tight); font-size: 0.9em; }
  .slot-body-label { font-weight: 600; color: var(--brand-text); margin-right: 0.5rem; }
  .slot-meta { font-size: 0.8em; color: var(--brand-text-muted); }
  .slot-price { font-weight: 700; font-size: 1.1em; color: var(--brand-primary); margin: 0; }
  .slot-status { font-size: 0.75rem; background: var(--brand-surface-alt); color: var(--brand-text); border: 1px solid var(--brand-border); padding: 0.15rem 0.55rem; border-radius: 999px; align-self: flex-start; }
  .slot-action { background: var(--brand-primary); color: var(--brand-primary-contrast); border: 0; padding: 0.5rem 1rem; border-radius: var(--brand-radius-tight); cursor: pointer; font-family: var(--brand-font-family); font-weight: 600; align-self: flex-start; }
  .slot-action .slot-field-pill { background: rgba(255,255,255,0.2); color: var(--brand-primary-contrast); }
  .slot-generic { display: flex; align-items: baseline; gap: 0.5rem; font-size: 0.9em; }
  .slot-name { color: var(--brand-text-muted); font-weight: 500; min-width: 6rem; }
  .empty { color: var(--brand-text-muted); font-style: italic; font-size: 0.85em; margin: 0; }
  .legend { margin-top: 2rem; padding: 0.75rem 1rem; background: var(--brand-surface); border: 1px solid var(--brand-border); border-radius: var(--brand-radius); font-size: 0.85em; color: var(--brand-text-muted); }
  .legend strong { color: var(--brand-text); }
`.trim();

  return `${brandBlocks}\n${layout}`;
}

// ---------------------------------------------------------------------------
// Top-level emit
// ---------------------------------------------------------------------------

export function emit(
  manifest: ObjectCatalogManifest,
  options: BrandedMockupOptions = {},
): BrandedMockupResult {
  const warnings: BrandedMockupIssue[] = [];
  const errors: BrandedMockupIssue[] = [];
  const includeStyles = options.includeStyles !== false;

  const entityBlocks: string[] = [];
  const brandsUsed = new Set<string>();
  let slotsRendered = 0;
  const invalidOverride = options.brandOverlay !== undefined && !canonicalBrand(options.brandOverlay);
  if (invalidOverride) {
    errors.push({ code: 'OODS-BM-002', message: 'Unknown brand_overlay "' + options.brandOverlay + '". Supported brands are A and B.' });
  }

  for (const entity of manifest.entities as SemanticEntity[]) {
    if (invalidOverride) break;
    try {
      const ctx = runPreEmit(entity, { variant: options.variant });
      if (!ctx.catalog) {
        warnings.push({
          code: 'OODS-BM-001',
          message: 'PreEmitContext lacked catalog annotations for entity',
          entity: entity.urn,
        });
        continue;
      }
      const declaredOverlay = options.brandOverlay ?? ctx.catalog.brandOverlay;
      const resolved = canonicalBrand(declaredOverlay ?? DEFAULT_BRAND);
      if (!resolved) {
        errors.push({
          code: 'OODS-BM-002',
          message: `Unknown brand_overlay "${declaredOverlay}". Supported brands are A and B.`,
          entity: entity.urn,
        });
        continue;
      }
      if (declaredOverlay?.startsWith('brand-')) {
        warnings.push({ code: 'OODS-BM-004', message: `Deprecated brand alias "${declaredOverlay}"; use "${resolved}". Compatibility is limited to one release.`, entity: entity.urn });
      }
      resolveBrandTokens(resolved);
      brandsUsed.add(resolved);
      entityBlocks.push(renderEntity(ctx.catalog, resolved));
      slotsRendered += ctx.catalog.slots.length;
    } catch (err) {
      errors.push({
        code: 'OODS-BM-003',
        message: `Failed to render entity: ${(err as Error).message}`,
        entity: entity.urn,
      });
    }
  }

  if (brandsUsed.size === 0 && errors.length === 0) brandsUsed.add(DEFAULT_BRAND);

  const sourceAgent = manifest.source?.agent;
  const catalogVersion = manifest.source?.oods_catalog_version;
  const capturedAt = manifest.source?.captured_at;
  const titleText = options.title ?? `OODS Branded Mockup — ${sourceAgent ?? 'Unknown source'}`;
  const documentBrand = canonicalBrand(options.brandOverlay ?? DEFAULT_BRAND);

  const docParts: string[] = [];
  docParts.push('<!DOCTYPE html>');
  docParts.push(`<html lang="en"${dataAttr('brand', documentBrand)}>`);
  docParts.push('<head>');
  docParts.push(`  <meta charset="utf-8">`);
  docParts.push(`  <title>${escapeHtml(titleText)}</title>`);
  if (includeStyles && errors.length === 0) {
    docParts.push(`  <style>\n${renderStyle(brandsUsed)}\n  </style>`);
  }
  docParts.push('</head>');
  docParts.push(
    `<body${dataAttr('catalog-version', catalogVersion)}${dataAttr('source-agent', sourceAgent)}${dataAttr('captured-at', capturedAt)}${dataAttr('fidelity', 'branded-mockup')}${dataAttr('brand', documentBrand)}>`,
  );
  docParts.push('  <header class="catalog-header">');
  docParts.push(`    <h1>${escapeHtml(titleText)}</h1>`);
  docParts.push(
    `    <p class="catalog-meta">Catalog v${escapeHtml(catalogVersion ?? '1.0.0')} · ${manifest.entities.length} entit${manifest.entities.length === 1 ? 'y' : 'ies'} · brand <strong>${escapeHtml(documentBrand ?? 'unavailable')}</strong>${capturedAt ? ` · captured ${escapeHtml(capturedAt)}` : ''}</p>`,
  );
  docParts.push('  </header>');
  docParts.push('  <section class="entities" aria-label="Entities">');
  docParts.push(entityBlocks.join('\n'));
  docParts.push('  </section>');
  docParts.push('  <aside class="legend">');
  docParts.push(
    '    <p><strong>Legend</strong> · branded card layout — image slots become placeholder boxes, headings get typographic emphasis, actions become buttons. Border color encodes <code>pragmatic_role</code>. Brand tokens applied via CSS custom properties driven by the catalog\'s <code>brand_overlay</code>.</p>',
  );
  docParts.push('  </aside>');
  docParts.push('</body>');
  docParts.push('</html>');
  docParts.push('');

  return {
    status: errors.length === 0 ? 'ok' : 'error',
    framework: 'branded-mockup',
    code: docParts.join('\n'),
    fileExtension: '.html',
    warnings,
    ...(errors.length > 0 ? { errors } : {}),
    meta: {
      entitiesRendered: entityBlocks.length,
      slotsRendered,
      brandsApplied: Array.from(brandsUsed),
      catalogVersion,
      sourceAgent,
    },
  };
}
