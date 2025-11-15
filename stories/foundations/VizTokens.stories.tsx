import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import '~/apps/explorer/src/styles/index.css';
import tokensBundle, { prefix as exportedPrefix } from '@oods/tokens';
import { getVizScaleTokens, getVizSizeTokens, getVizMarginToken } from '@/viz/tokens/scale-token-mapper.js';

const sequentialTokens = getVizScaleTokens('sequential');
const divergingTokens = getVizScaleTokens('diverging');
const categoricalTokens = getVizScaleTokens('categorical');
const pointSizes = getVizSizeTokens('point');
const strokeSizes = getVizSizeTokens('stroke');
const barSizes = getVizSizeTokens('bar');
const marginTokens = [
  { label: 'Tight', token: getVizMarginToken('tight') },
  { label: 'Default', token: getVizMarginToken('default') },
  { label: 'Roomy', token: getVizMarginToken('roomy') },
];

const tokenPrefix =
  (typeof exportedPrefix === 'string' && exportedPrefix.length > 0 && exportedPrefix) ||
  (typeof tokensBundle?.prefix === 'string' && tokensBundle.prefix.length > 0 && tokensBundle.prefix) ||
  'oods';

const resolveCssVariable = (token: string): string => {
  const trimmed = token.startsWith('--') ? token.slice(2) : token;
  return `--${tokenPrefix}-${trimmed}`;
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  marginBlock: '1.5rem',
};

const headerCellStyle: React.CSSProperties = {
  textAlign: 'left',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--cmp-text-muted, #475569)',
  borderBottom: '1px solid color-mix(in srgb, var(--cmp-border-default, #CBD5F5) 65%, transparent)',
  padding: '0.5rem 0.75rem',
};

const cellStyle: React.CSSProperties = {
  padding: '0.75rem',
  borderBottom: '1px solid color-mix(in srgb, var(--cmp-border-default, #CBD5F5) 35%, transparent)',
  fontSize: '0.9rem',
};

const sectionShellStyle: React.CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--cmp-border-default, #CBD5F5) 45%, transparent)',
  borderRadius: '1rem',
  background: 'var(--cmp-surface-panel, #fff)',
  padding: '1.25rem 1.5rem',
  boxShadow: '0 18px 32px -24px rgba(15, 23, 42, 0.12)',
  marginBottom: '1.5rem',
};

const docWrapperStyle: React.CSSProperties = {
  width: 'min(960px, 100%)',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem',
};

interface TokenTableProps<T> {
  readonly tokens: readonly T[];
  readonly title: string;
  readonly renderPreview: (token: T) => React.ReactNode;
}

function TokenTable<T>({ tokens, title, renderPreview }: TokenTableProps<T>): JSX.Element {
  return (
    <section style={sectionShellStyle}>
      <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>{title}</h3>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={headerCellStyle}>Token</th>
            <th style={headerCellStyle}>Preview</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token, index) => {
            const key = typeof token === 'string' ? token : `${title}-${index}`;
            const tokenLabel = typeof token === 'string' ? token : String((token as { token?: string }).token ?? token);
            return (
              <tr key={key}>
                <td style={cellStyle}>
                  <code>{tokenLabel}</code>
                </td>
                <td style={cellStyle}>{renderPreview(token)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

const ColorSwatch = ({ token }: { token: string }): JSX.Element => (
  <div
    style={{
      width: '5rem',
      height: '2.5rem',
      borderRadius: '0.75rem',
      border: '1px solid color-mix(in srgb, var(--cmp-border-default, #CBD5F5) 45%, transparent)',
      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
      background: `var(${resolveCssVariable(token)})`,
    }}
    aria-label={token}
  />
);

const CircleSwatch = ({ token }: { token: string }): JSX.Element => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
    <div
      style={{
        width: `var(${resolveCssVariable(token)})`,
        height: `var(${resolveCssVariable(token)})`,
        borderRadius: '999px',
        background: 'var(--viz-scale-sequential-05, #6F7FF7)',
        border: '1px solid color-mix(in srgb, var(--cmp-border-default, #CBD5F5) 65%, transparent)',
      }}
    />
    <code>{token}</code>
  </div>
);

const StrokeSwatch = ({ token }: { token: string }): JSX.Element => (
  <div style={{ width: '100%', paddingBlock: '0.25rem' }}>
    <div
      style={{
        width: '100%',
        borderBottomWidth: `var(${resolveCssVariable(token)})`,
        borderBottomStyle: 'solid',
        borderBottomColor: 'var(--sys-text-primary, #0F172A)',
      }}
    />
  </div>
);

const BarPreview = ({ token }: { token: string }): JSX.Element => (
  <div
    style={{
      width: `var(${resolveCssVariable(token)})`,
      height: '1.75rem',
      background: 'var(--viz-scale-sequential-04, #7C8DFF)',
      borderRadius: '0.25rem',
    }}
  />
);

const MarginPreview = ({ label, token }: { label: string; token: string }): JSX.Element => (
  <div
    style={{
      width: '100%',
      border: '1px dashed color-mix(in srgb, var(--cmp-border-default, #CBD5F5) 55%, transparent)',
      borderRadius: '0.75rem',
      padding: `var(${resolveCssVariable(token)})`,
      background: 'color-mix(in srgb, var(--cmp-surface-panel, #FFFFFF) 60%, transparent)',
    }}
  >
    <div style={{ background: 'var(--viz-scale-categorical-01, #4C71FE)', borderRadius: '0.35rem', height: '1rem' }} />
    <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--cmp-text-muted, #475569)' }}>
      {label} margin ({token})
    </p>
  </div>
);

function VizTokensDoc(): JSX.Element {
  return (
    <div className="storybook-docs" style={docWrapperStyle}>
      <h1>Viz Tokens</h1>
      <p>
        Tokenization for Sprint 21 visualizations combines governed OKLCH ramps with existing system aliases so chart traits
        never reach directly into raw palette files. Use these helpers to wire Vega-Lite configs, Tailwind themes or future
        <code>--cmp-viz-*</code> slots.
      </p>

      <TokenTable title="Sequential (ΔL ≥ 0.10)" tokens={sequentialTokens} renderPreview={(token) => <ColorSwatch token={token as string} />} />
      <TokenTable title="Diverging" tokens={divergingTokens} renderPreview={(token) => <ColorSwatch token={token as string} />} />
      <TokenTable
        title="Categorical (aliased to sys.status.*)"
        tokens={categoricalTokens}
        renderPreview={(token) => <ColorSwatch token={token as string} />}
      />
      <TokenTable title="Point Sizes" tokens={pointSizes} renderPreview={(token) => <CircleSwatch token={token as string} />} />
      <TokenTable title="Stroke Widths" tokens={strokeSizes} renderPreview={(token) => <StrokeSwatch token={token as string} />} />
      <TokenTable title="Bar Widths" tokens={barSizes} renderPreview={(token) => <BarPreview token={token as string} />} />

      <section>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>Margins</h3>
        <div style={{ display: 'grid', gap: '1rem' }}>
          {marginTokens.map((entry) => (
            <MarginPreview key={entry.token} label={entry.label} token={entry.token} />
          ))}
        </div>
      </section>
    </div>
  );
}

const meta = {
  title: 'Foundations/Viz Tokens',
  component: VizTokensDoc,
  parameters: {
    layout: 'fullscreen',
    docs: {
      source: { state: 'hidden' },
    },
  },
} satisfies Meta<typeof VizTokensDoc>;

export default meta;

type Story = StoryObj<typeof VizTokensDoc>;

export const Catalog: Story = {
  render: () => <VizTokensDoc />,
};
