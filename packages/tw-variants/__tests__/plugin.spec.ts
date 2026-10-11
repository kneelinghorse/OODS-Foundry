import path from 'node:path';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import type { PluginAPI } from 'tailwindcss/types/config';
import plugin from '../src/index.js';

type VariantCall = {
  name: string;
  handler: (api: {
    modifySelectors: (modifier: (details: { className: string }) => string) => void;
    separator: string;
  }) => void;
};

type BaseCall = Record<string, Record<string, string>>;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tokensPath = path.resolve(
  __dirname,
  '../../tokens/dist/tailwind/tokens.json',
);

const temporary: string[] = [];
afterEach(() => temporary.splice(0).forEach(directory => rmSync(directory, { recursive: true })));
const tokenFixture = (flat: Record<string, { cssVariable: string }>) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'tw-variants-'));
  temporary.push(directory);
  const file = path.join(directory, 'tokens.json');
  writeFileSync(file, JSON.stringify({ prefix: 'test', flat }));
  return file;
};

const createHarness = (source = tokensPath) => {
  const addBaseCalls: BaseCall[] = [];
  const addVariantCalls: VariantCall[] = [];

  const api: Partial<PluginAPI> = {
    addBase: (rules) => {
      addBaseCalls.push(rules as BaseCall);
    },
    addVariant: (name, handler) => {
      addVariantCalls.push({
        name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        handler: handler as VariantCall['handler'],
      });
    },
    e: (value: string) => value.replace(/:/g, '\\:'),
  };

  const pluginInstance = plugin({ tokensPath: source });
  const handler = typeof pluginInstance === 'function'
    ? pluginInstance
    : (pluginInstance as { handler: (api: PluginAPI) => void }).handler;

  handler(api as PluginAPI);

  const mergedBase = addBaseCalls.reduce<BaseCall>((acc, entry) => ({
    ...acc,
    ...entry,
  }), {});

  return { mergedBase, addVariantCalls };
};

describe('@oods/tw-variants plugin', () => {
  it('generates context-specific CSS variables for direct token matches', () => {
    const { mergedBase } = createHarness();
    const rule = mergedBase['.context-list [data-region="header"]'];

    expect(rule).toBeDefined();
    expect(rule['--context-spacing-inset-compact']).toBe(
      'var(--oods-spacing-inset-compact)',
    );
    // A typography composite expands into real scalar CSS properties.
    for (const property of ['font-family', 'font-size', 'font-weight', 'letter-spacing', 'line-height']) {
      expect(rule[`--context-typography-scale-heading-lg-${property}`]).toBe(
        `var(--oods-text-scale-heading-lg-${property})`,
      );
    }
    expect(rule['--context-typography-line-height-tight']).toBe(
      'var(--oods-text-line-height-tight)',
    );
  });

  it('expands wildcard token expressions across the token map', () => {
    const { mergedBase } = createHarness();
    const rule =
      mergedBase['.context-detail [data-region="statusBanner"]'];

    expect(rule).toBeDefined();
    expect(rule['--context-surface-status-info-surface']).toBe(
      'var(--oods-sys-status-info-surface)',
    );
    expect(rule['--context-surface-status-success-surface']).toBe(
      'var(--oods-sys-status-success-surface)',
    );
  });

  it('falls back to prefixed variables when tokens are missing', () => {
    const { mergedBase } = createHarness(tokenFixture({}));
    const rule = mergedBase['.context-form [data-region="header"]'];

    expect(rule).toBeDefined();
    expect(rule['--context-spacing-inset-default']).toBe(
      'var(--test-spacing-inset-default)',
    );
    expect(rule['--context-typography-scale-heading-lg']).toBe(
      'var(--test-text-scale-heading-lg)',
    );
  });

  it('keeps an explicit semantic token ahead of its system alias', () => {
    const { mergedBase } = createHarness(tokenFixture({
      'sys-surface-default': { cssVariable: '--system-surface' },
      'surface-default': { cssVariable: '--team-surface' },
    }));
    expect(mergedBase['.context-list [data-region="header"]']['--context-surface-default']).toBe('var(--team-surface)');
  });

  it('registers composable context and region variants', () => {
    const { addVariantCalls } = createHarness();

    const detailVariant = addVariantCalls.find((call) => call.name === 'detail');
    const bodyVariant = addVariantCalls.find((call) => call.name === 'body');

    expect(detailVariant).toBeDefined();
    expect(bodyVariant).toBeDefined();

    let detailSelector = '';
    detailVariant?.handler({
      modifySelectors: (modifier) => {
        detailSelector = modifier({ className: 'gap-4' });
      },
      separator: ':',
    });
    expect(detailSelector).toBe('.context-detail .detail\\:gap-4');

    let bodySelector = '';
    bodyVariant?.handler({
      modifySelectors: (modifier) => {
        bodySelector = modifier({ className: 'gap-4' });
      },
      separator: ':',
    });
    expect(bodySelector).toBe('[data-region="body"] .body\\:gap-4');
  });

  it('throws when tokensPath is missing', () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (plugin as any)();
    }).toThrow(/tokensPath option/);
  });
});
