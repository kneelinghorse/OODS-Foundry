/**
 * s221-m03 (the website's defect (a), message a232e944): what a11y.scan advertises is what a11y.scan.ts does. Since
 * Sprint 216 it grades the text and icon pairs the shared component stylesheet declares, in every built brand and
 * theme, and with a UiSchema renders the screen and checks its document rules (src/a11y/built-screen.ts). 0.3.2's
 * description and the README still described 18 fixed pairs from the legacy structured-data token export.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SCREEN_RULES } from '../../src/a11y/built-screen.js';

const root = path.resolve(fileURLToPath(import.meta.url), '../../../../..');
const advertised = (JSON.parse(fs.readFileSync(path.join(root, 'packages/mcp-adapter/tool-descriptions.json'), 'utf8')) as Record<string, string>)['a11y.scan']!;
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8').split('\n').filter(line => line.includes('a11y_scan')).join('\n');
const reference = fs.readFileSync(path.join(root, 'packages/foundry/TOOL-REFERENCE.md'), 'utf8').split('## a11y_scan\n')[1]!.split('\n## ')[0]!;
const STALE = /18 fixed|legacy `?tokens\/|structured-data token export|inspects? no screen|2\.68:1/;
// Each of the checker's screen rules, as the description words it.
const RULE_WORDS: Record<(typeof SCREEN_RULES)[number], RegExp> = {
  'document-language': /document language/, 'document-title': /title/, 'main-landmark': /main landmark/, 'unique-id': /unique IDs/,
  'aria-reference': /ARIA reference/, 'control-name': /control names/, 'image-alt': /image alternatives/,
  'svg-name-description': /chart SVG names? and descriptions?/, 'heading-name-order': /heading/,
};

describe('a11y.scan says what it checks (s221-m03)', () => {
  it('no longer describes the legacy token export', () => {
    expect(advertised).not.toMatch(STALE);
    expect(readme).not.toMatch(STALE);
    expect(reference).not.toMatch(STALE);
    // s239 (#2743): descriptions link the tool's full schema instead of TOOL-REFERENCE.md, a file the model cannot open.
    expect(advertised).toContain('Full schema: oods://schemas/a11y_scan.input.json');
  });

  it('names the declared component pairs, their thresholds and the built scopes', () => {
    expect(reference).toMatch(/component stylesheet declares/);
    expect(reference).toMatch(/4\.5:1/);
    expect(reference).toMatch(/3:1/);
    expect(reference).toMatch(/every built brand and theme/);
    expect(readme).toMatch(/component stylesheet/);
  });

  it('names every screen rule the checker runs', () => {
    expect(SCREEN_RULES).toHaveLength(9);
    for (const rule of SCREEN_RULES) expect(reference, rule).toMatch(RULE_WORDS[rule]);
  });
});
