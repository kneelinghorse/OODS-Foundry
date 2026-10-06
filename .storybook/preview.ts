// Ensure design-token variables are present before any DS CSS consumes them.
import '../apps/explorer/src/styles/tokens.css';
import '../apps/explorer/src/styles/overlays.css';
import '../apps/explorer/src/styles/index.css';
import '../src/styles/globals.css';
// The component chrome the generated apps and the Explorer ship with (Sprint 200 residue: the root Storybook loaded tokens but no component styles).
import '@oods/component-styles/css';
import type { Decorator, Preview } from '@storybook/react';
import { INITIAL_VIEWPORTS } from 'storybook/viewport';
import React, { useEffect } from 'react';
import * as ReactDOM from 'react-dom';
// s213-m04: the brands are the token build's (the brand registry), so a brand added there appears in the toolbar.
import { brands } from '@oods/tokens/brands';

type ThemeSetting = 'light' | 'dark';
type BrandSetting = 'default' | `brand-${string}`;

const BRAND_STORAGE_KEY = 'oods:storybook:brand';

const brandSetting = (brand: string): BrandSetting => `brand-${brand.toLowerCase()}`;

const DOM_BRAND_BY_SETTING: Record<BrandSetting, string | null> = {
  default: null,
  ...Object.fromEntries(brands.map((brand) => [brandSetting(brand), brand])),
};

function normaliseBrand(value: unknown): BrandSetting | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const token = value.trim().toLowerCase().replace(/[\s_]/g, '-');
  for (const brand of brands) {
    const id = brand.toLowerCase();
    if (token === `brand-${id}` || token === id || token === `brand${id}`) {
      return brandSetting(brand);
    }
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
      modes: Object.fromEntries(brands.flatMap((brand) => (['light', 'dark'] as const).map((theme) => [
        `${brandSetting(brand)}-${theme}`, { globals: { theme, brand: brandSetting(brand) } },
      ]))),
    },
    /**
     * s173 m04 — REAL viewport presets, replacing hand-drawn boxes.
     *
     * Several stories used to "show a narrow viewport" by wrapping their content in a div of
     * a fixed width. That is a picture of a narrow screen, not a narrow screen: the story
     * still renders at the canvas width, `100vw` still means the canvas, and — the reason it
     * matters for this sprint — a CONTAINER QUERY sees whatever the wrapper happens to be
     * rather than the device. Storybook 9 resizes the canvas itself, so a preset changes the
     * thing under test instead of drawing a frame around it.
     *
     * The set is deliberately small and named after this design system's own scale rather
     * than after phones: `oods-mobile` and `oods-tablet` are sys.breakpoint-derived widths,
     * so a story pinned to one of them is pinned to the same number the CSS collapses at.
     * INITIAL_VIEWPORTS stays available for anyone who genuinely wants an iPhone.
     */
    viewport: {
      options: {
        ...INITIAL_VIEWPORTS,
        'oods-mobile': {
          name: 'OODS mobile (375)',
          styles: { width: '375px', height: '812px' },
          type: 'mobile',
        },
        'oods-tablet': {
          name: 'OODS tablet (768 = sys.breakpoint.md)',
          styles: { width: '768px', height: '1024px' },
          type: 'tablet',
        },
        'oods-desktop': {
          name: 'OODS desktop (1280 = sys.breakpoint.xl)',
          styles: { width: '1280px', height: '800px' },
          type: 'desktop',
        },
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
          ...brands.map((brand) => ({ value: brandSetting(brand), title: `Brand ${brand}` })),
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
    // 'responsive' = the canvas follows its own size, which is Storybook's default and what
    // every existing story (and every 1280 capture) already renders at. Stated explicitly so
    // adding the presets above changes nothing for stories that do not opt in.
    viewport: { value: 'responsive', isRotated: false },
  },
};

export default preview;
