import type { ReplIssue, UiSchema } from '../schemas/generated.js';
import type {
  CodegenFramework,
  CodegenIssue,
  CodegenReleaseEvidence,
  CodegenStyling,
  CodegenTargetResolution,
  CodegenValidationProfile,
  CodegenValidationReceipt,
  GeneratedArtifact,
} from './types.js';
import { handle as composeHandle, type ActionMapping, type ActionInstance, type DesignComposeInput, type ResolvedTraitActions } from './design.compose.js';
import { handle as validateHandle } from './repl.validate.js';
import { handle as renderHandle } from './repl.render.js';
import { handle as codeGenerateHandle } from './code.generate.js';
import { handle as schemaSaveHandle } from './schema/save.js';
import { resolveSchemaRef, computeTtlWarning } from './schema-ref.js';
import { loadOodsrc } from '../lib/oodsrc.js';
import type { LayoutInput } from '../compose/layout-types.js';
import {
  createValidationReceipt,
  validationReceiptIntegrityIssues,
  withTargetResolution,
} from '../codegen/validation-profile.js';
import { validateGeneratedArtifact } from '../codegen/artifact-envelope.js';
import type { ToolContext } from '../lib/tool-context.js';
import { INLINE_PAYLOAD_LIMIT, largePayloadWarning, payloadDigest, payloadTooLarge, writePayload, type PayloadMode, type PayloadReceipt } from '../lib/payload-store.js';

type PipelineStep = 'compose' | 'validate' | 'render' | 'codegen' | 'save';

export type PipelineInput = {
  object?: string;
  intent?: string;
  context?: 'detail' | 'list' | 'form' | 'timeline' | 'card' | 'inline' | 'workflow';
  layout?: LayoutInput;
  preferences?: DesignComposeInput['preferences'];
  /** Sprint 88: Stage1 BridgeSummary action_mappings, flat verb-keyed. */
  actionMappings?: ActionMapping[];
  /** Sprint 88.1: Stage1 BridgeSummary.actions[] per-component action instances. Requires actionMappings[] for trait lookup. */
  actionInstances?: ActionInstance[];
  framework?: CodegenFramework;
  styling?: CodegenStyling;
  /** Validation profile. Defaults to build. */
  profile?: CodegenValidationProfile;
  /** Hash-bound evidence required when profile is release. */
  releaseEvidence?: CodegenReleaseEvidence;
  save?: string | { name: string; tags?: string[] };
  options?: {
    skipValidation?: boolean;
    skipRender?: boolean;
    checkA11y?: boolean;
    renderApply?: boolean;
    compact?: boolean;
    /** Alias: accepted in options for agent ergonomics. */
    typescript?: boolean;
    /** Alias: accepted in options for agent ergonomics. */
    styling?: CodegenStyling;
    /** Alias: accepted in options for agent ergonomics. */
    framework?: CodegenFramework;
    /** Emit data-oods-confidence attributes on rendered components. Default false. */
    showConfidence?: boolean;
    /** Confidence threshold for low-confidence CSS class. Default 0.5. */
    confidenceThreshold?: number;
    /** Unset: inline unless the output would exceed one reply; file writes the HTML and the artifact to disk. */
    payloadMode?: PayloadMode;
  };
};

export type PipelineOutput = {
  validationReceipt: CodegenValidationReceipt;
  /** s239: OODS-W004 when the page and the generated files went to files because they were too large to return. */
  warnings?: Array<{ code: string; message: string }>;
  schemaRef?: string;
  schemaRefCreatedAt?: string;
  schemaRefExpiresAt?: string;
  schemaRefTtlWarning?: {
    message: string;
    remainingMs: number;
    recommendation: string;
  };
  compose: {
    object?: string;
    context?: string;
    layout: string;
    componentCount: number;
    /** Sprint 88: verbs grouped by trait after action_mappings reconciliation. */
    resolvedActions?: ResolvedTraitActions[];
  };
  validation?: {
    status: 'ok' | 'invalid' | 'skipped';
    errors: ReplIssue[];
    warnings: ReplIssue[];
  };
  render?: {
    html?: string;
    tokenCssRef?: string;
    meta: Record<string, unknown>;
  };
  code?: {
    framework: CodegenFramework;
    styling: CodegenStyling;
    /** Omitted when the output went to files; payload lists them. */
    artifact?: GeneratedArtifact;
  };
  /** s238: the rendered HTML and the artifact's files, written to disk instead of returned (payloadMode). */
  payload?: PayloadReceipt & { reason: string };
  saved?: {
    name: string;
    version: number;
  };
  summary?: string;
  metrics?: {
    totalNodes: number;
    componentsUsed: number;
    fieldsBound: number;
    fieldsOmitted?: Array<{ field: string; reason: string }>;
    responseBytes: number;
  };
  pipeline: {
    steps: string[];
    stepLatency?: Record<string, number>;
    duration: number;
  };
  error?: {
    step: PipelineStep;
    code: string;
    message: string;
  };
};

