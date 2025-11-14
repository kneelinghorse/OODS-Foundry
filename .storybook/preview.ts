// Ensure design-token variables are present before any DS CSS consumes them.
import '../apps/explorer/src/styles/tokens.css';
import '../apps/explorer/src/styles/overlays.css';
import '../apps/explorer/src/styles/index.css';
import '../src/styles/globals.css';
import type { Decorator, Preview } from '@storybook/react';
import React, { useEffect } from 'react';
import * as ReactDOM from 'react-dom';

type ThemeSetting = 'light' | 'dark';
type BrandSetting = 'default' | 'brand-a' | 'brand-b';

const BRAND_STORAGE_KEY = 'oods:storybook:brand';

const DOM_BRAND_BY_SETTING: Record<BrandSetting, 'A' | 'B' | null> = {
  default: null,
  'brand-a': 'A',
  'brand-b': 'B',
};

function normaliseBrand(value: unknown): BrandSetting | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const token = value.trim().toLowerCase().replace(/[\s_]/g, '-');
  if (token === 'brand-a' || token === 'a' || token === 'branda') {
    return 'brand-a';
  }
  if (token === 'brand-b' || token === 'b' || token === 'brandb') {
    return 'brand-b';
  }
  if (token === '' || token === 'default' || token === 'unset' || token === 'base') {
    return 'default';
  }
  return undefined;
}

function readEnvBrand(): BrandSetting | undefined {
  const fromImportMeta =
    typeof import.meta !== 'undefined' && typeof import.meta.env === 'object'
      ? normaliseBrand((import.meta.env as Record<string, unknown>).STORYBOOK_BRAND)
      : undefined;
  const fromNode =
    typeof process !== 'undefined' && typeof process.env === 'object'
      ? normaliseBrand(process.env.STORYBOOK_BRAND)
      : undefined;
  return fromImportMeta ?? fromNode;
}

function readStoredBrand(): BrandSetting | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  try {
    return normaliseBrand(window.localStorage.getItem(BRAND_STORAGE_KEY));
  } catch {
    return undefined;
  }
}

function resolveInitialBrand(): BrandSetting {
  return readStoredBrand() ?? readEnvBrand() ?? 'brand-a';
}

const initialBrand = resolveInitialBrand();
const initialTheme: ThemeSetting = 'light';

function applyGlobals(theme: ThemeSetting, brand: BrandSetting): void {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const body = document.body;
  const domBrand = DOM_BRAND_BY_SETTING[brand];

  root.setAttribute('data-theme', theme);
  body.setAttribute('data-theme', theme);

  if (domBrand) {
    root.setAttribute('data-brand', domBrand);
    body.setAttribute('data-brand', domBrand);
  } else {
    root.removeAttribute('data-brand');
    body.removeAttribute('data-brand');
  }
}

function persistBrand(brand: BrandSetting): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(BRAND_STORAGE_KEY, brand);
  } catch {
    // localStorage unavailable (e.g. iframe sandbox); swallow intentionally.
  }
}

applyGlobals(initialTheme, initialBrand);

if (typeof globalThis !== 'undefined' && !(globalThis as any).__VITE_IMPORT_META_ENV__) {
  (globalThis as any).__VITE_IMPORT_META_ENV__ = import.meta.env;
}

if (typeof window !== 'undefined') {
  (window as unknown as { React?: typeof React }).React = React;
  (window as unknown as { ReactDOM?: typeof ReactDOM }).ReactDOM = ReactDOM;
}

interface GlobalsWrapperProps {
  theme: ThemeSetting;
  brand: BrandSetting;
  children: React.ReactNode;
}

const GlobalsWrapper: React.FC<GlobalsWrapperProps> = ({ theme, brand, children }) => {
  useEffect(() => {
    applyGlobals(theme, brand);
    persistBrand(brand);

    return () => {
      if (typeof document === 'undefined') {
        return;
      }
      const root = document.documentElement;
      const body = document.body;
      root.removeAttribute('data-theme');
      body.removeAttribute('data-theme');
      root.removeAttribute('data-brand');
      body.removeAttribute('data-brand');
    };
  }, [theme, brand]);

  return React.createElement(React.Fragment, null, children);
};

const preview: Preview = {
  parameters: {
    layout: 'centered',
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    options: {
      storySort: {
        order: ['Intro', 'Docs', 'Foundations', 'Components', 'Contexts', 'Domains', 'Patterns', 'Explorer', 'Brand'],
      },
      panelPosition: 'right',
    },
    chromatic: {
      modes: {
        'brand-a-light': { globals: { theme: 'light', brand: 'brand-a' } },
        'brand-a-dark': { globals: { theme: 'dark', brand: 'brand-a' } },
        'brand-b-light': { globals: { theme: 'light', brand: 'brand-b' } },
        'brand-b-dark': { globals: { theme: 'dark', brand: 'brand-b' } },
      },
    },
  },
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Toggle light/dark design tokens',
      defaultValue: initialTheme,
      toolbar: {
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
        hidden: true,
      },
    },
    brand: {
      name: 'Brand',
      description: 'Toggle design brand context',
      defaultValue: initialBrand,
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'default', title: 'Default' },
          { value: 'brand-a', title: 'Brand A' },
          { value: 'brand-b', title: 'Brand B' },
        ],
        dynamicTitle: true,
        hidden: true,
      },
    },
  },
  decorators: [
    ((Story, context) => {
      const theme = (context.globals.theme as ThemeSetting | undefined) ?? initialTheme;
      const brand = (context.globals.brand as BrandSetting | undefined) ?? initialBrand;
      return React.createElement(GlobalsWrapper, { theme, brand }, React.createElement(Story));
    }) as Decorator,
  ],
  globals: {
    brand: initialBrand,
    theme: initialTheme,
  },
};

export default preview;
