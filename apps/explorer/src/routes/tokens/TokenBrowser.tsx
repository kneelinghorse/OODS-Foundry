import { useMemo, useState } from 'react';
import { Swatch } from '../../components/Swatch';
import { isHexColor } from '../../../../../tools/a11y/contrast.js';

export type TokenEntry = {
  id: string;
  name: string;
  value: string;
  path: string[];
  description?: string;
};

export type TokenBrowserProps = {
  tokens: TokenEntry[];
  resolveToken: (tokenName: string) => string | undefined;
};

const toTitle = (value: string) =>
  value
    .split('.')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' • ');

const filterTokens = (tokens: TokenEntry[], query: string) => {
  if (!query) {
    return tokens;
  }

  const needle = query.trim().toLowerCase();
  return tokens.filter((token) => {
    const haystacks = [
      token.name,
      token.value,
      token.path.join('.'),
      token.path.slice(0, -1).join('.')
    ]
      .filter(Boolean)
      .map((item) => item.toLowerCase());

    return haystacks.some((haystack) => haystack.includes(needle));
  });
};

const groupTokens = (tokens: TokenEntry[]) => {
  const groups = new Map<string, TokenEntry[]>();
  for (const token of tokens) {
    const key = token.path[0] ?? 'misc';
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(token);
  }

  for (const [, list] of groups) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
};

const STATUS_TONES = ['info', 'success', 'warning', 'critical'] as const;
const SURFACE_VARIANTS = ['default', 'raised', 'subtle'] as const;

const DEFAULT_FOREGROUND = '#0f172a';
const DEFAULT_BACKGROUND = '#ffffff';

const isSurfaceToken = (path: string[]) =>
  path.includes('surface') || path.includes('background');

const isTextToken = (path: string[]) => path.includes('text');
const isIconToken = (path: string[]) => path.includes('icon');
const isBorderToken = (path: string[]) => path.includes('border');

const normalisePath = (path: string[]) => path.map((segment) => segment.toLowerCase());

