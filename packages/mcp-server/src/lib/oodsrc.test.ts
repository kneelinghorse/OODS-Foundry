import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadOodsrc, clearOodsrcCache } from './oodsrc.js';

describe('oodsrc config loader', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `oodsrc-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });
    clearOodsrcCache();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    clearOodsrcCache();
  });

  describe('load', () => {
    it('loads valid .oodsrc with all fields', () => {
      const config = {
        framework: 'vue',
        styling: 'tailwind',
        typescript: false,
        brand: 'acme',
        context: 'form',
        layout: 'dashboard',
        preferences: {
          theme: 'dark',
          metricColumns: 4,
          fieldGroups: 2,
          tabCount: 3,
          tabLabels: ['Info', 'Settings', 'Advanced'],
        },
        pipeline: {
          checkA11y: true,
          compact: false,
        },
      };
      writeFileSync(join(tempDir, '.oodsrc'), JSON.stringify(config));
      const result = loadOodsrc(tempDir);

      expect(result.framework).toBe('vue');
      expect(result.styling).toBe('tailwind');
      expect(result.typescript).toBe(false);
      expect(result.brand).toBe('acme');
      expect(result.context).toBe('form');
      expect(result.layout).toBe('dashboard');
      expect(result.preferences).toEqual({
        theme: 'dark',
        metricColumns: 4,
        fieldGroups: 2,
        tabCount: 3,
        tabLabels: ['Info', 'Settings', 'Advanced'],
      });
      expect(result.pipeline).toEqual({ checkA11y: true, compact: false });
    });

    it('loads partial config', () => {
      writeFileSync(join(tempDir, '.oodsrc'), JSON.stringify({ framework: 'html' }));
      const result = loadOodsrc(tempDir);
      expect(result.framework).toBe('html');
      expect(result.styling).toBeUndefined();
      expect(result.typescript).toBeUndefined();
    });
  });

  describe('missing file', () => {
    it('returns empty config when .oodsrc does not exist', () => {
      const result = loadOodsrc(tempDir);
      expect(result).toEqual({});
    });

    it('does not throw', () => {
      expect(() => loadOodsrc(tempDir)).not.toThrow();
    });
  });

  describe('invalid JSON', () => {
    it('returns empty config for malformed JSON', () => {
      writeFileSync(join(tempDir, '.oodsrc'), '{not valid json!!!}');
      const result = loadOodsrc(tempDir);
      expect(result).toEqual({});
    });

    it('returns empty config for JSON array', () => {
      writeFileSync(join(tempDir, '.oodsrc'), '[1, 2, 3]');
      const result = loadOodsrc(tempDir);
      expect(result).toEqual({});
    });

    it('returns empty config for JSON string', () => {
      writeFileSync(join(tempDir, '.oodsrc'), '"hello"');
      const result = loadOodsrc(tempDir);
      expect(result).toEqual({});
    });

    it('returns empty config for empty file', () => {
      writeFileSync(join(tempDir, '.oodsrc'), '');
      const result = loadOodsrc(tempDir);
      expect(result).toEqual({});
    });
  });

  describe('sanitization', () => {
    it('drops unknown keys', () => {
      writeFileSync(join(tempDir, '.oodsrc'), JSON.stringify({ unknownKey: 'whatever', framework: 'react' }));
      const result = loadOodsrc(tempDir);
      expect(result.framework).toBe('react');
      expect((result as Record<string, unknown>).unknownKey).toBeUndefined();
    });

    it('drops invalid framework values', () => {
      writeFileSync(join(tempDir, '.oodsrc'), JSON.stringify({ framework: 'angular' }));
      const result = loadOodsrc(tempDir);
      expect(result.framework).toBeUndefined();
    });

    it('drops invalid styling values', () => {
      writeFileSync(join(tempDir, '.oodsrc'), JSON.stringify({ styling: 'scss' }));
      const result = loadOodsrc(tempDir);
      expect(result.styling).toBeUndefined();
    });

    it('drops non-boolean typescript', () => {
      writeFileSync(join(tempDir, '.oodsrc'), JSON.stringify({ typescript: 'yes' }));
      const result = loadOodsrc(tempDir);
      expect(result.typescript).toBeUndefined();
    });

    it('drops out-of-range metricColumns', () => {
      writeFileSync(join(tempDir, '.oodsrc'), JSON.stringify({ preferences: { metricColumns: 99 } }));
      const result = loadOodsrc(tempDir);
      expect(result.preferences).toBeUndefined();
    });

    it('drops invalid context values', () => {
      writeFileSync(join(tempDir, '.oodsrc'), JSON.stringify({ context: 'dashboard' }));
      const result = loadOodsrc(tempDir);
      expect(result.context).toBeUndefined();
    });

    it('drops invalid layout values', () => {
      writeFileSync(join(tempDir, '.oodsrc'), JSON.stringify({ layout: 'grid' }));
      const result = loadOodsrc(tempDir);
      expect(result.layout).toBeUndefined();
    });
  });

  describe('override precedence', () => {
    it('explicit params should be preferred over .oodsrc (integration pattern)', () => {
      // This tests the pattern used in tool handlers:
      // input.framework ?? rc.framework ?? 'react'
      writeFileSync(join(tempDir, '.oodsrc'), JSON.stringify({ framework: 'vue', styling: 'tailwind' }));
      const rc = loadOodsrc(tempDir);

      // Simulate explicit input overriding .oodsrc
      const explicitFramework = 'html';
      const resolved = explicitFramework ?? rc.framework ?? 'react';
      expect(resolved).toBe('html');

      // Simulate no explicit input — falls through to .oodsrc
      const noExplicit = undefined;
      const resolved2 = noExplicit ?? rc.framework ?? 'react';
      expect(resolved2).toBe('vue');
    });
  });

  describe('caching', () => {
    it('returns cached config on second call to same path', () => {
      writeFileSync(join(tempDir, '.oodsrc'), JSON.stringify({ framework: 'vue' }));
      const first = loadOodsrc(tempDir);
      // Overwrite file — cache should still return the original
      writeFileSync(join(tempDir, '.oodsrc'), JSON.stringify({ framework: 'html' }));
      const second = loadOodsrc(tempDir);
      expect(first).toBe(second); // Same object reference
      expect(second.framework).toBe('vue');
    });

    it('clearOodsrcCache forces re-read', () => {
      writeFileSync(join(tempDir, '.oodsrc'), JSON.stringify({ framework: 'vue' }));
      loadOodsrc(tempDir);
      clearOodsrcCache();
      writeFileSync(join(tempDir, '.oodsrc'), JSON.stringify({ framework: 'html' }));
      const result = loadOodsrc(tempDir);
      expect(result.framework).toBe('html');
    });
  });
});
