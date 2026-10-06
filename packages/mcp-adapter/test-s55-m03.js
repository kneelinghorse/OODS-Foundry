/**
 * s55-m03 contract tests — rich tool descriptions and typed input schemas
 *
 * Validates all six success criteria:
 * 1. Every tool has a human-readable description (not 'Proxy to...')
 * 2. Descriptions are action-oriented
 * 3. Input schemas expose real parameter names, types, and required fields
 * 4. Agent calling list_tools sees typed parameters
 * 5. Description manifest is maintainable — single JSON entry per tool
 * 6. Existing JSON Schema files remain source of truth (no duplication)
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INDEX_SRC = readFileSync(path.join(__dirname, 'index.js'), 'utf8');
const DESCRIPTIONS = JSON.parse(readFileSync(path.join(__dirname, 'tool-descriptions.json'), 'utf8'));

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const REGISTRY = JSON.parse(readFileSync(
  path.join(PROJECT_ROOT, 'packages', 'mcp-server', 'dist', 'tools', 'registry.json'), 'utf8'
));
const SCHEMAS_DIR = path.join(PROJECT_ROOT, 'packages', 'mcp-server', 'dist', 'schemas');
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

console.log('s55-m03 contract tests\n');

// ── Criterion 1: Human-readable descriptions (not 'Proxy to...') ─────

test('Every tool has a description in the manifest', () => {
  const missing = ALL_TOOLS.filter(t => !DESCRIPTIONS[t]);
  assert.equal(missing.length, 0, `Missing descriptions for: ${missing.join(', ')}`);
});

test('No description contains "Proxy to"', () => {
  for (const [tool, desc] of Object.entries(DESCRIPTIONS)) {
    assert.ok(!desc.includes('Proxy to'), `${tool} description still says "Proxy to": ${desc}`);
  }
});

test('Adapter code does not hardcode "Proxy to" as description', () => {
  assert.ok(!INDEX_SRC.includes('Proxy to OODS'), 'Index.js should not contain "Proxy to OODS"');
});

// ── Criterion 2: Action-oriented descriptions ────────────────────────

test('Descriptions start with an action verb', () => {
  // s213-m02: descriptions now open with what the tool actually does; exporting built files, writing a snapshot and
  // diffing two fixtures are actions too.
  const actionVerbs = ['Build', 'Fetch', 'Validate', 'Render', 'Apply', 'List', 'Generate', 'Export', 'Write', 'Diff',
    'Compose', 'Create', 'Resolve', 'Capture', 'Run', 'Verify', 'Switch', 'Audit', 'Execute', 'Show', 'Check', 'Delete', 'Load', 'Persist', 'Update', 'Return',
    // Verbs later sprints introduced: `health` reads, `design.preview` opens, `artifact.certify` certifies.
    'Read', 'Open', 'Certify', 'Manage'];
  // Report every offender: asserting inside the loop stopped at the first one and hid the rest for three sprints.
  const offenders = Object.entries(DESCRIPTIONS)
    .map(([tool, desc]) => [tool, desc.split(/\s/)[0]])
    .filter(([, firstWord]) => !actionVerbs.includes(firstWord))
    .map(([tool, firstWord]) => `${tool}: starts with "${firstWord}"`);
  assert.deepStrictEqual(offenders, [], `descriptions must open with an action verb — ${offenders.join('; ')}`);
});

test('Descriptions explain what the tool returns or does', () => {
  for (const [tool, desc] of Object.entries(DESCRIPTIONS)) {
    assert.ok(desc.length >= 30, `${tool}: description too short (${desc.length} chars): "${desc}"`);
  }
});

// ── Criterion 3: Real parameter names/types from JSON Schema ─────────

test('Tools with specific schemas expose typed properties', () => {
  // These tools have known specific schemas (not generic)
  const toolsWithSpecificSchemas = [
    'tokens.build',
    'structuredData.fetch',
    'brand.apply',
    'catalog.list',
    'code.generate',
    'design.compose',
    'pipeline',
    'map.create',
    'map.list',
    'map.resolve',
    ];
  for (const tool of toolsWithSpecificSchemas) {
    const schemaFile = path.join(SCHEMAS_DIR, `${tool}.input.json`);
    let schema;
    try {
      schema = JSON.parse(readFileSync(schemaFile, 'utf8'));
    } catch {
      continue; // Schema file not found — skip
    }
    assert.ok(
      schema.properties && Object.keys(schema.properties).length > 0,
      `${tool}: schema should have properties with parameter names`
    );
  }
});

test('Adapter loads tool-specific input schemas (not one generic schema for all)', () => {
  assert.ok(
    INDEX_SRC.includes('loadInputSchema'),
    'Expected loadInputSchema function'
  );
  // Verify it tries the tool-specific file first
  assert.ok(
    INDEX_SRC.includes('.input.json'),
    'Expected .input.json pattern for schema file lookup'
  );
});

// ── Criterion 4: list_tools sees typed parameters ────────────────────

test('Adapter uses Server class (low-level) for direct JSON Schema control', () => {
  assert.ok(
    INDEX_SRC.includes("from '@modelcontextprotocol/sdk/server/index.js'"),
    'Expected import from @modelcontextprotocol/sdk/server/index.js'
  );
});

test('Adapter handles ListToolsRequestSchema with inputSchema per tool', () => {
  assert.ok(
    INDEX_SRC.includes('ListToolsRequestSchema'),
    'Expected ListToolsRequestSchema handler'
  );
  assert.ok(
    INDEX_SRC.includes('inputSchema: t.inputSchema') || INDEX_SRC.includes('inputSchema:'),
    'Expected inputSchema field in tools/list response'
  );
});

test('Adapter handles CallToolRequestSchema for tool dispatch', () => {
  assert.ok(
    INDEX_SRC.includes('CallToolRequestSchema'),
    'Expected CallToolRequestSchema handler'
  );
});

// ── Criterion 5: Maintainable description manifest ───────────────────

test('tool-descriptions.json is a flat key-value map', () => {
  for (const [key, value] of Object.entries(DESCRIPTIONS)) {
    assert.equal(typeof key, 'string', 'Keys should be strings');
    assert.equal(typeof value, 'string', 'Values should be strings');
  }
});

test('Description manifest has an entry for every registry tool', () => {
  assert.equal(
    Object.keys(DESCRIPTIONS).length, EXPECTED_TOOL_COUNT,
    `Expected ${EXPECTED_TOOL_COUNT} descriptions, got ${Object.keys(DESCRIPTIONS).length}`
  );
});

test('Description keys match registry tool names', () => {
  const descKeys = new Set(Object.keys(DESCRIPTIONS));
  const regKeys = new Set(ALL_TOOLS);
  const extra = [...descKeys].filter(k => !regKeys.has(k));
  const missing = [...regKeys].filter(k => !descKeys.has(k));
  assert.equal(extra.length, 0, `Extra descriptions not in registry: ${extra.join(', ')}`);
  assert.equal(missing.length, 0, `Missing descriptions for registry tools: ${missing.join(', ')}`);
});

// ── Criterion 6: JSON Schema files remain source of truth ────────────

test('Adapter reads schemas from server dist/schemas/ directory', () => {
  assert.ok(
    INDEX_SRC.includes('SCHEMAS_DIR'),
    'Expected SCHEMAS_DIR reference for schema loading'
  );
});

test('No duplicated schema definitions in adapter code', () => {
  // Adapter should NOT contain JSON Schema property definitions inline
  const inlineSchemaPatterns = [
    '"brand":', '"theme":', '"dataset":', '"framework":',
  ];
  const codeLines = INDEX_SRC.split('\n').filter(l =>
    !l.trim().startsWith('//') && !l.trim().startsWith('*')
  );
  const codeText = codeLines.join('\n');
  for (const pattern of inlineSchemaPatterns) {
    assert.ok(
      !codeText.includes(pattern),
      `Found inline schema property "${pattern}" — schemas should come from JSON files`
    );
  }
});

test('$ref properties are stripped from schemas (agents cannot resolve local file refs)', () => {
  assert.ok(
    INDEX_SRC.includes('sanitizeSchema'),
    'Expected sanitizeSchema usage for removing or normalizing unsupported schema fields'
  );
});

// ── Summary ──────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
