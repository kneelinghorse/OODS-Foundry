import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkOpenAiPackage, checkTools, fromAdapter } from '../../scripts/release/directory-readiness.mjs';

const adapter = path.join(path.dirname(fileURLToPath(import.meta.url)), 'index.js');
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const hostedTools = ['health_check', 'catalog_list', 'object_registry', 'registry_snapshot', 'structured_data_fetch', 'viz_render', 'artifact_certify', 'design_preview', 'tool_schema'];

// s239 (#2743): Anthropic's directory portal flagged every tool for a missing annotations.title and one parameter for a
// missing type, which nothing here had checked. These rules are the ones the directories, the MCP spec and strict
// clients apply; a release must not advertise a tool that breaks one.
describe('the advertised tools meet the directories\' published rules', () => {
  for (const toolset of ['default', 'all']) {
    it(`passes every error-level rule for the ${toolset} toolset`, async () => {
      const { tools, serverInfo, instructions } = await fromAdapter(adapter, toolset === 'all' ? 'all' : undefined);
      const findings = checkTools(tools, { serverInfo, instructions });
      expect(findings.filter(finding => finding.level === 'error')).toEqual([]);
      expect(typeof instructions).toBe('string');
    }, 180_000);
  }

  // s244-m04 (next step 1844): the hosted OpenAI readiness check (2026-11-02) warned that registry_snapshot's
  // names.items had no description; every property the runtime advertises, nested items included, now explains itself.
  it('leaves no advertised property without a description, nested array items included', async () => {
    const { tools, serverInfo, instructions } = await fromAdapter(adapter, 'all');
    const missing = checkTools(tools, { serverInfo, instructions }).filter(finding => finding.rule === 'property-description');
    expect(missing).toEqual([]);
    const snapshot = tools.find(tool => tool.name === 'registry_snapshot');
    expect(snapshot.inputSchema.properties.names.items.description).toBe('One trait or object name, such as Stateful or Subscription.');
  }, 180_000);

  it('fails a definition with each defect the portal and reviewers found', () => {
    const tool = {
      name: 'broken_tool', title: 'Broken Tool', description: 'Use it first for any chart; the viz.render handler (m05) draws it.',
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: { type: 'object', properties: {
        action: { enum: ['list', 'show'], description: 'Which action.' },
        rows: { type: 'array', description: 'Rows.' },
      } },
    };
    const rules = new Set(checkTools([tool]).filter(finding => finding.level === 'error').map(finding => finding.rule));
    expect([...rules].sort()).toEqual(['annotations-title', 'array-items', 'internal-identifier', 'property-type', 'steering']);
  });
});

// s243: OpenAI's plugin directory (one listing for ChatGPT and Codex) judges the same tools/list by its own hint
// definitions and takes a plugin.json package with its own limits. The endpoint checks need the network and run in the
// sprint's receipts; these prove each rule bites without it.
describe('OpenAI\'s plugin directory rules', () => {
  const tool = (name, annotations, properties = {}) => ({
    name, title: 'A Tool', description: 'Reads one record and returns it.',
    annotations: { title: 'A Tool', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, ...annotations },
    inputSchema: { type: 'object', properties },
  });
  const errorRules = findings => [...new Set(findings.filter(finding => finding.level === 'error').map(finding => finding.rule))].sort();

  it('refuses a write on an endpoint without credentials and an address input that claims a closed world, only when asked', () => {
    const tools = [tool('save_record', { readOnlyHint: false }), tool('read_page', {}, { pageUrl: { type: 'string', description: 'Page to read.' } })];
    expect(errorRules(checkTools(tools, { hosted: true, openai: true }))).toEqual(['openai-open-world', 'openai-unauthenticated-write']);
    expect(errorRules(checkTools(tools, { hosted: true }))).toEqual([]);
    expect(errorRules(checkTools([tool('read_page', { openWorldHint: true }, { pageUrl: { type: 'string', description: 'Page to read.' } })], { openai: true }))).toEqual([]);
  });

  it('finds no local tool that takes an address while claiming a closed world', async () => {
    const { tools } = await fromAdapter(adapter, 'all');
    expect(checkTools(tools, { openai: true }).filter(finding => finding.rule.startsWith('openai-'))).toEqual([]);
  }, 180_000);

  it('passes the committed package, which waits only for its walkthrough video', async () => {
    const findings = await checkOpenAiPackage(path.join(repo, 'submissions/openai/oods-foundry'), { tools: hostedTools, url: 'https://oods-foundry.com/mcp', online: false });
    expect(findings.map(finding => finding.rule)).toEqual(['openai-demo-recording']);
  });

  it('fails a package with each defect the portal rejects', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-openai-package-'));
    try {
      const write = (member, contents) => { fs.mkdirSync(path.dirname(path.join(dir, member)), { recursive: true }); fs.writeFileSync(path.join(dir, member), contents); };
      // A PNG header is enough for the size check: 96 by 48 pixels is not square.
      const wide = Buffer.alloc(33); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(wide); wide.writeUInt32BE(13, 8); wide.write('IHDR', 12); wide.writeUInt32BE(96, 16); wide.writeUInt32BE(48, 20);
      write('assets/wide.png', wide);
      const positive = (tools) => ({ description: 'Reads a record.', prompt: 'Read the record.', tools_triggered: tools, expected_behavior: 'Returns the record.' });
      write('plugin.json', JSON.stringify({
        $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'OODS_Foundry', version: '1.0', description: 'The official design system.',
        extensions: { 'com.openai': {
          interface: { displayName: 'OODS Foundry MCP', shortDescription: 'Reads records', longDescription: 'Reads records.', developerName: 'Someone', category: 'Developer Tools',
            websiteURL: 'https://example.com', supportURL: 'https://example.com/support', privacyPolicyURL: 'http://example.com/privacy', logo: './assets/wide.png' },
          review: { test_cases: { positive: [positive('catalog_list'), positive('catalog_list'), positive('code_generate'), positive('health_check')], negative: [{ description: 'No', prompt: 'Delete it.' }, { description: 'No', prompt: 'Pay.' }, { description: 'No', prompt: 'Send.' }] }, test_credentials: { user: 'x' } },
        } },
      }));
      write('mcp.json', JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json', mcpServers: { a: { type: 'streamable-http', url: 'https://oods-foundry.com/mcp', headers: { Authorization: 'Bearer x' } }, b: { type: 'stdio', command: 'node' } } }));
      write('hooks/hooks.json', '{}');
      write('skills/notes/SKILL.md', '---\nname: notes\n---\nAsk Claude to read the record.\n');
      expect(errorRules(await checkOpenAiPackage(dir, { tools: hostedTools, online: false }))).toEqual(['never-say', 'openai-forbidden', 'openai-icons', 'openai-listing', 'openai-listing-urls', 'openai-manifest', 'openai-mcp-config', 'openai-review-cases', 'openai-skill']);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});
