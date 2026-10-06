import {
  applyPatch,
  loadComponentRegistry,
  patchExampleHint,
  summarizeMeta,
  validateComponents,
  validateSchema,
} from './repl.utils.js';
import { ToolError } from '../errors/tool-error.js';
import type {
  ReplIssue,
  ReplJsonPatchOperation,
  ReplValidateInput,
  ReplValidateOutput,
  ReplValidationMeta,
  UiSchema,
} from '../schemas/generated.js';
import { resolveSchemaRef, unavailableSchemaRef } from './schema-ref.js';

function asWarnings(issues: ReplIssue[]): ReplIssue[] {
  return issues.map((entry) => ({ ...entry, severity: entry.severity ?? 'warning' }));
}

function cloneTree(tree: UiSchema | undefined): UiSchema | undefined {
  return tree ? structuredClone(tree) : undefined;
}

export async function handle(input: ReplValidateInput): Promise<ReplValidateOutput> {
  const mode = input.mode ?? 'full';
  const registry = loadComponentRegistry();
  const errors: ReplIssue[] = [];
  const warnings: ReplIssue[] = asWarnings(registry.warnings);

  let workingTree: UiSchema | undefined = undefined;
  let normalizedPatch: ReplJsonPatchOperation[] | undefined;
  let appliedPatch = false;
  let meta: ReplValidationMeta | undefined;

  if (mode === 'full') {
    if (input.schema) {
      workingTree = cloneTree(input.schema);
    } else if (input.schemaRef) {
      const resolved = resolveSchemaRef(input.schemaRef);
      if (resolved.ok) {
        workingTree = resolved.schema;
      } else {
        errors.push(unavailableSchemaRef(input.schemaRef, resolved.reason));
      }
    } else {
      errors.push({ code: 'OODS-V009', message: 'schema is required when mode=full' });
    }
  } else {
    if (input.baseTree) {
      workingTree = cloneTree(input.baseTree);
    } else if (input.schemaRef) {
      const resolved = resolveSchemaRef(input.schemaRef);
      if (resolved.ok) {
        workingTree = resolved.schema;
      } else {
        errors.push({ ...unavailableSchemaRef(input.schemaRef, resolved.reason), hint: 'Run design.compose again in this conversation for a fresh schemaRef, or pass the tree inline in the baseTree field.' });
      }
    } else {
      errors.push({
        code: 'OODS-V010',
        message: 'baseTree is required when mode=patch',
        path: '/baseTree',
        hint: patchExampleHint(),
      });
    }
    if (!input.patch) {
      errors.push({
        code: 'OODS-V011',
        message: 'patch is required when mode=patch',
        path: '/patch',
        hint: patchExampleHint(),
      });
    }
    if (workingTree && input.patch) {
      const patchResult = applyPatch(workingTree, input.patch);
      workingTree = patchResult.tree;
      if (patchResult.normalized.length) {
        normalizedPatch = patchResult.normalized;
      }
      errors.push(...patchResult.issues);
      appliedPatch = patchResult.normalized.length > 0 && patchResult.issues.length === 0;
    }
  }

  if (workingTree) {
    errors.push(...validateSchema(workingTree));
    if (input.options?.checkComponents !== false) {
      errors.push(...validateComponents(workingTree, registry));
    }
    meta = summarizeMeta(workingTree, registry);
  }

  // Opt-in screen checks use the same renderer and built scopes as a11y.scan.
  if (input.options?.checkA11y && errors.length === 0 && workingTree) {
    try {
      const { checkBuiltScreen, accessibilityWarnings } = await import('../a11y/built-screen.js');
      warnings.push(...accessibilityWarnings(await checkBuiltScreen(workingTree)));
    } catch (error) {
      errors.push({ code: error instanceof ToolError ? error.opiCode : 'OODS-S012',
        message: `Accessibility checks failed: ${error instanceof Error ? error.message : String(error)}`, severity: 'error' });
    }
  }

  const status = errors.length ? 'invalid' : 'ok';
  const dslVersion = workingTree?.version ?? input.schema?.version ?? '0.0.0';

  const output: ReplValidateOutput = {
    status,
    mode,
    dslVersion,
    registryVersion: registry.version,
    errors,
    warnings,
  };

  const includeTree = input.options?.includeNormalized ?? true;
  if (workingTree && includeTree) {
    output.normalizedTree = workingTree;
  }
  if (normalizedPatch && normalizedPatch.length) {
    output.normalizedPatch = normalizedPatch as ReplValidateOutput['normalizedPatch'];
  }
  if (mode === 'patch') {
    output.appliedPatch = appliedPatch;
  }
  if (meta) {
    output.meta = meta;
  }

  return output;
}
