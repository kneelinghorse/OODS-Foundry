import type { CSSProperties } from 'react';
import type { Meta, StoryObj, StoryContext } from '@storybook/react';
import '../styles/index.css';
import '../styles/brand.css';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { StatusChip } from '../components/StatusChip';
import { ensureDomainInContext, pickStatusByIndex } from '../config/statusMap';
import { Input } from '../components/Input';
import { Toggle } from '../components/Toggle';
import { Checkbox } from '../components/Checkbox';

type Theme = 'light' | 'dark' | 'hc';
type Brand = 'A' | 'B';
type ToolbarBrandSetting = 'default' | 'brand-a' | 'brand-b' | 'unset';

const previewShell: CSSProperties = {
  display: 'grid',
  gap: '1.5rem',
  padding: '2rem',
  maxWidth: '1100px',
  margin: '0 auto',
  background: 'var(--cmp-surface-canvas)',
  color: 'var(--cmp-text-body)',
  transition: 'background-color 0.3s ease, color 0.3s ease'
};

const cardStyle: CSSProperties = {
  display: 'grid',
  gap: '1.25rem',
  padding: '1.75rem',
  borderRadius: '1.25rem',
  border: '1px solid color-mix(in srgb, var(--cmp-border-default) 55%, transparent)',
  background: 'var(--cmp-surface-panel)',
  boxShadow:
    '0 0 0 1px color-mix(in srgb, var(--cmp-border-default) 45%, transparent), var(--cmp-shadow-panel)'
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gap: '1.1rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'
};

const bodyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--cmp-text-body)',
  fontSize: '1rem',
  lineHeight: 1.55
};

const captionStyle: CSSProperties = {
  margin: 0,
  color: 'var(--cmp-text-muted)',
  fontSize: '0.9rem'
};

const tagsByTheme: Record<Theme, string[]> = {
  light: ['brand-light'],
  dark: ['brand-dark'],
  hc: ['brand-hc']
};

const showcaseLayout: CSSProperties = {
  display: 'grid',
  gap: '2.5rem',
  padding: '2rem',
  margin: '0 auto',
  maxWidth: '1200px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))'
};

const brandTokenForGlobals: Record<Brand, 'brand-a' | 'brand-b'> = {
  A: 'brand-a',
  B: 'brand-b'
};

const themeTokenForGlobals: Record<Theme, 'light' | 'dark'> = {
  light: 'light',
  dark: 'dark',
  hc: 'light'
};

const storyParameters = (theme: Theme) => ({
  chromatic: { disableSnapshot: false },
  vrt: { tags: tagsByTheme[theme] }
});

const storyParametersWithGlobals = (theme: Theme, brand: Brand) => ({
  ...storyParameters(theme),
  globals: {
    theme: themeTokenForGlobals[theme],
    brand: brandTokenForGlobals[brand]
  }
});

ensureDomainInContext('list', 'subscription');
const BRAND_PREVIEW_STATUS = pickStatusByIndex('subscription', 1);

function normalizeBrandSetting(value: unknown): Brand | undefined {
  if (value === 'A' || value === 'brand-a') {
    return 'A';
  }
  if (value === 'B' || value === 'brand-b') {
    return 'B';
  }
  return undefined;
}

function resolveBrand(context: StoryContext<BrandPreviewProps>, fallback: Brand): Brand {
  const globalBrand = normalizeBrandSetting(context.globals.brand as ToolbarBrandSetting | undefined);
  return globalBrand ?? fallback;
}

const BRAND_COPY: Record<
  Brand,
  {
    name: string;
    summaries: Record<Theme, string>;
  }
> = {
  A: {
    name: 'Brand A',
    summaries: {
      light: 'Warm neutrals, 4.5:1 button contrast, shared system tokens.',
      dark: 'Canvas and panels pivot to deep umber with luminous accents.',
      hc: 'CSS system colors (Canvas / Highlight) ensure OS-driven palettes.'
    }
  },
  B: {
    name: 'Brand B',
    summaries: {
      light: 'Cool indigo palette with crisp neutrals and tokens-only overrides.',
      dark: 'Deep slate canvas with saturated cyan accents for high energy product screens.',
      hc: 'Forced-colors mapping keeps outlines sharp while respecting OS accessibility settings.'
    }
  }
};

const THEME_TITLES: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  hc: 'High Contrast'
};

interface BrandPreviewProps {
  theme: Theme;
  brand: Brand;
}

const BrandPreview = ({ theme, brand }: BrandPreviewProps) => {
  const brandCopy = BRAND_COPY[brand];
  const heading = `${brandCopy.name} · ${THEME_TITLES[theme]}`;
  const summary = brandCopy.summaries[theme];

  return (
    <section style={previewShell} data-brand={brand} data-theme={theme} data-story-theme={theme}>
      <article style={cardStyle} className="brand-preview">
        <header style={{ display: 'grid', gap: '0.4rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.65rem' }}>{heading}</h2>
          <p style={captionStyle}>{summary}</p>
        </header>

        <p style={bodyStyle}>
          Brand tokens slot straight into <code>--theme-*</code> variables. Components keep reading the same{' '}
          <code>--cmp-*</code> surfaces, borders, and type styles—only the DOM attributes change.
        </p>

        <div style={gridStyle}>
          <Button leadingIcon="★">Primary Action</Button>
          <Button tone="accent" variant="outline" trailingIcon="→">
            Secondary
          </Button>
          <Badge tone="accent" leadingIcon="＋">
            Launch Prep
          </Badge>
          <StatusChip domain="subscription" status={BRAND_PREVIEW_STATUS} />
          <Input
            label="Workspace"
            placeholder="brand-a"
            supportingText="Lowercase, 3–12 characters"
          />
          <Toggle label="Notify the customer" defaultChecked />
          <Checkbox label="Marketing opt-in" supportingText="Send quarterly release notes" defaultChecked />
        </div>
      </article>
    </section>
  );
};

const meta: Meta<typeof BrandPreview> = {
  title: 'Brand/Showcase',
  component: BrandPreview,
  parameters: {
    layout: 'fullscreen',
    docs: { source: { state: 'hidden' } }
  },
  argTypes: {
    brand: { control: false },
    theme: { control: false }
  },
  tags: ['vrt-critical']
};

export default meta;

type Story = StoryObj<typeof BrandPreview>;

const renderBrandPreview: Story['render'] = (args, context) => (
  <BrandPreview {...args} brand={resolveBrand(context, args.brand ?? 'A')} />
);

export const Showcase: Story = {
  name: 'Showcase',
  render: () => (
    <div style={showcaseLayout}>
      {(['light', 'dark', 'hc'] as const).map((theme) => (
        <BrandPreview key={theme} theme={theme} brand="A" />
      ))}
    </div>
  ),
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['brand-showcase', 'brand-light', 'brand-dark', 'brand-hc'] },
    globals: {
      theme: 'light',
      brand: 'brand-a'
    }
  },
  tags: ['vrt-critical']
};

export const Light: Story = {
  name: 'Light',
  args: { theme: 'light', brand: 'A' },
  render: renderBrandPreview,
  parameters: storyParametersWithGlobals('light', 'A')
};

export const Dark: Story = {
  name: 'Dark',
  args: { theme: 'dark', brand: 'A' },
  render: renderBrandPreview,
  parameters: storyParametersWithGlobals('dark', 'A')
};

export const HighContrast: Story = {
  name: 'High Contrast',
  args: { theme: 'hc', brand: 'A' },
  render: renderBrandPreview,
  parameters: storyParametersWithGlobals('hc', 'A')
};
