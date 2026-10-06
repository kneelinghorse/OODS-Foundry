/**
 * Opus 4.6 findings reproduction harness (stdio adapter).
 *
 * Runs a small set of MCP tool calls through the adapter and prints
 * compact observations (sizes, key fields, and snippets) so the
 * reproduction report can cite concrete outputs.
 */

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADAPTER_ENTRY = path.join(__dirname, 'index.js');
const FIXTURE_DIR = path.resolve(__dirname, '..', 'mcp-server', 'test', 'fixtures', 'ui');
const BASIC_SCHEMA = JSON.parse(readFileSync(path.join(FIXTURE_DIR, 'basic-mix.ui-schema.json'), 'utf8'));
const WORKBENCH_SCHEMA = JSON.parse(readFileSync(path.join(FIXTURE_DIR, 'workbench-s44.ui-schema.json'), 'utf8'));

const TIMEOUT_MS = 20000;

function jsonRpcRequest(method, params = {}, id = 1) {
  return JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
}

function startAdapter() {
  const child = spawn(process.execPath, [ADAPTER_ENTRY], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, MCP_TOOLSET: 'all' },
  });
  return child;
}

async function waitForAdapterReady(child) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    const timer = setTimeout(() => reject(new Error('Adapter startup timeout')), TIMEOUT_MS);
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (stderr.includes('[oods-mcp-adapter]')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Adapter exited with code ${code}`));
    });
  });
}

function createClient(child) {
  let seq = 0;
  let buffer = '';
  const pending = new Map();

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      let parsed;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      if (parsed.id == null) continue;
      const handler = pending.get(parsed.id);
      if (!handler) continue;
      pending.delete(parsed.id);
      if (parsed.error) handler.reject(parsed.error);
      else handler.resolve(parsed.result);
    }
  });

  const request = (method, params) => {
    const id = ++seq;
    const payload = jsonRpcRequest(method, params, id);
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      child.stdin.write(payload, 'utf8');
    });
  };

  const callTool = async (name, args) => {
    const result = await request('tools/call', { name, arguments: args ?? {} });
    const text = result?.content?.[0]?.text ?? '';
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    return { result, text, parsed };
  };

  return { request, callTool };
}

function summarizeText(text, max = 240) {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

async function run() {
  console.log('Opus 4.6 reproduction harness (stdio adapter)\n');

  const child = startAdapter();
  await waitForAdapterReady(child);

  const client = createClient(child);

  await client.request('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'opus-4.6-repro', version: '1.0.0' },
  });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  // ── catalog.list unfiltered size ──────────────────────────────────
  const catalogAll = await client.callTool('catalog_list', {});
  const catalogText = catalogAll.text;
  const catalogSize = catalogText.length;
  let catalogComponentCount = null;
  if (catalogAll.parsed && typeof catalogAll.parsed === 'object') {
    const list = catalogAll.parsed.components || catalogAll.parsed.items || catalogAll.parsed.tools;
    if (Array.isArray(list)) catalogComponentCount = list.length;
  }
  console.log('CASE: catalog.list (unfiltered)');
  console.log(`  response chars: ${catalogSize}`);
  if (catalogComponentCount != null) console.log(`  component count: ${catalogComponentCount}`);
  console.log(`  snippet: ${summarizeText(catalogText, 220)}\n`);

  // ── catalog.list trait filter (Searchable) ────────────────────────
  const catalogTrait = await client.callTool('catalog_list', { trait: 'Searchable' });
  const traitParsed = catalogTrait.parsed;
  let traitCount = null;
  if (traitParsed && typeof traitParsed === 'object') {
    const list = traitParsed.components || traitParsed.items || traitParsed.tools;
    if (Array.isArray(list)) traitCount = list.length;
  }
  console.log('CASE: catalog.list (trait=Searchable)');
  console.log(`  response chars: ${catalogTrait.text.length}`);
  if (traitCount != null) console.log(`  component count: ${traitCount}`);
  console.log(`  snippet: ${summarizeText(catalogTrait.text, 200)}\n`);

  // ── design.compose with tabs ──────────────────────────────────────
  const composeInput = {
    intent: 'User account detail page with profile info, billing status, activity timeline, and settings in a tabbed layout.',
    layout: 'detail',
    preferences: { tabCount: 4, tabLabels: ['Overview', 'Billing', 'Activity', 'Settings'] },
    options: { topN: 1 },
  };
  const compose = await client.callTool('design_compose', composeInput);
  let tabBodyComponents = [];
  let tabSummaries = [];
  let componentCounts = {};
  if (compose.parsed && typeof compose.parsed === 'object') {
    const schema = compose.parsed.schema;
    const screens = Array.isArray(schema?.screens) ? schema.screens : [];
    const allNodes = [];
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      allNodes.push(node);
      if (node.component) {
        componentCounts[node.component] = (componentCounts[node.component] || 0) + 1;
      }
      const kids = Array.isArray(node.children) ? node.children : [];
      for (const child of kids) walk(child);
    };
    for (const screen of screens) walk(screen);
    const tabNodes = allNodes.filter(n => n.component === 'Tabs' || n.component === 'TabGroup');
    for (const tabNode of tabNodes) {
      const tabs = Array.isArray(tabNode.props?.tabs) ? tabNode.props.tabs : [];
      for (const tab of tabs) {
        tabSummaries.push({
          id: tab?.id ?? null,
          label: tab?.label ?? null,
          contentType: typeof tab?.content,
          contentComponent: tab?.content?.component ?? null,
        });
        if (typeof tab?.content === 'string') continue;
        if (tab?.content && typeof tab.content === 'object') {
          const comp = tab.content.component;
          if (comp) tabBodyComponents.push(comp);
        }
      }
    }
  }
  console.log('CASE: design.compose (tabbed detail)');
  console.log(`  response chars: ${compose.text.length}`);
  const comps = Object.entries(componentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => `${name}:${count}`);
  if (comps.length) console.log(`  top components: ${comps.join(', ')}`);
  if (tabBodyComponents.length) {
    const unique = [...new Set(tabBodyComponents)];
    console.log(`  tab body components: ${tabBodyComponents.join(', ')}`);
    console.log(`  unique components: ${unique.join(', ')}`);
  } else if (tabSummaries.length) {
    console.log(`  tab summaries: ${JSON.stringify(tabSummaries)}`);
  } else if (Object.keys(componentCounts).includes('Tabs')) {
    const schema = compose.parsed?.schema;
    const tabsNode = (() => {
      const screens = Array.isArray(schema?.screens) ? schema.screens : [];
      const stack = [...screens];
      while (stack.length) {
        const node = stack.pop();
        if (node?.component === 'Tabs') return node;
        const kids = Array.isArray(node?.children) ? node.children : [];
        for (const child of kids) stack.push(child);
      }
      return null;
    })();
    if (tabsNode) {
      const nodeSnippet = JSON.stringify(tabsNode).slice(0, 320);
      console.log(`  tabs node snippet: ${nodeSnippet}${JSON.stringify(tabsNode).length > 320 ? '…' : ''}`);
    } else {
      console.log('  tab body components: (Tabs present, node not found)');
    }
  } else {
    console.log('  tab body components: (not detected in output)');
  }
  console.log(`  snippet: ${summarizeText(compose.text, 220)}\n`);

  // ── repl.validate patch mode ──────────────────────────────────────
  const patchInput = {
    mode: 'patch',
    baseTree: BASIC_SCHEMA,
    patch: [{ nodeId: 'basic-text', path: 'component', value: 'ArchiveEvent' }],
  };
  const validatePatch = await client.callTool('repl_validate', patchInput);
  console.log('CASE: repl.validate (patch mode)');
  console.log(`  response chars: ${validatePatch.text.length}`);
  console.log(`  snippet: ${summarizeText(validatePatch.text, 220)}\n`);

  // ── repl.validate schemaRef (expected to fail until schemaRef added) ─
  const validateRef = await client.callTool('repl_validate', { mode: 'full', schemaRef: 'compose-abc123' });
  console.log('CASE: repl.validate (schemaRef)');
  console.log(`  response chars: ${validateRef.text.length}`);
  console.log(`  snippet: ${summarizeText(validateRef.text, 220)}\n`);

  // ── repl.render document mode (apply false) ───────────────────────
  const renderInput = { mode: 'full', schema: BASIC_SCHEMA, output: { format: 'document' } };
  const renderDoc = await client.callTool('repl_render', renderInput);
  console.log('CASE: repl.render (document mode, apply default)');
  console.log(`  response chars: ${renderDoc.text.length}`);
  console.log(`  has html: ${renderDoc.text.includes('\"html\"')}`);
  console.log(`  snippet: ${summarizeText(renderDoc.text, 220)}\n`);

  // ── repl.render document mode with apply true ─────────────────────
  const renderApply = await client.callTool('repl_render', { ...renderInput, apply: true });
  console.log('CASE: repl.render (document mode, apply=true)');
  console.log(`  response chars: ${renderApply.text.length}`);
  console.log(`  has html: ${renderApply.text.includes('\"html\"')}`);
  console.log(`  snippet: ${summarizeText(renderApply.text, 220)}\n`);

  // ── code.generate React inline styles ─────────────────────────────
  const codegen = await client.callTool('code_generate', {
    schema: BASIC_SCHEMA,
    framework: 'react',
    options: { styling: 'inline', typescript: true },
  });
  const hasTriple = codegen.text.includes('style={{{');
  console.log('CASE: code.generate (react, inline styles)');
  console.log(`  response chars: ${codegen.text.length}`);
  console.log(`  contains style={{{ : ${hasTriple}`);
  console.log(`  snippet: ${summarizeText(codegen.text, 220)}\n`);

  // ── brand.apply preview verbosity ─────────────────────────────────
  const brandPreview = await client.callTool('brand_apply', {
    brand: 'A',
    strategy: 'alias',
    apply: false,
    delta: { typography: { body: { fontSize: 15 } } },
  });
  console.log('CASE: brand.apply (preview)');
  console.log(`  response chars: ${brandPreview.text.length}`);
  console.log(`  snippet: ${summarizeText(brandPreview.text, 220)}\n`);

  // ── tokens.build preview ──────────────────────────────────────────
  const tokensPreview = await client.callTool('tokens_build', { theme: 'dark', apply: false });
  console.log('CASE: tokens.build (preview)');
  console.log(`  response chars: ${tokensPreview.text.length}`);
  console.log(`  snippet: ${summarizeText(tokensPreview.text, 220)}\n`);

  child.kill();
}

run().catch((err) => {
  console.error('Repro harness error:', err);
  process.exit(1);
});
