import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Sprint 201 m06 — the 390px paginator split (#2046): the count and range broke across the
// page controls. Below 600px the bar is a two-row grid; the controls stay together on row two.
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(packageRoot, 'src/components.css'), 'utf8');

describe('PaginationBar narrow layout', () => {
  it('lays the bar out as a two-row grid under 600px with the page controls on one row', () => {
    const block = /@media \(max-width: 600px\) \{\s*:where\(\[data-oods-component='PaginationBar'\]\) \{([^}]*)\}([\s\S]*?)\n\}/.exec(css);
    expect(block, 'narrow PaginationBar media block').toBeTruthy();
    expect(block![1]).toMatch(/display:\s*grid/);
    expect(block![1]).toMatch(/grid-template-areas:\s*'count count range range' 'prev pages next current'/);
    for (const area of ['count', 'range', 'prev', 'pages', 'next', 'current']) expect(block![2]).toContain(`grid-area: ${area};`);
  });

  it('ships the same rule in the built stylesheet', () => {
    const built = path.join(packageRoot, 'dist/components.css');
    if (!fs.existsSync(built)) return;
    expect(fs.readFileSync(built, 'utf8')).toContain("grid-template-areas: 'count count range range' 'prev pages next current'");
  });
});
