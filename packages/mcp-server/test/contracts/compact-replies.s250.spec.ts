/**
 * s250-m01: two replies leave the stdio adapter compact, and are measured as they are sent (Interface 6). Claude Code saves
 * a tool reply over 50,000 characters to a file. At 0.16.0 the registry summary was 49,549 characters as the adapter sent
 * it, indented by two, and object_registry's show of Grant 51,048; Closure and its trait would have taken the summary over.
 * The native server, the bridge and the hosted site already send compact text; only the adapter indented. These specs run
 * the real adapter against the built server, as a client does (a missing build is a failure, not a skip), and pin:
 * - registry_snapshot's and object_registry's text is compact JSON that parses to what the tool returns;
 * - the summary, object_registry's list and every public object's show are each under 50,000 characters as sent;
 * - every other reply keeps its indentation, so nothing else a client reads changes.
 */
import { vi } from 'vitest';

vi.setConfig({ testTimeout: 180_000 });

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { McpClient } from '../../../../scripts/runtime/e2e.mjs';
import { handle as snapshot } from '../../src/tools/registry.snapshot.js';
import { handle as objectTool } from '../../src/tools/object.js';

const root = path.resolve(fileURLToPath(import.meta.url), '../../../../..');
const LIMIT = 50_000;
let client: InstanceType<typeof McpClient>;
let home: string;
const text = async (name: string, args: Record<string, unknown>) => {
  const result = await client.request('tools/call', { name, arguments: args }) as { content: Array<{ text: string }>; isError?: boolean };
  expect(result.isError, `${name}: ${result.content?.[0]?.text?.slice(0, 300)}`).not.toBe(true);
  return result.content[0]!.text;
};
/** What does not repeat from one call to the next: when the reply was made. */
const settled = (value: Record<string, unknown>) => { const { generatedAt: _at, ...rest } = value; return rest; };

beforeAll(async () => {
  expect(fs.existsSync(path.join(root, 'packages/mcp-server/dist/index.js')), 'build the server first: the adapter serves its dist').toBe(true);
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s250-compact-'));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(?:MCP_|OODS_|FORGE_)/.test(key)));
  Object.assign(env, { OODS_FOUNDRY_HOME: home, OODS_OBJECTS_DIR: path.join(home, 'objects'), HOME: home, MCP_TOOLSET: 'default', MCP_HEALTH_PORT: '0', OODS_NODE_PATH: process.execPath });
  vi.stubEnv('OODS_OBJECTS_DIR', env.OODS_OBJECTS_DIR);
  client = new McpClient({ adapterPath: path.join(root, 'packages/mcp-adapter/index.js'), cwd: root, env });
  await client.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 's250-compact-replies', version: '1' } });
  client.notify('notifications/initialized');
});
afterAll(async () => {
  if (client) { const closed = await client.closeStdinAndObserve(); if (!closed.exited) await client.terminate(); }
  vi.unstubAllEnvs();
  fs.rmSync(home, { recursive: true, force: true });
});

describe('registry_snapshot and object_registry leave the adapter compact, measured as sent', () => {
  it('sends the registry summary as compact JSON, the same JSON the tool returns, under 50,000 characters', async () => {
    const sent = await text('registry_snapshot', {});
    expect(sent).toBe(JSON.stringify(JSON.parse(sent)));
    expect(sent.length).toBeLessThan(LIMIT);
    expect(settled(JSON.parse(sent))).toEqual(settled(await snapshot({}) as Record<string, unknown>));
  });

  it('sends object_registry\'s list and every public object\'s show compact, each under 50,000 characters as sent', async () => {
    const list = await text('object_registry', { action: 'list' });
    expect(list).toBe(JSON.stringify(JSON.parse(list)));
    expect(list.length).toBeLessThan(LIMIT);
    const listed = JSON.parse(list) as { objects: Array<{ name: string }> };
    expect(listed).toEqual(await objectTool({ action: 'list' } as never));
    const sizes: Record<string, number> = {};
    for (const { name } of listed.objects) {
      const shown = await text('object_registry', { action: 'show', name });
      expect(shown, name).toBe(JSON.stringify(JSON.parse(shown)));
      expect(JSON.parse(shown), name).toEqual(await objectTool({ action: 'show', name } as never));
      sizes[name] = shown.length;
    }
    expect(Object.keys(sizes).length).toBeGreaterThanOrEqual(15);
    for (const [name, size] of Object.entries(sizes)) expect(size, `${name}: ${size} characters as sent`).toBeLessThan(LIMIT);
  });

  it('keeps every other reply indented as before', async () => {
    for (const [name, args] of [['health_check', {}], ['catalog_list', {}]] as const) {
      const sent = await text(name, args);
      expect(sent, name).toBe(JSON.stringify(JSON.parse(sent), null, 2));
    }
  });
  it('shows an imported object’s authored enum labels through server output validation', async () => {
    const name = 'ImportedLabels';
    const schema = { title: name, type: 'object', properties: {
      role: { type: 'string', enum: ['OWNER'], 'x-oods': { enumLabels: { OWNER: 'Team lead' } } },
    } };
    const draft = JSON.parse(await text('object_import', { action: 'draft', source: { name: 'roles.json', content: JSON.stringify(schema) } }));
    await text('object_import', { action: 'apply', importId: draft.importId, objects: [{ name }] });
    const shown = JSON.parse(await text('object_registry', { action: 'show', name }));
    expect(shown.semantics.role.ui_hints.enumLabels).toEqual({ OWNER: 'Team lead' });
  });

  it('returns the maps for the stored None value in Grant and Agent', async () => {
    for (const [name, fields] of Object.entries({
      Grant: { asks_first_for: 'No listed action needs a separate yes', never_allowed: 'No additional exclusions listed' },
      Agent: { acts_for: 'No party listed' },
    })) {
      const shown = JSON.parse(await text('object_registry', { action: 'show', name }));
      for (const [field, label] of Object.entries(fields)) {
        expect(shown.semantics[field].ui_hints.valueLabels).toEqual({ None: label });
      }
    }
  });

  it('shows all four residency labels while retaining the stored region codes', async () => {
    const shown = JSON.parse(await text('object_registry', { action: 'show', name: 'Organization' }));
    expect(shown.schema.data_residency.validation.enum).toEqual(['us', 'eu', 'apac', 'latam']);
    expect(shown.semantics.data_residency.ui_hints.enumLabels).toEqual({ us: 'US', eu: 'EU', apac: 'APAC', latam: 'LATAM' });
  });

  it('returns the Decision level label on an Approval that composes it', async () => {
    const shown = JSON.parse(await text('object_registry', { action: 'show', name: 'Approval' }));
    expect(shown.semantics.level.ui_hints.enumLabels).toEqual({ sign_off: 'Sign-off' });
  });

});
