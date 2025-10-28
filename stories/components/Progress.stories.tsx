/**
 * @file Progress component stories
 */

import { useState, useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ProgressLinear } from '~/src/components/progress/ProgressLinear';
import { ProgressCircular } from '~/src/components/progress/ProgressCircular';
import type {
  ProgressIntent,
  ProgressSize,
} from '~/src/components/progress/types';

const meta: Meta = {
  title: 'Components/Progression/Progress',
};
export default meta;

type Story = StoryObj;

// ============================================================================
// Linear Progress Stories
// ============================================================================

export const LinearDeterminate: Story = {
  name: 'Linear - Determinate',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 400 }}>
      <div>
        <div style={{ marginBottom: 8, fontSize: 14 }}>25% complete</div>
        <ProgressLinear value={25} intent="info" label="Upload progress" />
      </div>
      <div>
        <div style={{ marginBottom: 8, fontSize: 14 }}>65% complete</div>
        <ProgressLinear value={65} intent="info" label="Processing" />
      </div>
      <div>
        <div style={{ marginBottom: 8, fontSize: 14 }}>100% complete</div>
        <ProgressLinear value={100} intent="success" label="Upload complete" />
      </div>
    </div>
  ),
};

export const LinearIndeterminate: Story = {
  name: 'Linear - Indeterminate',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 400 }}>
      <div>
        <div style={{ marginBottom: 8, fontSize: 14 }}>Loading...</div>
        <ProgressLinear isIndeterminate intent="info" label="Loading content" />
      </div>
    </div>
  ),
};

export const LinearIntents: Story = {
  name: 'Linear - All Intents',
  render: () => {
    const intents: ProgressIntent[] = ['info', 'success', 'warning', 'error'];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 400 }}>
        {intents.map((intent) => (
          <div key={intent}>
            <div style={{ marginBottom: 8, fontSize: 14, textTransform: 'capitalize' }}>
              {intent} (75%)
            </div>
            <ProgressLinear value={75} intent={intent} label={`${intent} progress`} />
          </div>
        ))}
      </div>
    );
  },
};

export const LinearSizes: Story = {
  name: 'Linear - Size Variants',
  render: () => {
    const sizes: ProgressSize[] = ['sm', 'md', 'lg'];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 400 }}>
        {sizes.map((size) => (
          <div key={size}>
            <div style={{ marginBottom: 8, fontSize: 14, textTransform: 'uppercase' }}>
              Size: {size}
            </div>
            <ProgressLinear value={60} size={size} intent="info" label={`${size} progress`} />
          </div>
        ))}
      </div>
    );
  },
};

export const LinearAnimated: Story = {
  name: 'Linear - Animated Transition',
  render: () => {
    const [value, setValue] = useState(0);

    useEffect(() => {
      const interval = setInterval(() => {
        setValue((prev) => {
          if (prev >= 100) {
            return 0;
          }
          return prev + 5;
        });
      }, 200);

      return () => clearInterval(interval);
    }, []);

    return (
      <div style={{ maxWidth: 400 }}>
        <div style={{ marginBottom: 8, fontSize: 14 }}>{value}% complete</div>
        <ProgressLinear value={value} intent="info" label="Animated progress" />
      </div>
    );
  },
};

// ============================================================================
// Circular Progress Stories
// ============================================================================

export const CircularDeterminate: Story = {
  name: 'Circular - Determinate',
  render: () => (
    <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <ProgressCircular value={25} intent="info" label="25% complete" />
        <div style={{ marginTop: 8, fontSize: 14 }}>25%</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <ProgressCircular value={50} intent="info" label="50% complete" />
        <div style={{ marginTop: 8, fontSize: 14 }}>50%</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <ProgressCircular value={75} intent="info" label="75% complete" />
        <div style={{ marginTop: 8, fontSize: 14 }}>75%</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <ProgressCircular value={100} intent="success" label="Complete" />
        <div style={{ marginTop: 8, fontSize: 14 }}>100%</div>
      </div>
    </div>
  ),
};

export const CircularIndeterminate: Story = {
  name: 'Circular - Indeterminate (Spinner)',
  render: () => (
    <div style={{ textAlign: 'center' }}>
      <ProgressCircular isIndeterminate intent="info" label="Loading..." />
      <div style={{ marginTop: 8, fontSize: 14 }}>Loading...</div>
    </div>
  ),
};

export const CircularIntents: Story = {
  name: 'Circular - All Intents',
  render: () => {
    const intents: ProgressIntent[] = ['info', 'success', 'warning', 'error'];
    return (
      <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
        {intents.map((intent) => (
          <div key={intent} style={{ textAlign: 'center' }}>
            <ProgressCircular value={70} intent={intent} label={`${intent} progress`} />
            <div style={{ marginTop: 8, fontSize: 14, textTransform: 'capitalize' }}>
              {intent}
            </div>
          </div>
        ))}
      </div>
    );
  },
};

export const CircularSizes: Story = {
  name: 'Circular - Custom Sizes',
  render: () => {
    const sizes = [
      { diameter: 24, strokeWidth: 3, label: 'Small (24px)' },
      { diameter: 40, strokeWidth: 4, label: 'Medium (40px)' },
      { diameter: 64, strokeWidth: 6, label: 'Large (64px)' },
    ];

    return (
      <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
        {sizes.map((config) => (
          <div key={config.diameter} style={{ textAlign: 'center' }}>
            <ProgressCircular
              value={60}
              diameter={config.diameter}
              strokeWidth={config.strokeWidth}
              intent="info"
              label={config.label}
            />
            <div style={{ marginTop: 8, fontSize: 12 }}>{config.label}</div>
          </div>
        ))}
      </div>
    );
  },
};

export const CircularAnimated: Story = {
  name: 'Circular - Animated Transition',
  render: () => {
    const [value, setValue] = useState(0);

    useEffect(() => {
      const interval = setInterval(() => {
        setValue((prev) => {
          if (prev >= 100) {
            return 0;
          }
          return prev + 5;
        });
      }, 200);

      return () => clearInterval(interval);
    }, []);

    return (
      <div style={{ textAlign: 'center' }}>
        <ProgressCircular value={value} intent="info" label="Animated progress" />
        <div style={{ marginTop: 8, fontSize: 14 }}>{value}%</div>
      </div>
    );
  },
};
