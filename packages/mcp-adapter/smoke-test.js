/**
 * Stdio adapter smoke test
 *
 * Spawns the adapter as a child process and sends a MCP list_tools request
 * via stdin/stdout JSON-RPC. Verifies all registry tools are returned with
 * descriptions, typed input schemas, and annotations.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADAPTER_ENTRY = path.join(__dirname, 'index.js');
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const SERVER_CANDIDATES = [
  path.join(PROJECT_ROOT, 'packages', 'mcp-server'),
  path.join(__dirname, '..', 'mcp-server'),
];
const TIMEOUT_MS = 15000;

function resolveRegistryPath() {
  for (const candidate of SERVER_CANDIDATES) {
    const registryPath = path.join(candidate, 'dist', 'tools', 'registry.json');
    if (fs.existsSync(registryPath)) {
      return registryPath;
    }
  }
  return path.join(SERVER_CANDIDATES[0], 'dist', 'tools', 'registry.json');
}

const REGISTRY_PATH = resolveRegistryPath();

function jsonRpcRequest(method, params = {}, id = 1) {
  return JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
}

async function runSmoke() {
  console.log('Stdio adapter smoke test\n');
  console.log(`Spawning: node ${ADAPTER_ENTRY}`);

  const child = spawn(process.execPath, [ADAPTER_ENTRY], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, MCP_TOOLSET: 'all' },
  });

  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', d => { stdout += d; });
  child.stderr.on('data', d => { stderr += d; });

  // Wait for the adapter to start (it logs to stderr on ready)
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Adapter startup timeout')), TIMEOUT_MS);
    child.stderr.on('data', () => {
      if (stderr.includes('[oods-mcp-adapter]')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`Adapter exited with code ${code}\nstderr: ${stderr}`));
    });
  });

  console.log(`Adapter started: ${stderr.trim()}\n`);

  // Send MCP initialize request
  child.stdin.write(jsonRpcRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'smoke-test', version: '1.0.0' },
  }, 1));

  // Wait for initialize response
  await waitForResponse(child, stdout, 1);
  stdout = '';

  // Send initialized notification
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  // Small delay for notification processing
  await new Promise(r => setTimeout(r, 200));

  // Send list_tools request
  child.stdin.write(jsonRpcRequest('tools/list', {}, 2));

  const listResult = await waitForResponse(child, stdout, 2, () => stdout);

  child.kill();

  // Parse the response
  const lines = listResult.split('\n').filter(Boolean);
  let response;
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.id === 2) {
        response = parsed;
        break;
      }
    } catch { continue; }
  }

  if (!response || !response.result) {
    console.error('FAIL: No valid list_tools response received');
    console.error('Raw stdout:', listResult);
    process.exit(1);
  }

  const tools = response.result.tools;
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const expectedToolCount = (registry.auto?.length ?? 0) + (registry.onDemand?.length ?? 0);
  console.log(`Received ${tools.length} tools from list_tools\n`);

  let passed = 0;
  let failed = 0;

  function check(name, condition, detail) {
    if (condition) {
      console.log(`  PASS  ${name}`);
      passed++;
    } else {
      console.error(`  FAIL  ${name}`);
      if (detail) console.error(`        ${detail}`);
      failed++;
    }
  }

  check(
    'Returns all registry tools with MCP_TOOLSET=all',
    tools.length === expectedToolCount,
    `Expected ${expectedToolCount}, got ${tools.length}`,
  );

  check('Startup identifies the runtime without exposing its directory', /runtime: v[^ |]+ (?:[a-f0-9]{12}|unbundled)/.test(stderr) && !stderr.includes(PROJECT_ROOT) && !stderr.includes('server: /'), stderr);

  // Check each tool has required fields
  const missingDesc = tools.filter(t => !t.description || t.description.includes('Proxy to'));
  check('All tools have human-readable descriptions', missingDesc.length === 0,
    missingDesc.map(t => t.name).join(', '));

  const missingSchema = tools.filter(t => !t.inputSchema || !t.inputSchema.type);
  check('All tools have typed input schemas', missingSchema.length === 0,
    missingSchema.map(t => t.name).join(', '));

  const missingAnnotations = tools.filter(t => !t.annotations);
  check('All tools have annotations', missingAnnotations.length === 0,
    missingAnnotations.map(t => t.name).join(', '));

  // Check specific tools have real parameters
  const sdFetch = tools.find(t => t.name === 'structuredData_fetch');
  check('structuredData_fetch has "dataset" parameter',
    sdFetch?.inputSchema?.properties?.dataset?.type === 'string',
    JSON.stringify(sdFetch?.inputSchema?.properties?.dataset));

  const tokensBuild = tools.find(t => t.name === 'tokens_build');
  check('tokens_build has "brand" parameter',
    tokensBuild?.inputSchema?.properties?.brand?.type === 'string',
    JSON.stringify(tokensBuild?.inputSchema?.properties?.brand));

  // Check annotations correctness
  const catalogList = tools.find(t => t.name === 'catalog_list');
  check('catalog_list has readOnlyHint: true',
    catalogList?.annotations?.readOnlyHint === true);

  const brandApply = tools.find(t => t.name === 'brand_apply');
  check('brand_apply has destructiveHint: true',
    brandApply?.annotations?.destructiveHint === true);

  // Check tool name format
  const badNames = tools.filter(t => t.name.includes('.'));
  check('All tool names use underscores (MCP-compliant)', badNames.length === 0,
    badNames.map(t => t.name).join(', '));

  console.log(`\n${passed + failed} checks: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

function waitForResponse(child, initialStdout, expectedId, getStdout) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Response timeout')), TIMEOUT_MS);
    let accumulated = initialStdout;

    const handler = (chunk) => {
      accumulated += chunk;
      const lines = accumulated.split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.id === expectedId) {
            clearTimeout(timer);
            child.stdout.removeListener('data', handler);
            resolve(accumulated);
            return;
          }
        } catch { continue; }
      }
    };

    // Check existing data first
    handler('');
    child.stdout.on('data', handler);
    child.on('exit', () => {
      clearTimeout(timer);
      resolve(accumulated);
    });
  });
}

runSmoke().catch(err => {
  console.error('Smoke test error:', err.message);
  process.exit(1);
});
