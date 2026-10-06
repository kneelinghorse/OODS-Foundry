import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReplIssue, ReplPatch, ReplRenderOutput, UiSchema } from '../../../packages/mcp-server/src/schemas/generated.js';
import { buildAgentPlan, fetchRegistrySummary } from '../agentWorkflow.js';
import { validateDesignLab } from '../rendererClient.js';
import type { RenderRequest, RenderResponse, ValidateResponse } from '../rendererClient.js';
import { ensureDesignLabStyles } from '../styles.js';

type ShellState = 'loading' | 'ready' | 'empty' | 'error';
type Renderer = (input: RenderRequest) => Promise<RenderResponse>;
type EditorMode = 'full' | 'patch';

export interface DesignLabShellProps {
  schema?: UiSchema;
  title?: string;
  renderer?: Renderer;
}

type PreviewBuckets = {
  errors: ReplIssue[];
  warnings: ReplIssue[];
};

type Snapshot = {
  id: string;
  tree: UiSchema;
  ts: string;
  note: string;
};

type ValidationState = {
  status: 'idle' | 'ok' | 'invalid' | 'error';
  errors: ReplIssue[];
  warnings: ReplIssue[];
  message?: string;
};

type ChatRole = 'System' | 'User' | 'Agent' | 'Tool';

type ChatEntry = {
  id: string;
  role: ChatRole;
  text: string;
  meta?: string;
  status?: 'pending' | 'ok' | 'error';
};

const defaultConversation: ChatEntry[] = [
  { id: 'm1', role: 'System', text: 'Loaded OODS registry and renderer tools.' },
  { id: 'm2', role: 'User', text: 'Draft a timeline screen using audit components.' },
  { id: 'm3', role: 'Agent', text: 'Building schema, validating, then rendering preview.' }
];

function bucketizeIssues(output?: ReplRenderOutput): PreviewBuckets {
  const errors = output?.errors || [];
  const warnings = output?.warnings || [];
  return { errors, warnings };
}

function safeStringify(tree?: UiSchema | null): string {
  if (!tree) return 'No schema loaded yet.';
  return JSON.stringify(tree, null, 2);
}

