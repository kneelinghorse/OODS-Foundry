import type {
  ReplIssue,
  ReplRenderInput,
  ReplRenderOutput,
  ReplValidateInput,
  ReplValidateOutput,
  UiSchema
} from '../../../packages/mcp-server/src/schemas/generated.js';

export type RenderRequest = Partial<ReplRenderInput> & {
  schema?: UiSchema;
  baseTree?: UiSchema;
};

export type RenderResponse =
  | { status: 'ok'; output: ReplRenderOutput }
  | { status: 'error'; error: Error };

export type ValidateRequest = Partial<ReplValidateInput> & {
  schema?: UiSchema;
  baseTree?: UiSchema;
};

export type ValidateResponse =
  | { status: 'ok'; output: ReplValidateOutput }
  | { status: 'error'; error: Error };

function summarizeRequest(request: RenderRequest | ValidateRequest): string {
  const mode = request.mode ?? (request.patch ? 'patch' : 'full');
  const schemaScreens = Array.isArray(request.schema?.screens) ? request.schema!.screens!.length : 0;
  const baseScreens = Array.isArray(request.baseTree?.screens) ? request.baseTree!.screens!.length : 0;
  const hasPatch = Boolean(request.patch);
  const parts = [`mode=${mode}`, `schemaScreens=${schemaScreens}`];
  if (baseScreens) parts.push(`baseScreens=${baseScreens}`);
  if (hasPatch) parts.push('patch=true');
  return parts.join(' ');
}

function summarizeIssues(issues?: ReplIssue[]): string {
  if (!issues?.length) return 'codes=none';
  const codes = Array.from(new Set(issues.map((issue) => issue.code || 'UNKNOWN')));
  return `codes=${codes.join(',')}`;
}

function logRendererFailure(
  kind: 'render' | 'validate',
  message: string,
  request: RenderRequest | ValidateRequest,
  issues?: ReplIssue[]
): void {
  const context = summarizeRequest(request);
  const codes = summarizeIssues(issues);
  // Minimal telemetry for renderer/validator failures without leaking full payloads
  console.warn(`[design-lab-shell:${kind}] ${message} (${context}; ${codes})`);
}

export async function renderDesignLab(request: RenderRequest = {}): Promise<RenderResponse> {
  const mode: ReplRenderInput['mode'] = request.mode ?? (request.patch ? 'patch' : 'full');

  const payload: ReplRenderInput = {
    mode,
    schema: request.schema,
    baseTree: request.baseTree,
    patch: request.patch,
    options: { includeTree: true, ...(request.options || {}) }
  };

  try {
    const { handle } = await import('../../../packages/mcp-server/src/tools/repl.render.js');
    const output = await handle(payload);
    if (output.status === 'error') {
      logRendererFailure('render', 'Renderer returned status=error', request, output.errors);
    }
    return { status: 'ok', output };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logRendererFailure('render', error.message, request);
    return { status: 'error', error };
  }
}

export async function validateDesignLab(request: ValidateRequest = {}): Promise<ValidateResponse> {
  const mode: ReplValidateInput['mode'] = request.mode ?? (request.patch ? 'patch' : 'full');
  const payload: ReplValidateInput = {
    mode,
    schema: request.schema,
    baseTree: request.baseTree,
    patch: request.patch,
    options: { includeNormalized: true, checkComponents: true, ...(request.options || {}) }
  };

  try {
    const { handle } = await import('../../../packages/mcp-server/src/tools/repl.validate.js');
    const output = await handle(payload);
    if (output.status === 'invalid') {
      logRendererFailure('validate', 'Validation returned status=invalid', request, output.errors);
    }
    return { status: 'ok', output };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logRendererFailure('validate', error.message, request);
    return { status: 'error', error };
  }
}

export function formatIssues(issues: ReplIssue[] | undefined): string {
  if (!issues?.length) return '';
  return issues
    .map((issue) => {
      const parts = [issue.code || 'ISSUE', issue.message || ''];
      if (issue.path) parts.push(`@ ${issue.path}`);
      if (issue.hint) parts.push(`(${issue.hint})`);
      return parts.filter(Boolean).join(' ');
    })
    .join('; ');
}
