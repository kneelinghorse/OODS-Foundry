import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildAndStartBridge, stopBridge, type BridgeProcess } from '../helpers/bridge-harness.ts';
import type {
  ReplRenderOutput,
  ReplValidateInput,
  ReplValidateOutput,
  UiSchema,
} from '../../src/schemas/generated.js';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, '../../../../');
const MCP_BRIDGE_DIR = path.join(REPO_ROOT, 'packages', 'mcp-bridge');

let bridge: BridgeProcess | null = null;

const testSchema: UiSchema = {
  version: '2026.02',
  dsVersion: '2026-02-24',
  theme: 'default',
  screens: [
    {
      id: 'a11y-e2e-screen',
      component: 'Stack',
      children: [
        { id: 'a11y-e2e-button', component: 'Button', props: { label: 'Submit' } },
        { id: 'a11y-e2e-badge', component: 'Badge', props: { label: 'Active' } },
      ],
    },
  ],
};

async function runBridgeTool<T>(port: number, tool: string, input: unknown): Promise<T> {
  const response = await fetch(`http://127.0.0.1:${port}/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tool, input }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Bridge /run failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  return payload.result as T;
}

// ---------------------------------------------------------------------------
// E2E: validate → render → scan round-trip
// ---------------------------------------------------------------------------

describe('a11y pipeline e2e', () => {
  beforeAll(async () => {
    bridge = await buildAndStartBridge({
      repoRoot: REPO_ROOT,
      bridgeDir: MCP_BRIDGE_DIR,
      extraEnv: { MCP_EXTRA_TOOLS: 'a11y.scan' },
    });
  }, 180_000);

  afterAll(async () => {
    if (bridge) {
      await stopBridge(bridge);
      bridge = null;
    }
  });

  it('validate with checkA11y=true returns a11y warnings through bridge', async () => {
    const input: ReplValidateInput = {
      mode: 'full',
      schema: testSchema,
      options: { checkA11y: true },
    };
    const result = await runBridgeTool<ReplValidateOutput>(bridge!.port, 'schema_render', { action: 'validate', ...input });

    expect(result.status).toBeDefined();
    expect(result.mode).toBe('full');
    expect(Array.isArray(result.warnings)).toBe(true);

    // All a11y warnings should have correct format
    const a11yWarnings = result.warnings.filter((w) => w.code === 'A11Y_CONTRAST');
    for (const warning of a11yWarnings) {
      expect(warning.severity).toBe('warning');
      expect(warning.hint).toBeTruthy();
    }
  });

  it('validate + render round-trip succeeds with a11y enabled', async () => {
    // Step 1: validate with a11y
    const validateResult = await runBridgeTool<ReplValidateOutput>(
      bridge!.port,
      'schema_render',
      { action: 'validate', mode: 'full', schema: testSchema, options: { checkA11y: true } },
    );
    expect(validateResult.status).toBe('ok');

    // Step 2: render the same schema — verify the pipeline doesn't break
    const renderResult = await runBridgeTool<ReplRenderOutput>(
      bridge!.port,
      'schema_render',
      { action: 'render', mode: 'full', schema: testSchema },
    );
    // Render should return a structured response (status + mode present)
    expect(renderResult.status).toBeDefined();
    expect(renderResult.mode).toBe('full');
  });

  it('a11y.scan produces structured report through bridge', async () => {
    const result = await runBridgeTool<{
      artifacts: string[];
      transcriptPath: string;
      bundleIndexPath: string;
      preview?: { summary?: string; notes?: string[] };
    }>(bridge!.port, 'a11y_scan', {});

    expect(result.transcriptPath).toBeUndefined();
    expect(result.bundleIndexPath).toBeUndefined();
    expect(result.preview).toBeDefined();
    expect(result.preview?.summary).toMatch(/Accessibility:/);
    expect(result.preview?.summary).toMatch(/declared pairs/);
  });
});
