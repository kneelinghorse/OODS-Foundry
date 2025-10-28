import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import {
  measureAsync,
  measureSync,
  markStart,
  markEnd,
  PerfProfiler,
  initProfilerMetrics,
  clearProfilerMetrics,
} from '~/src/perf/instrumentation';
import { Button } from '~/src/components/base/Button';
import '~/src/styles/globals.css';

const meta: Meta = {
  title: 'Explorer/Performance/Token Transform Harness',
  parameters: {
    layout: 'padded',
    chromatic: { disableSnapshot: true },
    controls: { hideNoControlsWarning: true },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

const Container: React.FC<React.PropsWithChildren<{ readonly id: string }>> = ({ id, children }) => {
  if (typeof window !== 'undefined' && !Array.isArray(window.__PERF_PROFILER_METRICS__)) {
    initProfilerMetrics();
  }
  useEffect(() => {
    return () => {
      clearProfilerMetrics();
    };
  }, []);
  return (
    <PerfProfiler id={id}>
      <div
        style={{
          display: 'grid',
          gap: '1rem',
          maxWidth: '32rem',
          padding: '1.5rem',
          borderRadius: '1rem',
          background:
            'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(236,72,153,0.08))',
        }}
      >
        {children}
      </div>
    </PerfProfiler>
  );
};

const BrandSwitchDemo: React.FC = () => {
  const [brand, setBrand] = useState<'brand-a' | 'brand-b'>('brand-a');
  const [duration, setDuration] = useState<number | null>(null);

  const handleSwitch = async () => {
    const nextBrand = brand === 'brand-a' ? 'brand-b' : 'brand-a';

    const { duration: elapsed } = await measureAsync('TokenTransform.BrandSwitch', () => {
      return new Promise<void>((resolve) => {
        const root = document.documentElement;
        requestAnimationFrame(() => {
          root.setAttribute('data-brand', nextBrand);
          requestAnimationFrame(() => {
            setBrand(nextBrand);
            resolve();
          });
        });
      });
    });

    setDuration(elapsed);
  };

  return (
    <Container id='TokenTransform.BrandSwitch'>
      <h2 style={{ margin: 0 }}>Brand attribute switch</h2>
      <p style={{ margin: 0, fontSize: '0.875rem', color: '#1f2937' }}>
        Toggles <code>data-brand</code> on <code>document.documentElement</code> to emulate token pipeline changes.
      </p>
      <Button data-testid="perf-brand-toggle" onClick={handleSwitch}>
        Switch brand (current: {brand})
      </Button>
      <span style={{ fontSize: '0.75rem', color: '#4b5563' }}>
        Last brand switch:{' '}
        <strong data-testid="perf-brand-duration">
          {duration !== null ? `${duration.toFixed(2)} ms` : '—'}
        </strong>
      </span>
    </Container>
  );
};

const ThemeToggleDemo: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [duration, setDuration] = useState<number | null>(null);

  const handleToggle = async () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';

    const { duration: elapsed } = await measureAsync('TokenTransform.ThemeToggle', () => {
      return new Promise<void>((resolve) => {
        const root = document.documentElement;
        requestAnimationFrame(() => {
          root.setAttribute('data-theme', nextTheme);
          requestAnimationFrame(() => {
            setTheme(nextTheme);
            resolve();
          });
        });
      });
    });

    setDuration(elapsed);
  };

  return (
    <Container id='TokenTransform.ThemeToggle'>
      <h2 style={{ margin: 0 }}>Theme toggle</h2>
      <p style={{ margin: 0, fontSize: '0.875rem', color: '#1f2937' }}>
        Measures DOM mutations triggered by theme switches and resulting token re-resolution.
      </p>
      <Button data-testid="perf-theme-toggle" onClick={handleToggle}>
        Toggle theme (current: {theme})
      </Button>
      <span style={{ fontSize: '0.75rem', color: '#4b5563' }}>
        Last theme toggle:{' '}
        <strong data-testid="perf-theme-duration">
          {duration !== null ? `${duration.toFixed(2)} ms` : '—'}
        </strong>
      </span>
    </Container>
  );
};

const TokenResolutionDemo: React.FC = () => {
  const [duration, setDuration] = useState<number | null>(null);

  const resolveTokens = () => {
    markStart('TokenTransform.Resolution');
    const style = getComputedStyle(document.documentElement);
    const tokens = [
      '--sys-color-surface-base',
      '--sys-color-text-primary',
      '--sys-spacing-inset-base',
      '--sys-typography-body-md',
      '--sys-border-radius-md',
    ];

    tokens.forEach((token) => style.getPropertyValue(token));
    const elapsed = markEnd('TokenTransform.Resolution');
    setDuration(elapsed);
  };

  return (
    <Container id='TokenTransform.Resolution'>
      <h2 style={{ margin: 0 }}>Token resolution</h2>
      <p style={{ margin: 0, fontSize: '0.875rem', color: '#1f2937' }}>
        Measures lookups across a curated list of system tokens after transforms are applied.
      </p>
      <Button data-testid="perf-token-resolve" onClick={resolveTokens}>
        Resolve token set
      </Button>
      <span style={{ fontSize: '0.75rem', color: '#4b5563' }}>
        Last resolution:{' '}
        <strong data-testid="perf-token-duration">
          {duration !== null ? `${duration.toFixed(2)} ms` : '—'}
        </strong>
      </span>
    </Container>
  );
};

export const BrandSwitch: Story = {
  name: 'Brand switch',
  render: () => <BrandSwitchDemo />,
};

export const ThemeToggle: Story = {
  name: 'Theme toggle',
  render: () => <ThemeToggleDemo />,
};

export const TokenResolution: Story = {
  name: 'Token resolution',
  render: () => <TokenResolutionDemo />,
};
