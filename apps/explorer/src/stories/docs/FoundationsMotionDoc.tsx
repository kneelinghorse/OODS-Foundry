import React, { useEffect, useMemo, useState } from 'react';
import '../../styles/index.css';
import { flatTokens } from '~/src/utils/design-tokens';

type FlatTokenName = keyof typeof flatTokens;

type DurationSpec = {
  label: string;
  token: FlatTokenName;
  cssVar: string;
  usage: string;
};

type TransitionSpec = {
  label: string;
  slug: string;
  usage: string;
  properties: string[];
};

const durationSpecs: DurationSpec[] = [
  {
    label: 'Fast',
    token: 'motion-duration-fast',
    cssVar: '--motion-duration-fast',
    usage: 'Hover feedback, button press, subtle emphasis.'
  },
  {
    label: 'Base',
    token: 'motion-duration-base',
    cssVar: '--motion-duration-base',
    usage: 'Focus shifts, chip selection, and standard transitions.'
  },
  {
    label: 'Slow',
    token: 'motion-duration-slow',
    cssVar: '--motion-duration-slow',
    usage: 'Banner reveals and large-surface entrance motion.'
  }
];

const transitionSpecs: TransitionSpec[] = [
  {
    label: 'Hover',
    slug: 'motion-transition-hover',
    usage: 'Buttons, chips, cards — background, stroke, and shadow cues.',
    properties: ['background-color', 'border-color', 'box-shadow', 'color']
  },
  {
    label: 'Focus',
    slug: 'motion-transition-focus',
    usage: 'Outlines and ring glows when keyboard focus shifts.',
    properties: ['outline-color', 'box-shadow', 'outline-offset']
  },
  {
    label: 'Chip In',
    slug: 'motion-transition-chip-in',
    usage: 'Filter chips joining a selection group.',
    properties: ['transform', 'opacity', 'background-color']
  },
  {
    label: 'Chip Out',
    slug: 'motion-transition-chip-out',
    usage: 'Chips deselecting or exiting a group.',
    properties: ['transform', 'opacity', 'background-color']
  },
  {
    label: 'Banner Reveal',
    slug: 'motion-transition-banner-reveal',
    usage: 'Banners sliding into view along the vertical axis.',
    properties: ['transform', 'opacity']
  }
];

const lookupTokenValue = (name: FlatTokenName): string => {
  const entry = flatTokens[name];
  if (!entry) {
    return '—';
  }
  const value = entry.value;
  return typeof value === 'string' ? value : String(value);
};

const transitionToken = (slug: string, suffix: 'duration' | 'delay' | 'timing-function') =>
  `${slug}-${suffix}` as FlatTokenName;

const cardStyle: React.CSSProperties = {
  display: 'grid',
  gap: '0.6rem',
  padding: '1.25rem',
  borderRadius: '1rem',
  border: '1px solid color-mix(in srgb, var(--cmp-border-default) 28%, transparent)',
  background: 'var(--cmp-surface-panel)',
  color: 'var(--cmp-text-body)',
  boxShadow:
    '0 0 0 1px color-mix(in srgb, var(--cmp-border-default) 18%, transparent), var(--cmp-shadow-panel)'
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: '0 8px'
};

const headCellStyle: React.CSSProperties = {
  textAlign: 'left',
  fontSize: '0.72rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--cmp-text-muted)',
  padding: '0.35rem 0.55rem',
  borderBottom: '1px solid color-mix(in srgb, var(--cmp-border-default) 40%, transparent)'
};

const cellStyle: React.CSSProperties = {
  padding: '0.55rem 0.65rem',
  background: 'var(--cmp-surface-panel)',
  borderRadius: '0.65rem',
  border: '1px solid color-mix(in srgb, var(--cmp-border-default) 24%, transparent)',
  verticalAlign: 'top'
};

