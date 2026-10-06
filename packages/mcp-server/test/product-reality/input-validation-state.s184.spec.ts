import { describe, expect, it } from 'vitest';

import type { UiSchema } from '../../src/schemas/generated.js';
import { handle as generateCode } from '../../src/tools/code.generate.js';

const FRAMEWORKS = ['react', 'vue'] as const;
const VALIDATION_STATES = ['error', 'success'] as const;

function inputSchema(state: typeof VALIDATION_STATES[number]): UiSchema {
  return {
    version: '1.0',
    screens: [{
      id: `input-validation-${state}`,
      component: 'Input',
      props: {
        id: `email-${state}`,
        label: 'Email',
        value: state === 'error' ? 'invalid' : 'owner@example.com',
        validation: {
          state,
          message: state === 'error' ? 'Enter a valid email.' : 'Email is valid.',
        },
      },
    }],
  };
}

describe('Sprint 184 Input validation-state regression pin', () => {
  it.each(FRAMEWORKS.flatMap((framework) => (
    VALIDATION_STATES.map((state) => ({ framework, state }))
  )))('$framework preserves the pre-existing Input validation state $state at build', async ({
    framework,
    state,
  }) => {
    const schema = inputSchema(state);
    expect(schema.screens[0]).not.toHaveProperty('state');

    const result = await generateCode({ framework, profile: 'build', schema });

    expect(result.status, JSON.stringify(result.errors ?? [])).toBe('ok');
    expect(result.code.length).toBeGreaterThan(0);
    expect(result.artifact).toBeDefined();
    expect(result.artifact?.files[0]?.contents.length).toBeGreaterThan(0);
    expect(result.errors ?? []).toEqual([]);
    expect(result.validationReceipt.checks.filter((check) => check === 'state-contract'))
      .toHaveLength(1);
  });
});
