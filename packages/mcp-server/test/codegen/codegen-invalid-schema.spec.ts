import { describe, expect, it } from 'vitest';
import type { UiSchema } from '../../src/schemas/generated.js';
import { handle } from '../../src/tools/code.generate.js';

const VALID_SCHEMA: UiSchema = {
  version: '2026.03',
  screens: [{
    id: 'screen-root',
    component: 'Stack',
    children: [
      {
        id: 'primary-button',
        component: 'Button',
        props: { label: 'Save' },
      },
    ],
  }],
};

const INVALID_SCHEMA: UiSchema = {
  version: '2026.03',
  screens: [{
    id: 'screen-root',
    component: 'Stack',
    children: [
      {
        id: 'unknown-child',
        component: 'UnknownComponent',
      },
    ],
  }],
};

describe('code.generate invalid schema gating', () => {
  it('returns error status and no code for unknown components', async () => {
    const result = await handle({
      framework: 'react',
      schema: INVALID_SCHEMA,
    });

    expect(result.status).toBe('error');
    expect(result.code).toBe('');
    expect(result.errors?.[0]?.code).toBe('OODS-V119');
    expect(result.errors?.[0]?.message).toContain('UnknownComponent');
    expect(result.errors?.[0]?.message).toContain('repl.validate');
    expect(result.meta?.unknownComponents).toEqual(['UnknownComponent']);
  });

  it('continues to generate code for valid schemas', async () => {
    const result = await handle({
      framework: 'react',
      schema: VALID_SCHEMA,
    });

    expect(result.status).toBe('ok');
    expect(result.code.length).toBeGreaterThan(0);
    expect(result.errors).toBeUndefined();
    expect(result.meta?.unknownComponents).toBeUndefined();
  });
});
