import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildAndStartBridge, stopBridge, type BridgeProcess } from '../helpers/bridge-harness.ts';
import type { ReplRenderInput, ReplRenderOutput, UiSchema } from '../../src/schemas/generated.js';
import { handle as renderHandle } from '../../src/tools/repl.render.js';

type TemplateCase = {
  name: string;
  file: string;
  minFragments: number;
  minComponentCount: number;
};

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, '../../../../');
const FIXTURE_DIR = path.resolve(TEST_FILE_DIR, '../fixtures/ui');
const MCP_SERVER_DIR = path.join(REPO_ROOT, 'packages', 'mcp-server');
const MCP_BRIDGE_DIR = path.join(REPO_ROOT, 'packages', 'mcp-bridge');

const TEMPLATE_CASES: TemplateCase[] = [
  { name: 'dashboard', file: 'dashboard-page.ui-schema.json', minFragments: 3, minComponentCount: 15 },
  { name: 'form-page', file: 'form-page.ui-schema.json', minFragments: 3, minComponentCount: 15 },
  { name: 'landing-page', file: 'landing-page.ui-schema.json', minFragments: 3, minComponentCount: 15 },
];

let bridge: BridgeProcess | null = null;

function loadFixture(fileName: string): UiSchema {
  const fullPath = path.join(FIXTURE_DIR, fileName);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8')) as UiSchema;
}

function renderCount(html: string): number {
  return (html.match(/data-oods-component="/g) ?? []).length;
}

function extractComponentSequence(html: string): string[] {
  const matches = html.matchAll(/data-oods-component="([^"]+)"/g);
  return Array.from(matches, (match) => match[1]);
}

function extractMainMarkup(documentHtml: string): string {
  const match = documentHtml.match(/<main id="oods-preview-root">([\s\S]*?)<\/main>/i);
  return match?.[1] ?? documentHtml;
}

function sortComponents(components: string[]): string[] {
  return [...components].sort((left, right) => left.localeCompare(right));
}

function subtractOneComponent(components: string[], componentName: string): string[] {
  const copy = [...components];
  const index = copy.indexOf(componentName);
  if (index >= 0) {
    copy.splice(index, 1);
  }
  return copy;
}

function assertNoDocumentWrappers(html: string): void {
  expect(html).not.toMatch(/<!DOCTYPE/i);
  expect(html).not.toMatch(/<html(?:\s|>)/i);
  expect(html).not.toMatch(/<head(?:\s|>)/i);
  expect(html).not.toMatch(/<body(?:\s|>)/i);
}

function collectFragmentHtml(result: ReplRenderOutput): string[] {
  return Object.values(result.fragments ?? {}).map((fragment) => fragment.html);
}

function collectFragmentNodeIds(result: ReplRenderOutput): string[] {
  return Object.keys(result.fragments ?? {});
}

async function runBridgeRender(port: number, input: ReplRenderInput): Promise<ReplRenderOutput> {
  const response = await fetch(`http://127.0.0.1:${port}/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      tool: 'repl',
      input: { action: 'render', ...input },
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Bridge /run failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  return payload.result as ReplRenderOutput;
}

describe('fragment integration e2e', () => {
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

  it.each(TEMPLATE_CASES)('%s fragment mode meets expected fragment and component coverage', async (templateCase) => {
    const schema = loadFixture(templateCase.file);
    const result = await renderHandle({
      mode: 'full',
      schema,
      apply: true,
      output: { format: 'fragments', strict: false },
    });

    expect(result.status).toBe('ok');
    const fragments = Object.values(result.fragments ?? {});
    expect(fragments.length).toBeGreaterThanOrEqual(templateCase.minFragments);

    const combinedCount = fragments.reduce((total, fragment) => total + renderCount(fragment.html), 0);
    expect(combinedCount).toBeGreaterThanOrEqual(templateCase.minComponentCount);

    for (const fragment of fragments) {
      assertNoDocumentWrappers(fragment.html);
      for (const cssRef of fragment.cssRefs) {
        expect(result.css?.[cssRef]).toBeDefined();
      }
    }
  });

  it.each(TEMPLATE_CASES)('%s fragment output preserves component structure vs full-document mode', async (templateCase) => {
    const schema = loadFixture(templateCase.file);
    const [fragmentResult, documentResult] = await Promise.all([
      renderHandle({
        mode: 'full',
        schema,
        apply: true,
        output: { format: 'fragments', strict: false },
      }),
      renderHandle({
        mode: 'full',
        schema,
        apply: true,
      }),
    ]);

    expect(fragmentResult.status).toBe('ok');
    expect(documentResult.status).toBe('ok');
    expect(documentResult.html).toContain('<!DOCTYPE html>');

    const fragmentComponents = sortComponents(
      collectFragmentHtml(fragmentResult).flatMap((html) => extractComponentSequence(html))
    );
    const rootComponents = (schema.screens ?? []).map((screen) => screen.component);
    let normalizedDocumentComponents = extractComponentSequence(extractMainMarkup(documentResult.html ?? ''));
    for (const rootComponent of rootComponents) {
      normalizedDocumentComponents = subtractOneComponent(normalizedDocumentComponents, rootComponent);
    }
    expect(fragmentComponents).toEqual(sortComponents(normalizedDocumentComponents));
  });

  it.each(TEMPLATE_CASES)('%s bridge transport returns fragment output equivalent to direct handler', async (templateCase) => {
    if (!bridge) throw new Error('Bridge process not initialized');
    const schema = loadFixture(templateCase.file);
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

    expect(bridgeResult.status).toBe('ok');
    expect(directResult.status).toBe('ok');
    expect(collectFragmentNodeIds(bridgeResult)).toEqual(collectFragmentNodeIds(directResult));
    expect(Object.keys(bridgeResult.css ?? {})).toEqual(Object.keys(directResult.css ?? {}));
    expect(bridgeResult.output).toEqual(directResult.output);
  });
});
