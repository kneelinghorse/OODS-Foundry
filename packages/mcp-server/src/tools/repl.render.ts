import {
  applyPatch,
  buildPreview,
  buildPreviewSummary,
  loadComponentRegistry,
  summarizeMeta,
  validateComponents,
  validateSchema,
} from './repl.utils.js';
import { getCssForComponents } from '../render/css-extractor.js';
import { brandStylesheet } from '../lib/user-brands.js';
import { renderSeed } from '../codegen/render-seed.js';
import { prepareChartAssets } from '../codegen/chart-assets.js';
import { renderRecordBody } from '../render/record-renderer.js';
import { renderDocument } from '../render/document.js';
import { resolveTokenOverlay, resolveSkinOverlay } from '../render/brand-overlay.js';
import { loadStyleLibrary } from '../render/style-library.js';
import { renderFragmentsWithErrors } from '../render/tree-renderer.js';
import type {
  ReplIssue,
  ReplJsonPatchOperation,
  ReplRenderFormat,
  ReplRenderInput,
  ReplRenderOutput,
  ReplValidationMeta,
  UiElement,
  UiSchema,
} from '../schemas/generated.js';
import { resolveSchemaRef, unavailableSchemaRef } from './schema-ref.js';
import { largePayloadWarning, payloadDigest, payloadTooLarge, writePayload } from '../lib/payload-store.js';
import type { ToolContext } from '../lib/tool-context.js';

function asWarnings(issues: ReplIssue[]): ReplIssue[] {
  return issues.map((entry) => ({ ...entry, severity: entry.severity ?? 'warning' }));
}

function cloneTree(tree: UiSchema | undefined): UiSchema | undefined {
  return tree ? structuredClone(tree) : undefined;
}

function normalizeOutputFormat(input: ReplRenderInput): ReplRenderFormat {
  return input.output?.format === 'fragments' ? 'fragments' : 'document';
}

function normalizeStrict(input: ReplRenderInput): boolean {
  return input.output?.strict ?? false;
}

function normalizeCompact(input: ReplRenderInput): boolean {
  return input.output?.compact ?? false;
}

function normalizeIncludeCss(input: ReplRenderInput): boolean {
  return input.output?.includeCss ?? true;
}

function normalizeTokenOverlay(input: ReplRenderInput): Record<string, unknown> | undefined {
  const overlay = input.output?.tokenOverlay;
  return overlay && typeof overlay === 'object' && !Array.isArray(overlay)
    ? (overlay as Record<string, unknown>)
    : undefined;
}

function normalizeSkinOverlay(input: ReplRenderInput): Record<string, unknown> | undefined {
  const overlay = input.output?.skinOverlay;
  return overlay && typeof overlay === 'object' && !Array.isArray(overlay)
    ? (overlay as Record<string, unknown>)
    : undefined;
}

function toComponentCssRef(componentName: string): string {
  return `cmp.${componentName.trim().toLowerCase()}.base`;
}

function normalizeShowConfidence(input: ReplRenderInput): boolean {
  return input.output?.showConfidence === true;
}

function normalizeConfidenceThreshold(input: ReplRenderInput): number {
  const raw = input.output?.confidenceThreshold;
  if (typeof raw === 'number' && raw >= 0 && raw <= 1) return raw;
  return 0.5;
}

/**
 * Strip confidence metadata from all nodes in the tree.
 * Used when showConfidence is not enabled to preserve backward compat.
 */
function stripConfidence(schema: UiSchema): void {
  const walk = (el: UiElement): void => {
    if (el.meta) {
      delete el.meta.confidence;
      delete el.meta.confidenceLevel;
    }
    el.children?.forEach(walk);
  };
  schema.screens.forEach(walk);
}

/**
 * Apply low-confidence CSS class to nodes below the threshold.
 * Adds 'oods-low-confidence' to the node's existing className prop.
 */
