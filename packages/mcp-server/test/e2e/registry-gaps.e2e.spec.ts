import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildAndStartBridge, stopBridge, type BridgeProcess } from '../helpers/bridge-harness.ts';
import type { ReplRenderInput, ReplRenderOutput, UiSchema } from '../../src/schemas/generated.js';
import { handle as renderHandle } from '../../src/tools/repl.render.js';

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, '../../../../');
const FIXTURE_DIR = path.resolve(TEST_FILE_DIR, '../fixtures/ui');
const MCP_BRIDGE_DIR = path.join(REPO_ROOT, 'packages', 'mcp-bridge');

let bridge: BridgeProcess | null = null;

function loadFixture(fileName: string): UiSchema {
  const fullPath = path.join(FIXTURE_DIR, fileName);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8')) as UiSchema;
}

/** Workbench S44 component set with 1 unknown component injected. */
function workbenchWithUnknown(): UiSchema {
  const base = loadFixture('workbench-s44.ui-schema.json');
  const screen = base.screens[0];
  if (Array.isArray(screen.children)) {
    screen.children.push({
      id: 'unknown-widget',
      component: 'FancyWidget',
    });
  }
  return base;
}

async function runBridgeRender(port: number, input: ReplRenderInput): Promise<ReplRenderOutput> {
  const response = await fetch(`http://127.0.0.1:${port}/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      tool: 'schema_render',
      input: { action: 'render', ...input },
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Bridge /run failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  if (!payload?.ok || !payload?.result) {
    throw new Error(`Unexpected bridge response: ${JSON.stringify(payload)}`);
  }
  return payload.result as ReplRenderOutput;
}

describe('registry gaps e2e verification', () => {
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

  it('Workbench S44 fixture with Grid + known components renders all fragments via bridge', async () => {
    if (!bridge) throw new Error('Bridge process not initialized');

    const schema = loadFixture('workbench-s44.ui-schema.json');
    const input: ReplRenderInput = {
      mode: 'full',
      schema,
      apply: true,
      output: { format: 'fragments', strict: false },
    };

    const [bridgeResult, directResult] = await Promise.all([
      runBridgeRender(bridge.port, input),
      renderHandle(input),
    ]);

    // Both transports return success
    expect(bridgeResult.status).toBe('ok');
    expect(directResult.status).toBe('ok');

    // All top-level fragments present (header-banner, main-grid, save-button)
    const expectedFragmentIds = ['header-banner', 'main-grid', 'save-button'];
    for (const id of expectedFragmentIds) {
      expect(bridgeResult.fragments?.[id]).toBeDefined();
      expect(directResult.fragments?.[id]).toBeDefined();
    }

    // Grid fragment renders correctly
    const gridFragment = bridgeResult.fragments?.['main-grid'];
    expect(gridFragment).toBeDefined();
    expect(gridFragment!.component).toBe('Grid');
    expect(gridFragment!.html).toContain('data-oods-component="Grid"');
    expect(gridFragment!.html).toContain('display:grid');
    // s221-m01: a column count is a maximum since #2418; the fragment carries the count and the shipped Grid rule that
    // reads it, so a fragment rendered with its own CSS keeps its columns.
    expect(gridFragment!.html).toContain('--oods-grid-columns:3');
    expect(gridFragment!.html).toContain('data-max-columns="3"');
    expect(gridFragment!.cssRefs).toContain('cmp.grid.base');
    expect(bridgeResult.css?.['cmp.grid.base']).toContain("[data-oods-component='Grid'][data-max-columns]");

    // Grid children rendered inside
    expect(gridFragment!.html).toContain('data-oods-component="Card"');
    expect(gridFragment!.html).toContain('data-oods-component="Text"');
    expect(gridFragment!.html).toContain('data-oods-component="Badge"');
    expect(gridFragment!.html).toContain('data-oods-component="Input"');
    expect(gridFragment!.html).toContain('data-oods-component="Select"');
    expect(gridFragment!.html).toContain('data-oods-component="Table"');
    expect(gridFragment!.html).toContain('data-oods-component="Tabs"');

    // No errors
    expect(bridgeResult.errors.filter((e) => e.code === 'OODS-V006')).toHaveLength(0);

    // Bridge parity: fragment IDs match
    expect(Object.keys(bridgeResult.fragments ?? {}).sort()).toEqual(
      Object.keys(directResult.fragments ?? {}).sort()
    );
  }, 60_000);

  it('Workbench S44 fixture with unknown component returns partial fragments + per-node errors via bridge', async () => {
    if (!bridge) throw new Error('Bridge process not initialized');

    const schema = workbenchWithUnknown();
    const input: ReplRenderInput = {
      mode: 'full',
      schema,
      apply: true,
      output: { format: 'fragments', strict: false },
    };

    const [bridgeResult, directResult] = await Promise.all([
      runBridgeRender(bridge.port, input),
      renderHandle(input),
    ]);

    // Both return partial success
    expect(bridgeResult.status).toBe('ok');
    expect(directResult.status).toBe('ok');

    // Known components still render as fragments
    expect(bridgeResult.fragments?.['header-banner']).toBeDefined();
    expect(bridgeResult.fragments?.['main-grid']).toBeDefined();
    expect(bridgeResult.fragments?.['save-button']).toBeDefined();

    // Unknown component excluded from fragments
    expect(bridgeResult.fragments?.['unknown-widget']).toBeUndefined();

    // Unknown component reported as per-node error
    const unknownErrors = bridgeResult.errors.filter((e) => e.code === 'OODS-V006');
    expect(unknownErrors).toHaveLength(1);
    expect(unknownErrors[0]?.nodeId).toBe('unknown-widget');
    expect(unknownErrors[0]?.component).toBe('FancyWidget');
    expect(unknownErrors[0]?.path).toBe('/fragments/unknown-widget');

    // Response shape matches the proposed shape from the registry gaps report
    expect(bridgeResult.fragments).toBeDefined();
    expect(bridgeResult.css).toBeDefined();
    expect(bridgeResult.errors).toBeDefined();

    // Bridge parity: error isolation behavior is identical
    const directUnknownErrors = directResult.errors.filter((e) => e.code === 'OODS-V006');
    expect(directUnknownErrors).toHaveLength(unknownErrors.length);
    expect(Object.keys(bridgeResult.fragments ?? {}).sort()).toEqual(
      Object.keys(directResult.fragments ?? {}).sort()
    );
  }, 60_000);

  it('bridge transport does not alter error isolation — strict mode still fails globally', async () => {
    if (!bridge) throw new Error('Bridge process not initialized');

    const schema = workbenchWithUnknown();
    const input: ReplRenderInput = {
      mode: 'full',
      schema,
      apply: true,
      output: { format: 'fragments', strict: true },
    };

    const [bridgeResult, directResult] = await Promise.all([
      runBridgeRender(bridge.port, input),
      renderHandle(input),
    ]);

    // Both return error status — strict mode blocks
    expect(bridgeResult.status).toBe('error');
    expect(directResult.status).toBe('error');
    expect(bridgeResult.fragments).toBeUndefined();
    expect(directResult.fragments).toBeUndefined();
  }, 60_000);
});