function countComponents(schema: UiSchema | undefined): number {
  if (!schema) return 0;
  const names = new Set<string>();
  const stack = [...schema.screens];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    names.add(node.component);
    if (Array.isArray(node.children) && node.children.length > 0) {
      stack.push(...node.children);
    }
  }

  return names.size;
}

function countNodes(schema: UiSchema | undefined): number {
  if (!schema) return 0;
  let count = 0;
  const stack = [...schema.screens];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    count++;
    if (Array.isArray(node.children) && node.children.length > 0) {
      stack.push(...node.children);
    }
  }
  return count;
}

type FieldBinding = {
  bound: number;
  boundFields: Set<string>;
};

function analyzeFieldBindings(schema: UiSchema | undefined): FieldBinding {
  if (!schema?.objectSchema) return { bound: 0, boundFields: new Set() };
  const boundFields = new Set<string>();
  const stack = [...schema.screens];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    const add = (field: unknown): void => {
      if (typeof field !== 'string' || !Object.hasOwn(schema.objectSchema!, field) || boundFields.has(field)) return;
      boundFields.add(field);
      const definition = schema.objectSchema![field]!;
      add(definition.displayLabelField);
      add(definition.displayFallbackField);
    };
    const declaredFields = (value: Record<string, unknown>): void => {
      for (const [key, field] of Object.entries(value)) {
        if (key === 'field' || key.endsWith('Field')) add(field);
        if ((key === 'fields' || key.endsWith('Fields')) && Array.isArray(field)) field.forEach(add);
      }
    };
    declaredFields(node.props ?? {});
    if (node.collection) declaredFields(node.collection);
    if (node.chart) declaredFields(node.chart);
    if (Array.isArray(node.props?.columns)) for (const column of node.props.columns) {
      if (column && typeof column === 'object') { add(column.key); add(column.field); }
    }
    if (Array.isArray(node.children) && node.children.length > 0) {
      stack.push(...node.children);
    }
  }
  return { bound: boundFields.size, boundFields };
}

type FieldOmission = { field: string; reason: string };

function computeFieldsOmitted(schema: UiSchema | undefined, boundFields: Set<string>): FieldOmission[] {
  if (!schema?.objectSchema) return [];
  const omitted: FieldOmission[] = [];
  for (const fieldName of Object.keys(schema.objectSchema)) {
    if (!boundFields.has(fieldName)) {
      const def = schema.objectSchema[fieldName];
      const isComplex = def && typeof def === 'object' && ('items' in def || 'properties' in def);
      const reason = isComplex
        ? 'Complex/nested field has no matching component slot'
        : 'No view slot available for this field in the current layout context';
      omitted.push({ field: fieldName, reason });
    }
  }
  return omitted;
}

function buildSummary(input: PipelineInput, componentCount: number, fieldsBound: number, framework: string, styling: string): string {
  const parts: string[] = [];
  if (input.object) parts.push(`${input.object}`);
  if (input.context) parts.push(`${input.context} view`);
  else parts.push('view');
  if (fieldsBound > 0) parts.push(`with ${fieldsBound} fields`);
  parts.push(`${framework}/${styling}`);
  return `${parts.join(', ')}, ${componentCount} components`;
}

