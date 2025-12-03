import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { DeliveryHealthWidget } from '../../src/components/communication/DeliveryHealthWidget.js';
import type { DeliveryHealthMetrics } from '../../src/components/communication/DeliveryHealthWidget.js';

type Story = StoryObj<typeof DeliveryHealthWidget>;

const meta: Meta<typeof DeliveryHealthWidget> = {
  title: 'Domain Patterns/Communication/Delivery Health Widget',
  component: DeliveryHealthWidget,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

export const Default: Story = {
  render: () => (
    <div className="min-h-screen bg-[--cmp-surface-canvas] p-8">
      <div className="mx-auto max-w-xl">
        <DeliveryHealthWidget metrics={buildMetrics()} timeWindow="24h" />
      </div>
    </div>
  ),
};

function buildMetrics(): DeliveryHealthMetrics {
  const now = new Date('2025-11-24T12:00:00Z');
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  return {
    timeToSend: {
      value: 110_000,
      p50: 90_000,
      p95: 150_000,
      p99: 220_000,
      count: 42,
      windowStart,
      windowEnd: now,
    },
    successRate: {
      value: 97.4,
      p50: 96.2,
      p95: 98.1,
      p99: 99.0,
      count: 42,
      windowStart,
      windowEnd: now,
    },
    retryExhaustionRate: 0.5,
    trend: [120_000, 95_000, 110_000, 90_000, 132_000],
  };
}

