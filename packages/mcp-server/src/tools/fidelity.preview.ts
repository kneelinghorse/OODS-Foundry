import { knownBrands } from '../lib/brand-registry.js';
import fs from 'node:fs';
import type { UiSchema } from '../schemas/generated.js';
import { composedWireframe, compositionDiagram } from '../codegen/composed-fidelity.js';
import { handle as compose, type DesignComposeInput } from './design.compose.js';
import { handle as generate } from './code.generate.js';
import { resolveSchemaRef, unavailableSchemaRef } from './schema-ref.js';
import { validateSchema } from './repl.utils.js';
import { relationshipDiagram, DiagramError } from '../codegen/relationship-diagram.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { emit as emitBoxesArrows } from '../codegen/boxes-arrows-emitter.js';
import { emit as emitWireframe } from '../codegen/wireframe-emitter.js';
import { emit as emitReview } from '../codegen/review-emitter.js';
import { emit as emitBrandedMockup } from '../codegen/branded-mockup-emitter.js';

export type FidelityKind = 'boxes-arrows' | 'wireframe' | 'review' | 'branded-mockup';

export type FidelityPreviewInput = {
  fidelityKind: FidelityKind;
  // Exactly one data source; caller file paths are never accepted.
  fixture?: string;
  object?: string;
  context?: DesignComposeInput['context'] | 'dashboard';
  schemaRef?: string;
  schema?: UiSchema;
  objects?: string[];
  manifest?: unknown;
  options?: {
    variant?: string;
    depth?: number;
    theme?: 'light' | 'dark' | 'hc';
    brandOverlay?: string;
    reviewThreshold?: number;
    includeStyles?: boolean;
  };
};

export type FidelityPreviewIssue = {
  code: string;
  message: string;
  entity?: string;
};

