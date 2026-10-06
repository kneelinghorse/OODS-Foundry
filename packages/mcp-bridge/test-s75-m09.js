import { strict as assert } from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bridgeConfig } from './dist/config.js';
import { resolveBridgeToolSurface } from './dist/tool-surface.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const SERVER_CWD = path.join(PROJECT_ROOT, 'packages', 'mcp-server');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (error) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${error.message}`);
    failed++;
  }
}

console.log('s75-m09 bridge/server tool surface parity\n');

test('default toolset exposes only auto tools', () => {
  const surface = resolveBridgeToolSurface(SERVER_CWD, bridgeConfig.tools.allowed, {
    MCP_TOOLSET: 'default',
    MCP_EXTRA_TOOLS: '',
  });

  assert.equal(surface.toolsetMode, 'default');
  assert.ok(surface.enabled.includes('design.compose'), 'expected auto tool to be enabled');
  assert.ok(!surface.enabled.includes('a11y.scan'), 'on-demand tool should not be enabled by default');
});

test('MCP_TOOLSET=all exposes on-demand tools too', () => {
  const surface = resolveBridgeToolSurface(SERVER_CWD, bridgeConfig.tools.allowed, {
    MCP_TOOLSET: 'all',
    MCP_EXTRA_TOOLS: '',
  });

  assert.equal(surface.toolsetMode, 'all');
  assert.ok(surface.enabled.includes('a11y.scan'), 'a11y.scan should be enabled when toolset=all');
});

test('MCP_EXTRA_TOOLS surfaces explicit extras and unknown extras', () => {
  const surface = resolveBridgeToolSurface(SERVER_CWD, bridgeConfig.tools.allowed, {
    MCP_TOOLSET: 'default',
    MCP_EXTRA_TOOLS: 'a11y.scan,unknown.tool',
  });

  assert.ok(surface.enabled.includes('a11y.scan'), 'explicit on-demand extra should be enabled');
  assert.deepEqual(surface.unknownExtras, ['unknown.tool']);
  assert.match(surface.registrySource, /tools[\\/]+registry\.json$/);
});

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
