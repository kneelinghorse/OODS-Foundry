import type { Meta, StoryObj } from '@storybook/react';
import tokensBundle, { flatTokens as exportedFlatTokens } from '@oods/tokens';
import { TokenBrowser } from '../../../apps/explorer/src/routes/tokens/TokenBrowser';
import { resolveTokenValue } from '../../../apps/explorer/src/utils/tokenResolver';
import { formatTokenReference } from '../../utils/token-values.js';

const meta: Meta = {
  title: 'Foundations/Tokens Roundtrip',
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Roundtrip visualises how semantic tokens travel from DTCG JSON → Tailwind → runtime CSS. Use the Token Browser story for interactive inspection.',
      },
    },
  },
};

export default meta;

type Story = StoryObj;
type TokenBrowserStory = StoryObj<typeof TokenBrowser>;

type FlatTokenRecord = {
  name: string;
  value: string | number;
  path: string[];
  cssVariable?: string;
  originalValue?: unknown;
  description?: string;
};

const flatRecord = (exportedFlatTokens ?? tokensBundle?.flatTokens ?? {}) as Record<string, FlatTokenRecord>;

const tokenEntries = Object.entries(flatRecord).map(([id, token]) => ({
  id,
  name: token.path.join('.'),
  value: String(token.value),
  path: token.path,
  description: token.description?.trim() ? token.description : undefined,
}));

type PreviewKind = 'background' | 'text' | 'border';

interface TokenPreviewConfig {
  path: string;
  cssVar: string;
  kind: PreviewKind;
}

const BRAND_B_TOKEN_PREVIEWS: TokenPreviewConfig[] = [
  { path: 'brand.B.surface.interactivePrimary', cssVar: '--oods-brand-b-surface-interactive-primary', kind: 'background' },
  { path: 'color.brand.B.surface.interactive.primary.hover', cssVar: '--oods-color-brand-b-surface-interactive-primary-hover', kind: 'background' },
  { path: 'color.brand.B.surface.interactive.primary.pressed', cssVar: '--oods-color-brand-b-surface-interactive-primary-pressed', kind: 'background' },
  { path: 'color.brand.B.surface.backdrop', cssVar: '--oods-color-brand-b-surface-backdrop', kind: 'background' },
  { path: 'color.brand.B.surface.disabled', cssVar: '--oods-color-brand-b-surface-disabled', kind: 'background' },
  { path: 'color.brand.B.surface.inverse', cssVar: '--oods-color-brand-b-surface-inverse', kind: 'background' },
  { path: 'color.brand.B.accent.background', cssVar: '--oods-color-brand-b-accent-background', kind: 'background' },
  { path: 'color.brand.B.accent.border', cssVar: '--oods-color-brand-b-accent-border', kind: 'border' },
  { path: 'color.brand.B.accent.text', cssVar: '--oods-color-brand-b-accent-text', kind: 'text' },
  { path: 'color.brand.B.status.info.surface', cssVar: '--oods-color-brand-b-status-info-surface', kind: 'background' },
  { path: 'color.brand.B.status.info.border', cssVar: '--oods-color-brand-b-status-info-border', kind: 'border' },
  { path: 'color.brand.B.status.info.icon', cssVar: '--oods-color-brand-b-status-info-icon', kind: 'text' },
  { path: 'color.brand.B.status.success.surface', cssVar: '--oods-color-brand-b-status-success-surface', kind: 'background' },
  { path: 'color.brand.B.status.success.border', cssVar: '--oods-color-brand-b-status-success-border', kind: 'border' },
  { path: 'color.brand.B.status.success.icon', cssVar: '--oods-color-brand-b-status-success-icon', kind: 'text' },
  { path: 'color.brand.B.status.warning.surface', cssVar: '--oods-color-brand-b-status-warning-surface', kind: 'background' },
  { path: 'color.brand.B.status.warning.border', cssVar: '--oods-color-brand-b-status-warning-border', kind: 'border' },
  { path: 'color.brand.B.status.warning.icon', cssVar: '--oods-color-brand-b-status-warning-icon', kind: 'text' },
  { path: 'color.brand.B.status.critical.surface', cssVar: '--oods-color-brand-b-status-critical-surface', kind: 'background' },
  { path: 'color.brand.B.status.critical.border', cssVar: '--oods-color-brand-b-status-critical-border', kind: 'border' },
  { path: 'color.brand.B.status.critical.icon', cssVar: '--oods-color-brand-b-status-critical-icon', kind: 'text' },
  { path: 'color.brand.B.status.neutral.surface', cssVar: '--oods-color-brand-b-status-neutral-surface', kind: 'background' },
  { path: 'color.brand.B.status.neutral.border', cssVar: '--oods-color-brand-b-status-neutral-border', kind: 'border' },
  { path: 'color.brand.B.status.neutral.icon', cssVar: '--oods-color-brand-b-status-neutral-icon', kind: 'text' },
  { path: 'color.brand.B.text.accent', cssVar: '--oods-color-brand-b-text-accent', kind: 'text' },
  { path: 'color.brand.B.text.disabled', cssVar: '--oods-color-brand-b-text-disabled', kind: 'text' },
  { path: 'color.brand.B.text.inverse', cssVar: '--oods-color-brand-b-text-inverse', kind: 'text' },
];

