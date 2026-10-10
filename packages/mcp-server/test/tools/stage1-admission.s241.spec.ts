import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { handle as fetchStructured } from '../../src/tools/structuredData.fetch.js';
import { readRunView } from '../../src/lib/run-view.js';
import { readComparisonView } from '../../src/lib/comparison-view.js';

const temps: string[] = [];
afterAll(() => { for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true }); });
function fixture(kind: 'run' | 'analysis', change: (file: string, data: any) => void = () => {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 's241-stage1-')); temps.push(dir);
  fs.cpSync(fileURLToPath(new URL(`../fixtures/stage1-0.4.0-${kind}`, import.meta.url)), dir, { recursive: true });
  const read = (file: string) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const write = (file: string, data: any) => fs.writeFileSync(path.join(dir, file), JSON.stringify(data));
  const manifest = read('manifest.json'); manifest.schema_version = '1.8.0';
  for (const file of Object.keys(manifest.hashes)) {
    const data = read(file);
    if (file.endsWith('a11y_report.json')) { data.schema_version = '3.0.0'; delete data.rollup.accessibility_score; }
    if (file.endsWith('drift_report.json')) {
      data.schema_version = '2.0.0';
      const shadow = data.value_join.families.find((row: any) => row.family === 'shadow');
      shadow.eligibility = { effect_style_values: 1, stroke_color_values: 19 };
      shadow.resolutions = [{ live_value: '#005ea2 0px 0px 0px 2px inset', detail: { stroke: { color: '#005ea2', x: 0, y: 0, blur: 0, spread: 2, inset: true } } }];
    }
    if (file.endsWith('style_fingerprint.json')) data.schema_version = '1.4.0';
    if (file.endsWith('fig_local_tokens.json')) {
      data.version = '1.6.0';
      data.collections = [{ name: 'Theme', modes: ['Light'], default_mode: 'Light', default_mode_basis: 'first_mode', soft_deleted: false }];
      data.tokens.push({ name: 'retained-alias', kind: 'color', collection: 'Theme', scopes: ['STROKE_COLOR'], soft_deleted: true, values: [{ mode: 'Light', value: '#005ea2', reference: { target_handle: '1:2', target_name: 'blue', target_collection: 'Theme', target_state: 'in_file' } }] });
    }
    change(file, data); write(file, data);
    manifest.hashes[file] = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, file))).digest('hex');
  }
  if (manifest.analysis) {
    manifest.analysis.stage1_version = '0.6.0';
    manifest.analysis.source.manifest_sha256 = manifest.hashes[manifest.analysis.source.manifest_path];
    for (const input of manifest.analysis.inputs) input.sha256 = manifest.hashes[input.path];
  }
  change('manifest.json', manifest); write('manifest.json', manifest); return dir;
}

describe('Stage1 0.6.0 contracts retain facts without inventing scores (s241)', () => {
  it('keeps an absent accessibility score absent while preserving severity counts', async () => {
    const view = await readRunView(fixture('run'));
    expect(view.kinds).toMatchObject({ run_manifest: '1.8.0', a11y_report: '3.0.0' });
    expect(view.records.Run[0].accessibility_score).toBeUndefined();
    expect(view.records.Run[0].serious_count).toBe(0);
    expect(view.records.Run[0].needs_review_count).toBe(1);
  });
  it('retains mode references and deletion metadata and describes the recorded stroke, without regrading it', () => {
    const view = readComparisonView(fixture('analysis'));
    expect(view.admitted.figTokens?.tokens.at(-1)).toMatchObject({ soft_deleted: true, scopes: ['STROKE_COLOR'], values: [{ mode: 'Light', reference: { target_name: 'blue' } }] });
    expect(view.admitted.figTokens?.collections[0].default_mode).toBe('Light');
    expect(view.records.Comparison[0].measurement_basis).toContain('Drift report 2.0.0');
    expect(view.records.Comparison[0].other_families).toContain('1 effect styles; 19 stroke colors');
    expect(view.records.Comparison[0].other_families).toContain('#005ea2, 0px/0px offset, 0px blur, 2px spread, inset');
    expect(view.records.ComparisonSignal[0].severity).toBeTruthy();
  });
  it('accepts measured presence with zero value signals, but does not silently turn absence into measurement', () => {
    const zero = (presence: boolean) => fixture('analysis', (file, data) => {
      if (file.endsWith('drift_report.json')) { data.signals = []; if (presence) data.declared_presence = { state: 'measured' }; }
    });
    expect(readComparisonView(zero(true)).admitted.resultState).toBe('measured');
    expect(() => readComparisonView(zero(false))).toThrow('result state contradicts');
  });
  it.each([
    ['drift_report.json', 'schema_version', '2.1.0'],
    ['fig_local_tokens.json', 'version', '1.7.0'],
    ['style_fingerprint.json', 'schema_version', '1.5.0'],
  ])('refuses unknown %s versions with the admitted versions named', (file, key, version) => {
    expect(() => readComparisonView(fixture('analysis', (name, data) => { if (name.endsWith(file)) data[key] = version; }))).toThrow(/accepted:/);
  });
  it('refuses an unknown capture version before opening the view', async () => {
    await expect(fetchStructured({ kind: 'run_manifest', runPath: fixture('run', (file, data) => { if (file === 'manifest.json') data.schema_version = '1.9.0'; }) })).rejects.toThrow(/Accepted:/);
  });
});
