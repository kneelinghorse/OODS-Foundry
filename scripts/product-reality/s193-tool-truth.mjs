#!/usr/bin/env node
import assert from 'node:assert/strict';
import { copyRetainedToolLedger, readRetainedProofs } from '../runtime/retained-proofs.mjs';
import { advertisedName } from '../runtime/tool-names.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ts = require('typescript');
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const LEDGER_PATH = 'packages/mcp-server/registry/tool-capability-ledger.v1.json';
export const PORTABLE_RECEIPT_PATH = 'artifacts/product-reality/sprint-196/m02/e2e-host.json';
/** One retained extracted-runtime receipt per mode; s200 ships the brand source, so only design.preview stays typed. */
export const PORTABLE_RECEIPT_PATHS = { s196: PORTABLE_RECEIPT_PATH, s200: 'artifacts/product-reality/sprint-200/m04/e2e-host.json', s201: 'artifacts/product-reality/sprint-201/m07/pre-freeze/e2e-host.json', s202: 'artifacts/product-reality/sprint-202/m06/pre-freeze/e2e-host.json', s203: 'artifacts/product-reality/sprint-203/m06/pre-freeze/e2e-host.json', s204: 'artifacts/product-reality/sprint-204/m06/pre-freeze/e2e-host.json', s205: 'artifacts/product-reality/sprint-205/m06/pre-freeze/e2e-host.json', s206: 'artifacts/product-reality/sprint-206/m05/pre-freeze/e2e-host.json', s207: 'artifacts/product-reality/sprint-207/m04/pre-freeze/e2e-host.json', s211: 'artifacts/product-reality/sprint-211/m03/pre-freeze/e2e-host.json', s212: 'artifacts/product-reality/sprint-212/m06/pre-freeze/e2e-host.json', s213: 'artifacts/product-reality/sprint-213/m01/pre-freeze/e2e-host.json' };
/** s201 ships the preview host, so no advertised tool stays typed from the bundle; s202 keeps that and adds the MCP Apps resources to the same E2E; s203 keeps both and the archive now carries 23 objects; s204 keeps all of it and health's trait count is live (47); s205 keeps all of it with 26 objects and 49 traits; s206 binds the hardened archive with the same counts; s211 binds the controlled package's archive at m03's freeze. */
export const PORTABLE_TYPED_CODES = { s196: { 'brand.apply': 'OODS-N020', 'design.preview': 'OODS-N019' }, s200: { 'design.preview': 'OODS-N019' }, s201: {}, s202: {}, s203: {}, s204: {}, s205: {}, s206: {}, s207: {}, s211: {}, s212: {}, s213: {} };
/**
 * Where a spec that imports a tool's handler lives, in precedence order (s213-m02, #2348). This is what the census
 * measures: a location, not a proof. It was called a "proof tier" with the values product-reality/contract/unit/none,
 * which read as execution proof; the directory names now say what was measured.
 */
export const LOCATIONS = ['test/product-reality', 'test/contracts', 'other-spec', 'none'];
/** s213-m02: the runtime limits probe of the preliminary archive tool truth binds to (s213-limits-probe.mjs). */
export const LIMITS_PROBE_PATH = 'artifacts/product-reality/sprint-213/m02/limits-probe/receipt.json';
/**
 * Reviews that certified a sprint, and the receipts their written findings rest on. A certified receipt is referenced
 * only through its review's certification line, and each reference carries the receipt's hash at generation.
 */
export const CERTIFIED_REVIEWS = Object.freeze([{
  sprint: 211, decision: 2319, findings: 'artifacts/product-reality/sprint-211/review/findings.md', certifiedLine: '**Certified** (`#2319`)',
  receipts: [
    { path: 'artifacts/product-reality/sprint-211/review/part-b/e2e-host.json', kind: 'archive-e2e' },
    { path: 'artifacts/product-reality/sprint-211/review/part-b/e2e-floor-node.json', kind: 'archive-e2e' },
    { path: 'artifacts/product-reality/sprint-211/review/npm-isolated/e2e-npm-isolated-node24.json', kind: 'npm-first-run' },
    { path: 'artifacts/product-reality/sprint-211/review/npm-isolated/e2e-npm-isolated-node20.11.1.json', kind: 'npm-first-run' },
  ],
}]);
/** The npm first run records one entry per step; viz.render is the step whose spec certify certifies (e2e-npm.mjs). */
const NPM_FIRST_RUN_TOOLS = { health: ['health'], compose: ['design.compose'], preview: ['design.preview'], certify: ['viz.render', 'artifact.certify'], codeGenerate: ['code.generate'], render: ['repl'] };
const families = new Set(['map', 'schema', 'object', 'repl']);
const hash = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]).sort();
export const serialize = value => JSON.stringify(value, null, 2) + '\n';

