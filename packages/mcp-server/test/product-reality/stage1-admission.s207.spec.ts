import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { handle as fetchStructured } from '../../src/tools/structuredData.fetch.js';
import { readRunView } from '../../src/lib/run-view.js';

// Small attested fixture: the same rule is BOTH a violation and incomplete on one page.
// This is absent from the real USWDS run and must not disappear in a future identity rewrite.
const temps: string[] = [];
const json = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file: string, data: unknown) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data)); };
const hash = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function fixture(legacy = false) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 's207-admission-')); temps.push(dir);
  const item = { id: 'color-contrast', help: 'Review contrast', description: 'Contrast evidence', impact: 'serious', node_count: 1, selectors: ['h1'], tags: ['wcag143'], help_url: 'https://example.org/rule' };
  const manifest: Record<string, any> = { ...(legacy ? {} : { schema_version: '1.0.0' }), run_id: 'test-run', project_id: 'fixture', mode: 'app', targets: [{ name: 'Fixture', url: 'https://example.org/' }], passes: [{ id: 'a11y', version: '1', status: 'ok' }], environment: { timestamp: '2026-09-18T19:01:00Z' }, auth: { type: 'header', mechanisms: ['header'], api_auth_kind: 'bearer', redaction: { applied: false } }, hashes: {} };
  write(path.join(dir, 'artifacts/a11y_report.json'), { kind: 'a11y_report', schema_version: legacy ? '2.2.0' : '2.3.0', pages: [{}], rollup: { violation_count: 1, accessibility_score: 99, by_severity: { serious: 1 }, ...(legacy ? {} : { needs_review_count: 1 }) } });
  write(path.join(dir, 'artifacts/report-index.json'), { kind: 'report_index', schema_version: legacy ? '1.0.0' : '1.1.0', artifacts: ['measured', 'measured_zero', 'not_measured', 'not_applicable', 'needs_review'].map((state, n) => ({ path: `artifact-${n}.json`, type: 'fixture', description: state, ...(legacy ? {} : { result_state: state, result_note: `Recorded ${state}` }) })) });
  write(path.join(dir, 'evidence/a11y/a11y_manifest.json'), { kind: 'a11y_evidence_manifest', version: legacy ? '1.1.0' : '1.2.0', pages: [{ route: '/', url: 'https://example.org/', axe_results_path: 'evidence/a11y/root.json' }] });
  write(path.join(dir, 'evidence/a11y/root.json'), { violations: [item], ...(legacy ? {} : { incomplete: [{ ...item, impact: null, reasons: ['Background image prevents automatic measurement'] }] }), test_engine: { name: 'axe-core', version: '4.11.0' }, timestamp: manifest.environment.timestamp });
  for (const file of ['artifacts/a11y_report.json', 'artifacts/report-index.json', 'evidence/a11y/a11y_manifest.json', 'evidence/a11y/root.json']) manifest.hashes[file] = hash(path.join(dir, file));
  write(path.join(dir, 'manifest.json'), manifest);
  return dir;
}
function edit(dir: string, file: string, change: (value: any) => void, attest = true) {
  const value = json(path.join(dir, file)); change(value); write(path.join(dir, file), value);
  if (attest && file !== 'manifest.json') {
    const manifest = json(path.join(dir, 'manifest.json')); manifest.hashes[file] = hash(path.join(dir, file)); write(path.join(dir, 'manifest.json'), manifest);
  }
}
afterEach(() => { for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

describe('Stage1 current/legacy admission (s207-m01)', () => {
  it('preserves review reasons with stable identities, separate violation totals and the source score', async () => {
    const dir = fixture(); const view = await readRunView(dir);
    expect(view.kinds).toEqual({ run_manifest: '1.0.0', a11y_report: '2.3.0', a11y_evidence: '1.2.0', report_index: '1.1.0' });
    expect(view.records.Run[0]).toMatchObject({ finding_count: 1, needs_review_count: 1, accessibility_score: 99 });
    expect(view.records.Finding.map(row => row.finding_id)).toEqual(['/#color-contrast', '/#color-contrast#needs_review']);
    expect(view.records.Finding[1]).toMatchObject({ result_state: 'needs_review', impact: 'unknown', reasons: 'Background image prevents automatic measurement' });
    expect((await readRunView(dir)).records.Finding).toEqual(view.records.Finding);
    expect(view.records.CapturedArtifact.map(row => row.result_state)).toEqual(['measured', 'measured_zero', 'not_measured', 'not_applicable', 'needs_review']);
    expect(view.records.CapturedArtifact[1]?.result_note).toBe('Recorded measured_zero');
    expect(view.records.CapturedArtifact.every(row => row.schema_version === null)).toBe(true);
  });
  it('leaves historical result absence unknown and never invents findings from counts', async () => {
    const dir = fixture(true); const before = fs.readFileSync(path.join(dir, 'manifest.json'));
    const view = await readRunView(dir);
    expect(view.records.Finding).toHaveLength(1);
    expect(view.records.Finding[0]?.finding_id).toBe('/#color-contrast');
    expect(view.records.Run[0]?.needs_review_count).toBeUndefined();
    expect(view.records.Run[0]?.auth_provenance_note).toContain('unknown');
    expect(view.records.CapturedArtifact.every(row => row.result_state === 'unknown')).toBe(true);
    expect(fs.readFileSync(path.join(dir, 'manifest.json')).equals(before)).toBe(true);
  });
  it('retains recorded auth mechanisms and false redaction without inferring credentials or replacing absence', async () => {
    const dir = fixture();
    expect((await readRunView(dir)).records.Run[0]).toMatchObject({ auth_type: 'header', auth_mechanisms: 'header', auth_api_kind: 'bearer', auth_redaction_applied: false });
    edit(dir, 'manifest.json', value => { delete value.auth; });
    expect((await readRunView(dir)).records.Run[0]).toMatchObject({ auth_type: 'unknown', auth_mechanisms: undefined, auth_redaction_applied: undefined });
  });
  it.each([
    ['run_manifest', 'manifest.json', 'schema_version'],
    ['a11y_report', 'artifacts/a11y_report.json', 'schema_version'],
    ['a11y_evidence', 'evidence/a11y/a11y_manifest.json', 'version'],
    ['report_index', 'artifacts/report-index.json', 'schema_version'],
  ] as const)('refuses an unknown %s version even with valid hashes', async (kind, file, field) => {
    const dir = fixture(); edit(dir, file, value => { value[field] = '99.0.0'; });
    await expect(fetchStructured({ kind, runPath: dir })).rejects.toMatchObject({ opiCode: 'OODS-N007', message: expect.stringContaining('99.0.0') });
    await expect(readRunView(dir)).rejects.toMatchObject({ opiCode: 'OODS-V213' });
  });
  it.each(['artifacts/a11y_report.json', 'artifacts/report-index.json', 'evidence/a11y/a11y_manifest.json', 'evidence/a11y/root.json'])('refuses tampered %s before presenting any record', async file => {
    const dir = fixture(); fs.appendFileSync(path.join(dir, file), ' ');
    await expect(readRunView(dir)).rejects.toMatchObject({ opiCode: 'OODS-V213', message: expect.stringContaining('attestation') });
  });
  it('refuses missing evidence and failed captures instead of returning an empty success', async () => {
    const dir = fixture(); fs.rmSync(path.join(dir, 'evidence/a11y/root.json'));
    await expect(readRunView(dir)).rejects.toMatchObject({ opiCode: 'OODS-V213' });
    fs.rmSync(path.join(dir, 'manifest.json'));
    write(path.join(dir, 'artifacts/capture-failure.json'), { error: 'capture failed' });
    await expect(readRunView(dir)).rejects.toMatchObject({ opiCode: 'OODS-V212' });
  });
  it('retains the manifest shape check and does not admit unrelated artifact kinds', async () => {
    const dir = fixture();
    await expect(fetchStructured({ kind: 'entity_catalog' as never, runPath: dir })).rejects.toBeDefined();
    edit(dir, 'manifest.json', value => { delete value.targets; });
    await expect(readRunView(dir)).rejects.toMatchObject({ opiCode: 'OODS-V212' });
  });
  it('refuses an unknown artifact result even when its index is attested', async () => {
    const dir = fixture(); edit(dir, 'artifacts/report-index.json', value => { value.artifacts[0].result_state = 'success'; });
    await expect(readRunView(dir)).rejects.toMatchObject({ opiCode: 'OODS-V213', message: expect.stringContaining('result_state') });
  });
});
