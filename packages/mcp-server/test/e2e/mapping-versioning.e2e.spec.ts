/**
 * Bridge E2E tests for mapping tools and versioned structuredData.fetch (s52-m04).
 *
 * Tests map.create, map.list, map.resolve, and versioned structuredData.fetch
 * through the MCP bridge HTTP transport.
 */
import { once } from 'node:events';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildAndStartBridge, type BridgeProcess } from '../helpers/bridge-harness.ts';

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, '../../../../');
const MCP_BRIDGE_DIR = path.join(REPO_ROOT, 'packages', 'mcp-bridge');
const DEFAULT_MAPPINGS_PATH = path.join(REPO_ROOT, 'artifacts', 'structured-data', 'component-mappings.json');
const MAPPINGS_PATH_ENV = 'MCP_MAPPINGS_PATH';

let bridge: BridgeProcess | null = null;
let originalMappings: string | null = null;
let originalMappingsPathEnv: string | undefined;
let mappingsTmpDir: string | null = null;

function currentMappingsPath(): string {
  return process.env[MAPPINGS_PATH_ENV] || DEFAULT_MAPPINGS_PATH;
}

async function runCommand(cmd: string, args: string[], cwd: string): Promise<void> {
  const child = spawn(cmd, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });
  const stderrChunks: string[] = [];
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => stderrChunks.push(chunk));
  const [code] = (await once(child, 'close')) as [number | null];
  if (code !== 0) {
    throw new Error(`Command failed (${cmd} ${args.join(' ')}):\n${stderrChunks.join('')}`);
  }
}

async function stopBridge(proc: BridgeProcess): Promise<void> {
  proc.child.kill('SIGTERM');
  await once(proc.child, 'close');
}

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

describe('mapping + versioning bridge E2E', () => {
  beforeAll(async () => {
    originalMappingsPathEnv = process.env[MAPPINGS_PATH_ENV];
    const originalPath = currentMappingsPath();
    originalMappings = fs.existsSync(originalPath) ? fs.readFileSync(originalPath, 'utf8') : null;

    mappingsTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-mapping-versioning-'));
    process.env[MAPPINGS_PATH_ENV] = path.join(mappingsTmpDir, 'component-mappings.json');

    // Reset to empty for clean test
    const empty = {
      $schema: '../../packages/mcp-server/src/schemas/component-mapping.schema.json',
      generatedAt: new Date().toISOString(),
      version: new Date().toISOString().slice(0, 10),
      stats: { mappingCount: 0, systemCount: 0 },
      mappings: [],
    };
    fs.mkdirSync(path.dirname(currentMappingsPath()), { recursive: true });
    fs.writeFileSync(currentMappingsPath(), JSON.stringify(empty, null, 2) + '\n');

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
    if (mappingsTmpDir) {
      fs.rmSync(mappingsTmpDir, { recursive: true, force: true });
      mappingsTmpDir = null;
    }
    if (originalMappingsPathEnv === undefined) {
      delete process.env[MAPPINGS_PATH_ENV];
    } else {
      process.env[MAPPINGS_PATH_ENV] = originalMappingsPathEnv;
    }
    // Restore mappings file
    const mappingsPath = currentMappingsPath();
    if (originalMappings === null) {
      fs.rmSync(mappingsPath, { force: true });
    } else {
      fs.mkdirSync(path.dirname(mappingsPath), { recursive: true });
      fs.writeFileSync(mappingsPath, originalMappings);
    }
  });

  it('map.create → map.list → map.resolve round-trip via bridge (multi-system)', async () => {
    const createdMaterial = await runBridgeTool(bridge!.port, 'map', { action: 'create',
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
      propMappings: [
        { externalProp: 'variant', oodsProp: 'appearance', coercion: { type: 'enum', mapping: { primary: 'primary' } } },
      ],
      confidence: 'auto',
    });

    const createdChakra = await runBridgeTool(bridge!.port, 'map', { action: 'create',
      apply: true,
      externalSystem: 'chakra',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
      propMappings: [
        { externalProp: 'size', oodsProp: 'size', coercion: { type: 'template', pattern: '{{value}}' } },
      ],
      confidence: 'manual',
    });

    expect(createdMaterial.status).toBe('ok');
    expect(createdMaterial.mapping.id).toBe('material-button');
    expect(createdMaterial.etag).toMatch(/^[a-f0-9]{64}$/);
    expect(createdMaterial.applied).toBe(true);

    expect(createdChakra.status).toBe('ok');
    expect(createdChakra.mapping.id).toBe('chakra-button');
    expect(createdChakra.etag).toMatch(/^[a-f0-9]{64}$/);
    expect(createdChakra.applied).toBe(true);

    const materialListed = await runBridgeTool(bridge!.port, 'map', { action: 'list',
      externalSystem: 'material',
    });

    expect(materialListed.totalCount).toBeGreaterThanOrEqual(1);
    expect(materialListed.mappings.some((m: any) => m.id === 'material-button')).toBe(true);

    const chakraListed = await runBridgeTool(bridge!.port, 'map', { action: 'list',
      externalSystem: 'chakra',
    });

    expect(chakraListed.totalCount).toBeGreaterThanOrEqual(1);
    expect(chakraListed.mappings.some((m: any) => m.id === 'chakra-button')).toBe(true);

    const resolvedMaterial = await runBridgeTool(bridge!.port, 'map', { action: 'resolve',
      externalSystem: 'material',
      externalComponent: 'Button',
    });

    expect(resolvedMaterial.status).toBe('ok');
    expect(resolvedMaterial.mapping.oodsTraits).toEqual(['Stateful']);
    expect(resolvedMaterial.propTranslations).toBeInstanceOf(Array);
    expect(resolvedMaterial.propTranslations.length).toBe(1);
    expect(resolvedMaterial.propTranslations[0].coercionType).toBe('enum');

    const resolvedChakra = await runBridgeTool(bridge!.port, 'map', { action: 'resolve',
      externalSystem: 'chakra',
      externalComponent: 'Button',
    });

    expect(resolvedChakra.status).toBe('ok');
    expect(resolvedChakra.mapping.oodsTraits).toEqual(['Stateful']);
    expect(resolvedChakra.propTranslations).toBeInstanceOf(Array);
    expect(resolvedChakra.propTranslations.length).toBe(1);
    expect(resolvedChakra.propTranslations[0].coercionType).toBe('template');
  });

  it('structuredData.fetch listVersions via bridge', async () => {
    const result = await runBridgeTool(bridge!.port, 'structuredData_fetch', {
      dataset: 'components',
      listVersions: true,
    });

    expect(result.availableVersions).toBeInstanceOf(Array);
    expect(result.availableVersions.length).toBeGreaterThan(0);
    expect(result.payloadIncluded).toBe(false);
  });

  it('structuredData.fetch versioned request via bridge', async () => {
    // Use a known version date
    const versions = await runBridgeTool(bridge!.port, 'structuredData_fetch', {
      dataset: 'components',
      listVersions: true,
    });

    const latestVersion = versions.availableVersions[versions.availableVersions.length - 1];

    const result = await runBridgeTool(bridge!.port, 'structuredData_fetch', {
      dataset: 'components',
      version: latestVersion,
      includePayload: false,
    });

    expect(result.resolvedVersion).toBe(latestVersion);
    expect(result.etag).toMatch(/^[a-f0-9]{64}$/);
    expect(result.payloadIncluded).toBe(false);
  });
});