/** Literal runtime imports only. A source-test tier is not an execution verdict. */
export function handlerImports(file, source, root, names) {
  const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const imports = [];
  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const typeOnly = clause?.isTypeOnly || (!clause?.name && clause?.namedBindings && ts.isNamedImports(clause.namedBindings) && clause.namedBindings.elements.every(item => item.isTypeOnly));
      if (!typeOnly) imports.push({ value: node.moduleSpecifier.text, line: syntax.getLineAndCharacterOfPosition(node.getStart(syntax)).line + 1 });
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(syntax) === 'require') && node.arguments.length && ts.isStringLiteral(node.arguments[0])) {
      imports.push({ value: node.arguments[0].text, line: syntax.getLineAndCharacterOfPosition(node.getStart(syntax)).line + 1 });
    }
    ts.forEachChild(node, visit);
  }
  visit(syntax);
  return imports.flatMap(item => {
    if (!item.value.startsWith('.')) return [];
    const full = path.resolve(root, path.dirname(file), item.value).replace(/\.[cm]?js$/, '.ts');
    const relative = path.relative(path.join(root, 'packages/mcp-server/src/tools'), full);
    if (relative.startsWith('..') || !fs.existsSync(full)) return [];
    if (!/export\s+(?:async\s+)?function\s+handle\b|export\s+const\s+handle\b/.test(fs.readFileSync(full, 'utf8'))) return [];
    const module = relative.replace(/\.ts$/, '').replaceAll(path.sep, '.');
    const name = names.find(name => module === name) ?? names.find(name => families.has(name) && module.startsWith(`${name}.`));
    return name ? [{ tool: name, path: file, line: item.line, handler: path.relative(root, full).replaceAll(path.sep, '/') }] : [];
  });
}

/** Only an actual successful extracted-runtime receipt can retire a portable limit. */
export function derivePortableExecution(bytes, advertised, mode = 's196', receiptPath = PORTABLE_RECEIPT_PATHS[mode]) {
  assert(mode === 'latest' || Object.hasOwn(PORTABLE_RECEIPT_PATHS, mode), `Unknown portable mode ${mode}`);
  const expectedCodes = mode === 'latest' ? {} : PORTABLE_TYPED_CODES[mode];
  const typedCount = Object.keys(expectedCodes).length;
  const receipt = JSON.parse(bytes);
  assert.equal(receipt.status, 'pass', 'Portable receipt must pass');
  assert.match(receipt.manifest?.commit ?? '', /^[0-9a-f]{40}$/);
  assert.equal(typeof receipt.manifest?.dirty, 'boolean');
  // s232: the npm first run and team journey exercise all default tools, but retain their
  // assertions in toolAssertions rather than the archive runner's calls.outcomes envelope.
  const npm = mode === 'latest' && Object.hasOwn(receipt, 'toolAssertions');
  if (npm) {
    assert.match(receipt.tarball?.sha256 ?? '', /^[0-9a-f]{64}$/, 'npm receipt must identify its tarball');
    for (const [tool, outcome] of Object.entries(receipt.toolAssertions ?? {})) {
      assert.equal(outcome?.bundleHead, receipt.manifest.commit, `${tool}: npm assertion must name the executed head`);
      assert(outcome.evidence && typeof outcome.evidence === 'object' && !Array.isArray(outcome.evidence) && Object.keys(outcome.evidence).length > 0, `${tool}: substantive npm assertion evidence missing`);
    }
  } else {
    assert.equal(receipt.tools?.count, advertised.length);
    assert.deepEqual([...receipt.tools.names].sort(), advertised.map(name => mode === 'latest' ? advertisedName(name) : name.replaceAll('.', '_')).sort());
  }
  const outcomes = npm ? receipt.toolAssertions : receipt.calls?.outcomes;
  assert.deepEqual(Object.keys(outcomes ?? {}).sort(), [...advertised].sort(), 'Portable receipt must cover every advertised tool exactly');
  assert.equal(Object.values(outcomes).filter(row => row.outcome === 'pass').length, advertised.length - typedCount);
  assert.equal(Object.values(outcomes).filter(row => row.outcome === 'typed').length, typedCount);
  for (const [tool, outcome] of Object.entries(outcomes)) {
    if (expectedCodes[tool]) {
      assert.equal(outcome.outcome, 'typed', `${tool}: dependency gap must remain typed`);
      assert.equal(outcome.code, expectedCodes[tool], `${tool}: native code must survive the adapter`);
      assert.equal(outcome.isError, true);
      assert.equal(outcome.retryable, tool === 'design.preview');
      assert.equal(typeof outcome.message, 'string');
      assert(outcome.message.length > 0);
      assert.equal(typeof outcome.gap, 'string');
      assert(outcome.gap.length > 0);
      assert(outcome.data && typeof outcome.data === 'object', `${tool}: native error data missing`);
    } else assert.equal(outcome.outcome, 'pass', `${tool}: successful portable execution required`);
  }
  return {
    proof: { path: receiptPath, sha256: hash(bytes), bundleHead: receipt.manifest.commit, dirty: receipt.manifest.dirty, tools: advertised.length, pass: advertised.length - typedCount, typed: typedCount },
    outcomes,
  };
}


