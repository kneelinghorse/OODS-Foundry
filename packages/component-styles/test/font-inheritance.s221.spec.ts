/**
 * s221-m02 (#2482 ruling 6): DM Sans ships in @oods/tokens, so every control that shows text must render in it. A
 * browser's own <button> takes the platform's font (Arial at 13.33px in Linux Chromium) unless a rule says otherwise.
 * The font audit of the m02 captures found two component buttons with no font rule: SortIndicator's and a Table's row
 * action (the record name every generated list shows). Each must inherit the page's font.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/components.css'), 'utf8');
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selectors, body]) => ({ selectors: selectors.trim(), body }));

describe('component buttons take the page font (s221-m02)', () => {
  it.each(['.oods-sort-indicator button', '.oods-table-row-action'])('%s inherits the font', (selector) => {
    const inheriting = rules.filter((rule) => rule.selectors.includes(selector) && /(?:^|[;\s])font:\s*inherit\s*;/.test(rule.body));
    expect(inheriting.map((rule) => rule.selectors)).not.toEqual([]);
  });
});
