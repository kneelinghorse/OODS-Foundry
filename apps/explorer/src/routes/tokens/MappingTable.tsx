import { useMemo } from 'react';
import { Swatch } from '../../components/Swatch';
import { isHexColor } from '../../../../../tools/a11y/contrast.js';

type TokenPayload = {
  foregroundColor: string;
  backgroundColor: string;
  borderColor: string;
  iconName: string;
};

type TokenOverride = Partial<TokenPayload>;

type MappingEntry = {
  description: string;
  default: TokenPayload;
  contexts?: Record<string, TokenOverride>;
};

type MappingManifest = {
  metadata: {
    description: string;
    version: string;
    owner?: string;
  };
  mappings: Record<string, MappingEntry>;
};

export type MappingTableProps = {
  manifest: MappingManifest;
  resolveToken: (tokenName: string) => string | undefined;
  title?: string;
};

const TOKENS = {
  textBody: 'var(--cmp-text-body)',
  textMuted: 'var(--cmp-text-muted)',
  textSecondary: 'var(--cmp-text-secondary, var(--sys-text-secondary))',
  surfacePanel: 'var(--cmp-surface-panel)',
  borderSoft: 'color-mix(in srgb, var(--cmp-border-default) 40%, transparent)',
  shadowSoft: '0 1px 2px color-mix(in srgb, var(--cmp-text-body) 12%, transparent)'
} as const;

const formatStatusLabel = (status: string) =>
  status
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const formatDetail = (tokenName: string, resolved?: string) => {
  if (resolved && isHexColor(resolved)) {
    return `${tokenName} → ${resolved}`;
  }
  return tokenName;
};

const buildContextPayload = (base: TokenPayload, override: TokenOverride): TokenPayload => ({
  foregroundColor: override.foregroundColor ?? base.foregroundColor,
  backgroundColor: override.backgroundColor ?? base.backgroundColor,
  borderColor: override.borderColor ?? base.borderColor,
  iconName: override.iconName ?? base.iconName
});

export const MappingTable = ({ manifest, resolveToken, title }: MappingTableProps) => {
  const entries = useMemo(() => {
    return Object.entries(manifest.mappings).map(([statusKey, entry]) => {
      const defaultResolved = {
        foreground: resolveToken(entry.default.foregroundColor),
        background: resolveToken(entry.default.backgroundColor),
        border: resolveToken(entry.default.borderColor)
      };

      const contexts =
        entry.contexts &&
        Object.entries(entry.contexts).map(([contextKey, override]) => {
          const payload = buildContextPayload(entry.default, override);
          return {
            key: contextKey,
            payload,
            resolved: {
              foreground: resolveToken(payload.foregroundColor) ?? defaultResolved.foreground,
              background: resolveToken(payload.backgroundColor) ?? defaultResolved.background,
              border: resolveToken(payload.borderColor) ?? defaultResolved.border
            }
          };
        });

      return {
        statusKey,
        entry,
        defaultResolved,
        contexts: contexts ?? []
      };
    });
  }, [manifest, resolveToken]);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <header>
        <h2 style={{ margin: 0, fontSize: '1.3rem', color: TOKENS.textBody }}>
          {title ?? manifest.metadata.description}
        </h2>
        <p style={{ margin: '0.35rem 0 0', color: TOKENS.textMuted, fontSize: '0.9rem' }}>
          Version {manifest.metadata.version}
          {manifest.metadata.owner ? ` • Owner: ${manifest.metadata.owner}` : ''}
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))'
        }}
      >
        {entries.map(({ statusKey, entry, defaultResolved, contexts }) => {
          const statusLabel = formatStatusLabel(statusKey);
          const contextSwatches = contexts.map((context) => (
            <Swatch
              key={`${statusKey}-context-${context.key}`}
              label={`Context • ${formatStatusLabel(context.key)}`}
              sampleText={statusLabel}
              foreground={context.resolved.foreground}
              background={context.resolved.background}
              border={context.resolved.border}
              iconLabel={context.payload.iconName}
              details={[
                {
                  label: 'Foreground',
                  value: formatDetail(
                    context.payload.foregroundColor,
                    context.resolved.foreground
                  )
                },
                {
                  label: 'Background',
                  value: formatDetail(
                    context.payload.backgroundColor,
                    context.resolved.background
                  )
                },
                {
                  label: 'Border',
                  value: formatDetail(context.payload.borderColor, context.resolved.border)
                },
                { label: 'Icon', value: context.payload.iconName }
              ]}
            />
          ));

          return (
            <div
              key={statusKey}
              style={{
                border: `1px solid ${TOKENS.borderSoft}`,
                borderRadius: '0.9rem',
                padding: '1.1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.9rem',
                backgroundColor: TOKENS.surfacePanel,
                boxShadow: TOKENS.shadowSoft
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: TOKENS.textBody }}>
                  {statusLabel}
                </h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: TOKENS.textMuted }}>
                  {entry.description}
                </p>
              </div>

              <Swatch
                label="Default"
                sampleText={statusLabel}
                foreground={defaultResolved.foreground}
                background={defaultResolved.background}
                border={defaultResolved.border}
                iconLabel={entry.default.iconName}
                details={[
                  {
                    label: 'Foreground',
                    value: formatDetail(
                      entry.default.foregroundColor,
                      defaultResolved.foreground
                    )
                  },
                  {
                    label: 'Background',
                    value: formatDetail(
                      entry.default.backgroundColor,
                      defaultResolved.background
                    )
                  },
                  {
                    label: 'Border',
                    value: formatDetail(entry.default.borderColor, defaultResolved.border)
                  },
                  { label: 'Icon', value: entry.default.iconName }
                ]}
              />

              {contextSwatches.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: TOKENS.textSecondary }}>
                    Contexts
                  </h4>
                  <div
                    style={{
                      display: 'grid',
                      gap: '0.75rem'
                    }}
                  >
                    {contextSwatches}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
};