/** New executions carry completedAt. Legacy receipts fall back to their numeric sprint path, never filesystem mtime. */
export function latestPortableReceipt(root, advertised) {
  const candidates = walk(path.join(root, 'artifacts/product-reality')).filter(file => /\/e2e[^/]*\.json$/.test(file));
  const valid = candidates.flatMap(file => {
    const relative = path.relative(root, file).split(path.sep).join('/');
    try {
      const bytes = fs.readFileSync(file, 'utf8'), receipt = JSON.parse(bytes);
      derivePortableExecution(bytes, advertised, 'latest', relative);
      return [{ relative, time: Date.parse(receipt.completedAt ?? '') || 0, sprint: Number(relative.match(/sprint-(\d+)/)?.[1] ?? 0) }];
    } catch { return []; } // Incomplete, failed, partial npm and incompatible-roster runs cannot establish this proof.
  }).sort((a, b) => b.time - a.time || b.sprint - a.sprint || a.relative.localeCompare(b.relative));
  assert(valid.length, 'No passing archive receipt covers the advertised default tools');
  return valid[0].relative;
}

export function deriveToolTruth({ root = ROOT, head, mode, receiptPath } = {}) {
  assert.match(head ?? '', /^[0-9a-f]{40}$/);
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  mode ??= JSON.parse(read(LEDGER_PATH)).mode ?? 's193';
  const registry = JSON.parse(read('packages/mcp-server/src/tools/registry.json'));
  const names = [...registry.auto, ...registry.onDemand];
  assert(['s193', 's194', 's196', 's200', 's201', 's202', 's203', 's204', 's205', 's206', 's207', 's211', 's212', 's213', 'latest'].includes(mode), 'Unknown tool-truth mode');
  const bound = mode === 'latest' || mode === 's196' || mode === 's200' || mode === 's201' || mode === 's202' || mode === 's203' || mode === 's204' || mode === 's205' || mode === 's206' || mode === 's207' || mode === 's211' || mode === 's212' || mode === 's213';
  const retired = mode !== 's193' ? JSON.parse(read('artifacts/product-reality/sprint-216/m02/retired-tools.json')).retired : [];
  assert.equal(names.length + retired.length, 34);
  assert.equal(new Set([...names, ...retired.map(row => row.name)]).size, 34);
  for (const row of retired) assert(row.decisionIds.length > 0 && row.decisionIds.every(Number.isInteger));
  const descriptions = JSON.parse(read('packages/mcp-adapter/tool-descriptions.json'));
  const index = read('packages/mcp-server/src/index.ts');
  const toolSpecs = new Map([...index.matchAll(/'([^']+)':\s*\{\s*modulePath:\s*'([^']+)',\s*inputSchema:\s*'([^']+)'/g)].map(match => [match[1], { handler: match[2], schema: match[3] }]));
  const allImports = [];
  for (const base of ['packages/mcp-server/test', 'packages/mcp-server/src']) {
    for (const full of walk(path.join(root, base)).filter(file => /\.(test|spec)\.[cm]?[jt]sx?$/.test(file))) {
      const file = path.relative(root, full).replaceAll(path.sep, '/');
      allImports.push(...handlerImports(file, read(file), root, names));
    }
  }
  const e2ePath = 'scripts/runtime/e2e.mjs';
  const e2eSource = read(e2ePath);
  const e2eCalls = [...e2eSource.matchAll(/\.callTool\(\s*["']([^"']+)["']/g)].map(match => ({ name: match[1], path: e2ePath, line: e2eSource.slice(0, match.index).split('\n').length }));
  const caveats = JSON.parse(read('scripts/product-reality/s193-tool-caveats.json'));
  const portableGaps = mode === 's194' ? JSON.parse(read('artifacts/product-reality/sprint-194/m06/portable-gaps.json')).gaps : [];
  const selectedReceipt = mode === 'latest' ? receiptPath ?? latestPortableReceipt(root, registry.auto) : PORTABLE_RECEIPT_PATHS[mode];
  const execution = bound ? derivePortableExecution(read(selectedReceipt), registry.auto, mode, selectedReceipt) : undefined;
  const probeBytes = read(LIMITS_PROBE_PATH);
  const probe = deriveLimitsProbe(probeBytes, names.filter(name => !['object.import', 'object.write', 'schema.read', 'map.read', 'brand.read', 'object.import.read', 'design.versions'].includes(name)), retired.map(row => row.name));
  // Runtime limits bind only to the archive the probe ran, which must be the archive this mode's E2E ran.
  const probeBound = Boolean(execution) && probe.proof.bundleHead === execution.proof.bundleHead && probe.proof.payloadTreeSha256 === JSON.parse(read(selectedReceipt)).manifest.payloadTreeSha256;
  const certified = deriveCertifiedReceipts(read, names);
  const rows = names.map(name => {
    const spec = toolSpecs.get(name); assert(spec, `No ToolSpec for ${name}`); assert.equal(typeof descriptions[name], 'string');
    const inputSchemaPath = path.posix.join('packages/mcp-server/src', spec.schema);
    const inputBytes = read(inputSchemaPath); const inputSchema = JSON.parse(inputBytes);
    const advertisedClaim = { name: advertisedName(name), description: descriptions[name], inputSchemaDescription: inputSchema.description ?? '' };
    const tests = Object.fromEntries(LOCATIONS.slice(0, 3).map(location => [location, []]));
    for (const item of allImports.filter(item => item.tool === name)) {
      const location = item.path.includes('/test/product-reality/') ? 'test/product-reality' : item.path.includes('/test/contracts/') ? 'test/contracts' : 'other-spec';
      const { tool: _tool, ...ref } = item; tests[location].push(ref);
    }
    const anchored = (caveats[name] ?? []).map(caveat => {
      const lines = read(caveat.file).split('\n'); const matches = lines.flatMap((line, index) => line.includes(caveat.anchor) ? [index + 1] : []);
      assert.equal(matches.length, 1, `Caveat anchor must be unique: ${name} ${caveat.anchor}`);
      const { anchor: _anchor, portable, observed, ...rest } = caveat;
      if (observed) checkObserved(observed, probe.results, root, `${name}: ${caveat.reason}`);
      return { portable: Boolean(portable), row: { ...rest, line: matches[0], ...(observed ? { observed: { receiptSha256: probe.proof.sha256, probes: [...new Set(observed.flatMap(entry => entry.probe ? [entry.probe] : (entry.same ?? entry.differ ?? entry.greater ?? []).map(([id]) => id)))] } } : {}) } };
    });
    const portableE2ERefs = e2eCalls.filter(call => call.name === advertisedName(name)).map(({ name: _name, ...ref }) => ref);
    const outcome = execution?.outcomes[name];
    const portableOutcome = outcome ? { outcome: outcome.outcome, ...(outcome.outcome === 'typed' ? { code: outcome.code, retryable: outcome.retryable } : {}), receiptSha256: execution.proof.sha256, bundleHead: execution.proof.bundleHead } : undefined;
    const typedLimits = execution ? outcome?.outcome === 'typed' ? [{
      id: outcome.gap, tool: name, status: 'typed', kind: 'documented-limit', source: 'e2e', code: outcome.code, retryable: outcome.retryable,
      blocker: outcome.message, transportOutcome: `tools/call returned isError with ${outcome.code}, retryable and data preserved`,
      receipt: { path: execution.proof.path, sha256: execution.proof.sha256, bundleHead: execution.proof.bundleHead },
    }] : [] : portableGaps.filter(gap => gap.tool === name);
    // A runtime limit is observed on the probed archive; without that binding it stays a documented caveat.
    const probedLimits = probeBound ? anchored.filter(entry => entry.portable).map(({ row }) => ({
      id: `runtime-${row.observed.probes[0]}`, tool: name, status: 'observed', kind: 'documented-limit', source: 'limits-probe', blocker: row.reason,
      receipt: { path: LIMITS_PROBE_PATH, sha256: probe.proof.sha256, bundleHead: probe.proof.bundleHead },
    })) : [];
    const portableLimits = [...typedLimits, ...probedLimits];
    const rowCaveats = anchored.filter(entry => !(probeBound && entry.portable)).map(entry => entry.row);
    const testImportLocation = LOCATIONS.find(location => tests[location]?.length) ?? 'none';
    return { name, registration: registry.auto.includes(name) ? 'auto' : 'on-demand', advertisedClaim, claimHash: hash(serialize(advertisedClaim)), inputSchemaPath, inputSchemaHash: hash(inputBytes), testImportLocation, testImports: tests, certifiedReceipts: certified[name], portableE2E: portableE2ERefs.length > 0, portableE2ERefs, ...(mode !== 's193' ? { portableLimits } : {}), ...(portableOutcome ? { portableOutcome } : {}), caveats: rowCaveats };
  });
  if (mode !== 's193') for (const row of rows) {
    assert(row.caveats.every(caveat => caveat.kind === 'documented-limit'), `${row.name}: unresolved claim`);
    if (row.registration === 'auto') {
      assert.equal(row.testImportLocation, 'test/product-reality', `${row.name}: no boundary spec imports its handler`);
      assert.equal(row.portableE2E, true, `${row.name}: missing extracted-bundle invocation`);
    } else assert(['test/contracts', 'test/product-reality'].includes(row.testImportLocation), `${row.name}: no spec imports its on-demand handler`);
  }
  const byLocation = population => Object.fromEntries(LOCATIONS.map(location => [location, population.filter(row => row.testImportLocation === location).length]));
  return {
    schemaVersion: '2.0.0', ...(mode !== 's193' ? { mode, retired } : {}), head, builderSelfCertified: false,
    methodology: {
      testImportLocation: 'Where a spec that imports the tool\'s handler module lives: packages/mcp-server/test/product-reality, then test/contracts, then any other mcp-server spec. A literal runtime import is source evidence that a test reaches the handler, not proof of invocation, passing execution or browser certification. Grouped action imports roll up to their registered family. Transitive imports and constructed imports/dispatch are not followed; type-only and schema-only imports do not count.',
      certifiedReceipts: 'Receipts of an independently certified review that recorded a call to the tool, each hash-bound at generation and named by the decision that certified it. They describe the build that review certified (its bundle head), not necessarily this one.',
      portableE2E: 'Literal callTool names in scripts/runtime/e2e.mjs; source coverage only, not a claim this census executed the portable E2E.',
      caveats: 'Limits anchored to one line of source. Where a caveat carries observed, the limits probe receipt shows the behaviour on the packed runtime, and generation fails if the observation stops matching.',
      ...(execution ? { portableExecution: 'Per-tool pass or typed dependency outcomes for the exercised inputs from the hash-bound packaged-runtime E2E receipt. Its bundle head and dirty state are retained separately from this source census head. Certification is the independent review\'s.' } : {}),
      ...(probeBound ? { portableLimits: 'Typed dependency outcomes from the E2E receipt, and limits the limits probe observed on the same archive (paths that fail or do nothing from the runtime and work, or would, in a source checkout).' } : {}),
    },
    ...(execution ? { portableExecution: execution.proof } : {}), ...(probeBound ? { limitsProbe: probe.proof } : {}),
    summary: { entries: rows.length, auto: registry.auto.length, onDemand: registry.onDemand.length, byTestImportLocation: byLocation(rows), autoByTestImportLocation: byLocation(rows.filter(row => row.registration === 'auto')), onDemandByTestImportLocation: byLocation(rows.filter(row => row.registration === 'on-demand')), portableE2E: rows.filter(row => row.portableE2E).length, caveats: rows.reduce((sum, row) => sum + row.caveats.length, 0), portableLimits: rows.reduce((sum, row) => sum + (row.portableLimits?.length ?? 0), 0) },
    rows,
  };
}

/** The limits probe receipt, bound by its bytes: its archive identity and one row per probe id. */
export function deriveLimitsProbe(bytes, names, retired = []) {
  const receipt = JSON.parse(bytes);
  assert.equal(receipt.kind, 'runtime-limits-probe');
  assert.equal(receipt.builderSelfCertified, false);
  assert.match(receipt.manifest?.commit ?? '', /^[0-9a-f]{40}$/);
  assert.equal(receipt.manifest.dirty, false, 'the probed archive must come from a clean tree');
  const knownRetirements = new Set(retired.map(name => name.replaceAll('.', '_')));
  // Historical bytes stay sealed; only documented retirements may leave the live roster.
  assert.deepEqual(receipt.surfaces.all.filter(name => !knownRetirements.has(name)).sort(), names.map(name => name.replaceAll('.', '_')).sort(), 'the probe listed every registered tool, apart from documented retirements');
  const results = Object.fromEntries(receipt.probes.map(row => [row.id, row]));
  assert.equal(Object.keys(results).length, receipt.probes.length, 'probe ids are unique');
  return { proof: { path: LIMITS_PROBE_PATH, sha256: hash(bytes), bundleHead: receipt.manifest.commit, payloadTreeSha256: receipt.manifest.payloadTreeSha256, archiveSha256: receipt.archive.sha256, probes: receipt.probes.length }, results };
}

const pick = (value, dotted) => dotted.split('.').reduce((node, key) => node?.[key], value);

/** Each observed assertion must hold in the probe receipt; a fixed limit fails here instead of staying published. */
export function checkObserved(observed, results, root, label) {
  const at = ([id, dotted]) => { assert(results[id], `${label}: unknown probe ${id}`); return pick(results[id], dotted); };
  for (const entry of observed) {
    if (entry.files) { assert.deepEqual(fs.readdirSync(path.join(root, entry.files)).sort(), entry.equals, `${label}: ${entry.files}`); continue; }
    if (entry.placement) {
      const placement = componentPlacement(root, entry.placement);
      assert.deepEqual({ labelledNotPlaced: placement.labelledNotPlaced.length, placedNotLabelled: placement.placedNotLabelled.length, placed: placement.placed.size }, { labelledNotPlaced: entry.labelledNotPlaced, placedNotLabelled: entry.placedNotLabelled, placed: entry.placed }, `${label}: component placement`);
      continue;
    }
    if (entry.same) { assert.deepEqual(at(entry.same[0]), at(entry.same[1]), `${label}: ${JSON.stringify(entry.same)}`); continue; }
    if (entry.differ) { assert.notDeepEqual(at(entry.differ[0]), at(entry.differ[1]), `${label}: ${JSON.stringify(entry.differ)}`); continue; }
    if (entry.greater) { assert(at(entry.greater[0]) > at(entry.greater[1]), `${label}: ${JSON.stringify(entry.greater)}`); continue; }
    const value = at([entry.probe, entry.path]);
    if ('equals' in entry) assert.deepEqual(value, entry.equals, `${label}: ${entry.probe} ${entry.path}`);
    else if ('count' in entry) assert.equal(value?.length, entry.count, `${label}: ${entry.probe} ${entry.path}`);
    else if ('includes' in entry) assert(Array.isArray(value) && value.includes(entry.includes), `${label}: ${entry.probe} ${entry.path}`);
    else if ('startsWith' in entry) assert(String(value).startsWith(entry.startsWith), `${label}: ${entry.probe} ${entry.path}`);
    else assert.fail(`${label}: unknown observed assertion ${JSON.stringify(entry)}`);
  }
}

/**
 * Components the generated apps of the served runtime sweep import (its receipt root, every generation receipt), against
 * the component ledger's proven-in-generated-apps evidence (generatedConsumer).
 */
export function componentPlacement(root, registryPath) {
  const registry = JSON.parse(fs.readFileSync(path.join(root, registryPath), 'utf8'));
  const placed = new Set();
  // The current ledger can retain only the public subset of a historical run (s233-m02). Files left in that run's
  // receipt directory are historical evidence, not additional current cells. Workflows bind their response explicitly.
  const generations = registry.rows.filter(row => row.status === 'pass').map(row =>
    row.gates.find(gate => gate.name === 'generation')?.detail?.response
      ?? path.posix.join(path.posix.dirname(row.report), 'generation.json'));
  for (const relative of new Set(generations)) {
    const file = path.join(root, registry.receiptRoot, relative);
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/import \{([^}]*)\} from \\?["']@oods\/components-(?:react|vue)/g)) {
      for (const name of match[1].split(',')) { const id = name.trim().split(' as ')[0].trim(); if (id) placed.add(id); }
    }
  }
  const ledger = JSON.parse(fs.readFileSync(path.join(root, 'packages/component-contracts/registry/component-capability-ledger.v1.json'), 'utf8'));
  const labelled = new Set(ledger.rows.filter(row => row.surfaces.generatedConsumer?.state === 'implemented-evidence-complete').map(row => row.id));
  return { placed, labelledNotPlaced: [...labelled].filter(id => !placed.has(id)).sort(), placedNotLabelled: [...placed].filter(id => !labelled.has(id)).sort() };
}

/** Per tool, the certified receipts that recorded a call to it, with the receipt's hash and what it recorded. */
export function deriveCertifiedReceipts(read, names) {
  const byTool = Object.fromEntries(names.map(name => [name, []]));
  for (const review of CERTIFIED_REVIEWS) {
    assert(read(review.findings).includes(review.certifiedLine), `Sprint ${review.sprint}'s review does not certify it`);
    for (const { path: receiptPath, kind } of review.receipts) {
      const bytes = read(receiptPath); const receipt = JSON.parse(bytes);
      const ref = { path: receiptPath, sha256: hash(bytes), kind, certifiedBy: review.decision, sprint: review.sprint };
      if (kind === 'archive-e2e') {
        assert.equal(receipt.status, 'pass');
        for (const [tool, outcome] of Object.entries(receipt.calls.outcomes)) byTool[tool]?.push({ ...ref, bundleHead: receipt.manifest.commit, node: receipt.nodeVersion, outcome: outcome.outcome });
      } else {
        // The npm first run writes its receipt only after every step's assertions pass.
        for (const [step, tools] of Object.entries(NPM_FIRST_RUN_TOOLS)) {
          assert(receipt.firstRun?.[step], `${receiptPath}: no ${step} step`);
          for (const tool of tools) byTool[tool].push({ ...ref, tarballSha256: `sha256:${receipt.tarball.sha256}`, node: receipt.node, outcome: 'pass' });
        }
      }
    }
  }
  return byTool;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const refresh = ['--refresh', '--check', '--head', '--mode', '--receipt'].some(flag => process.argv.includes(flag));
  if (!refresh) {
    const outputIndex = process.argv.indexOf('--output');
    if (outputIndex >= 0) copyRetainedToolLedger(process.argv[outputIndex + 1]);
    else readRetainedProofs();
  } else {
  const headIndex = process.argv.indexOf('--head');
  const recorded = JSON.parse(fs.readFileSync(path.join(ROOT, LEDGER_PATH), 'utf8'));
  const head = headIndex < 0 ? process.argv.includes('--check') ? recorded.head : execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim() : process.argv[headIndex + 1];
  const modeIndex = process.argv.indexOf('--mode');
  const mode = modeIndex < 0 ? process.argv.includes('--check') ? recorded.mode ?? 's193' : 'latest' : process.argv[modeIndex + 1];
  const receiptIndex = process.argv.indexOf('--receipt');
  const ledger = deriveToolTruth({ head, mode, ...(receiptIndex >= 0 ? { receiptPath: process.argv[receiptIndex + 1] } : {}) });
  if (process.argv.includes('--check')) assert.equal(fs.readFileSync(path.join(ROOT, LEDGER_PATH), 'utf8'), serialize(ledger));
  else {
    const outputIndex = process.argv.indexOf('--output');
    const output = outputIndex < 0 ? path.join(ROOT, LEDGER_PATH) : path.resolve(ROOT, process.argv[outputIndex + 1]);
    assert(!path.relative(ROOT, output).startsWith('..'), 'Ledger output must stay in the repository');
    fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, serialize(ledger));
  }
  console.log(serialize({ head, ...ledger.summary }));
  }
}