function firstIssueMessage(issues: ReplIssue[] | CodegenIssue[] | undefined): { code: string; message: string } {
  const issue = issues?.[0];
  if (!issue) {
    return {
      code: 'OODS-S009',
      message: 'Step failed without a structured issue payload.',
    };
  }

  return {
    code: issue.code,
    message: issue.message,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function handle(input: PipelineInput, context: ToolContext = {}): Promise<PipelineOutput> {
  const startedAt = Date.now();
  const steps: PipelineStep[] = [];
  const rc = loadOodsrc();
  const targetResolution: CodegenTargetResolution = input.framework !== undefined
    ? { requested: input.framework, resolved: input.framework, source: 'explicit' }
    : input.options?.framework !== undefined
      ? {
          requested: input.options.framework,
          resolved: input.options.framework,
          source: 'options-alias',
        }
      : rc.framework !== undefined
        ? { resolved: rc.framework, source: 'oodsrc' }
        : { resolved: 'react', source: 'default' };
  const framework = targetResolution.resolved;
  const styling = input.styling ?? input.options?.styling ?? rc.styling ?? 'tokens';
  const skipValidation = input.options?.skipValidation === true;
  const skipRender = input.options?.skipRender === true;
  const checkA11y = input.options?.checkA11y ?? rc.pipeline?.checkA11y ?? false;
  const renderApply = input.options?.renderApply ?? true;
  const renderCompact = input.options?.compact ?? rc.pipeline?.compact ?? true;
  let validationReceipt = createValidationReceipt(input.profile, framework, targetResolution);

  const output: PipelineOutput = {
    validationReceipt,
    compose: {
      ...(input.object ? { object: input.object } : {}),
      ...(input.context ? { context: input.context } : {}),
      layout: input.layout ?? 'auto',
      componentCount: 0,
    },
    pipeline: {
      steps: [],
      duration: 0,
    },
  };

  const stepLatency: Record<string, number> = {};

  let composedSchema: UiSchema | undefined;

  const finish = (): PipelineOutput => {
    output.pipeline.steps = [...steps];
    output.pipeline.stepLatency = stepLatency;
    output.pipeline.duration = Math.max(1, Date.now() - startedAt);

    // s238 (0.10.1): the rendered page and the generated files can exceed what one reply should carry (a detail screen
    // is about 250,000 characters). Unless the caller chose, they go to disk and the response lists the files.
    const requested = input.options?.payloadMode;
    const artifact = output.code?.artifact;
    const characters = JSON.stringify(output).length;
    if (!output.error && (output.render?.html || artifact) && (requested === 'file' || payloadTooLarge(requested, characters, context.sizedReply))) {
      const files = [
        ...(output.render?.html ? [{ path: 'render/index.html', contents: output.render.html }] : []),
        ...(artifact ? [...artifact.files.map(file => ({ path: `code/${file.path}`, contents: file.contents, ...((file as { encoding?: 'base64' }).encoding ? { encoding: (file as { encoding?: 'base64' }).encoding } : {}) })), { path: 'code/artifact.json', contents: JSON.stringify(artifact, null, 2) + '\n' }] : []),
      ];
      const receipt = writePayload(`pipeline-${payloadDigest(files.map(file => `${file.path}\n${file.contents}`).join('\n'))}`, files);
      output.payload = { ...receipt, reason: requested === 'file' ? 'payloadMode file' : `The page and the generated files exceed ${INLINE_PAYLOAD_LIMIT.toLocaleString('en-US')} characters; pass options.payloadMode "inline" to receive them in the response.` };
      if (output.render) delete output.render.html;
      if (output.code) delete output.code.artifact;
      // s239: the site found no OODS-W004 on this path although the 0.10.1 CHANGELOG promised it, as code_generate and
      // schema_render give it; a caller that chose file mode needs no warning.
      if (requested !== 'file') output.warnings = [...(output.warnings ?? []), largePayloadWarning(characters, 'options.payloadMode')];
    }

    // Compute metrics and summary if compose succeeded
    if (composedSchema && !output.error) {
      const totalNodes = countNodes(composedSchema);
      const componentsUsed = countComponents(composedSchema);
      const binding = analyzeFieldBindings(composedSchema);
      const fieldsOmitted = computeFieldsOmitted(composedSchema, binding.boundFields);
      output.summary = buildSummary(input, componentsUsed, binding.bound, framework, styling);

      output.metrics = {
        totalNodes,
        componentsUsed,
        fieldsBound: binding.bound,
        ...(fieldsOmitted.length > 0 ? { fieldsOmitted } : {}),
        responseBytes: 0,
      };
      // Include the metrics block itself; repeat only until the size's decimal width stabilizes.
      let bytes = Buffer.byteLength(JSON.stringify(output), 'utf8');
      while (output.metrics.responseBytes !== bytes) {
        output.metrics.responseBytes = bytes;
        bytes = Buffer.byteLength(JSON.stringify(output), 'utf8');
      }
    }

    return output;
  };

  const fail = (step: PipelineStep, code: string, message: string): PipelineOutput => {
    output.error = { step, code, message };
    return finish();
  };

  steps.push('compose');

  let composeResult: Awaited<ReturnType<typeof composeHandle>>;
  let stepStart = Date.now();
  try {
    composeResult = await composeHandle({
      object: input.object,
      intent: input.intent,
      context: input.context,
      layout: input.layout,
      preferences: input.preferences,
      ...(input.actionMappings ? { actionMappings: input.actionMappings } : {}),
      ...(input.actionInstances ? { actionInstances: input.actionInstances } : {}),
      options: {
        validate: false,
      },
    });
    stepLatency.compose = Date.now() - stepStart;
  } catch (error) {
    stepLatency.compose = Date.now() - stepStart;
    return fail('compose', 'OODS-S010', `compose step threw: ${errorMessage(error)}`);
  }

  composedSchema = composeResult.schema;

  output.compose = {
    ...(composeResult.objectUsed?.name ? { object: composeResult.objectUsed.name } : output.compose.object ? { object: output.compose.object } : {}),
    ...(input.context ? { context: input.context } : {}),
    layout: composeResult.layout,
    componentCount: countComponents(composeResult.schema),
    ...(composeResult.objectUsed?.resolvedActions && composeResult.objectUsed.resolvedActions.length > 0
      ? { resolvedActions: composeResult.objectUsed.resolvedActions }
      : {}),
  };

  if (composeResult.schemaRef) {
    output.schemaRef = composeResult.schemaRef;
    if (composeResult.schemaRefCreatedAt) {
      output.schemaRefCreatedAt = composeResult.schemaRefCreatedAt;
    }
    if (composeResult.schemaRefExpiresAt) {
      output.schemaRefExpiresAt = composeResult.schemaRefExpiresAt;
    }

    // Proactive TTL warning (s86-m03)
    const resolved = resolveSchemaRef(composeResult.schemaRef);
    if (resolved.ok) {
      const ttlWarning = computeTtlWarning(resolved.record);
      if (ttlWarning) {
        output.schemaRefTtlWarning = ttlWarning;
      }
    }
  }

  if (composeResult.status !== 'ok') {
    const issue = firstIssueMessage(composeResult.errors);
    return fail('compose', issue.code, issue.message);
  }

  if (!composeResult.schemaRef) {
    return fail('compose', 'OODS-C001', 'compose did not return schemaRef.');
  }

  if (!skipValidation) {
    steps.push('validate');

    let validationResult: Awaited<ReturnType<typeof validateHandle>>;
    stepStart = Date.now();
    try {
      validationResult = await validateHandle({
        mode: 'full',
        schemaRef: composeResult.schemaRef,
        options: {
          checkComponents: true,
          checkA11y,
          includeNormalized: false,
        },
      });
      stepLatency.validate = Date.now() - stepStart;
    } catch (error) {
      stepLatency.validate = Date.now() - stepStart;
      return fail('validate', 'OODS-S011', `validate step threw: ${errorMessage(error)}`);
    }

    output.validation = {
      status: validationResult.status,
      errors: validationResult.errors,
      warnings: validationResult.warnings,
    };

    if (validationResult.status !== 'ok') {
      const issue = firstIssueMessage(validationResult.errors);
      return fail('validate', issue.code, issue.message);
    }
  }

  if (!skipRender) {
    steps.push('render');

    let renderResult: Awaited<ReturnType<typeof renderHandle>>;
    stepStart = Date.now();
    try {
      renderResult = await renderHandle({
        mode: 'full',
        schemaRef: composeResult.schemaRef,
        apply: renderApply,
        options: {
          includeTree: false,
        },
        output: {
          // The pipeline decides where the whole output goes (options.payloadMode).
          payloadMode: 'inline',
          compact: renderCompact,
          ...(input.options?.showConfidence ? { showConfidence: true } : {}),
          ...(input.options?.confidenceThreshold !== undefined ? { confidenceThreshold: input.options.confidenceThreshold } : {}),
        },
      });
      stepLatency.render = Date.now() - stepStart;
    } catch (error) {
      stepLatency.render = Date.now() - stepStart;
      return fail('render', 'OODS-S012', `render step threw: ${errorMessage(error)}`);
    }

    output.render = {
      ...(renderApply && renderResult.html ? { html: renderResult.html } : {}),
      ...(renderResult.tokenCssRef ? { tokenCssRef: renderResult.tokenCssRef } : {}),
      meta: {
        status: renderResult.status,
        warnings: renderResult.warnings.length,
        errors: renderResult.errors.length,
        ...(renderResult.output ? {
          format: renderResult.output.format,
          strict: renderResult.output.strict,
        } : {}),
        ...(renderResult.meta ? { validationMeta: renderResult.meta } : {}),
      },
    };

    if (renderResult.status !== 'ok') {
      const issue = firstIssueMessage(renderResult.errors);
      return fail('render', issue.code, issue.message);
    }
  }

  steps.push('codegen');

  let codegenResult: Awaited<ReturnType<typeof codeGenerateHandle>>;
  stepStart = Date.now();
  try {
    const typescript = input.options?.typescript;
    codegenResult = await codeGenerateHandle({
      schemaRef: composeResult.schemaRef,
      framework,
      ...(input.profile !== undefined ? { profile: input.profile } : {}),
      ...(input.releaseEvidence !== undefined ? { releaseEvidence: input.releaseEvidence } : {}),
      options: {
        styling,
        ...(typescript !== undefined ? { typescript } : {}),
        // The pipeline checks the artifact envelope itself and decides where the whole output goes (payloadMode).
        payloadMode: 'inline',
      },
    });
    stepLatency.codegen = Date.now() - stepStart;
  } catch (error) {
    stepLatency.codegen = Date.now() - stepStart;
    return fail('codegen', 'OODS-S013', `codegen step threw: ${errorMessage(error)}`);
  }

  if (!codegenResult.validationReceipt) {
    return fail(
      'codegen',
      'OODS-S009',
      'code.generate returned without its mandatory validation receipt.',
    );
  }
  if (codegenResult.framework !== framework) {
    return fail(
      'codegen',
      'OODS-S009',
      `code.generate returned framework ${JSON.stringify(codegenResult.framework)} for requested target ${JSON.stringify(framework)}.`,
    );
  }
  if (codegenResult.artifact?.framework !== undefined && codegenResult.artifact.framework !== framework) {
    return fail(
      'codegen',
      'OODS-S009',
      `code.generate returned an artifact for ${JSON.stringify(codegenResult.artifact.framework)} instead of ${JSON.stringify(framework)}.`,
    );
  }
  if (codegenResult.artifact) {
    const artifactIssues = validateGeneratedArtifact(codegenResult.artifact);
    if (artifactIssues.length > 0) {
      return fail(
        'codegen',
        'OODS-S009',
        `code.generate returned an invalid artifact envelope: ${artifactIssues[0]}`,
      );
    }
  }
  const receiptIssues = validationReceiptIntegrityIssues(codegenResult.validationReceipt, {
    profile: input.profile ?? 'build',
    defaulted: input.profile === undefined,
    target: { requested: framework, resolved: framework, source: 'explicit' },
    ...(codegenResult.artifact
      ? { artifactContentHash: codegenResult.artifact.contentHash }
      : {}),
  });
  if (receiptIssues.length > 0) {
    return fail(
      'codegen',
      'OODS-S009',
      `code.generate returned an invalid validation receipt: ${receiptIssues[0]}.`,
    );
  }
  validationReceipt = withTargetResolution(codegenResult.validationReceipt, targetResolution);
  output.validationReceipt = validationReceipt;

  if (codegenResult.status !== 'ok') {
    const issue = firstIssueMessage(codegenResult.errors);
    return fail('codegen', issue.code, issue.message);
  }
  if (!codegenResult.artifact) {
    return fail('codegen', 'OODS-N017', 'code.generate returned success without an artifact envelope.');
  }

  output.code = {
    framework,
    styling,
    artifact: codegenResult.artifact,
  };

  const saveConfig = typeof input.save === 'string'
    ? { name: input.save.trim(), tags: undefined }
    : input.save
      ? { name: input.save.name.trim(), tags: input.save.tags }
      : undefined;

  if (saveConfig?.name) {
    steps.push('save');

    stepStart = Date.now();
    try {
      const saved = await schemaSaveHandle({
        name: saveConfig.name,
        schemaRef: composeResult.schemaRef,
        ...(saveConfig.tags ? { tags: saveConfig.tags } : {}),
        ...(composeResult.objectUsed?.name ? { object: composeResult.objectUsed.name } : {}),
      });
      stepLatency.save = Date.now() - stepStart;
      output.saved = {
        name: saved.name,
        version: saved.version,
      };
    } catch (error) {
      stepLatency.save = Date.now() - stepStart;
      return fail('save', 'OODS-S014', `save step threw: ${errorMessage(error)}`);
    }
  }

  return finish();
}
