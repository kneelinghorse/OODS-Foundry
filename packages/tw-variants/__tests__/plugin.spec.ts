import path from 'node:path';
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

const createHarness = () => {
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

  const pluginInstance = plugin({ tokensPath });
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
    expect(rule['--context-typography-scale-heading-lg']).toBe(
      'var(--oods-text-scale-heading-lg)',
    );
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
      'var(--oods-status-info-surface)',
    );
    expect(rule['--context-surface-status-success-surface']).toBe(
      'var(--oods-status-success-surface)',
    );
  });

  it('falls back to prefixed variables when tokens are missing', () => {
    const { mergedBase } = createHarness();
    const rule = mergedBase['.context-form [data-region="header"]'];

    expect(rule).toBeDefined();
    expect(rule['--context-spacing-inset-default']).toBe(
      'var(--oods-spacing-inset-default)',
    );
    expect(rule['--context-typography-scale-heading-lg']).toBe(
      'var(--oods-text-scale-heading-lg)',
    );
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
