import '../src/styles/globals.css';
import type { Decorator, Preview } from '@storybook/react';
import React, { useEffect } from 'react';
import * as ReactDOM from 'react-dom';

type Brand = 'A' | 'B';
type BrandSetting = Brand | 'unset';

const BRAND_STORAGE_KEY = 'oods:storybook:brand';

function normaliseBrand(value: unknown): BrandSetting | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const upper = value.trim().toUpperCase();
  if (upper === 'A' || upper === 'B') {
    return upper as Brand;
  }
  if (upper === 'UNSET') {
    return 'unset';
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

function resolveInitialBrand(): BrandSetting {
  const stored =
    typeof window !== 'undefined'
      ? normaliseBrand(window.localStorage.getItem(BRAND_STORAGE_KEY))
      : undefined;
  return stored ?? readEnvBrand() ?? 'A';
}

const initialBrand = resolveInitialBrand();

// Apply initial theme/brand attributes ASAP to avoid unstyled flashes
if (typeof document !== 'undefined') {
  const root = document.documentElement;
  const body = document.body;
  const initialTheme = 'light';
  root.setAttribute('data-theme', initialTheme);
  body.setAttribute('data-theme', initialTheme);
  const effectiveBrand = initialBrand === 'unset' ? null : initialBrand;
  if (effectiveBrand) {
    root.setAttribute('data-brand', effectiveBrand);
    body.setAttribute('data-brand', effectiveBrand);
  }
}

if (typeof globalThis !== 'undefined' && !(globalThis as any).__VITE_IMPORT_META_ENV__) {
  (globalThis as any).__VITE_IMPORT_META_ENV__ = import.meta.env;
}

if (typeof window !== 'undefined') {
  (window as unknown as { React?: typeof React }).React = React;
  (window as unknown as { ReactDOM?: typeof ReactDOM }).ReactDOM = ReactDOM;
}

interface GlobalsWrapperProps {
  theme: string;
  brand: BrandSetting;
  children: React.ReactNode;
}

const GlobalsWrapper: React.FC<GlobalsWrapperProps> = ({ theme, brand, children }) => {
  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const root = document.documentElement;
    const body = document.body;

    root.setAttribute('data-theme', theme);
    body.setAttribute('data-theme', theme);
    const effectiveBrand = brand === 'unset' ? null : brand;

    if (effectiveBrand) {
      root.setAttribute('data-brand', effectiveBrand);
      body.setAttribute('data-brand', effectiveBrand);
    } else {
      root.removeAttribute('data-brand');
      body.removeAttribute('data-brand');
    }

    if (typeof window !== 'undefined') {
      if (effectiveBrand) {
        window.localStorage.setItem(BRAND_STORAGE_KEY, effectiveBrand);
      } else {
        window.localStorage.removeItem(BRAND_STORAGE_KEY);
      }
    }

    return () => {
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
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    chromatic: {
      modes: {
        'brand-a-light': { globals: { theme: 'light', brand: 'A' } },
        'brand-a-dark': { globals: { theme: 'dark', brand: 'A' } },
        'brand-b-light': { globals: { theme: 'light', brand: 'B' } },
        'brand-b-dark': { globals: { theme: 'dark', brand: 'B' } },
      },
    },
  },
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Toggle light/dark design tokens',
      defaultValue: 'light',
      toolbar: {
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
    brand: {
      name: 'Brand',
      description: 'Toggle design brand context',
      defaultValue: initialBrand,
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'A', title: 'Brand A' },
          { value: 'B', title: 'Brand B' },
          { value: 'unset', title: 'Story Default' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    ((Story, context) => {
      const theme = (context.globals.theme as string | undefined) ?? 'light';
      const brand = (context.globals.brand as BrandSetting | undefined) ?? initialBrand;
      return React.createElement(GlobalsWrapper, { theme, brand }, React.createElement(Story));
    }) as Decorator,
  ],
};

preview.globals = {
  ...(preview.globals ?? {}),
  brand: initialBrand,
};

export default preview;
