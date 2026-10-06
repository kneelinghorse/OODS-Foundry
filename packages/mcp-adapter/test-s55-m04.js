/**
 * s55-m04 contract tests — MCP annotations, error UX, and protocol cleanup
 *
 * Validates all six success criteria:
 * 1. All tools have MCP annotations (readOnlyHint, destructiveHint, openWorldHint)
 * 2. Read-only tools marked readOnlyHint: true, apply-capable marked destructiveHint: true
 * 3. Server spawn failures produce structured MCP error with actionable fix instructions
 * 4. Non-standard structuredContent field removed from tool responses
 * 5. Adapter logs version, tool count, and server path on startup to stderr
 * 6. Annotations derivable from existing policy/registry data — no manual per-tool config
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INDEX_SRC = readFileSync(path.join(__dirname, 'index.js'), 'utf8');
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const POLICY = JSON.parse(readFileSync(
  path.join(PROJECT_ROOT, 'packages', 'mcp-server', 'dist', 'security', 'policy.json'), 'utf8'
));
const REGISTRY = JSON.parse(readFileSync(
  path.join(PROJECT_ROOT, 'packages', 'mcp-server', 'dist', 'tools', 'registry.json'), 'utf8'
));
const ALL_TOOLS = [...REGISTRY.auto, ...REGISTRY.onDemand];
const EXPECTED_TOOL_COUNT = ALL_TOOLS.length;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

// Simulate deriveAnnotations from the adapter
function deriveAnnotations(toolName) {
  const rule = POLICY.rules?.find(r => r.tool === toolName);
  if (!rule) return { openWorldHint: false };
  if (rule.readOnly) return { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
  if (rule.additive) return { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
  return { readOnlyHint: false, destructiveHint: true, openWorldHint: false };
}

console.log('s55-m04 contract tests\n');

// ── Criterion 1: All tools have MCP annotations ─────────────────────

test('deriveAnnotations function exists in adapter', () => {
  assert.ok(INDEX_SRC.includes('deriveAnnotations'), 'Expected deriveAnnotations function');
});

test('Every tool gets annotations with all three hint fields', () => {
  for (const tool of ALL_TOOLS) {
    const ann = deriveAnnotations(tool);
    assert.ok('openWorldHint' in ann, `${tool}: missing openWorldHint`);
    assert.ok(
      'readOnlyHint' in ann || 'destructiveHint' in ann,
      `${tool}: must have readOnlyHint or destructiveHint`
    );
  }
});

test('Annotations object included in list_tools response', () => {
  assert.ok(
    INDEX_SRC.includes('annotations: t.annotations'),
    'Expected annotations field in tools/list response'
  );
});

// ── Criterion 2: Correct classification of read-only vs destructive ──

const READ_ONLY_TOOLS = ['catalog.list', 'structuredData.fetch', 'health', 'registry.snapshot',
  'viz.render', 'dashboard.render', 'artifact.certify', 'fidelity.preview'];
// s213-m02: these record a composition version or write a file payload, so a client must not be told they are
// read-only; they only add new files to their own stores, so they are not destructive either.
const ADDITIVE_TOOLS = ['design.compose', 'design.preview', 'code.generate'];
// s213-m03: object's register writes a team's definition into its own folder and, with overwrite: true, replaces one of
// the team's files, so it is a writer that is not only additive.
// s213-m05: brand.intake's create writes a brand into the brands folder and runs the token build, which rewrites the
// token package's dist, so it is a writer too.
const WRITE_TOOLS = ['tokens.build', 'brand.apply', 'repl',
  'a11y.scan', 'map', 'schema', 'pipeline', 'object', 'brand.intake'];

test('Read-only tools have readOnlyHint: true', () => {
  for (const tool of READ_ONLY_TOOLS) {
    const ann = deriveAnnotations(tool);
    assert.equal(ann.readOnlyHint, true, `${tool} should be readOnlyHint: true`);
    assert.equal(ann.destructiveHint, false, `${tool} should be destructiveHint: false`);
  }
});

test('Tools that only add files to their own stores are neither read-only nor destructive', () => {
  for (const tool of ADDITIVE_TOOLS) {
    const ann = deriveAnnotations(tool);
    assert.equal(ann.readOnlyHint, false, `${tool} writes, so it must not claim readOnlyHint`);
    assert.equal(ann.destructiveHint, false, `${tool} only adds files`);
  }
  assert.ok(INDEX_SRC.includes('if (rule.additive)'), 'the adapter derives the additive annotation from the server policy');
});

test('Write-capable tools have destructiveHint: true', () => {
  for (const tool of WRITE_TOOLS) {
    const ann = deriveAnnotations(tool);
    assert.equal(ann.destructiveHint, true, `${tool} should be destructiveHint: true`);
    assert.equal(ann.readOnlyHint, false, `${tool} should be readOnlyHint: false`);
  }
});

test('All tools have openWorldHint: false (local operations only)', () => {
  for (const tool of ALL_TOOLS) {
    const ann = deriveAnnotations(tool);
    assert.equal(ann.openWorldHint, false, `${tool} should be openWorldHint: false`);
  }
});

test('Classification covers all registry tools', () => {
  const classified = new Set([...READ_ONLY_TOOLS, ...ADDITIVE_TOOLS, ...WRITE_TOOLS]);
  assert.equal(classified.size, EXPECTED_TOOL_COUNT, `Expected ${EXPECTED_TOOL_COUNT} classified tools, got ${classified.size}`);
  for (const tool of ALL_TOOLS) {
    assert.ok(classified.has(tool), `${tool} not classified in either read-only or write lists`);
  }
});

// ── Criterion 3: Structured error for spawn failures ─────────────────

test('Adapter detects spawn/build errors and adds fix guidance', () => {
  assert.ok(
    INDEX_SRC.includes('isSpawnError'),
    'Expected spawn error detection logic'
  );
  assert.ok(
    INDEX_SRC.includes('pnpm --filter @oods/mcp-server run build'),
    'Expected actionable build command in error guidance'
  );
});

test('Error guidance only appended for server-related failures', () => {
  // Verify the conditional: only spawn/build errors get guidance
  assert.ok(
    INDEX_SRC.includes("message.includes('not built')") ||
    INDEX_SRC.includes("'not built'"),
    'Expected check for "not built" error pattern'
  );
  assert.ok(
    INDEX_SRC.includes("message.includes('server exited')") ||
    INDEX_SRC.includes("'server exited'"),
    'Expected check for "server exited" error pattern'
  );
});

// ── Criterion 4: structuredContent only on design_preview (s202-m02) ───────────────────────────

// Sprint 55 removed structuredContent from every tool response. Sprint 202 (MCP Apps) returns it beside the unchanged text
// for design_preview only, for the preview app inside the conversation; no other tool carries it.
test('structuredContent only on design_preview results', () => {
  const uses = INDEX_SRC.split('\n').map(line => line.trim()).filter(line => line.includes('structuredContent'));
  assert.deepEqual(uses, [
    '// design_preview carries its result as structuredContent too (for the app, never for the model); the text is unchanged.',
    '...(structured ? { structuredContent: structured } : {}),',
  ], 'structuredContent appears only in the design_preview result branch');
  assert.match(INDEX_SRC, /const structured = internalName === 'design\.preview' && /, 'structuredContent is built only for design.preview');
});

// ── Criterion 5: Startup logging with version, tool count, server path

test('Startup log includes adapter version', () => {
  assert.ok(
    INDEX_SRC.includes('ADAPTER_VERSION') || INDEX_SRC.includes("version: '"),
    'Expected version in startup log'
  );
});

test('ADAPTER_VERSION is derived from the adjacent package.json', () => {
  assert.ok(
    INDEX_SRC.includes("new URL('./package.json', import.meta.url)"),
    'Expected an ESM-safe adjacent package.json URL'
  );
  assert.match(
    INDEX_SRC,
    /const ADAPTER_VERSION = JSON\.parse\([\s\S]*?readFileSync\([\s\S]*?package\.json[\s\S]*?\)\.version;/,
    'Expected ADAPTER_VERSION to be read from package.json'
  );
  assert.doesNotMatch(
    INDEX_SRC,
    /const ADAPTER_VERSION\s*=\s*['"][^'"]+['"];/,
    'ADAPTER_VERSION must not duplicate the package.json version literal'
  );
});

test('Startup log includes server path (NATIVE_DIST)', () => {
  assert.ok(
    INDEX_SRC.includes('NATIVE_DIST') && INDEX_SRC.includes('console.error'),
    'Expected server path in startup stderr log'
  );
});

test('Startup log includes tool count', () => {
  // Already verified by s55-m02, but confirm it still exists
  assert.ok(
    INDEX_SRC.includes('enabled.length') && INDEX_SRC.includes('console.error'),
    'Expected tool count in startup log'
  );
});

// ── Criterion 6: Annotations derived from policy, not manual config ──

test('Adapter loads policy.json from server dist', () => {
  assert.ok(INDEX_SRC.includes('POLICY_PATH'), 'Expected POLICY_PATH reference');
  assert.ok(INDEX_SRC.includes('policy.json'), 'Expected policy.json reference');
});

test('No per-tool annotation hardcoding in adapter', () => {
  // Check that no tool-specific annotation objects are hardcoded
  const annotationHardcodes = INDEX_SRC.match(/readOnlyHint:\s*(true|false).*tokens\.build/);
  assert.ok(!annotationHardcodes, 'Annotations should be derived from policy, not hardcoded per tool');
});

test('deriveAnnotations reads from policy rules', () => {
  assert.ok(
    INDEX_SRC.includes('policy.rules') || INDEX_SRC.includes('rule.readOnly'),
    'Expected policy rules inspection in deriveAnnotations'
  );
});

// ── Summary ──────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
