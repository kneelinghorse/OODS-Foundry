import type { Meta, StoryObj } from '@storybook/react';
import tokensJson from '@oods/tokens/tailwind';
import { TokenBrowser } from '../../../apps/explorer/src/routes/tokens/TokenBrowser';
import { resolveTokenValue } from '../../../apps/explorer/src/utils/tokenResolver';

const meta: Meta = {
  title: 'Foundations/Tokens Roundtrip',
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj;
type TokenBrowserStory = StoryObj<typeof TokenBrowser>;

type FlatTokenRecord = {
  name: string;
  value: string;
  path: string[];
  cssVariable?: string;
  originalValue?: string;
  description?: string;
};

const flatRecord = tokensJson.flat as Record<string, FlatTokenRecord>;

const tokenEntries = Object.entries(flatRecord).map(([id, token]) => ({
  id,
  name: token.path.join('.'),
  value: token.value,
  path: token.path,
  description: token.description?.trim() ? token.description : undefined,
}));

type PreviewKind = 'background' | 'text' | 'border';

interface TokenPreviewConfig {
  path: string;
  cssVar: string;
  hex: string;
  kind: PreviewKind;
}

const BRAND_B_TOKEN_PREVIEWS: TokenPreviewConfig[] = [
  { path: 'brand.B.surface.interactivePrimary', cssVar: '--oods-brand-b-surface-interactive-primary', hex: '#0093D0', kind: 'background' },
  { path: 'color.brand.B.surface.interactive.primary.hover', cssVar: '--oods-color-brand-b-surface-interactive-primary-hover', hex: '#0074A6', kind: 'background' },
  { path: 'color.brand.B.surface.interactive.primary.pressed', cssVar: '--oods-color-brand-b-surface-interactive-primary-pressed', hex: '#006492', kind: 'background' },
  { path: 'color.brand.B.surface.backdrop', cssVar: '--oods-color-brand-b-surface-backdrop', hex: '#2F3D44', kind: 'background' },
  { path: 'color.brand.B.surface.disabled', cssVar: '--oods-color-brand-b-surface-disabled', hex: '#CEDAE0', kind: 'background' },
  { path: 'color.brand.B.surface.inverse', cssVar: '--oods-color-brand-b-surface-inverse', hex: '#192C35', kind: 'background' },
  { path: 'color.brand.B.accent.background', cssVar: '--oods-color-brand-b-accent-background', hex: '#C4E3F9', kind: 'background' },
  { path: 'color.brand.B.accent.border', cssVar: '--oods-color-brand-b-accent-border', hex: '#5CB4EF', kind: 'border' },
  { path: 'color.brand.B.accent.text', cssVar: '--oods-color-brand-b-accent-text', hex: '#005E99', kind: 'text' },
  { path: 'color.brand.B.status.info.surface', cssVar: '--oods-color-brand-b-status-info-surface', hex: '#EEF5FD', kind: 'background' },
  { path: 'color.brand.B.status.info.border', cssVar: '--oods-color-brand-b-status-info-border', hex: '#A4C8F1', kind: 'border' },
  { path: 'color.brand.B.status.info.icon', cssVar: '--oods-color-brand-b-status-info-icon', hex: '#0070D6', kind: 'text' },
  { path: 'color.brand.B.status.success.surface', cssVar: '--oods-color-brand-b-status-success-surface', hex: '#EAFBF5', kind: 'background' },
  { path: 'color.brand.B.status.success.border', cssVar: '--oods-color-brand-b-status-success-border', hex: '#A1E5CA', kind: 'border' },
  { path: 'color.brand.B.status.success.icon', cssVar: '--oods-color-brand-b-status-success-icon', hex: '#169770', kind: 'text' },
  { path: 'color.brand.B.status.warning.surface', cssVar: '--oods-color-brand-b-status-warning-surface', hex: '#FFF7E5', kind: 'background' },
  { path: 'color.brand.B.status.warning.border', cssVar: '--oods-color-brand-b-status-warning-border', hex: '#FFD57D', kind: 'border' },
  { path: 'color.brand.B.status.warning.icon', cssVar: '--oods-color-brand-b-status-warning-icon', hex: '#B7882B', kind: 'text' },
  { path: 'color.brand.B.status.critical.surface', cssVar: '--oods-color-brand-b-status-critical-surface', hex: '#FFF0EF', kind: 'background' },
  { path: 'color.brand.B.status.critical.border', cssVar: '--oods-color-brand-b-status-critical-border', hex: '#F7B1AA', kind: 'border' },
  { path: 'color.brand.B.status.critical.icon', cssVar: '--oods-color-brand-b-status-critical-icon', hex: '#D94748', kind: 'text' },
  { path: 'color.brand.B.status.neutral.surface', cssVar: '--oods-color-brand-b-status-neutral-surface', hex: '#F8F9FA', kind: 'background' },
  { path: 'color.brand.B.status.neutral.border', cssVar: '--oods-color-brand-b-status-neutral-border', hex: '#D4DBE3', kind: 'border' },
  { path: 'color.brand.B.status.neutral.icon', cssVar: '--oods-color-brand-b-status-neutral-icon', hex: '#5F6776', kind: 'text' },
  { path: 'color.brand.B.text.accent', cssVar: '--oods-color-brand-b-text-accent', hex: '#0077B5', kind: 'text' },
  { path: 'color.brand.B.text.disabled', cssVar: '--oods-color-brand-b-text-disabled', hex: '#9A9EA8', kind: 'text' },
  { path: 'color.brand.B.text.inverse', cssVar: '--oods-color-brand-b-text-inverse', hex: '#E5ECF1', kind: 'text' },
];

const renderTokenPreview = (token: TokenPreviewConfig) => {
  const colorBlock = (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: token.kind === 'border' ? 10 : 8,
        border:
          token.kind === 'border'
            ? `4px solid ${token.hex}`
            : '1px solid rgba(17, 24, 39, 0.15)',
        backgroundColor: token.kind === 'background' ? token.hex : '#ffffff',
        color: token.kind === 'text' ? token.hex : '#1f2937',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 12,
        fontWeight: 600,
        boxShadow: '0 6px 18px rgba(15, 23, 42, 0.18)',
      }}
    >
      {token.kind === 'text' ? 'Aa' : ''}
    </div>
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: 14,
        borderRadius: 18,
        border: '1px solid rgba(15, 23, 42, 0.12)',
        background: 'linear-gradient(145deg, rgba(249, 250, 251, 0.95), rgba(243, 244, 246, 0.9))',
        boxShadow: '0 14px 28px rgba(17, 24, 39, 0.12)',
      }}
    >
      {colorBlock}
      <div
        style={{
          display: 'grid',
          gap: 4,
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 12,
          lineHeight: 1.6,
          color: '#4b5563',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#111827' }}>
          {token.kind === 'background'
            ? 'Surface swatch'
            : token.kind === 'border'
            ? 'Border sample'
            : 'Text sample'}
        </div>
        <div>
          <span style={{ fontWeight: 600, color: '#111827' }}>Token:</span>{' '}
          <code>{token.path}</code>
        </div>
        <div>
          <span style={{ fontWeight: 600, color: '#111827' }}>CSS var:</span>{' '}
          <code>{token.cssVar}</code>
        </div>
        <div>
          <span style={{ fontWeight: 600, color: '#111827' }}>Hex fallback:</span>{' '}
          <code>{token.hex}</code>
        </div>
      </div>
    </div>
  );
};

const RoundtripPreview = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      width: 720,
      margin: '40px auto',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}
  >
    <header style={{ textAlign: 'center', display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 12, letterSpacing: '0.4em', color: '#6b7280' }}>
        FIGMA → REPO → TAILWIND
      </div>
      <h2 style={{ fontSize: 24, margin: 0, color: '#111827' }}>Brand B Token Coverage</h2>
      <p style={{ fontSize: 14, color: '#4b5563', margin: 0 }}>
        Swatches render using literal hex so the governance scanner sees usage immediately, before any theme CSS loads.
      </p>
    </header>

    <section
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 18,
      }}
    >
      {BRAND_B_TOKEN_PREVIEWS.map((token) => (
        <article key={token.cssVar}>{renderTokenPreview(token)}</article>
      ))}
    </section>
  </div>
);

export const Roundtrip: Story = {
  render: () => <RoundtripPreview />,
};

export const Browser: TokenBrowserStory = {
  name: 'Token Browser',
  parameters: {
    layout: 'fullscreen',
  },
  render: () => <TokenBrowser tokens={tokenEntries} resolveToken={resolveTokenValue} />,
};
