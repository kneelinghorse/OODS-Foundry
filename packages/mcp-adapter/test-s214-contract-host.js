import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { McpClient } from '../../scripts/runtime/e2e.mjs';
const root = path.resolve(import.meta.dirname, '../..');
test('stdio codegen supplies the contract host even before the first preview, without requiring a browser', async () => {
  const work = fs.mkdtempSync(path.join(root, '.tmp/s214-adapter-'));
  const client = new McpClient({ adapterPath: path.join(root, 'packages/mcp-adapter/index.js'), cwd: work,
    env: { ...process.env, MCP_MAPPINGS_PATH: path.join(work, 'mappings.json'), MCP_SCHEMA_STORE_ROOT: work, MCP_SCHEMA_STORE_DIR: 'schemas',
      OODS_OBJECTS_DIR: path.join(work,'objects'), OODS_TRAITS_DIR: path.join(work,'traits'), OODS_BRANDS_DIR: path.join(work,'brands'),
      OODS_CONTRACT_BROWSER_EXECUTABLE: path.join(work,'deliberately-absent-chromium'), OODS_PLAYWRIGHT_WS_ENDPOINT: '' } });
  try {
    await client.request('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'contract-host-regression',version:'1'}});
    client.notify('notifications/initialized');
    const mapping = JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/team-components/mappings.json'),'utf8'))[0];
    mapping.substitution.react.localPath = path.join(root,'tests/fixtures/team-components');
    assert.equal((await client.callTool('component_map',{action:'create',...mapping})).status,'ok');
    const composed = await client.callTool('design_compose',{object:'Subscription',context:'detail'});
    assert.equal(composed.status,'ok');
    const generated = await client.callTool('code_generate',{schema:composed.schema,framework:'react'});
    assert.equal(generated.status,'ok','unavailable Chromium is advisory');
    const report = generated.componentContracts.find(report=>report.component==='Button');
    assert.match(report.source.packageContentHash??'',/^sha256:/,'the actual preview host inspected package bytes');
    assert(report.obligations.some(row=>row.reason.includes('deliberately-absent-chromium')),'the browser was tried, not silently skipped for a missing host');
    assert.equal(report.summary.met,0); assert(report.summary["not-checked"]>0);
  } finally { await client.closeStdinAndObserve(); fs.rmSync(work,{recursive:true,force:true}); }
});
