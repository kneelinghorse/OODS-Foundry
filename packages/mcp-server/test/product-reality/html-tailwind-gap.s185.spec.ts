import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearOodsrcCache } from '../../src/lib/oodsrc.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { handle } from '../../src/tools/code.generate.js';

const schema: UiSchema = {
  version: '1.0',
  screens: [{ id: 'styling-proof', component: 'Text', props: { content: 'Styling contract' } }],
};
const gap = {
  code: 'OODS-N018',
  message: 'HTML Tailwind styling is unavailable; the HTML target emits document CSS. Use tokens or inline, or choose React or Vue for Tailwind output.',
};

afterEach(() => {
  vi.restoreAllMocks();
  clearOodsrcCache();
});

describe('Sprint 185 HTML Tailwind requests disclose the actual target gap', () => {
  it('draft retains document output with a typed warning', async () => {
    const result = await handle({ schema, framework: 'html', profile: 'draft', options: { styling: 'tailwind' } });
    expect(result.status).toBe('ok');
    expect(result.errors ?? []).toEqual([]);
    expect(result.warnings).toEqual([gap]);
    expect(result.code).toContain('<!DOCTYPE html>');
    expect(result.code).toContain('Styling contract');
    expect(result.artifact?.files[0]?.contents).toBe(result.code);
    expect(result.validationReceipt?.axes.enforcement).toBe('advisory');
  });

  it.each([undefined, 'build', 'release'] as const)('%s blocks before publishing an unsupported artifact', async (profile) => {
    const result = await handle({ schema, framework: 'html', profile, options: { styling: 'tailwind' } });
    expect(result.status).toBe('error');
    expect(result.errors).toEqual([gap]);
    expect(result.warnings).toEqual([]);
    expect(result.code).toBe('');
    expect(result.imports).toEqual([]);
    expect(result.artifact).toBeUndefined();
    expect(result.validationReceipt).toMatchObject({ profile: profile ?? 'build', defaulted: profile === undefined });
    expect(result.validationReceipt?.checks).toContain('target-readiness');
  });

  it.each(['inline', 'tokens'] as const)('HTML %s remains supported', async (styling) => {
    const result = await handle({ schema, framework: 'html', options: { styling } });
    expect(result.status).toBe('ok');
    expect(result.errors ?? []).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.artifact).toBeDefined();
  });

  it.each(['react', 'vue'] as const)('%s Tailwind remains supported', async (framework) => {
    const result = await handle({ schema, framework, options: { styling: 'tailwind' } });
    expect(result.status, JSON.stringify(result.errors ?? [])).toBe('ok');
    expect([...result.warnings, ...(result.errors ?? [])].some(({ code }) => code === gap.code)).toBe(false);
    expect(result.artifact).toBeDefined();
  });

  it('checks the resolved .oodsrc fallback while respecting an explicit styling override', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'oods-s185-html-tailwind-'));
    try {
      writeFileSync(path.join(root, '.oodsrc'), JSON.stringify({ styling: 'tailwind' }));
      // Spy on cwd only: use the real config loader and file without changing
      // the process directory used by registry/policy modules in other tests.
      vi.spyOn(process, 'cwd').mockReturnValue(root);
      clearOodsrcCache();
      const fallback = await handle({ schema, framework: 'html' });
      expect(fallback.errors).toEqual([gap]);
      expect(fallback.artifact).toBeUndefined();
      const explicit = await handle({ schema, framework: 'html', options: { styling: 'tokens' } });
      expect(explicit.status, JSON.stringify(explicit.errors ?? [])).toBe('ok');
      expect(explicit.warnings).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