export const TokenBrowser = ({ tokens, resolveToken }: TokenBrowserProps) => {
  const [query, setQuery] = useState('');

  const filteredTokens = useMemo(
    () => filterTokens(tokens, query),
    [tokens, query]
  );

  const grouped = useMemo(
    () => groupTokens(filteredTokens),
    [filteredTokens]
  );

  const getTokenValue = (tokenName: string) => resolveToken(tokenName);

  const defaultForeground = getTokenValue('text.default') ?? DEFAULT_FOREGROUND;
  const defaultBackground = getTokenValue('surface.default') ?? DEFAULT_BACKGROUND;

  const statusSwatches = useMemo(() => {
    return STATUS_TONES.map((tone) => {
      const surface = getTokenValue(`status.${tone}.surface`);
      const text = getTokenValue(`status.${tone}.text`);
      const border = getTokenValue(`status.${tone}.border`);
      if (!surface || !text) {
        return null;
      }

      return {
        id: `status-${tone}`,
        label: `Status • ${toTitle(tone)}`,
        background: surface,
        foreground: text,
        border,
        description: `Status palette for ${tone} states`
      };
    }).filter(Boolean) as Array<{
      id: string;
      label: string;
      background: string;
      foreground: string;
      border?: string;
      description: string;
    }>;
  }, [getTokenValue]);

  const surfaceSwatches = useMemo(() => {
    return SURFACE_VARIANTS.map((variant) => {
      const surface = getTokenValue(`surface.${variant}`);
      if (!surface) {
        return null;
      }
      return {
        id: `surface-${variant}`,
        label: `Surface • ${toTitle(variant)}`,
        background: surface,
        foreground: defaultForeground,
        description: 'Surface token preview',
        tokenName: `surface.${variant}`
      };
    }).filter(Boolean) as Array<{
      id: string;
      label: string;
      background: string;
      foreground: string;
      description: string;
      tokenName: string;
    }>;
  }, [getTokenValue, defaultForeground]);

  const renderTokenCard = (token: TokenEntry) => {
    if (!isHexColor(token.value)) {
      return (
        <div
          key={token.id}
          style={{
            border: '1px solid rgba(148, 163, 184, 0.45)',
            borderRadius: '0.75rem',
            padding: '0.9rem',
            backgroundColor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem'
          }}
        >
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>
            {token.name}
          </div>
          <div style={{ fontFamily: 'monospace', color: '#334155', fontSize: '0.85rem' }}>
            {token.value}
          </div>
          {token.description ? (
            <div style={{ fontSize: '0.75rem', color: '#475569' }}>{token.description}</div>
          ) : null}
        </div>
      );
    }

    const loweredPath = normalisePath(token.path);
    let foreground = defaultForeground;
    let background = defaultBackground;
    let border: string | undefined;
    let sampleText = 'Token';

    if (isSurfaceToken(loweredPath)) {
      background = token.value;
      sampleText = 'Surface';
    } else if (isBorderToken(loweredPath)) {
      border = token.value;
      background = defaultBackground;
      foreground = defaultForeground;
      sampleText = 'Border';
    } else if (isTextToken(loweredPath) || isIconToken(loweredPath)) {
      foreground = token.value;
      background = defaultBackground;
      sampleText = isIconToken(loweredPath) ? 'Icon' : 'Text';
    } else {
      background = token.value;
    }

    return (
      <Swatch
        key={token.id}
        label={token.name}
        description={token.description}
        foreground={foreground}
        background={background}
        border={border}
        sampleText={sampleText}
        details={[
          { label: 'Token', value: token.name },
          { label: 'Value', value: token.value }
        ]}
      />
    );
  };

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', color: '#0f172a' }}>Token Browser</h1>
          <p style={{ margin: '0.4rem 0 0', color: '#475569' }}>
            Browse semantic tokens emitted by the pipeline, inspect live previews, and confirm
            contrast outcomes.
          </p>
        </div>
        <input
          placeholder="Filter by namespace, token name, or value…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{
            padding: '0.65rem 0.85rem',
            borderRadius: '0.6rem',
            border: '1px solid rgba(148, 163, 184, 0.45)',
            fontSize: '0.95rem',
            color: '#0f172a',
            backgroundColor: '#ffffff',
            boxShadow: '0 1px 2px 0 rgba(15, 23, 42, 0.05)'
          }}
        />
      </header>

      {statusSwatches.length > 0 ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Status Palettes</h2>
          <div
            style={{
              display: 'grid',
              gap: '1rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))'
            }}
          >
            {statusSwatches.map((swatch) => (
              <Swatch
                key={swatch.id}
                label={swatch.label}
                description={swatch.description}
                foreground={swatch.foreground}
                background={swatch.background}
                border={swatch.border}
                sampleText="Status"
                details={[
                  { label: 'Foreground', value: swatch.foreground },
                  { label: 'Background', value: swatch.background },
                  { label: 'Border', value: swatch.border ?? '—' }
                ]}
              />
            ))}
          </div>
        </section>
      ) : null}

      {surfaceSwatches.length > 0 ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Surface Tokens</h2>
          <div
            style={{
              display: 'grid',
              gap: '1rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))'
            }}
          >
            {surfaceSwatches.map((swatch) => (
              <Swatch
                key={swatch.id}
                label={swatch.label}
                description={swatch.description}
                foreground={swatch.foreground}
                background={swatch.background}
                sampleText="Surface"
                details={[
                  { label: 'Token', value: swatch.tokenName },
                  { label: 'Background', value: swatch.background }
                ]}
              />
            ))}
          </div>
        </section>
      ) : null}

      {grouped.map(([groupName, groupTokensList]) => (
        <section
          key={groupName}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.9rem'
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
            {toTitle(groupName)}
          </h2>
          <div
            style={{
              display: 'grid',
              gap: '1rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))'
            }}
          >
            {groupTokensList.map((token) => renderTokenCard(token))}
          </div>
        </section>
      ))}
    </section>
  );
};