const DurationSwatch: React.FC<{ spec: DurationSpec; engaged: boolean }> = ({ spec, engaged }) => {
  const width = engaged ? '100%' : '32%';
  return (
    <div style={{ display: 'grid', gap: '0.4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <strong>{spec.label}</strong>
        <code>{spec.token}</code>
      </div>
      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--cmp-text-muted)' }}>{spec.usage}</p>
      <div
        aria-hidden="true"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          height: '0.65rem',
          borderRadius: '999px',
          background: 'color-mix(in srgb, var(--cmp-surface-subtle) 60%, transparent)'
        }}
      >
        <span
          style={{
            display: 'inline-block',
            height: '100%',
            width,
            maxWidth: '100%',
            borderRadius: 'inherit',
            background:
              spec.label === 'Slow'
                ? 'linear-gradient(90deg, var(--cmp-surface-action), var(--cmp-text-accent)'
                : 'linear-gradient(90deg, var(--cmp-text-accent), color-mix(in srgb, var(--cmp-text-accent) 65%, transparent))',
            transitionProperty: 'width',
            transitionDuration: `var(${spec.cssVar})`,
            transitionTimingFunction: 'var(--motion-easing-emphasized)'
          }}
        />
      </div>
      <small style={{ fontSize: '0.75rem', color: 'var(--cmp-text-muted)' }}>
        Duration: {lookupTokenValue(spec.token)}
      </small>
    </div>
  );
};

const TransitionRow: React.FC<{ spec: TransitionSpec }> = ({ spec }) => {
  const duration = lookupTokenValue(transitionToken(spec.slug, 'duration'));
  const delay = lookupTokenValue(transitionToken(spec.slug, 'delay'));
  const easing = lookupTokenValue(transitionToken(spec.slug, 'timing-function'));

  return (
    <tr>
      <td style={cellStyle}>
        <div style={{ display: 'grid', gap: '0.25rem' }}>
          <strong>{spec.label}</strong>
          <span style={{ fontSize: '0.82rem', color: 'var(--cmp-text-muted)' }}>{spec.usage}</span>
          <code>{spec.slug}</code>
        </div>
      </td>
      <td style={cellStyle}>
        <code>{duration}</code>
      </td>
      <td style={cellStyle}>
        <code>{easing}</code>
      </td>
      <td style={cellStyle}>
        <code>{delay}</code>
      </td>
      <td style={cellStyle}>
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.35rem', fontSize: '0.78rem' }}>
          {spec.properties.map((property) => (
            <code key={property}>{property}</code>
          ))}
        </span>
      </td>
    </tr>
  );
};

const useReducedMotionState = () => {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const evaluate = () => {
      const chromatic = root.dataset.chromatic === 'true';
      const result = Boolean(query?.matches || chromatic);
      setReduced(result);
    };

    evaluate();

    if (!query) {
      return;
    }

    const handler = () => evaluate();
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', handler);
      return () => query.removeEventListener('change', handler);
    }
    query.addListener(handler);
    return () => query.removeListener(handler);
  }, []);

  return reduced;
};

const MotionPlayground: React.FC = () => {
  const [chipSelected, setChipSelected] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(true);

  const bannerStyle: React.CSSProperties = useMemo(
    () => ({
      transform: bannerVisible ? 'translateY(0)' : 'translateY(-16px)',
      opacity: bannerVisible ? 1 : 0,
      pointerEvents: bannerVisible ? 'auto' : 'none'
    }),
    [bannerVisible]
  );

  return (
    <section style={{ display: 'grid', gap: '1.25rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Token Playground</h2>
        <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="cmp-button"
            data-selected={chipSelected}
            onClick={() => setChipSelected((prev) => !prev)}
          >
            <span className="cmp-button__label">{chipSelected ? 'Deselect Chip' : 'Select Chip'}</span>
          </button>
          <button type="button" className="cmp-button" onClick={() => setBannerVisible((prev) => !prev)}>
            <span className="cmp-button__label">{bannerVisible ? 'Hide Banner' : 'Show Banner'}</span>
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gap: '1rem' }}>
        <button
          type="button"
          className="cmp-badge"
          aria-pressed={chipSelected}
          data-selected={chipSelected}
          onClick={() => setChipSelected((prev) => !prev)}
          style={{ justifySelf: 'start' }}
        >
          <span className="cmp-badge__icon">★</span>
          <span className="cmp-badge__label">{chipSelected ? 'Chip Active' : 'Chip Idle'}</span>
        </button>

        <article className="cmp-banner" style={bannerStyle} data-has-actions="true">
          <div className="cmp-banner__icon">ℹ️</div>
          <div className="cmp-banner__content">
            <strong className="cmp-banner__title">Banner Reveal</strong>
            <p className="cmp-banner__message">
              Toggle the visibility to observe how the banner relies on <code>banner-reveal</code> tokens. Reduced motion
              collapses the transition to an instant state.
            </p>
          </div>
          <div className="cmp-banner__actions">
            <button type="button" className="cmp-banner__action">
              Acknowledge
            </button>
            <button type="button" className="cmp-banner__dismiss" onClick={() => setBannerVisible(false)}>
              Close
            </button>
          </div>
        </article>
      </div>
    </section>
  );
};

