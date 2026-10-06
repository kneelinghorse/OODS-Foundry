/**
 * Bridge E2E test for design.compose (s51-m04).
 *
 * Tests design.compose through the MCP bridge HTTP transport,
 * verifying the full toolchain: bridge → MCP server → compose → validate → respond.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildAndStartBridge, stopBridge, type BridgeProcess } from '../helpers/bridge-harness.ts';

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, '../../../../');
const MCP_BRIDGE_DIR = path.join(REPO_ROOT, 'packages', 'mcp-bridge');

let bridge: BridgeProcess | null = null;

async function runBridgeTool(port: number, tool: string, input: Record<string, unknown>): Promise<any> {
  const response = await fetch(`http://127.0.0.1:${port}/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tool, input }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Bridge /run failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  return payload.result;
}

describe('design.compose bridge E2E', () => {
  beforeAll(async () => {
    bridge = await buildAndStartBridge({
      repoRoot: REPO_ROOT,
      bridgeDir: MCP_BRIDGE_DIR,
    });
  }, 180_000);

  afterAll(async () => {
    if (bridge) {
      await stopBridge(bridge);
      bridge = null;
    }
  });

  it('compose via bridge produces valid schema with selections', async () => {
    const result = await runBridgeTool(bridge!.port, 'design_compose', {
      intent: 'dashboard with metrics',
      layout: 'dashboard',
    });

    expect(result.status).toBe('ok');
    expect(result.layout).toBe('dashboard');
    expect(result.schema).toBeTruthy();
    expect(result.schema.version).toBe('2026.02');
    expect(result.schema.screens).toHaveLength(1);
    expect(result.selections).toBeInstanceOf(Array);
    expect(result.selections.length).toBeGreaterThan(0);
  });

  it('compose then render round-trip through bridge', async () => {
    // Step 1: Compose through bridge
    const composed = await runBridgeTool(bridge!.port, 'design_compose', {
      intent: 'user registration form',
      layout: 'form',
    });
    expect(composed.status).toBe('ok');
    expect(composed.validation?.status).toBe('ok');

    // Step 2: Render the composed schema through bridge
    const rendered = await runBridgeTool(bridge!.port, 'repl', { action: 'render',
      mode: 'full',
      schema: composed.schema,
      apply: true,
      output: { format: 'document' },
    });
    expect(rendered.status).toBe('ok');
    expect(rendered.html).toBeTruthy();
    expect(rendered.html).toContain('data-oods-component');
  });

  it('compose with fragment render through bridge', async () => {
    const composed = await runBridgeTool(bridge!.port, 'design_compose', {
      intent: 'searchable product list',
      layout: 'list',
    });
    expect(composed.status).toBe('ok');

    const rendered = await runBridgeTool(bridge!.port, 'repl', { action: 'render',
      mode: 'full',
      schema: composed.schema,
      apply: true,
      output: { format: 'fragments' },
    });
    expect(rendered.status).toBe('ok');
    expect(rendered.fragments).toBeTruthy();
    expect(Object.keys(rendered.fragments).length).toBeGreaterThan(0);
  });
});
