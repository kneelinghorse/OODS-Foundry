#!/usr/bin/env node
/** Exercise every advertised read action, refusing any persistent change outside reply payloads. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { McpClient } from '../runtime/e2e.mjs';

export function snapshot(root, payloads) {
  const entries = {};
  const visit = file => {
    if (file === payloads) { assert(!fs.existsSync(file) || !fs.lstatSync(file).isSymbolicLink(), 'payloads must not be a symlink'); return; }
    const stat = fs.lstatSync(file), key = path.relative(root, file);
    entries[key] = stat.isDirectory() ? ['directory', stat.mode] : stat.isSymbolicLink() ? ['link', fs.readlinkSync(file)]
      : ['file', stat.mode, stat.mtimeMs, createHash('sha256').update(fs.readFileSync(file)).digest('hex')];
    if (stat.isDirectory()) for (const child of fs.readdirSync(file).sort()) visit(path.join(file, child));
  };
  visit(root); return entries;
}
export function assertUnchanged(before, after, label) { assert.deepEqual(after, before, `${label} changed persistent state outside reply payloads`); }

export async function checkReadOnly({ runtime, work, out, toolset = 'default' }) {
  assert(!fs.existsSync(work), 'Use a fresh work directory');
  const home = path.join(work, 'home'), project = path.join(work, 'project'), foundry = path.join(home, '.oods-foundry');
  for (const dir of [home, project, foundry, path.join(work, 't'), path.join(foundry, 'objects'), path.join(foundry, 'traits'), path.join(foundry, 'brands')]) fs.mkdirSync(dir, { recursive: true });
  const env = { ...process.env, HOME: home, TMPDIR: path.join(work, 't'), OODS_FOUNDRY_HOME: foundry, MCP_SCHEMA_STORE_ROOT: foundry, MCP_SCHEMA_STORE_DIR: 'schemas', MCP_MAPPINGS_PATH: path.join(foundry, 'mappings.json'), OODS_OBJECTS_DIR: path.join(foundry, 'objects'), OODS_TRAITS_DIR: path.join(foundry, 'traits'), OODS_BRANDS_DIR: path.join(foundry, 'brands'), MCP_HEALTH_PORT: '0', MCP_TOOLSET: toolset, MCP_EXTRA_TOOLS: '' };
  const client = new McpClient({ adapterPath: path.join(runtime, 'packages/mcp-adapter/index.js'), cwd: project, env });
  const receipt = { builderSelfCertified: false, status: 'fail', toolset, calls: [], moved: [] };
  const fixture = name => JSON.parse(fs.readFileSync(new URL(`../../packages/mcp-server/test/fixtures/portable-runtime/s194-${name}.json`, import.meta.url))).arguments;
  const payloads = path.join(foundry, 'payloads');
  try {
    await client.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'read-only-check', version: '1' } }); client.notify('notifications/initialized');
    const { tools } = await client.request('tools/list');
    const readTools = tools.filter(tool => tool.annotations.readOnlyHint);
    // Real write tools prepare persisted data. Everything after this setup is observed per call.
    const composed = await client.callTool('design_compose', { object: 'User', context: 'detail' });
    await client.callTool('schema_store', { action: 'save', name: 'read-check', schemaRef: composed.schemaRef });
    const source = { title: 'ReadCheck', type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } };
    const imported = await client.callTool('object_import', { action: 'draft', source: { content: JSON.stringify(source) } });
    const yaml = fs.readFileSync(path.join(imported.directory, 'objects/ReadCheck.object.yaml'), 'utf8');
    const { stageIntake } = await import(pathToFileURL(path.join(runtime, 'packages/mcp-server/dist/intake/stage.js')));
    const previous = process.env.OODS_FOUNDRY_HOME; process.env.OODS_FOUNDRY_HOME = foundry;
    let componentDraft, brandDraft;
    try {
      componentDraft = stageIntake('components', { source: { project, format: 'shadcn' }, sources: [], proposals: [], warnings: [], counts: {}, contentHash: 'read-check' });
      const tokensFile = path.join(project, 'tokens.json');
      fs.writeFileSync(tokensFile, JSON.stringify({ ink: { $type: 'color', $value: '#123456' } }));
      brandDraft = await client.callTool('brand_create', { action: 'draft', brand_id: 'read-check', source: { path: tokensFile } });
    } finally { if (previous === undefined) delete process.env.OODS_FOUNDRY_HOME; else process.env.OODS_FOUNDRY_HOME = previous; }
    const inputs = {
      health_check: [{}], catalog_list: [{}], structured_data_fetch: [{ dataset: 'components' }], registry_snapshot: [{}],
      viz_render: [fixture('viz-render')], dashboard_render: [fixture('dashboard-render')], artifact_certify: [fixture('artifact-certify')],
      fidelity_preview: [{ fidelityKind: 'boxes-arrows', object: 'User' }],
      object_registry: [{ action: 'list' }, { action: 'show', name: 'User' }, { action: 'validate', yaml }, { action: 'reload' }],
      schema_read: [{ action: 'list' }, { action: 'load', name: 'read-check' }],
      component_map_read: [{ action: 'list' }, { action: 'resolve', externalSystem: 'read-check', externalComponent: 'Button' }, { action: 'show', draftId: componentDraft.draftId }],
      brand_read: [{ action: 'template' }, { action: 'validate', documents: {} }, { action: 'derive', css: ':root { --primary: #000000; }' }, { action: 'show', draftId: brandDraft.draftId }],
      object_import_read: [{ action: 'show', importId: imported.importId, object: 'ReadCheck' }],
      design_versions: [{ action: 'versions', compositionId: composed.compositionId }],
      schema_render: [{ action: 'validate', mode: 'full', schema: composed.schema }, { action: 'render', mode: 'full', schema: composed.schema, apply: true, output: { payloadMode: 'file' } }],
    };
    let chart;
    for (const tool of readTools) {
      const cases = inputs[tool.name]; assert(cases?.length, `No read proof for ${tool.name}`);
      const advertisedActions = tool.inputSchema.properties.action?.enum ?? [];
      assert.deepEqual([...new Set(cases.map(input => input.action).filter(Boolean))].sort(), [...advertisedActions].sort(), `${tool.name} action coverage`);
      for (const input of cases) {
        if (tool.name === 'artifact_certify') input.spec = chart.normalizedSpec;
        const before = snapshot(work, payloads);
        const result = await client.callTool(tool.name, input);
        if (tool.name === 'viz_render') chart = result;
        assertUnchanged(before, snapshot(work, payloads), `${tool.name} ${input.action ?? ''}`);
        if (tool.name === 'brand_read' && input.action === 'template') {
          receipt.brandTemplateCharacters = client.lastResult.content[0].text.length;
          assert(receipt.brandTemplateCharacters < 50000); assert(result.documents && result.slots);
        }
        receipt.calls.push({ tool: tool.name, action: input.action ?? null, unchanged: true });
      }
    }
    const { movedActions } = await import(pathToFileURL(path.join(runtime, 'packages/mcp-server/dist/tools/action-moves.js')));
    const surface = JSON.parse(fs.readFileSync(path.join(runtime, 'packages/mcp-adapter/tool-surface.json')));
    for (const [internal, moves] of Object.entries(movedActions)) for (const [action, replacement] of Object.entries(moves)) {
      const before = snapshot(work, payloads);
      const result = await client.request('tools/call', { name: surface[internal].name, arguments: { action } });
      assert.equal(result.isError, true); assert(result.content[0].text.includes(replacement));
      assertUnchanged(before, snapshot(work, payloads), `moved ${internal} ${action}`);
      receipt.moved.push({ tool: surface[internal].name, action, replacement, unchanged: true });
    }
    receipt.readTools = readTools.length; receipt.status = 'pass';
  } catch (error) { receipt.error = error.stack; throw error; }
  finally { await client.terminate(); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(receipt, null, 2) + '\n'); }
  return receipt;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [runtime, work, out, toolset] = process.argv.slice(2);
  assert(runtime && work && out, 'Pass runtime, fresh work directory, receipt path, optional toolset');
  console.log(await checkReadOnly({ runtime: path.resolve(runtime), work: path.resolve(work), out: path.resolve(out), toolset }));
}