const renderTokenPreview = (token: TokenPreviewConfig) => {
  const resolvedValue =
    resolveTokenValue(token.path) ??
    formatTokenReference(token.path, token.cssVar, 'Canvas');
  const cssReference = `var(${token.cssVar}, ${resolvedValue})`;
  const blockColor =
    token.kind === 'background'
      ? cssReference
      : 'var(--cmp-surface-canvas, Canvas)';
  const borderColor = 'var(--cmp-border-default, var(--sys-border-subtle, CanvasText))';
  const borderValue =
    token.kind === 'border'
      ? `4px solid ${cssReference}`
      : `1px solid ${borderColor}`;
  const textColor =
    token.kind === 'text'
      ? cssReference
      : 'var(--cmp-text-body, CanvasText)';

  const colorBlock = (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: token.kind === 'border' ? 10 : 8,
        border: borderValue,
        backgroundColor: blockColor,
        color: textColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 12,
        fontWeight: 600,
        boxShadow:
          'var(--sys-shadow-elevation-card, 0 14px 28px color-mix(in srgb, var(--cmp-text-body, CanvasText) 12%, transparent))',
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
        border: '1px solid var(--cmp-border-default, var(--sys-border-subtle, CanvasText))',
        background: 'var(--cmp-surface-panel, Canvas)',
        boxShadow:
          'var(--sys-shadow-elevation-card, 0 18px 36px color-mix(in srgb, var(--cmp-text-body, CanvasText) 12%, transparent))',
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
          color: 'var(--cmp-text-muted, CanvasText)',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cmp-text-body, CanvasText)' }}>
          {token.kind === 'background'
            ? 'Surface swatch'
            : token.kind === 'border'
            ? 'Border sample'
            : 'Text sample'}
        </div>
        <div>
          <span style={{ fontWeight: 600, color: 'var(--cmp-text-body, CanvasText)' }}>Token:</span>{' '}
          <code>{token.path}</code>
        </div>
        <div>
          <span style={{ fontWeight: 600, color: 'var(--cmp-text-body, CanvasText)' }}>CSS var:</span>{' '}
          <code>{token.cssVar}</code>
        </div>
        <div>
          <span style={{ fontWeight: 600, color: 'var(--cmp-text-body, CanvasText)' }}>Resolved value:</span>{' '}
          <code>{resolvedValue}</code>
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
      <div style={{ fontSize: 12, letterSpacing: '0.4em', color: 'var(--cmp-text-muted, CanvasText)' }}>
        FIGMA → REPO → TAILWIND
      </div>
      <h2 style={{ fontSize: 24, margin: 0, color: 'var(--cmp-text-body, CanvasText)' }}>Brand B Token Coverage</h2>
      <p style={{ fontSize: 14, color: 'var(--cmp-text-muted, CanvasText)', margin: 0 }}>
        Swatches render directly from semantic tokens so the governance scanner sees usage without bespoke literals.
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
  parameters: {
    docs: {
      storyDescription: 'Brand B swatches render directly from semantic tokens to prove the governance scanner sees real usage.',
    },
  },
  render: () => <RoundtripPreview />,
};

export const Browser: TokenBrowserStory = {
  name: 'Token Browser',
  parameters: {
    layout: 'fullscreen',
    docs: {
      storyDescription:
        'Search, group, and contrast-check every emitted semantic token. Filter by namespace, status tone, or resolved value.',
    },
  },
  render: () => <TokenBrowser tokens={tokenEntries} resolveToken={resolveTokenValue} />,
};
