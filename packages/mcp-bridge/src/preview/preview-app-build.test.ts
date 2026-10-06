import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * The preview app build (s202-m03): one self-contained HTML file with the runtime inlined, or nothing. Without the preview
 * runtime's styles the build refuses and writes no app. With them, the width-only media queries are answered by the app's
 * frame (inside the conversation the viewport is not the app's width), every other media query stays, no CSP is declared,
 * nothing references the network, and the manifest records the bytes and digests the receipts read.
 */
const packageRoot = path.resolve(fileURLToPath(import.meta.url), '../../..');
const script = path.join(packageRoot, 'scripts/build-preview-app.mjs');
const temporary: string[] = [];
const temporaryDir = (prefix: string) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); temporary.push(dir); return dir; };
afterEach(() => { for (const dir of temporary.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
const build = (args: string[]) => spawnSync(process.execPath, [script, ...args], { cwd: packageRoot, encoding: 'utf8', timeout: 120_000 });

describe('the preview app build (s202-m03)', () => {
  it('refuses to emit the app when the preview runtime is missing, and writes nothing', () => {
    const runtimeDir = temporaryDir('oods-preview-runtime-missing-');
    const out = path.join(temporaryDir('oods-preview-app-out-'), 'preview-app');
    const run = build(['--runtime-dir', runtimeDir, '--out', out]);
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/preview runtime styles are missing .*No app was emitted/);
    expect(fs.existsSync(out)).toBe(false);
  });

  it('inlines the runtime and its styles with no CSP of its own, answers width queries from the app frame, and records sizes and digests', () => {
    const runtimeDir = temporaryDir('oods-preview-runtime-');
    fs.writeFileSync(path.join(runtimeDir, 'styles.css'), '[data-layout=sidebar]{display:grid}@media (max-width: 40rem){[data-layout=sidebar]{grid-template-columns:minmax(0,1fr)!important}}@media (forced-colors: active){.oods-badge{border-color:CanvasText}}@media (min-width: 600px){.oods-row{gap:1rem}}');
    const out = path.join(temporaryDir('oods-preview-app-out-'), 'preview-app');
    const run = build(['--runtime-dir', runtimeDir, '--out', out]);
    expect(run.status, run.stderr).toBe(0);
    const html = fs.readFileSync(path.join(out, 'app.html'), 'utf8');
    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).not.toMatch(/Content-Security-Policy/i);
    expect(html).not.toMatch(/\ssrc=["']https?:|\shref=["']https?:|url\(\s*["']?https?:/);
    // The same rules, keyed to the frame the running app is shown in; forced colors stays a media query.
    expect(html).toContain('@container oods-app (max-width: 40rem){[data-layout=sidebar]{grid-template-columns:minmax(0,1fr)!important}}');
    expect(html).toContain('@container oods-app (min-width: 600px){.oods-row{gap:1rem}}');
    expect(html).toContain('@media (forced-colors: active){.oods-badge{border-color:CanvasText}}');
    expect(html).toMatch(/container:\s*oods-app\s*\/\s*inline-size/);
    expect(manifest.styles.widthQueries).toEqual({ container: 'oods-app', rewritten: ['(max-width: 40rem)', '(min-width: 600px)'], kept: ['(forced-colors: active)'] });
    // The runtime the generated app imports is in the document, not fetched.
    expect(html).toContain('globalThis.__oodsRuntime');
    expect(manifest.runtime.specifiers).toEqual(expect.arrayContaining(['react', 'react/jsx-runtime', 'react-dom/client', 'vue', '@oods/components-react', '@oods/components-vue', '@oods/component-contracts']));
    expect(manifest.runtime.bytes).toBeGreaterThan(500_000);
    expect(manifest.bytes).toBe(Buffer.byteLength(html));
    expect(manifest.sha256).toBe(createHash('sha256').update(html).digest('hex'));
    expect(manifest.revision).toBe(manifest.sha256.slice(0, 12));
  }, 120_000);
});