function formatIssueList(issues?: ReplIssue[]): string {
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

function safeParseJson<T>(input: string): { ok: true; value: T } | { ok: false; message: string } {
  if (!input.trim()) return { ok: false, message: 'No JSON provided.' };
  try {
    const value = JSON.parse(input) as T;
    return { ok: true, value };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return 'array';
  return 'object';
}

function joinPath(base: string, segment: string): string {
  if (!base) return `/${segment}`;
  return `${base}/${segment}`;
}

function diffSchemas(before?: UiSchema, after?: UiSchema): string[] {
  if (!before || !after) return [];

  const changes: string[] = [];

  const walk = (prev: any, next: any, path: string) => {
    if (prev === next) return;
    if (prev === undefined) {
      changes.push(`added ${path || '/'}: ${formatValue(next)}`);
      return;
    }
    if (next === undefined) {
      changes.push(`removed ${path || '/'}: ${formatValue(prev)}`);
      return;
    }

    if (Array.isArray(prev) && Array.isArray(next)) {
      const max = Math.max(prev.length, next.length);
      for (let i = 0; i < max; i += 1) {
        const pointer = joinPath(path, String(i));
        if (i >= prev.length) {
          changes.push(`added ${pointer}: ${formatValue(next[i])}`);
        } else if (i >= next.length) {
          changes.push(`removed ${pointer}: ${formatValue(prev[i])}`);
        } else {
          walk(prev[i], next[i], pointer);
        }
      }
      return;
    }

    if (isPlainObject(prev) && isPlainObject(next)) {
      const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
      for (const key of keys) {
        const pointer = joinPath(path, key);
        walk((prev as any)[key], (next as any)[key], pointer);
      }
      return;
    }

    changes.push(`changed ${path || '/'}: ${formatValue(prev)} -> ${formatValue(next)}`);
  };

  walk(before, after, '');
  return changes;
}

function summarizeMeta(meta?: ReplRenderOutput['meta']): string | undefined {
  if (!meta) return undefined;
  const parts: string[] = [];
  if (meta.screenCount !== undefined) parts.push(`${meta.screenCount} screen${meta.screenCount === 1 ? '' : 's'}`);
  if (meta.nodeCount !== undefined) parts.push(`${meta.nodeCount} nodes`);
  if (meta.duplicateIds?.length) parts.push(`dupes: ${meta.duplicateIds.join(', ')}`);
  if (meta.missingComponents?.length) parts.push(`missing: ${meta.missingComponents.slice(0, 3).join(', ')}`);
  return parts.length ? parts.join(' · ') : undefined;
}

async function callRenderer(renderer: Renderer | undefined, request: RenderRequest): Promise<RenderResponse> {
  if (renderer) return renderer(request);
  const mod = await import('../rendererClient.js');
  return mod.renderDesignLab(request);
}

function renderStatusPill(state: ShellState, output?: ReplRenderOutput, fatal?: string) {
  const variant =
    fatal || output?.status === 'error' || state === 'error'
      ? 'error'
      : state === 'ready'
        ? 'ready'
        : 'warning';
  const label =
    fatal || output?.status === 'error'
      ? fatal || 'Renderer error'
      : state === 'ready'
        ? 'Renderer ok'
        : 'Loading renderer';

  return (
    <span className="design-status" data-variant={variant} aria-live="polite">
      {label}
    </span>
  );
}

export function DesignLabShell({ schema, title = 'Design Lab', renderer }: DesignLabShellProps) {
  const [state, setState] = useState<ShellState>(schema ? 'loading' : 'empty');
  const [preview, setPreview] = useState<ReplRenderOutput | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [editorText, setEditorText] = useState<string>(() => (schema ? JSON.stringify(schema, null, 2) : ''));
  const [patchText, setPatchText] = useState<string>('');
  const [mode, setMode] = useState<EditorMode>('full');
  const [validation, setValidation] = useState<ValidationState>({ status: 'idle', errors: [], warnings: [] });
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [workingSchema, setWorkingSchema] = useState<UiSchema | undefined>(schema);
  const [chatLog, setChatLog] = useState<ChatEntry[]>(defaultConversation);
  const [agentPrompt, setAgentPrompt] = useState<string>('Add a status badge to the audit timeline.');
  const [agentBusy, setAgentBusy] = useState<boolean>(false);
  const [registryHints, setRegistryHints] = useState<string[]>([]);
  const chatSeq = useRef<number>(defaultConversation.length);

  useEffect(() => {
    ensureDesignLabStyles();
  }, []);

  const appendChat = (entry: Omit<ChatEntry, 'id'>) => {
    chatSeq.current += 1;
    const payload: ChatEntry = { ...entry, id: `m${chatSeq.current}` };
    setChatLog((prev) => [...prev, payload]);
    return payload;
  };

  const addSnapshot = (tree: UiSchema, note: string) => {
    setSnapshots((prev) => {
      const last = prev[prev.length - 1];
      const latestJson = JSON.stringify(tree);
      if (last && JSON.stringify(last.tree) === latestJson) return prev;
      const id = `v${prev.length + 1}`;
      const entry: Snapshot = { id, tree, ts: new Date().toISOString(), note };
      const next = [...prev, entry];
      return next.slice(-5);
    });
  };

  const applyValidationResponse = (result: ValidateResponse): { status: 'ok' | 'invalid' | 'error'; summary: string } => {
    if (result.status === 'error') {
      const message = result.error.message;
      setValidation({ status: 'error', errors: [{ code: 'VALIDATE_FAILED', message }], warnings: [] });
      return { status: 'error', summary: message };
    }
    const output = result.output;
    const status: 'ok' | 'invalid' = output.status === 'ok' ? 'ok' : 'invalid';
    const message = summarizeMeta(output.meta);
    setValidation({
      status,
      errors: output.errors,
      warnings: output.warnings,
      message
    });
    return {
      status,
      summary: output.errors.length ? formatIssueList(output.errors) : message || 'Validation ok'
    };
  };

  const executeRender = async (request: RenderRequest, note: string): Promise<RenderResponse | undefined> => {
    setState('loading');
    setFatal(null);
    let result: RenderResponse;
    try {
      result = await callRenderer(renderer, request);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFatal(message);
      setPreview(null);
      setState('error');
      setValidation({ status: 'error', errors: [{ code: 'RENDER_FAILED', message }], warnings: [] });
      return { status: 'error', error: new Error(message) };
    }

    if (result.status === 'error') {
      const message = result.error.message;
      setFatal(message);
      setPreview(null);
      setState('error');
      setValidation({ status: 'error', errors: [{ code: 'RENDER_FAILED', message }], warnings: [] });
      return result;
    }

    const output = result.output;
    setPreview(output);
    setState(output.status === 'error' ? 'error' : 'ready');
    setValidation({
      status: output.errors.length ? 'invalid' : 'ok',
      errors: output.errors,
      warnings: output.warnings,
      message: summarizeMeta(output.meta)
    });
    if (output.renderedTree) {
      setWorkingSchema(output.renderedTree);
      addSnapshot(output.renderedTree, note);
    }
    return result;
  };

  useEffect(() => {
    if (!schema) {
      setState('empty');
      setPreview(null);
      setFatal(null);
      setWorkingSchema(undefined);
      setEditorText('');
      setSnapshots([]);
      return;
    }

    setEditorText(JSON.stringify(schema, null, 2));
    setPatchText('');
    setMode('full');
    setWorkingSchema(schema);
    executeRender({ mode: 'full', schema }, 'Initial schema').catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      setFatal(message);
      setPreview(null);
      setState('error');
      setValidation({ status: 'error', errors: [{ code: 'RENDER_FAILED', message }], warnings: [] });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema, renderer]);

  const handleValidate = async () => {
    if (mode === 'full') {
      const parsed = safeParseJson<UiSchema>(editorText);
      if (!parsed.ok) {
        setValidation({ status: 'error', errors: [{ code: 'JSON_PARSE', message: parsed.message }], warnings: [] });
        return;
      }
      let result: Awaited<ReturnType<typeof validateDesignLab>>;
      try {
        result = await validateDesignLab({ mode: 'full', schema: parsed.value });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setValidation({ status: 'error', errors: [{ code: 'VALIDATE_FAILED', message }], warnings: [] });
        return;
      }
      applyValidationResponse(result);
      return;
    }

    const baseTree = workingSchema ?? preview?.renderedTree;
    if (!baseTree) {
      setValidation({
        status: 'error',
        errors: [{ code: 'MISSING_BASE_TREE', message: 'Apply a full schema before sending patches.' }],
        warnings: []
      });
      return;
    }

    const parsedPatch = safeParseJson<ReplPatch>(patchText);
    if (!parsedPatch.ok) {
      setValidation({ status: 'error', errors: [{ code: 'PATCH_PARSE', message: parsedPatch.message }], warnings: [] });
      return;
    }
    let result: Awaited<ReturnType<typeof validateDesignLab>>;
    try {
      result = await validateDesignLab({ mode: 'patch', baseTree, patch: parsedPatch.value });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setValidation({ status: 'error', errors: [{ code: 'VALIDATE_FAILED', message }], warnings: [] });
      return;
    }
    applyValidationResponse(result);
  };

  const handleApply = async () => {
    if (mode === 'full') {
      const parsed = safeParseJson<UiSchema>(editorText);
      if (!parsed.ok) {
        setValidation({ status: 'error', errors: [{ code: 'JSON_PARSE', message: parsed.message }], warnings: [] });
        return;
      }
      await executeRender({ mode: 'full', schema: parsed.value }, 'Applied full schema');
      return;
    }

    const baseTree = workingSchema ?? preview?.renderedTree;
    if (!baseTree) {
      setValidation({
        status: 'error',
        errors: [{ code: 'MISSING_BASE_TREE', message: 'Apply a full schema before sending patches.' }],
        warnings: []
      });
      return;
    }
    const parsedPatch = safeParseJson<ReplPatch>(patchText);
    if (!parsedPatch.ok) {
      setValidation({ status: 'error', errors: [{ code: 'PATCH_PARSE', message: parsedPatch.message }], warnings: [] });
      return;
    }
    await executeRender({ mode: 'patch', baseTree, patch: parsedPatch.value }, 'Applied patch');
  };

  const handleAgentRun = async () => {
    if (agentBusy) return;
    const prompt = agentPrompt.trim();
    if (!prompt) return;

    appendChat({ role: 'User', text: prompt });
    setAgentBusy(true);
    const baseTree = workingSchema ?? preview?.renderedTree ?? schema;

    try {
      const [componentsResult, tokensResult] = await Promise.allSettled([
        fetchRegistrySummary('components'),
        fetchRegistrySummary('tokens')
      ]);

      const componentSummary = componentsResult.status === 'fulfilled' ? componentsResult.value : null;
      const tokenSummary = tokensResult.status === 'fulfilled' ? tokensResult.value : null;

      if (componentSummary) {
        setRegistryHints((prev) => [...prev.slice(-2), componentSummary.summary]);
        appendChat({
          role: 'Tool',
          text: 'structuredData.fetch(components)',
          meta: componentSummary.summary,
          status: 'ok'
        });
      } else if (componentsResult.status === 'rejected') {
        const message = componentsResult.reason instanceof Error ? componentsResult.reason.message : String(componentsResult.reason);
        appendChat({ role: 'Tool', text: `structuredData.fetch(components) failed: ${message}`, status: 'error' });
      }

      if (tokenSummary) {
        setRegistryHints((prev) => [...prev.slice(-2), tokenSummary.summary]);
        appendChat({
          role: 'Tool',
          text: 'structuredData.fetch(tokens)',
          meta: tokenSummary.summary,
          status: 'ok'
        });
      } else if (tokensResult.status === 'rejected') {
        const message = tokensResult.reason instanceof Error ? tokensResult.reason.message : String(tokensResult.reason);
        appendChat({ role: 'Tool', text: `structuredData.fetch(tokens) failed: ${message}`, status: 'error' });
      }

      const plan = buildAgentPlan(prompt, {
        baseTree: baseTree || undefined,
        registryVersion: componentSummary?.version ?? null,
        componentNames: componentSummary?.sampleComponents
      });

      if (plan.mode === 'patch') {
        setMode('patch');
        setPatchText(JSON.stringify(plan.request.patch ?? [], null, 2));
      } else {
        setMode('full');
        if (plan.request.schema) {
          setEditorText(JSON.stringify(plan.request.schema, null, 2));
        }
      }

      appendChat({
        role: 'Agent',
        text: plan.description,
        meta: plan.patchSummary.join(' · '),
        status: 'pending'
      });

      const validationResult = await validateDesignLab({
        mode: plan.request.mode ?? (plan.request.patch ? 'patch' : 'full'),
        schema: plan.request.schema,
        baseTree: plan.request.baseTree,
        patch: plan.request.patch
      });
      const validationSummary = applyValidationResponse(validationResult);
      appendChat({
        role: 'Tool',
        text: `validate_ui_tree: ${validationSummary.status === 'ok' ? 'ok' : 'issues detected'}`,
        meta: validationSummary.summary,
        status: validationSummary.status === 'ok' ? 'ok' : 'error'
      });

      const renderResult = await executeRender(plan.request, plan.note);
      if (renderResult?.status === 'error') {
        appendChat({ role: 'Tool', text: `render_ui failed: ${renderResult.error.message}`, status: 'error' });
      } else if (renderResult?.status === 'ok') {
        const output = renderResult.output;
        appendChat({
          role: 'Tool',
          text: `render_ui: ${output.status}`,
          meta: output.preview?.summary || (output.errors.length ? formatIssueList(output.errors) : undefined),
          status: output.status === 'ok' ? 'ok' : 'error'
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      appendChat({ role: 'Agent', text: `Agent workflow failed: ${message}`, status: 'error' });
      setState('error');
    } finally {
      setAgentBusy(false);
    }
  };

  const formattedJson = useMemo(() => {
    const tree = preview?.renderedTree ?? workingSchema ?? schema;
    return safeStringify(tree);
  }, [preview?.renderedTree, workingSchema, schema]);

  const { errors, warnings } = useMemo(() => bucketizeIssues(preview || undefined), [preview]);

  const previewSummary = preview?.preview?.summary || 'Awaiting renderer response.';
  const screens = preview?.preview?.screens || [];
  const routes = preview?.preview?.routes || [];

  const metaHints = useMemo(() => {
    const hints: string[] = [];
    if (preview?.registryVersion) hints.push(`Registry ${preview.registryVersion}`);
    if (preview?.dslVersion) hints.push(`DSL ${preview.dslVersion}`);
    if (preview?.mode) hints.push(`Mode: ${preview.mode}`);
    if (preview?.meta?.screenCount !== undefined) hints.push(`${preview.meta.screenCount} screen(s) validated`);
    return hints;
  }, [preview]);

  const showPlaceholder = state === 'loading' || state === 'empty';
  const placeholderText =
    state === 'empty'
      ? 'No mission schema provided yet. Feed the renderer a JSON UI tree to light up the preview.'
      : 'Loading renderer and schema...';

  const renderIssues = fatal ? [fatal] : errors.map((entry) => formatIssueList([entry]));

  const lastSnapshot = snapshots[snapshots.length - 1];
  const previousSnapshot = snapshots.length > 1 ? snapshots[snapshots.length - 2] : undefined;
  const diffSummary = useMemo(
    () => diffSchemas(previousSnapshot?.tree, lastSnapshot?.tree),
    [lastSnapshot?.tree, previousSnapshot?.tree]
  );

  return (
    <div className="design-lab-shell" data-testid="design-lab-shell" aria-label={`${title} shell`}>
      <section className="design-pane" data-testid="pane-chat">
        <header className="design-pane__title">
          Chat & Context
          {renderStatusPill(state, preview || undefined, fatal || undefined)}
        </header>
        <p className="design-pane__hint">Trace what the agent is doing and which context is active.</p>
        <div className="design-pane__body">
          <div className="design-pane__list" data-testid="chat-log">
            {chatLog.map((entry) => (
              <div className="design-pane__card design-chat__item" data-status={entry.status} key={entry.id}>
                <div className="design-chat__role">{entry.role}</div>
                <div className="design-chat__text">
                  {entry.text}
                  {entry.meta ? <div className="design-chat__meta">{entry.meta}</div> : null}
                </div>
              </div>
            ))}
            {registryHints.length ? (
              <div className="design-pane__card">
                <div className="design-pane__title">Registry Context</div>
                <div className="design-pane__hint">{registryHints.join(' · ')}</div>
              </div>
            ) : null}
            {metaHints.length ? (
              <div className="design-pane__card">
                <div className="design-pane__title">Renderer Meta</div>
                <div className="design-pane__hint">{metaHints.join(' · ')}</div>
              </div>
            ) : null}
          </div>
          <div className="design-chat__composer">
            <input
              type="text"
              value={agentPrompt}
              onChange={(event) => setAgentPrompt(event.target.value)}
              placeholder="Ask the agent to update the UI schema"
              data-testid="agent-input"
              disabled={agentBusy}
            />
            <button type="button" data-testid="agent-run" onClick={handleAgentRun} disabled={agentBusy}>
              {agentBusy ? 'Running...' : 'Send to agent'}
            </button>
          </div>
        </div>
      </section>

      <section className="design-pane" data-testid="pane-json">
        <header className="design-pane__title">Schema JSON</header>
        <p className="design-pane__hint">Edit the UI tree, validate changes, and apply full or patch updates.</p>
        <div className="design-controls">
          <div className="design-toggle" role="group" aria-label="Apply mode">
            <button
              type="button"
              data-active={mode === 'full'}
              data-testid="mode-full"
              onClick={() => setMode('full')}
            >
              Full apply
            </button>
            <button
              type="button"
              data-active={mode === 'patch'}
              data-testid="mode-patch"
              onClick={() => setMode('patch')}
            >
              Patch apply
            </button>
          </div>
          <div className="design-actions">
            <button type="button" data-testid="validate-json" onClick={handleValidate}>
              Validate
            </button>
            <button type="button" data-testid="apply-json" onClick={handleApply}>
              Apply to preview
            </button>
          </div>
        </div>

        <div className="design-pane__body design-editor">
          <div className="design-editor__block">
            <div className="design-pane__title">Schema editor</div>
            <textarea
              className="design-textarea"
              value={editorText}
              onChange={(event) => setEditorText(event.target.value)}
              placeholder="Paste or write a UISchema JSON payload."
              spellCheck={false}
              data-testid="json-editor"
            />
          </div>

          {mode === 'patch' ? (
            <div className="design-editor__block">
              <div className="design-pane__title">Patch editor</div>
              <textarea
                className="design-textarea"
                value={patchText}
                onChange={(event) => setPatchText(event.target.value)}
                placeholder='Provide JSON Patch or node-targeted patch. Example: [{"op":"replace","path":"/screens/0/component","value":"AuditTimeline"}]'
                spellCheck={false}
                data-testid="patch-editor"
              />
              <p className="design-pane__hint">
                Base tree: {lastSnapshot ? `${lastSnapshot.id} (${lastSnapshot.note})` : 'none available yet'}
              </p>
            </div>
          ) : null}

          <div className="design-editor__block">
            <div className="design-pane__title">Last rendered tree</div>
            {showPlaceholder && !preview?.renderedTree ? (
              <div className="design-placeholder" data-testid="json-placeholder">
                {placeholderText}
              </div>
            ) : (
              <pre className="design-json" data-testid="json-view">
                {formattedJson}
              </pre>
            )}
          </div>

          {validation.status !== 'idle' ? (
            <div className="design-validation" data-status={validation.status} data-testid="validation-summary">
              <div className="design-validation__header">
                Validation {validation.status === 'ok' ? 'passed' : 'feedback'}
                {validation.message ? <span className="design-pane__hint">{validation.message}</span> : null}
              </div>
              {validation.errors.length ? (
                <div>
                  <strong>Errors</strong>
                  <div>{formatIssueList(validation.errors)}</div>
                </div>
              ) : null}
              {validation.warnings.length ? (
                <div>
                  <strong>Warnings</strong>
                  <div>{formatIssueList(validation.warnings)}</div>
                </div>
              ) : null}
              {!validation.errors.length && !validation.warnings.length ? (
                <div className="design-pane__hint">No validation issues detected.</div>
              ) : null}
            </div>
          ) : null}

          <div className="design-diff" data-testid="diff-summary">
            <div className="design-pane__title">Changes vs previous</div>
            {diffSummary.length ? (
              <ul>
                {diffSummary.map((entry, idx) => (
                  <li key={idx}>{entry}</li>
                ))}
              </ul>
            ) : (
              <p className="design-pane__hint">Diffs will appear after at least two applied snapshots.</p>
            )}
          </div>

          <div className="design-history" data-testid="history-list">
            <div className="design-pane__title">History</div>
            {snapshots.length ? (
              <ul>
                {snapshots.map((snap) => (
                  <li key={snap.id}>
                    <strong>{snap.id}</strong> — {snap.note} ({new Date(snap.ts).toLocaleTimeString()})
                  </li>
                ))}
              </ul>
            ) : (
              <p className="design-pane__hint">Apply a schema to build a timeline and enable diffs.</p>
            )}
          </div>
        </div>
      </section>

      <section className="design-pane" data-testid="pane-preview">
        <header className="design-pane__title">
          Live Preview
          {renderStatusPill(state, preview || undefined, fatal || undefined)}
        </header>
        <p className="design-pane__hint">Renderer output, validation errors, and screen routing.</p>
        <div className="design-pane__body">
          {showPlaceholder ? (
            <div className="design-placeholder" data-testid="preview-placeholder">
              {placeholderText}
            </div>
          ) : (
            <>
              <div className="design-preview__section">
                <div className="design-preview__badge" data-testid="preview-summary">
                  {previewSummary}
                </div>
                {screens.length ? (
                  <div className="design-preview__badge" data-testid="preview-screens">
                    Screens: {screens.join(', ')}
                  </div>
                ) : null}
                {routes.length ? (
                  <div className="design-preview__badge" data-testid="preview-routes">
                    Routes: {routes.join(', ')}
                  </div>
                ) : null}
                {warnings.length ? (
                  <div className="design-preview__badge" data-variant="warning" data-testid="preview-warnings">
                    Warnings: {formatIssueList(warnings)}
                  </div>
                ) : null}
              </div>

              {renderIssues.length ? (
                <div className="design-preview__errors" data-testid="preview-errors">
                  <strong>Renderer issues</strong>
                  {renderIssues.map((err, idx) => (
                    <div key={idx}>{err}</div>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
