import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PORTED_COMPONENT_STYLE_IDS } from '../src/ported.js';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(packageRoot, 'src/components-ported.css'), 'utf8');
const rootCss = fs.readFileSync(path.join(packageRoot, 'src/components.css'), 'utf8');

describe('Sprint 184 ported component style contract', () => {
  it('preserves the historical eight-family stylesheet for old evidence references', () => {
    expect(PORTED_COMPONENT_STYLE_IDS).toEqual([
      'StatusBadge',
      'PriceBadge',
      'StatusTimeline',
      'AuditTimeline',
      'CancellationSummary',
      'SearchInput',
      'PaginationBar',
      'RelativeTimestamp',
    ]);
    for (const id of PORTED_COMPONENT_STYLE_IDS) {
      expect(css, id).toContain(`[data-oods-component='${id}']`);
    }
  });

  it('publishes one canonical stylesheet through css only, containing the former eight and statusables', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
    // Sprint 200 m04 retired ./css-ported and ./ported with no migration window (#2062).
    expect(Object.keys(manifest.exports)).toEqual(['.', './css', './package.json']);
    expect(manifest.exports['./css']).toEqual({ types: './dist/css.d.ts', default: './dist/components.css' });
    for (const id of PORTED_COMPONENT_STYLE_IDS) {
      expect(rootCss, id).toContain(`[data-oods-component='${id}']`);
    }
    expect(rootCss.match(/@import "@oods\/tokens\/css";/g)).toHaveLength(1);
    expect(rootCss.match(/@import "\.\/statusables\.css";/g)).toHaveLength(1);
    const rules = css.split('\n').filter(line => !line.startsWith('@import')).join('\n').trim();
    expect(rootCss.split(rules)).toHaveLength(2);
  });

  it('packages the previously orphaned statusable rules in the historical stylesheet', () => {
    expect(css).toContain('@import "./statusables.css"');
    const statusables = fs.readFileSync(path.join(packageRoot, '../../src/styles/statusables.css'), 'utf8');
    expect(statusables).toContain('.statusable-badge');
  });

  it('keeps token and forced-color styling in the additive stylesheet', () => {
    expect(css).toContain('@import "@oods/tokens/css"');
    expect(css).toMatch(/var\(--cmp-/);
    expect(css).toMatch(/@media \(forced-colors: active\)[\s\S]*forced-color-adjust: none/);
  });
});
