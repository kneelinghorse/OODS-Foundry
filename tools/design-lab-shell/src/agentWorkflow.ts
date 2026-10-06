import type { ReplPatch, UiSchema } from '../../../packages/mcp-server/src/schemas/generated.js';
import type { StructuredDataFetchOutput } from '../../../packages/mcp-server/src/tools/types.js';
import type { RenderRequest } from './rendererClient.js';
import { sampleSchema } from './sampleSchema.js';

export type RegistrySummary = {
  dataset: 'components' | 'tokens';
  summary: string;
  version?: string | null;
  warnings?: string[];
  sampleComponents?: string[];
  etag?: string;
  payloadIncluded?: boolean;
  meta?: Record<string, unknown>;
};

function extractComponentNames(payload: StructuredDataFetchOutput['payload']): string[] {
  if (!payload) return [];
  const components = (payload as Record<string, any>).components;
  if (!Array.isArray(components)) return [];
  return components
    .map((entry) => (entry && typeof entry === 'object' ? (entry as Record<string, any>).id || null : null))
    .filter((name): name is string => Boolean(name))
    .slice(0, 6);
}

function formatSummary(output: StructuredDataFetchOutput): string {
  const meta = output.meta || {};
  const pieces: string[] = [];
  if (output.dataset === 'components') {
    const componentCount = meta.componentCount ?? meta.objectCount ?? null;
    const traitCount = meta.traitCount ?? null;
    if (componentCount !== null) pieces.push(`${componentCount} components`);
    if (traitCount !== null) pieces.push(`${traitCount} traits`);
  } else if (output.dataset === 'tokens') {
    const tokenCounts = meta.tokenCounts as Record<string, unknown> | undefined;
    const componentTokens = tokenCounts?.componentTokens ?? tokenCounts?.systemTokens ?? null;
    if (componentTokens !== null) pieces.push(`${componentTokens} tokens`);
  }
  if (output.version) pieces.push(`v${output.version}`);
  if (output.etag) pieces.push(`etag ${output.etag.slice(0, 8)}`);
  return pieces.length ? pieces.join(' · ') : `${output.dataset} fetched`;
}

export async function fetchRegistrySummary(dataset: 'components' | 'tokens'): Promise<RegistrySummary> {
  const { handle } = await import('../../../packages/mcp-server/src/tools/structuredData.fetch.js');
  const output: StructuredDataFetchOutput = await handle({ dataset, includePayload: dataset === 'components' });
  return {
    dataset,
    version: output.version,
    summary: formatSummary(output),
    warnings: output.warnings,
    sampleComponents: dataset === 'components' ? extractComponentNames(output.payload) : undefined,
    etag: output.etag,
    payloadIncluded: output.payloadIncluded,
    meta: output.meta
  };
}

type PlanOptions = {
  baseTree?: UiSchema;
  registryVersion?: string | null;
  componentNames?: string[];
};

export type AgentPlan = {
  mode: 'full' | 'patch';
  request: RenderRequest;
  description: string;
  note: string;
  patchSummary: string[];
};

function ensureScreenShape(tree: UiSchema): UiSchema {
  const clone = structuredClone(tree);
  if (!Array.isArray(clone.screens) || !clone.screens.length) return clone;
  const screen = clone.screens[0];
  if (!Array.isArray(screen.children)) screen.children = [];
  if (!screen.meta) screen.meta = {};
  if (!screen.layout) screen.layout = { type: 'stack', gapToken: 'spacing.md' };
  if (!screen.layout.gapToken) screen.layout.gapToken = 'spacing.md';
  return clone;
}

function selectComponent(prompt: string, candidates?: string[], fallback?: string): string {
  const normalized = prompt.toLowerCase();
  if (normalized.includes('timeline')) return 'AuditTimeline';
  if (normalized.includes('summary')) return 'ArchiveSummary';
  if (normalized.includes('status')) return 'StatusBadge';
  if (candidates?.length) return candidates[0];
  return fallback || 'AuditTimeline';
}

function sanitizedPrompt(prompt: string): string {
  const cleaned = prompt.trim() || 'Update the UI schema';
  return cleaned.length > 90 ? `${cleaned.slice(0, 87)}...` : cleaned;
}

export function buildAgentPlan(prompt: string, options: PlanOptions): AgentPlan {
  const hint = sanitizedPrompt(prompt);
  const candidates = options.componentNames;
  const registryVersion = options.registryVersion || undefined;
  const baseTree = options.baseTree ? ensureScreenShape(options.baseTree) : null;
  const selectedComponent = selectComponent(hint, candidates, baseTree?.screens?.[0]?.component);

  if (!baseTree || !Array.isArray(baseTree.screens) || !baseTree.screens.length) {
    const schema: UiSchema = {
      ...structuredClone(sampleSchema),
      dsVersion: registryVersion || sampleSchema.dsVersion,
      screens: [
        {
          id: 'agent-screen',
          component: selectedComponent,
          layout: { type: 'stack', gapToken: 'spacing.md' },
          meta: { label: hint },
          children: [
            {
              id: 'agent-status',
              component: 'StatusBadge',
              meta: { label: 'Status indicator' },
              props: { tone: 'info', label: 'On track' }
            }
          ]
        }
      ]
    };
    return {
      mode: 'full',
      request: { mode: 'full', schema },
      description: `Generated base schema with ${selectedComponent}`,
      note: 'Agent generated a new UISchema from prompt input',
      patchSummary: ['Created base schema', `Primary component ${selectedComponent}`]
    };
  }

  const screen = baseTree.screens[0];
  const patch: ReplPatch = [];
  const summary: string[] = [];

  if (screen.component !== selectedComponent) {
    patch.push({ op: 'replace', path: '/screens/0/component', value: selectedComponent });
    summary.push(`component → ${selectedComponent}`);
  }

  const mergedLabel = screen.meta?.label ? `${screen.meta.label} · ${hint}` : hint;
  patch.push({ op: 'add', path: '/screens/0/meta/label', value: mergedLabel });
  summary.push('label updated');

  if (!screen.layout?.gapToken) {
    patch.push({ op: 'add', path: '/screens/0/layout/gapToken', value: 'spacing.md' });
    summary.push('gapToken=spacing.md');
  }

  const nextChildIndex = screen.children?.length ?? 0;
  patch.push({
    op: 'add',
    path: `/screens/0/children/${nextChildIndex}`,
    value: {
      id: `agent-${nextChildIndex + 1}`,
      component: 'StatusBadge',
      meta: { label: 'Agent status badge' },
      props: { tone: 'info', label: 'Agent-added status' }
    }
  });
  summary.push('added StatusBadge child');

  return {
    mode: 'patch',
    request: { mode: 'patch', baseTree, patch },
    description: `Planned ${patch.length} updates (${summary.join(', ')})`,
    note: 'Agent patch applied to active tree',
    patchSummary: summary
  };
}
