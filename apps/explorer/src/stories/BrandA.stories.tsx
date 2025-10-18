import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
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
  light: ['brand-a-light'],
  dark: ['brand-a-dark'],
  hc: ['brand-a-hc']
};

const storyParameters = (theme: Theme) => ({
  chromatic: { disableSnapshot: false },
  vrt: { tags: tagsByTheme[theme] }
});

ensureDomainInContext('list', 'subscription');
const BRAND_PREVIEW_STATUS = pickStatusByIndex('subscription', 1);

interface BrandPreviewProps {
  theme: Theme;
}

const BrandPreview = ({ theme }: BrandPreviewProps) => {
  const heading =
    theme === 'light'
      ? 'Brand A · Light'
      : theme === 'dark'
      ? 'Brand A · Dark'
      : 'Brand A · High Contrast';

  const summary =
    theme === 'light'
      ? 'Warm neutrals, 4.5:1 button contrast, shared system tokens.'
      : theme === 'dark'
      ? 'Canvas and panels pivot to deep umber with luminous accents.'
      : 'CSS system colors (Canvas / Highlight) ensure OS-driven palettes.';

  return (
    <section style={previewShell} data-brand="A" data-theme={theme} data-story-theme={theme}>
      <article style={cardStyle} className="brand-a-preview">
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
  title: 'Brand/Brand A',
  component: BrandPreview,
  parameters: {
    layout: 'fullscreen',
    docs: { source: { state: 'hidden' } }
  },
  tags: ['vrt-critical']
};

export default meta;

type Story = StoryObj<typeof BrandPreview>;

export const Light: Story = {
  name: 'Light',
  args: { theme: 'light' },
  parameters: storyParameters('light')
};

export const Dark: Story = {
  name: 'Dark',
  args: { theme: 'dark' },
  parameters: storyParameters('dark')
};

export const HighContrast: Story = {
  name: 'High Contrast',
  args: { theme: 'hc' },
  parameters: storyParameters('hc')
};
