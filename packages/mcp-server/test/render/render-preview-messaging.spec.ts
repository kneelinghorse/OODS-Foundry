import { describe, expect, it } from 'vitest';
import type { UiSchema } from '../../src/schemas/generated.js';
import { handle } from '../../src/tools/repl.render.js';

const VALID_SCHEMA: UiSchema = {
  version: '2026.03',
  screens: [{
    id: 'screen-root',
    component: 'Stack',
    children: [{
      id: 'primary-button',
      component: 'Button',
      props: { label: 'Save' },
    }],
  }],
};

const INVALID_SCHEMA: UiSchema = {
  version: '2026.03',
  screens: [{
    id: 'screen-root',
    component: 'Stack',
    children: [{
      id: 'unknown-node',
      component: 'UnknownComponent',
    }],
  }],
};

describe('repl.render preview messaging', () => {
  it('uses a ready summary for valid schemas', async () => {
    const result = await handle({ schema: VALID_SCHEMA, apply: true });

    expect(result.status).toBe('ok');
    expect(result.preview?.summary).toBe('Render ready for 1 screen');
    expect(result.html).toContain('<html');
    expect(result.warnings.some(issue => issue.code === 'OODS-W003')).toBe(false);
  });

  // s211-m01: a dry run said "ready" and returned no HTML, and nothing said why.
  it('says a dry run renders no HTML, and how to get it, in a warning and in the summary', async () => {
    const result = await handle({ schema: VALID_SCHEMA });

    expect(result.status).toBe('ok');
    expect(result.html).toBeUndefined();
    expect(result.preview?.summary).toBe('Render ready for 1 screen; dry run, so no HTML: pass apply: true to render it');
    expect(result.warnings).toContainEqual({ code: 'OODS-W003', message: 'Dry run: the schema validated, but no HTML was rendered. Pass apply: true to get the document, or fragments with output.format "fragments".' });
    // A blocked schema is not a dry run: its errors are the reason there is no HTML.
    const blocked = await handle({ schema: INVALID_SCHEMA });
    expect(blocked.warnings.some(issue => issue.code === 'OODS-W003')).toBe(false);
  });

  it('reports non-strict V006 reclassification explicitly using the existing invalid fixture', async () => {
    const result = await handle({ schema: INVALID_SCHEMA, apply: true, output: { format: 'fragments', strict: false } });
    expect(result.warnings.some(issue => issue.code === 'OODS-W002' && issue.message.includes('1 OODS-V006'))).toBe(true);
    // With no known siblings this existing fixture still has no renderable fragments.
    expect(result.status).toBe('error');
    expect(result.errors.find(issue => issue.code === 'OODS-V006')?.path).toBe('/fragments/unknown-node');
    const strict = await handle({ schema: INVALID_SCHEMA, apply: true, output: { format: 'fragments', strict: true } });
    expect(strict.status).toBe('error');
    expect(strict.warnings.some(issue => issue.code === 'OODS-W002')).toBe(false);
  });

  it('uses a blocked summary for invalid schemas', async () => {
    const result = await handle({ schema: INVALID_SCHEMA });

    expect(result.status).toBe('error');
    expect(result.preview?.summary).toBe('Render blocked: 1 validation error');
    expect(result.errors.some((issue) => issue.code === 'OODS-V006')).toBe(true);
  });
});
