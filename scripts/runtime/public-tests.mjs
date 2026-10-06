#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { isolatedCommand } from './e2e-npm.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const selection = JSON.parse(fs.readFileSync(path.join(root, 'scripts/runtime/public-test-selection.json'), 'utf8'));
const selfIsolatingSpecs = [
  'packages/component-styles/test/billing-meter-track.s213.spec.ts',
  'packages/component-styles/test/billing-meter.s212.spec.ts',
  'packages/component-styles/test/placed-chart-fill.s213.spec.ts',
  'packages/mcp-server/test/product-reality/bundle-harness.s196.spec.ts',
  'packages/mcp-server/test/product-reality/consumer-isolation.s212.spec.ts',
];
assert.deepEqual(selection.selfIsolatingSpecs, selfIsolatingSpecs, 'Only the reviewed native-sandbox orchestrators run outside the outer sandbox');
assert.equal(new Set(selection.specs).size, selection.specs.length, 'Duplicate public test selection');
for (const file of selection.specs) {
  assert(/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file), `Not an executable spec: ${file}`);
  assert(fs.existsSync(path.join(root, file)), `Missing public spec ${file}`);
}
for (const file of selfIsolatingSpecs) assert(selection.specs.includes(file), `Missing self-isolating spec ${file}`);
const output = path.resolve(root, process.argv[2] ?? '.tmp/public-proof/tests.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
const reportDirectory = output.replace(/\.json$/, '') + '-projects';
fs.mkdirSync(reportDirectory, { recursive: true });
const config = path.join(root, 'scripts/runtime/vitest.public.config.mts');
const vitest = path.join(root, 'node_modules/vitest/vitest.mjs');
const guardArgs = ['--require', path.join(root, 'scripts/runtime/public-dependency-guard.cjs'), '--import', path.join(root, 'scripts/runtime/public-dependency-register.mjs')];
const resolutions = path.join(reportDirectory, 'dependency-resolutions.jsonl');
fs.writeFileSync(resolutions, '');
const guardedEnv = { ...process.env, PUBLIC_TEST_RESOLUTIONS: resolutions };
const report = { numTotalTestSuites: 0, numPassedTestSuites: 0, numFailedTestSuites: 0, numPendingTestSuites: 0, numTotalTests: 0, numPassedTests: 0, numFailedTests: 0, numPendingTests: 0, numTodoTests: 0, startTime: Date.now(), success: true, testResults: [], projects: [], publicIsolation: { ordinary: { mode: 'ancestor-denied', projects: [], blockedAncestors: [] }, selfIsolating: { specs: selfIsolatingSpecs, outsideCloneCanaries: {}, dependencyResolutionCount: 0, dependencyResolutionSha256: null } } };
const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
function runProject(name, specs, selfIsolating = false) {
  const cwd = name === 'tokens' ? root : path.join(root, 'packages', name);
  const resultPath = path.join(reportDirectory, `${name}${selfIsolating ? '-self-isolating' : ''}.json`);
  const args = ['--expose-gc', ...(selfIsolating ? guardArgs : []), vitest, 'run', '--config', config, '--project', name + (selfIsolating ? '-self-isolating' : ''), '--reporter=default', '--reporter=json', `--outputFile=${resultPath}`];
  if (selfIsolating) args.push(...specs.map(file => path.relative(cwd, path.join(root, file))));
  else for (const file of selfIsolatingSpecs) args.push('--exclude', `**/${path.basename(file)}`);
  const invocation = selfIsolating ? { command: process.execPath, args } : isolatedCommand(root, process.execPath, args);
  const result = spawnSync(invocation.command, invocation.args, { cwd, stdio: 'inherit', env: selfIsolating ? guardedEnv : process.env });
  if (result.error) throw result.error;
  assert(fs.existsSync(resultPath), `No Vitest report from ${name}`);
  const part = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  assert.deepEqual(part.testResults.map(row => path.relative(root, row.name)).sort(), [...specs].sort(), `${name}: every selected spec must run exactly once`);
  for (const key of Object.keys(report).filter(key => key.startsWith('num'))) report[key] += part[key] ?? 0;
  report.success &&= result.status === 0 && part.success === true;
  report.testResults.push(...part.testResults);
  report.projects.push({ name, selfIsolating, exitCode: result.status, report: path.relative(root, resultPath) });
  if (!selfIsolating) { report.publicIsolation.ordinary.projects.push(name); report.publicIsolation.ordinary.blockedAncestors = invocation.blocked; }
  save();
}
for (const name of selection.packages) {
  const specs = selection.specs.filter(file => (name === 'tokens' ? file.startsWith('tests/') : file.startsWith(`packages/${name}/`)) && !selfIsolatingSpecs.includes(file));
  assert(specs.length, `${name}: empty selected suite`);
  runProject(name, specs);
}
// Deliberate outside-clone modules contain only public fixture text, inside the export's sprint scratch.
const canaryDirectory = fs.mkdtempSync(path.join(path.dirname(root), 'dependency-canary-'));
try {
  for (const [kind, extension, contents] of [['commonjs', 'cjs', 'module.exports = true;\n'], ['esm', 'mjs', 'export default true;\n']]) {
    const file = path.join(canaryDirectory, `outside.${extension}`); fs.writeFileSync(file, contents);
    const source = kind === 'commonjs' ? `require(${JSON.stringify(file)})` : `await import(${JSON.stringify(file)})`;
    const result = spawnSync(process.execPath, [...guardArgs, ...(kind === 'esm' ? ['--input-type=module'] : []), '-e', source], { cwd: root, env: guardedEnv, encoding: 'utf8' });
    assert.notEqual(result.status, 0, `${kind}: outside-clone dependency canary escaped`);
    assert.match(result.stderr, /ERR_PUBLIC_DEPENDENCY_OUTSIDE/, `${kind}: canary failed for the wrong reason`);
    report.publicIsolation.selfIsolating.outsideCloneCanaries[kind] = 'rejected';
  }
  const nativeSpec = path.join(reportDirectory, 'worker-native-canary.spec.ts');
  const nativeConfig = path.join(reportDirectory, 'worker-native-canary.config.mts');
  const nativeReport = path.join(reportDirectory, 'worker-native-canary.json');
  const nativeImport = path.join(reportDirectory, 'native-import.cjs');
  fs.writeFileSync(nativeImport, 'module.exports = specifier => import(specifier);\n');
  fs.writeFileSync(nativeSpec, `import { it, expect } from 'vitest';\nimport { createRequire } from 'node:module';\nit('worker CommonJS stays in the clone', () => expect(() => createRequire(import.meta.url)(${JSON.stringify(path.join(canaryDirectory, 'outside.cjs'))})).toThrow(/ERR_PUBLIC_DEPENDENCY_OUTSIDE/));\nit('worker native ESM stays in the clone', async () => { const nativeImport = createRequire(import.meta.url)(${JSON.stringify(nativeImport)}); await expect(nativeImport(${JSON.stringify(path.join(canaryDirectory, 'outside.mjs'))})).rejects.toMatchObject({ code: 'ERR_PUBLIC_DEPENDENCY_OUTSIDE' }); });\n`);
  fs.writeFileSync(nativeConfig, `import { publicDependencyBoundary, publicDependencyWorkerOptions } from ${JSON.stringify(config)};\nexport default { plugins: [publicDependencyBoundary()], test: { ...publicDependencyWorkerOptions, root: ${JSON.stringify(root)}, include: [${JSON.stringify(nativeSpec)}], fileParallelism: false } };\n`);
  const native = spawnSync(process.execPath, [...guardArgs, vitest, 'run', '--config', nativeConfig, '--reporter=json', '--outputFile=' + nativeReport], { cwd: root, env: guardedEnv, encoding: 'utf8' });
  fs.writeFileSync(path.join(reportDirectory, 'worker-native-canary.log'), native.stdout + native.stderr);
  assert.equal(native.status, 0, 'Vitest workers must inherit both native dependency guards');
  const nativeResults = JSON.parse(fs.readFileSync(nativeReport, 'utf8'));
  assert.equal(nativeResults.numPassedTests, 2);
  assert.equal(nativeResults.numPendingTests + nativeResults.numTodoTests, 0);
  report.publicIsolation.selfIsolating.outsideCloneCanaries.commonjsWorker = 'rejected';
  report.publicIsolation.selfIsolating.outsideCloneCanaries.esmWorker = 'rejected';
  const outside = path.join(canaryDirectory, 'outside.ts'); fs.writeFileSync(outside, 'export const witness: boolean = true;\n');
  const canarySpec = path.join(reportDirectory, 'worker-canary.spec.ts');
  const canaryConfig = path.join(reportDirectory, 'worker-canary.config.mts');
  fs.writeFileSync(canarySpec, `import { it, expect } from 'vitest';\nimport { witness } from ${JSON.stringify(outside)};\nit('must reject the outside-clone TS module', () => expect(witness).toBe(true));\n`);
  fs.writeFileSync(canaryConfig, `import { publicDependencyBoundary, publicDependencyWorkerOptions } from ${JSON.stringify(config)};\nexport default { plugins: [publicDependencyBoundary()], test: { ...publicDependencyWorkerOptions, root: ${JSON.stringify(root)}, include: [${JSON.stringify(canarySpec)}], fileParallelism: false } };\n`);
  const transformed = spawnSync(process.execPath, [...guardArgs, vitest, 'run', '--config', canaryConfig], { cwd: root, env: guardedEnv, encoding: 'utf8' });
  assert.notEqual(transformed.status, 0, 'Vitest transformed an outside-clone TS module');
  assert.match(transformed.stdout + transformed.stderr, /ERR_PUBLIC_DEPENDENCY_OUTSIDE/, 'Vitest canary failed for the wrong reason');
  report.publicIsolation.selfIsolating.outsideCloneCanaries.vitestTransform = 'rejected';
  fs.writeFileSync(path.join(reportDirectory, 'worker-canary.log'), transformed.stdout + transformed.stderr);
} finally { fs.rmSync(canaryDirectory, { recursive: true, force: true }); }
for (const name of selection.packages) {
  const specs = selfIsolatingSpecs.filter(file => file.startsWith(`packages/${name}/`));
  if (specs.length) runProject(name, specs, true);
}
const resolved = [...new Set(fs.readFileSync(resolutions, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)))].sort();
assert(resolved.some(file => file.includes('node_modules/')), 'The orchestrator dependency guard must observe actual dependencies');
report.publicIsolation.selfIsolating.dependencyResolutionCount = resolved.length;
report.publicIsolation.selfIsolating.dependencyResolutionSha256 = createHash('sha256').update(JSON.stringify(resolved)).digest('hex');
save();
assert(report.success, 'Public tests failed');
assert(report.numPassedTests > 0, 'Public tests must execute assertions');
assert.equal(report.numPendingTests + report.numTodoTests, 0, 'Public tests cannot silently skip assertions');
assert.deepEqual(report.testResults.map(row => path.relative(root, row.name)).sort(), [...selection.specs].sort(), 'Every public spec must run exactly once');
console.log(JSON.stringify({ specs: report.testResults.length, passed: report.numPassedTests, failed: report.numFailedTests, skipped: report.numPendingTests + report.numTodoTests }));