const FoundationsMotionDoc: React.FC = () => {
  const [durationsEngaged, setDurationsEngaged] = useState(false);
  const reducedMotion = useReducedMotionState();

  return (
    <div style={{ display: 'grid', gap: '2rem', padding: '2.5rem', paddingBottom: '3rem' }}>
      <section style={{ display: 'grid', gap: '0.85rem' }}>
        <h1 style={{ margin: 0 }}>Motion Tokens</h1>
        <p style={{ margin: 0, maxWidth: '50ch', color: 'var(--cmp-text-muted)', fontSize: '1rem', lineHeight: 1.55 }}>
          Motion tokens capture the shared durations, easing curves, and transition recipes used across the Explorer. They map
          directly to CSS custom properties, respect <code>prefers-reduced-motion</code>, and are automatically disabled for
          Chromatic snapshots to keep visual regressions stable.
        </p>
        <div
          role="status"
          aria-live="polite"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 0.85rem',
            borderRadius: '0.75rem',
            border: '1px solid color-mix(in srgb, var(--cmp-border-default) 30%, transparent)',
            background: 'color-mix(in srgb, var(--cmp-surface-panel) 75%, transparent)',
            fontSize: '0.85rem',
            color: 'var(--cmp-text-muted)'
          }}
        >
          <span aria-hidden="true">{reducedMotion ? '◼︎' : '◯'}</span>
          {reducedMotion
            ? 'Reduced motion is active (system preference or Chromatic snapshot). All transitions resolve instantly.'
            : 'Full motion is active. Switch your OS setting to “Reduce Motion” to preview instant fallbacks.'}
        </div>
      </section>

      <section style={{ display: 'grid', gap: '1.2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Durations</h2>
          <button type="button" className="cmp-button" onClick={() => setDurationsEngaged((prev) => !prev)}>
            <span className="cmp-button__label">{durationsEngaged ? 'Reset Samples' : 'Play Samples'}</span>
          </button>
        </div>
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))' }}>
          {durationSpecs.map((spec) => (
            <article key={spec.token} style={cardStyle}>
              <DurationSwatch spec={spec} engaged={durationsEngaged} />
            </article>
          ))}
        </div>
      </section>

      <MotionPlayground />

      <section style={{ display: 'grid', gap: '1rem' }}>
        <h2 style={{ margin: 0 }}>Transition Recipes</h2>
        <p style={{ margin: 0, maxWidth: '60ch', color: 'var(--cmp-text-muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
          Each transition token exposes duration, easing, and delay components. Components bind these values through
          <code>motion.css</code>, and reduced-motion fallbacks switch to the zero-duration variants emitted by the token build.
        </p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...headCellStyle, width: '28%' }}>Transition</th>
              <th style={{ ...headCellStyle, width: '14%' }}>Duration</th>
              <th style={{ ...headCellStyle, width: '18%' }}>Easing</th>
              <th style={{ ...headCellStyle, width: '12%' }}>Delay</th>
              <th style={headCellStyle}>Properties</th>
            </tr>
          </thead>
          <tbody>
            {transitionSpecs.map((spec) => (
              <TransitionRow key={spec.slug} spec={spec} />
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default FoundationsMotionDoc;
