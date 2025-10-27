/**
 * @file Progress components test suite
 */

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProgressLinear } from '../../src/components/progress/ProgressLinear.js';
import { ProgressCircular } from '../../src/components/progress/ProgressCircular.js';

describe('<ProgressLinear>', () => {
  it('renders determinate progress with correct ARIA attributes', () => {
    const markup = renderToStaticMarkup(
      <ProgressLinear value={65} intent="info" label="Upload progress" />
    );

    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-valuenow="65"');
    expect(markup).toContain('aria-valuemin="0"');
    expect(markup).toContain('aria-valuemax="100"');
    expect(markup).toContain('aria-label="Upload progress"');
    expect(markup).toContain('data-intent="info"');
  });

  it('renders indeterminate progress without value attributes', () => {
    const markup = renderToStaticMarkup(
      <ProgressLinear isIndeterminate intent="info" label="Loading" />
    );

    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-label="Loading"');
    expect(markup).toContain('progress-linear--indeterminate');
    expect(markup).not.toContain('aria-valuenow');
  });

  it('applies intent-based CSS variables', () => {
    const markup = renderToStaticMarkup(
      <ProgressLinear value={50} intent="success" />
    );

    expect(markup).toContain('--progress-linear-fill');
    expect(markup).toContain('data-intent="success"');
  });

  it('maps intents to Statusables tokens without literal colors', () => {
    const markup = renderToStaticMarkup(
      <ProgressLinear value={40} intent="warning" />
    );

    expect(markup).toMatch(/--progress-linear-fill:\s*var\(--cmp-status-warning-border\)/);
    expect(markup).toMatch(/--progress-linear-track:\s*var\(--cmp-status-neutral-surface\)/);
    expect(markup).not.toContain('#');
  });

  it('renders all size variants', () => {
    const sizes = ['sm', 'md', 'lg'] as const;
    sizes.forEach((size) => {
      const markup = renderToStaticMarkup(
        <ProgressLinear value={50} size={size} />
      );
      expect(markup).toContain(`data-size="${size}"`);
      expect(markup).toContain('--progress-linear-height');
    });
  });

  it('clamps values to 0-100 range', () => {
    const overMarkup = renderToStaticMarkup(<ProgressLinear value={150} />);
    const underMarkup = renderToStaticMarkup(<ProgressLinear value={-20} />);

    expect(overMarkup).toContain('aria-valuenow="100"');
    expect(underMarkup).toContain('aria-valuenow="0"');
  });

  it('respects custom maximum values in aria contract', () => {
    const markup = renderToStaticMarkup(<ProgressLinear value={30} max={120} />);

    expect(markup).toContain('aria-valuenow="30"');
    expect(markup).toContain('aria-valuemax="120"');
  });

  it('renders all intent variants with tokens', () => {
    const intents = ['info', 'success', 'warning', 'error'] as const;
    intents.forEach((intent) => {
      const markup = renderToStaticMarkup(
        <ProgressLinear value={75} intent={intent} />
      );
      expect(markup).toContain(`data-intent="${intent}"`);
      expect(markup).toContain('--progress-linear-fill');
      expect(markup).toContain('--progress-linear-track');
    });
  });
});

describe('<ProgressCircular>', () => {
  it('renders determinate circular progress with ARIA attributes', () => {
    const markup = renderToStaticMarkup(
      <ProgressCircular value={75} intent="success" label="Processing" />
    );

    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-valuenow="75"');
    expect(markup).toContain('aria-valuemin="0"');
    expect(markup).toContain('aria-valuemax="100"');
    expect(markup).toContain('aria-label="Processing"');
  });

  it('renders indeterminate circular progress (spinner)', () => {
    const markup = renderToStaticMarkup(
      <ProgressCircular isIndeterminate intent="info" label="Loading" />
    );

    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('progress-circular--indeterminate');
    expect(markup).not.toContain('aria-valuenow');
  });

  it('renders SVG with correct dimensions', () => {
    const markup = renderToStaticMarkup(
      <ProgressCircular value={50} diameter={40} strokeWidth={4} />
    );

    expect(markup).toContain('<svg');
    expect(markup).toContain('width="40"');
    expect(markup).toContain('height="40"');
    expect(markup).toContain('viewBox="0 0 40 40"');
  });

  it('supports custom diameter and stroke width', () => {
    const markup = renderToStaticMarkup(
      <ProgressCircular value={60} diameter={64} strokeWidth={6} />
    );

    expect(markup).toContain('--progress-circular-diameter');
    expect(markup).toContain('--progress-circular-stroke-width');
    expect(markup).toContain('width="64"');
  });

  it('renders track and fill circles', () => {
    const markup = renderToStaticMarkup(
      <ProgressCircular value={50} intent="info" />
    );

    // Should have two circles: track and fill
    const circleMatches = markup.match(/<circle/g);
    expect(circleMatches).toHaveLength(2);
    expect(markup).toContain('progress-circular__track');
    expect(markup).toContain('progress-circular__fill');
  });

  it('applies intent-based colors', () => {
    const intents = ['info', 'success', 'warning', 'error'] as const;
    intents.forEach((intent) => {
      const markup = renderToStaticMarkup(
        <ProgressCircular value={70} intent={intent} />
      );
      expect(markup).toContain(`data-intent="${intent}"`);
      expect(markup).toContain('--progress-circular-fill');
    });
  });

  it('uses Statusables tokens for circular intents', () => {
    const markup = renderToStaticMarkup(
      <ProgressCircular value={55} intent="error" />
    );

    expect(markup).toMatch(/--progress-circular-fill:\s*var\(--cmp-status-critical-border\)/);
    expect(markup).toMatch(/--progress-circular-track:\s*var\(--cmp-status-neutral-surface\)/);
  });
});

// Accessibility contract tests
describe('Progress accessibility', () => {
  it('ProgressLinear meets WCAG progressbar requirements', () => {
    const markup = renderToStaticMarkup(
      <ProgressLinear value={50} label="Test progress" />
    );

    // Must have role="progressbar"
    expect(markup).toContain('role="progressbar"');
    // Must have aria-label
    expect(markup).toContain('aria-label="Test progress"');
    // Determinate must have value attributes
    expect(markup).toContain('aria-valuenow');
    expect(markup).toContain('aria-valuemin');
    expect(markup).toContain('aria-valuemax');
  });

  it('ProgressCircular meets WCAG progressbar requirements', () => {
    const markup = renderToStaticMarkup(
      <ProgressCircular value={75} label="Upload" />
    );

    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-label="Upload"');
    expect(markup).toContain('aria-valuenow="75"');
  });

  it('indeterminate progress omits value attributes per spec', () => {
    const linearMarkup = renderToStaticMarkup(
      <ProgressLinear isIndeterminate label="Loading" />
    );
    const circularMarkup = renderToStaticMarkup(
      <ProgressCircular isIndeterminate label="Loading" />
    );

    // Indeterminate should NOT have aria-valuenow/min/max
    expect(linearMarkup).not.toContain('aria-valuenow');
    expect(circularMarkup).not.toContain('aria-valuenow');
  });
});
