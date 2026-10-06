import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { readDerivedAnalysis, resolveAnalysisPointer } from '../../src/lib/derived-analysis.js';
import { readRunView } from '../../src/lib/run-view.js';
import { handle as fetchStructured } from '../../src/tools/structuredData.fetch.js';

const root = path.resolve(fileURLToPath(import.meta.url), '../../../../..');
const temps: string[] = [];
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const read = (dir: string, file: string) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
const write = (dir: string, file: string, data: unknown) => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), JSON.stringify(data)); };
const analysisId = '64c871d1-4f6e-4369-bdc8-a4c341b7c1ff';
function fixture() {
  const base = path.join(root, 'artifacts/product-reality/sprint-209/.test-tmp'); fs.mkdirSync(base, { recursive: true });
  const dir = fs.mkdtempSync(path.join(base, 'admission-')); temps.push(dir);
  const sourceTime = '2026-09-18T19:00:00Z', capturedAt = '2026-09-18T19:01:00Z', analyzedAt = '2026-09-20T13:55:00Z';
  const ref = (artifact: string, pointer: string) => ({ artifact_ref: artifact, json_pointer: pointer, run_id: analysisId });
  const files: Record<string, any> = {
    'artifacts/style_fingerprint.json': { colors: [{ value: '#545454', occurrences: 2 }] },
    'artifacts/fig_local_tokens.json': { kind: 'fig_local_tokens', version: '1.3.0', source: { file_label: 'Unit kit', fig_version: 80 }, tokens: [{ value: '#ffffff' }] },
    'evidence/lineage/source-crawl.json': { captured_at: capturedAt },
    'artifacts/drift_report.json': { kind: 'drift_report', schema_version: '1.0.0', generated_at: analyzedAt, current_run: { id: analysisId }, signals: [{ class: 'value_drift', value_family: 'color', live_value: '#545454', live_occurrences: 2, severity_level: 'medium', severity_basis: ['off_system_value'], tolerance: { source: 'registry_default', effective: { kind: 'exact_value', case_sensitive: false, include_alpha_forms: false } }, evidence_ref: ref('drift_report.json', '/signals/0'), comparands: [{ surface: 'live', ref: ref('style_fingerprint.json', '/colors/0') }, { surface: 'fig_local', ref: ref('fig_local_tokens.json', '/tokens') }] }] },
    'artifacts/report-index.json': { kind: 'report_index', schema_version: '1.1.0', run_id: analysisId, generated_at: analyzedAt, artifacts: [{ type: 'drift_report', path: 'drift_report.json', result_state: 'measured', result_note: 'One off-system value.' }] },
  };
  const inputs = Object.keys(files).slice(0, 3).map(file => ({ path: file, sha256: sha(JSON.stringify(files[file])), origin: file.includes('fig_local') ? 'injected_comparand' : 'source_capture', ...(file.includes('fig_local') ? {} : { source_path: file }) }));
  const sourceManifest = { run_id: 'source-capture', schema_version: '1.0.0', environment: { timestamp: sourceTime }, hashes: Object.fromEntries(inputs.filter(input => input.origin === 'source_capture').map(input => [input.path, input.sha256])) };
  files['evidence/lineage/source-manifest.json'] = sourceManifest;
  for (const [file, data] of Object.entries(files)) write(dir, file, data);
  const hashes = Object.fromEntries(Object.keys(files).map(file => [file, sha(fs.readFileSync(path.join(dir, file)))]));
  write(dir, 'manifest.json', { schema_version: '1.0.0', run_id: analysisId, mode: 'app', project_id: 'fixture', targets: [{ name: 'Unit capture', url: 'https://example.org' }], environment: { timestamp: sourceTime }, auth: { type: 'none', redaction: { applied: false } }, passes: [{ id: 'semantic.drift_compare', status: 'ok', version: '1.0.0' }], hashes,
    analysis: { kind: 'redrift', schema_version: '1.0.0', analysis_run_id: analysisId, analyzed_at: analyzedAt, capture_performed: false, authentication_performed: false, redaction_performed: false, passes_rerun: ['semantic.drift_compare'], source: { run_id: 'source-capture', run_path: '/nonexistent/source-provenance-only', manifest_path: 'evidence/lineage/source-manifest.json', manifest_sha256: hashes['evidence/lineage/source-manifest.json'], captured_at: capturedAt, capture_time_ref: 'evidence/lineage/source-crawl.json', target_id: null }, inputs, outputs: ['artifacts/drift_report.json', 'artifacts/report-index.json'] },
  });
  return dir;
}
function edit(dir: string, file: string, change: (data: any) => void) {
  const data = read(dir, file); change(data); write(dir, file, data);
  if (file !== 'manifest.json') {
    const manifest = read(dir, 'manifest.json');
    manifest.hashes[file] = sha(fs.readFileSync(path.join(dir, file)));
    const input = manifest.analysis.inputs.find((input: any) => input.path === file);
    if (input) input.sha256 = manifest.hashes[file];
    if (file === manifest.analysis.source.manifest_path) manifest.analysis.source.manifest_sha256 = manifest.hashes[file];
    write(dir, 'manifest.json', manifest);
  }
}
function snapshot(dir: string): Record<string, string> {
  return Object.fromEntries(fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile()).map(entry => { const file = path.join(entry.parentPath, entry.name); return [path.relative(dir, file), sha(fs.readFileSync(file))]; }));
}
afterEach(() => { for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

describe('derived-analysis admission: evidence must establish a comparison, not a fresh capture', () => {
  it('admits portable retained bytes with separate source/capture/analysis times, no a11y tree, and no writes', async () => {
    const dir = fixture(), before = snapshot(dir);
    const view = readDerivedAnalysis(dir);
    expect(view.resultState).toBe('measured'); expect(view.report.signals).toHaveLength(1);
    expect(view.sourceManifest.environment.timestamp).not.toBe(view.analysis.source.captured_at);
    expect(view.analysis.source.captured_at).not.toBe(view.analysis.analyzed_at);
    const result = await fetchStructured({ kind: 'derived_analysis', runPath: dir });
    expect(result.meta).toMatchObject({ sourceRunId: 'source-capture', signalCount: 1, resultState: 'measured' });
    expect(result.payload?.analysis).toEqual(view.analysis);
    expect((await fetchStructured({ kind: 'derived_analysis', runPath: dir, ifNoneMatch: result.etag })).payloadIncluded).toBe(false);
    expect(snapshot(dir)).toEqual(before);
    await expect(readRunView(dir)).rejects.toMatchObject({ opiCode: 'OODS-V213', message: expect.stringContaining('not a captured run') });
  });
  it.each(['measured_zero', 'not_measured', 'needs_review', undefined])('preserves %s independently from a zero count', state => {
    const dir = fixture();
    edit(dir, 'artifacts/drift_report.json', data => { data.signals = []; });
    edit(dir, 'artifacts/report-index.json', data => { data.artifacts[0].result_state = state; });
    expect(readDerivedAnalysis(dir).resultState).toBe(state ?? 'unknown');
  });
  it.each([
    ['colliding identity', (m: any) => { m.analysis.source.run_id = m.run_id; }],
    ['mismatched identity', (m: any) => { m.run_id = 'different'; }],
    ['analysis version', (m: any) => { m.analysis.schema_version = '99.0.0'; }],
    ['manifest version', (m: any) => { m.schema_version = '99.0.0'; }],
    ['failed pass', (m: any) => { m.passes[0].status = 'failed'; }],
    ['extra capture pass', (m: any) => { m.passes.push({ id: 'capture', status: 'ok', version: '1' }); }],
    ['capture claim', (m: any) => { m.analysis.capture_performed = true; }],
    ['authentication claim', (m: any) => { m.analysis.authentication_performed = true; }],
    ['redaction claim', (m: any) => { m.analysis.redaction_performed = true; }],
    ['auth type', (m: any) => { m.auth.type = 'header'; }],
    ['auth redaction', (m: any) => { m.auth.redaction.applied = true; }],
    ['capture timestamp', (m: any) => { m.analysis.source.captured_at = '2026-09-18T19:02:00Z'; }],
    ['manifest timestamp', (m: any) => { m.environment.timestamp = '2026-09-18T19:02:00Z'; }],
    ['analysis timestamp', (m: any) => { m.analysis.analyzed_at = '2020-01-01T00:00:00Z'; }],
    ['invalid timestamp', (m: any) => { m.analysis.analyzed_at = 'yesterday'; }],
    ['source attestation', (m: any) => { m.analysis.source.manifest_sha256 = 'a'.repeat(64); }],
    ['input lineage', (m: any) => { m.analysis.inputs[0].source_path = 'missing.json'; }],
    ['duplicate input', (m: any) => { m.analysis.inputs.push(m.analysis.inputs[0]); }],
    ['output as input', (m: any) => { m.analysis.inputs[0].path = 'artifacts/drift_report.json'; }],
    ['escaped path', (m: any) => { m.analysis.inputs[0].path = '../outside.json'; }],
    ['absolute path', (m: any) => { m.analysis.inputs[0].path = '/etc/passwd'; }],
    ['backslash path', (m: any) => { m.analysis.inputs[0].path = 'artifacts\\data.json'; }],
    ['unattested operand', (m: any) => { delete m.hashes['artifacts/style_fingerprint.json']; }],
  ])('refuses %s before any writes', async (_, change) => {
    const dir = fixture(); edit(dir, 'manifest.json', change); const before = snapshot(dir);
    await expect(fetchStructured({ kind: 'derived_analysis', runPath: dir })).rejects.toMatchObject({ opiCode: 'OODS-N007' });
    expect(snapshot(dir)).toEqual(before);
  });
  it.each([
    ['missing pointer', (r: any) => { r.signals[0].comparands[0].ref.json_pointer = '/missing'; }],
    ['malformed pointer', (r: any) => { r.signals[0].comparands[0].ref.json_pointer = '/~2'; }],
    ['wrong run', (r: any) => { r.signals[0].comparands[0].ref.run_id = 'stranger'; }],
    ['wrong manifest', (r: any) => { r.signals[0].comparands[0].ref.manifest_hash = 'a'.repeat(64); }],
    ['missing operand', (r: any) => { r.signals[0].comparands[0].ref.artifact_ref = 'missing.json'; }],
    ['escaped operand', (r: any) => { r.signals[0].comparands[0].ref.artifact_ref = '../manifest.json'; }],
    ['only one comparand', (r: any) => { r.signals[0].comparands.pop(); }],
    ['duplicate comparands', (r: any) => { r.signals[0].comparands[1] = r.signals[0].comparands[0]; }],
    ['output pretending to be input', (r: any) => { r.signals[0].comparands[0].ref = r.signals[0].evidence_ref; }],
    ['wrong severity basis', (r: any) => { r.signals[0].severity_basis = ['token_swap']; }],
    ['unsupported class', (r: any) => { r.signals[0].class = 'unknown'; }],
    ['invalid tolerance', (r: any) => { r.signals[0].tolerance.effective.kind = 'fuzzy'; }],
    ['unknown report version', (r: any) => { r.schema_version = '99.0.0'; }],
    ['report identity', (r: any) => { r.current_run.id = 'source-capture'; }],
  ])('refuses attested %s; hashes alone cannot establish meaningful evidence', (_, change) => {
    const dir = fixture(); edit(dir, 'artifacts/drift_report.json', change);
    expect(() => readDerivedAnalysis(dir)).toThrow(/Derived analysis refused/);
  });
  it.each(['artifacts/fig_local_tokens.json', 'artifacts/style_fingerprint.json', 'artifacts/report-index.json', 'artifacts/drift_report.json', 'evidence/lineage/source-manifest.json'])('refuses tamper of %s even after an ETag hit', async file => {
    const dir = fixture(); const result = await fetchStructured({ kind: 'derived_analysis', runPath: dir });
    fs.appendFileSync(path.join(dir, file), ' ');
    await expect(fetchStructured({ kind: 'derived_analysis', runPath: dir, ifNoneMatch: result.etag, includePayload: false })).rejects.toMatchObject({ opiCode: 'OODS-N007' });
  });
  it('refuses missing files and symlink escapes, including the root manifest', () => {
    for (const file of ['manifest.json', 'artifacts/fig_local_tokens.json']) {
      const dir = fixture(); const outside = fixture();
      fs.rmSync(path.join(dir, file)); expect(() => readDerivedAnalysis(dir)).toThrow(/refused/);
      fs.symlinkSync(path.join(outside, file), path.join(dir, file));
      expect(() => readDerivedAnalysis(dir)).toThrow(/escaped path/);
    }
  });
  it('refuses source identity, index identity/version/state and unknown token versions despite valid digests', () => {
    for (const [file, change] of [
      ['evidence/lineage/source-manifest.json', (d: any) => { d.run_id = 'stranger'; }],
      ['artifacts/report-index.json', (d: any) => { d.run_id = 'stranger'; }],
      ['artifacts/report-index.json', (d: any) => { d.schema_version = '99.0.0'; }],
      ['artifacts/report-index.json', (d: any) => { d.artifacts[0].result_state = 'success'; }],
      ['artifacts/report-index.json', (d: any) => { d.artifacts[0].result_state = 'measured_zero'; }],
      ['artifacts/fig_local_tokens.json', (d: any) => { d.version = '99.0.0'; }],
    ] as const) {
      const dir = fixture(); edit(dir, file, change); expect(() => readDerivedAnalysis(dir)).toThrow(/refused/);
    }
  });
  it('resolves escaped object keys and refuses prototype/array pseudo-indices', () => {
    expect(resolveAnalysisPointer({ 'a/b': { '~x': [false] } }, '/a~1b/~0x/0')).toBe(false);
    for (const pointer of ['/constructor', '/__proto__', '/length', '/01', '/-']) expect(() => resolveAnalysisPointer([1, 2], pointer)).toThrow();
  });
});