function applyLowConfidenceClass(schema: UiSchema, threshold: number): void {
  const walk = (el: UiElement): void => {
    if (el.meta?.confidence !== undefined && el.meta.confidence < threshold) {
      el.props = el.props ?? {};
      const existing = typeof el.props.className === 'string' ? el.props.className : '';
      el.props.className = existing ? `${existing} oods-low-confidence` : 'oods-low-confidence';
    }
    el.children?.forEach(walk);
  };
  schema.screens.forEach(walk);
}

function toFragmentRenderIssue(nodeId: string, component: string, message: string): ReplIssue {
  return {
    code: 'OODS-S007',
    message: `Fragment render failed for node '${nodeId}': ${message}`,
    path: `/fragments/${nodeId}`,
    component,
  };
}

export async function handle(input: ReplRenderInput, context: ToolContext = {}): Promise<ReplRenderOutput> {
  const mode = input.mode ?? 'full';
  const registry = loadComponentRegistry();
  const errors: ReplIssue[] = [];
  const warnings: ReplIssue[] = asWarnings(registry.warnings);

  let workingTree: UiSchema | undefined = undefined;
  let normalizedPatch: ReplJsonPatchOperation[] | undefined;
  let appliedPatch = false;
  let meta: ReplValidationMeta | undefined;

  let documentTitle: string | undefined;
  if (mode === 'full') {
    if (input.schema) {
      workingTree = cloneTree(input.schema);
    } else if (input.schemaRef) {
      const resolved = resolveSchemaRef(input.schemaRef);
      if (resolved.ok) {
        workingTree = resolved.schema;
        documentTitle = resolved.record.label;
      } else {
        errors.push(unavailableSchemaRef(input.schemaRef, resolved.reason));
      }
    } else {
      errors.push({ code: 'OODS-V009', message: 'schema is required when mode=full' });
    }
  } else {
    workingTree = cloneTree(input.baseTree);
    if (!workingTree) {
      errors.push({ code: 'OODS-V010', message: 'baseTree is required when mode=patch' });
    }
    if (workingTree && input.patch) {
      const patchResult = applyPatch(workingTree, input.patch);
      workingTree = patchResult.tree;
      normalizedPatch = patchResult.normalized.length ? patchResult.normalized : undefined;
      errors.push(...patchResult.issues);
      appliedPatch = true;
    }
  }

  if (workingTree) {
    errors.push(...validateSchema(workingTree));
    errors.push(...validateComponents(workingTree, registry));
    meta = summarizeMeta(workingTree, registry);
  }

  const format = normalizeOutputFormat(input);
  const strict = normalizeStrict(input);
  const compact = normalizeCompact(input);
  if (format === 'fragments') {
    const ignored = [input.brand !== undefined ? 'brand' : '', input.output?.tokenOverlay !== undefined ? 'output.tokenOverlay' : '', input.output?.skinOverlay !== undefined ? 'output.skinOverlay' : ''].filter(Boolean);
    if (ignored.length) warnings.push({ code: 'OODS-W001', message: `Fragment output ignores ${ignored.join(', ')}; use document format to apply these options.` });
  }

  // In non-strict fragment mode, UNKNOWN_COMPONENT errors should not block the
  // entire render. They are deferred and reported as per-node errors after
  // rendering, so known components still produce fragments.
  let deferredUnknownErrors: ReplIssue[] = [];
  if (input.apply === true && format === 'fragments' && !strict) {
    deferredUnknownErrors = errors.filter((e) => e.code === 'OODS-V006');
    if (deferredUnknownErrors.length > 0) {
      const remaining = errors.filter((e) => e.code !== 'OODS-V006');
      errors.length = 0;
      errors.push(...remaining);
      warnings.push({ code: 'OODS-W002', message: `Non-strict fragment output reclassifies ${deferredUnknownErrors.length} OODS-V006 issue(s) as per-node errors; known fragments may still render.` });
    }
  }

  let status: ReplRenderOutput['status'] = errors.length ? 'error' : 'ok';
  const dslVersion = workingTree?.version ?? input.schema?.version ?? '0.0.0';

  const preview = workingTree ? buildPreview(workingTree) : undefined;
  if (preview && warnings.length) {
    const warningNotes = warnings.map((entry) => entry.message);
    preview.notes = preview.notes ? [...preview.notes, ...warningNotes] : warningNotes;
  }

  const output: ReplRenderOutput = {
    status,
    mode,
    dslVersion,
    registryVersion: registry.version,
    errors,
    warnings,
    preview,
  };

  const includeTree = input.options?.includeTree ?? true;
  if (workingTree && includeTree) {
    output.renderedTree = workingTree;
  }
  if (normalizedPatch) {
    output.normalizedPatch = normalizedPatch as ReplRenderOutput['normalizedPatch'];
  }
  if (appliedPatch) {
    output.appliedPatch = true;
  }
  if (meta) {
    output.meta = meta;
  }

  if (input.apply === true && status === 'ok' && workingTree) {
    // Confidence affordance: opt-in gate
    const showConfidence = normalizeShowConfidence(input);
    if (showConfidence) {
      applyLowConfidenceClass(workingTree, normalizeConfidenceThreshold(input));
    } else {
      stripConfidence(workingTree);
    }

    if (format === 'fragments') {
      const includeCss = compact ? false : normalizeIncludeCss(input);
      const { fragments: fragmentMap, errors: fragmentErrors } = renderFragmentsWithErrors(workingTree);

      // Per-node isolation: remove fallback fragments for unknown top-level
      // components and report them as per-node UNKNOWN_COMPONENT errors.
      if (deferredUnknownErrors.length > 0) {
        for (const screen of workingTree.screens) {
          const children = Array.isArray(screen.children) ? screen.children : [];
          for (const node of children) {
            if (registry.names.size > 0 && !registry.names.has(node.component)) {
              fragmentMap.delete(node.id);
              output.errors.push({
                code: 'OODS-V006',
                message: `Component '${node.component}' is not in the OODS registry`,
                path: `/fragments/${node.id}`,
                component: node.component,
                nodeId: node.id,
              });
            }
          }
        }
      }

      if (fragmentErrors.length > 0) {
        const mapped = fragmentErrors.map((entry) => toFragmentRenderIssue(entry.nodeId, entry.component, entry.message));
        output.errors.push(...mapped);
      }

      const hasFragmentFailures = fragmentErrors.length > 0 || deferredUnknownErrors.length > 0;
      if (strict && hasFragmentFailures) {
        status = 'error';
      }

      if (!strict || !hasFragmentFailures) {
        const components = Array.from(fragmentMap.values()).map((entry) => entry.component);
        const cssPayload = getCssForComponents(components, includeCss);
        const includesTokensCss = cssPayload.cssRefs.includes('css.tokens');
        const fragments: NonNullable<ReplRenderOutput['fragments']> = {};

        for (const [nodeId, fragment] of fragmentMap.entries()) {
          const cssRefs = ['css.base'];
          if (includesTokensCss) {
            cssRefs.push('css.tokens');
          }
          const componentRef = toComponentCssRef(fragment.component);
          if (cssPayload.css[componentRef]) {
            cssRefs.push(componentRef);
          }

          fragments[nodeId] = {
            nodeId: fragment.nodeId,
            component: fragment.component,
            html: fragment.html,
            cssRefs,
          };
        }

        if (Object.keys(fragments).length > 0) {
          output.fragments = fragments;
          output.css = cssPayload.css;
        }
      }

      if (!strict && hasFragmentFailures && fragmentMap.size > 0) {
        status = 'ok';
      } else if (hasFragmentFailures && fragmentMap.size === 0) {
        status = 'error';
      }
    } else {
      // Documents use the same record binding, chart preparation and body renderer as HTML
      // generation. Overlay CSS is appended after the shipped component styles.
      const seed = await renderSeed(workingTree);
      const renderOptions = { typescript: true, styling: 'tokens' as const, brand: input.brand, theme: workingTree.theme === 'dark' ? 'dark' as const : workingTree.theme === 'hc' ? 'hc' as const : 'light' as const, sampleModel: seed.model, sampleRecords: seed.records };
      const prepared = await prepareChartAssets(workingTree, renderOptions, seed.record);
      const screenHtml = renderRecordBody(prepared.schema, renderOptions);
      const overlay = normalizeTokenOverlay(input);
      const overlayBlock = overlay ? resolveTokenOverlay(overlay) : '';
      const skin = normalizeSkinOverlay(input);
      const skinBlock = skin ? resolveSkinOverlay(skin, loadStyleLibrary()) : '';
      const combined = [input.brand ? brandStylesheet(input.brand)?.contents : '', overlayBlock, skinBlock].filter(Boolean).join('\n');
      output.html = renderDocument({
        screenHtml,
        schema: workingTree,
        compact,
        // The document is titled after what it shows (the composed object and context, or the
        // screen's own title); "OODS Preview" remains only for an untitled inline schema.
        ...((seed.title ?? documentTitle) ? { title: seed.title ?? documentTitle } : {}),
        // s169 m04 — brand. `renderDocument` already accepted and escaped `brand`; only
        // this plumbing was missing. Passed ONLY when supplied, so `normalizeBrand`'s
        // 'default' fallback (and every byte of the existing document) is untouched
        // otherwise. Deliberately NOT defaulted to 'A': `data-brand="default"` matches no
        // generated block, which is the correct meaning of "no brand requested".
        ...(input.brand ? { brand: input.brand } : {}),
        ...(combined ? { componentCss: combined } : {}),
      });
    }

    if (compact) {
      output.tokenCssRef = 'tokens.build';
    }

    output.output = { format, strict, ...(compact ? { compact } : {}) };
    // s238 (0.10.1): a document with its token CSS is about 680,000 characters. Left unset, payloadMode is inline
    // unless the output would overflow one reply; then it is written as with 'file', and OODS-W004 says why.
    const renderedCharacters = input.output?.payloadMode === undefined && context.sizedReply ? (output.html?.length ?? 0) + (output.fragments !== undefined ? JSON.stringify(output.fragments).length : 0) + (output.css !== undefined ? JSON.stringify(output.css).length : 0) : 0;
    const tooLarge = payloadTooLarge(input.output?.payloadMode, renderedCharacters, context.sizedReply);
    if (tooLarge && (output.html !== undefined || output.fragments !== undefined)) warnings.push(largePayloadWarning(renderedCharacters, 'output.payloadMode'));
    if ((input.output?.payloadMode === 'file' || tooLarge) && (output.html !== undefined || output.fragments !== undefined)) {
      // The rendered document (or the fragment set) goes to disk beside the saved-schema store; the response keeps the references.
      const files = output.html !== undefined
        ? [{ path: 'index.html', contents: output.html }]
        : [{ path: 'fragments.json', contents: JSON.stringify(output.fragments, null, 2) + '\n' }, ...(output.css !== undefined ? [{ path: 'css.json', contents: JSON.stringify(output.css, null, 2) + '\n' }] : [])];
      try {
        output.payload = writePayload(`repl.render-${payloadDigest(files.map(file => file.contents).join('\u0000'))}`, files);
        delete output.html; delete output.fragments; delete output.css;
      } catch (error) {
        errors.push({ code: 'OODS-S020', message: `Payload directory is not writable: ${error instanceof Error ? error.message : String(error)}` });
        status = 'error';
      }
    }
  }

  output.status = status;
  const dryRun = input.apply !== true && status === 'ok';
  if (dryRun) warnings.push({ code: 'OODS-W003', message: 'Dry run: the schema validated, but no HTML was rendered. Pass apply: true to get the document, or fragments with output.format "fragments".' });
  if (output.preview) {
    const errorCount = output.status === 'error' ? output.errors.length : 0;
    output.preview.summary = buildPreviewSummary((output.preview.screens ?? []).length, errorCount, dryRun);
  }

  return output;
}
