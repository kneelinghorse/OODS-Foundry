import { vi } from 'vitest';
import { renderDesignLab, validateDesignLab } from '../src/rendererClient.js';
import { sampleSchema } from '../src/sampleSchema.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('rendererClient', () => {
  it('invokes the MCP renderer and returns preview metadata', async () => {
    const result = await renderDesignLab({ schema: sampleSchema });
    expect(result.status).toBe('ok');

    const output = result.status === 'ok' ? result.output : null;
    expect(output).not.toBeNull();
    expect(output?.preview?.screens).toContain('audit-screen');
    expect(Array.isArray(output?.errors)).toBe(true);
    expect(Array.isArray(output?.warnings)).toBe(true);
  });

  it('validates a schema and surfaces structured output', async () => {
    const result = await validateDesignLab({ schema: sampleSchema });
    expect(result.status).toBe('ok');

    const output = result.status === 'ok' ? result.output : null;
    expect(output?.status).toMatch(/ok|invalid/);
    expect(Array.isArray(output?.errors)).toBe(true);
    expect(Array.isArray(output?.warnings)).toBe(true);
    expect(output?.mode).toBe('full');
  });

  it('returns structured errors for unknown components without throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const badSchema = {
      ...sampleSchema,
      screens: [{ ...(sampleSchema.screens?.[0] || {}), component: 'UnknownWidget' }]
    };

    const result = await renderDesignLab({ schema: badSchema });
    expect(result.status).toBe('ok');

    const output = result.status === 'ok' ? result.output : null;
    expect(output?.status).toBe('error');
    expect(output?.errors.some((issue) => issue.code === 'UNKNOWN_COMPONENT')).toBe(true);
    expect(output?.meta?.missingComponents).toContain('UnknownWidget');
    expect(output?.renderedTree?.screens?.[0]?.component).toBe('UnknownWidget');
    expect(warn).toHaveBeenCalled();
  });

  it('surfaces patch errors when no base tree is provided', async () => {
    const result = await renderDesignLab({
      mode: 'patch',
      patch: [{ op: 'replace', path: '/screens/0/component', value: 'AuditTimeline' }]
    });
    expect(result.status).toBe('ok');

    const output = result.status === 'ok' ? result.output : null;
    expect(output?.status).toBe('error');
    expect(output?.errors.map((issue) => issue.code)).toContain('MISSING_BASE_TREE');
  });

  it('flags schema validation issues for unknown properties', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const invalidSchema = {
      ...sampleSchema,
      screens: [{ ...(sampleSchema.screens?.[0] || {}), layout: { type: 'unknown' } }]
    };

    const result = await validateDesignLab({ schema: invalidSchema });
    expect(result.status).toBe('ok');

    const output = result.status === 'ok' ? result.output : null;
    expect(output?.status).toBe('invalid');
    expect(output?.errors.some((issue) => issue.code === 'DSL_SCHEMA')).toBe(true);
    expect(output?.errors.some((issue) => String(issue.path).includes('/screens/0/layout/type'))).toBe(true);
    expect(warn).toHaveBeenCalled();
  });
});