export type FidelityPreviewOutput = {
  status: 'ok' | 'warning' | 'error';
  fidelityKind: FidelityKind;
  fixture: string;
  html: string;
  svg?: string;
  warnings: FidelityPreviewIssue[];
  errors: FidelityPreviewIssue[];
  meta: {
    entityCount: number;
    componentCount?: number;
    edgeCount?: number;
    theme?: string;
    width?: number;
    height?: number;
    appliedBrandOverlay?: string;
  };
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Server-resident fixtures the playground (or any caller) may name. Keeps
// fixture loading on a tight allow-list — no caller-supplied paths are
// resolved, eliminating path-traversal risk. Exported so other playground-
// affordance tools (review.chain) reuse the same allow-list rather than
// duplicating it.
const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE_ROOT = fs.existsSync(path.join(__dirname, '../registry/fidelity-fixtures'))
  ? path.join(__dirname, '../registry/fidelity-fixtures') : path.join(PACKAGE_ROOT, 'registry/fidelity-fixtures');
export const FIXTURE_PATHS: Record<string, string> = Object.fromEntries(
  ['user', 'product', 'subscription', 'article', 'author', 'comment', 'content-pack', 'billing-multi-entity', 'subscription-low-confidence'].map(name => [name, path.join(FIXTURE_ROOT, `${name}.json`)]),
);

export const FIXTURE_NAMES: ReadonlyArray<string> = Object.keys(FIXTURE_PATHS);

const SUPPORTED_KINDS = new Set<FidelityKind>(['boxes-arrows', 'wireframe', 'review', 'branded-mockup']);

function loadFixture(name: string): { manifest: unknown } {
  const filePath = FIXTURE_PATHS[name];
  if (!filePath) {
    throw Object.assign(new Error(`Unknown fixture '${name}'`), { code: 'OODS-FP-001' });
  }
  if (!fs.existsSync(filePath)) {
    throw Object.assign(new Error(`Fixture file missing on disk: ${filePath}`), { code: 'OODS-FP-002' });
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const manifest = JSON.parse(raw);
  return { manifest };
}

// Resolve the manifest source to render. Exactly one of `fixture` (named, vetted,
// on-disk) or `manifest` (inline object) must be supplied. The inline path accepts
// data only — never a path — so it does not reopen the traversal surface the fixture
// allow-list closes. `source` is echoed back so callers can tell which path was taken
// ('(inline)' for the inline case).
function resolveManifest(input: FidelityPreviewInput): { manifest: unknown; source: string } {
  const hasFixture = typeof input.fixture === 'string' && input.fixture.length > 0;
  const hasManifest = input.manifest !== undefined && input.manifest !== null;
  if (hasFixture === hasManifest) {
    throw Object.assign(
      new Error("Provide exactly one of 'fixture' (named server-resident) or 'manifest' (inline object)."),
      { code: 'OODS-FP-004' },
    );
  }
  if (hasManifest) {
    const m = input.manifest;
    if (typeof m !== 'object' || m === null || !Array.isArray((m as { entities?: unknown }).entities)) {
      throw Object.assign(
        new Error("Inline 'manifest' must be an Object Catalog manifest object with an 'entities' array."),
        { code: 'OODS-FP-005' },
      );
    }
    return { manifest: m, source: '(inline)' };
  }
  return { manifest: loadFixture(input.fixture as string).manifest, source: input.fixture as string };
}

function countEntities(manifest: unknown): number {
  if (manifest && typeof manifest === 'object' && Array.isArray((manifest as { entities?: unknown[] }).entities)) {
    return (manifest as { entities: unknown[] }).entities.length;
  }
  return 0;
}

export async function handle(input: FidelityPreviewInput): Promise<FidelityPreviewOutput> {
  const { fidelityKind, options = {} } = input;

  if (!SUPPORTED_KINDS.has(fidelityKind)) {
    return {
      status: 'error',
      fidelityKind,
      fixture: input.fixture ?? '(inline)',
      html: '',
      warnings: [],
      errors: [{ code: 'OODS-FP-003', message: `Unsupported fidelityKind '${fidelityKind}'. Supported: ${Array.from(SUPPORTED_KINDS).join(', ')}` }],
      meta: { entityCount: 0 },
    };
  }

  if (input.object !== undefined || input.objects !== undefined || input.schemaRef !== undefined || input.schema !== undefined) {
    const source = input.object ? `(object:${input.object})` : input.objects ? '(objects)' : '(composition)';
    try {
      if ([input.object, input.objects, input.schema, input.schemaRef, input.fixture, input.manifest].filter(value => value !== undefined).length !== 1) throw new DiagramError('OODS-FP-004', 'Provide exactly one source: object, objects, schema, schemaRef, fixture or manifest.');
      if (input.objects || fidelityKind === 'boxes-arrows' && input.object) {
        if (fidelityKind !== 'boxes-arrows') throw new DiagramError('OODS-FP-006', 'An objects set uses fidelityKind boxes-arrows.');
        const result = relationshipDiagram(input, options);
        return { status: 'ok', fidelityKind, fixture: source, html: result.html, svg: result.svg, meta: result.meta, warnings: [], errors: [] };
      }
      let schema = input.schema, title = 'Composed screen';
      const warnings: FidelityPreviewIssue[] = [];
      if (input.object) {
        const context = input.context ?? 'detail';
        const result = await compose({ object: input.object, ...(context === 'dashboard' ? { layout: 'dashboard' } : { context }), options: { transient: true } });
        if (result.status === 'error') return { status: 'error', fidelityKind, fixture: source, html: '', warnings: result.warnings, errors: result.errors ?? [], meta: { entityCount: 0 } };
        schema = result.schema; title = `${input.object} ${context}`; warnings.push(...result.warnings);
      } else if (input.schemaRef) {
        const resolved = resolveSchemaRef(input.schemaRef);
        if (!resolved.ok) { const issue = unavailableSchemaRef(input.schemaRef, resolved.reason); throw new DiagramError(issue.code, `${issue.message} ${issue.hint}`); }
        schema = resolved.schema; title = resolved.record.label ?? title;
      }
      const issues = validateSchema(schema!);
      if (issues.length) return { status: 'error', fidelityKind, fixture: source, html: '', warnings, errors: issues, meta: { entityCount: 0 } };
      if (fidelityKind === 'branded-mockup') {
        const requested = options.brandOverlay ?? 'A';
        const brand = knownBrands().find(id => id === requested || `brand-${id.toLowerCase()}` === requested);
        if (!brand) throw new DiagramError('OODS-FP-006', `Unknown built brand ${requested}. Available: ${knownBrands().join(', ')}.`);
        const result = await generate({ schema, framework: 'html', profile: 'build', options: { brand, theme: options.theme ?? 'light' } });
        return { status: result.status, fidelityKind, fixture: source, html: options.includeStyles === false ? result.code.replace(/<style[\s\S]*?<\/style>/g, '') : result.code, warnings: [...warnings, ...result.warnings], errors: result.errors ?? [], meta: { entityCount: schema!.screens.length, appliedBrandOverlay: brand, theme: options.theme ?? 'light' } };
      }
      const result = fidelityKind === 'boxes-arrows' ? compositionDiagram(schema!, { ...options, title }) : composedWireframe(schema!, { ...options, title }, fidelityKind === 'review');
      return { status: 'ok', fidelityKind, fixture: source, ...result, meta: { ...result.meta, appliedBrandOverlay: knownBrands().find(id => id === (options.brandOverlay ?? 'A') || `brand-${id.toLowerCase()}` === options.brandOverlay), theme: options.theme ?? 'light' }, warnings, errors: [] };
    } catch (error) {
      return { status: 'error', fidelityKind, fixture: source, html: '', warnings: [], errors: [{ code: error instanceof DiagramError ? error.code : 'OODS-FP-008', message: error instanceof Error ? error.message : String(error) }], meta: { entityCount: 0 } };
    }
  }

  let manifest: unknown;
  let source: string;
  try {
    ({ manifest, source } = resolveManifest(input));
  } catch (e) {
    const code = (e as { code?: string })?.code || 'OODS-FP-001';
    const message = e instanceof Error ? e.message : String(e);
    return {
      status: 'error',
      fidelityKind,
      fixture: input.fixture ?? '(inline)',
      html: '',
      warnings: [],
      errors: [{ code, message }],
      meta: { entityCount: 0 },
    };
  }

  const entityCount = countEntities(manifest);

  // Dispatch — each emitter has its own option shape but they all share
  // variant + includeStyles. branded-mockup additionally honors brandOverlay;
  // review additionally honors reviewThreshold.
  const sharedOptions = {
    variant: options.variant,
    includeStyles: options.includeStyles,
  };

  let html: string;
  let warnings: FidelityPreviewIssue[] = [];
  let errors: FidelityPreviewIssue[] = [];
  let appliedBrandOverlay: string | undefined;

  switch (fidelityKind) {
    case 'boxes-arrows': {
      const result = emitBoxesArrows(manifest as Parameters<typeof emitBoxesArrows>[0], sharedOptions);
      html = result.code;
      warnings = result.warnings ?? [];
      errors = result.errors ?? [];
      break;
    }
    case 'wireframe': {
      const result = emitWireframe(manifest as Parameters<typeof emitWireframe>[0], sharedOptions);
      html = result.code;
      warnings = result.warnings ?? [];
      errors = result.errors ?? [];
      break;
    }
    case 'review': {
      const result = emitReview(manifest as Parameters<typeof emitReview>[0], {
        ...sharedOptions,
        reviewThreshold: options.reviewThreshold,
      });
      html = result.code;
      warnings = result.warnings ?? [];
      errors = result.errors ?? [];
      break;
    }
    case 'branded-mockup': {
      const result = emitBrandedMockup(manifest as Parameters<typeof emitBrandedMockup>[0], {
        ...sharedOptions,
        brandOverlay: options.brandOverlay,
      });
      html = result.code;
      warnings = result.warnings ?? [];
      errors = result.errors ?? [];
      appliedBrandOverlay = result.meta.brandsApplied.join(', ');
      break;
    }
    default: {
      // Exhaustive — SUPPORTED_KINDS gate above ensures we never reach here.
      const exhaustive: never = fidelityKind;
      throw new Error(`Unhandled fidelityKind: ${String(exhaustive)}`);
    }
  }

  const status: FidelityPreviewOutput['status'] = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ok';

  return {
    status,
    fidelityKind,
    fixture: source,
    html,
    warnings,
    errors,
    meta: {
      entityCount,
      ...(appliedBrandOverlay !== undefined ? { appliedBrandOverlay } : {}),
    },
  };
}
