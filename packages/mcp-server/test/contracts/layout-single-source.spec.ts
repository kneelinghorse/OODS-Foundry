/**
 * Layout single-source contract (s107-m02).
 *
 * The layout vocabulary had drifted across 7+ hand-maintained sites: s106-m04
 * added `landing` to design.compose but pipeline.ts / pipeline.input.json /
 * generated.ts never got it, so pipeline(layout='landing') was AJV-rejected
 * while design.compose(landing) worked.
 *
 * The fix exports ONE LayoutType / LAYOUT_INPUT_VALUES (src/compose/layout-types.ts)
 * consumed at every TS site; this test pins the two AJV input enums to that
 * single source so any future drift (add/remove/reorder a layout in one place
 * only) fails CI — making "add a layout" one edit in layout-types.ts plus the
 * compile-enforced exhaustive maps in design.compose.
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LAYOUT_TYPES, LAYOUT_INPUT_VALUES } from '../../src/compose/layout-types.js';
import { handle as composeHandle } from '../../src/tools/design.compose.js';
import { handle as pipelineHandle } from '../../src/tools/pipeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMAS_DIR = path.resolve(__dirname, '../../src/schemas');

function layoutEnum(schemaFile: string): unknown {
  const schema = JSON.parse(fs.readFileSync(path.join(SCHEMAS_DIR, schemaFile), 'utf8'));
  return schema?.properties?.layout?.enum;
}

describe('layout single-source (s107-m02)', () => {
  const expected = [...LAYOUT_INPUT_VALUES];

  it("LAYOUT_INPUT_VALUES is the real layouts plus the 'auto' sentinel", () => {
    expect(expected).toEqual([...LAYOUT_TYPES, 'auto']);
    // 'auto' is input-only — never a real template.
    expect(LAYOUT_TYPES as readonly string[]).not.toContain('auto');
  });

  it('design.compose.input.json layout enum is pinned to the single source', () => {
    expect(layoutEnum('design.compose.input.json')).toEqual(expected);
  });

  it('pipeline.input.json layout enum is pinned to the single source (the s106-review gap)', () => {
    const enumValues = layoutEnum('pipeline.input.json');
    expect(enumValues).toEqual(expected);
    // Explicit regression on the exact bug: landing must be an accepted input.
    expect(enumValues as string[]).toContain('landing');
  });

  it('the compose and pipeline AJV layout enums are identical (no drift between the verbs)', () => {
    expect(layoutEnum('design.compose.input.json')).toEqual(layoutEnum('pipeline.input.json'));
  });

  it('pipeline(layout="landing") routes to the landing template, matching design.compose', async () => {
    const composed = await composeHandle({ intent: 'a landing page for our product', layout: 'landing' });
    expect(composed.status).toBe('ok');
    expect(composed.layout).toBe('landing');

    const piped = await pipelineHandle({
      intent: 'a landing page for our product',
      layout: 'landing',
      framework: 'html',
      options: { skipValidation: true, skipRender: true },
    });
    expect(piped.error).toBeUndefined();
    expect(piped.compose.layout).toBe('landing');
  });
});
