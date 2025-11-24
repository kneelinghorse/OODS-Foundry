/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { DeliveryHealthWidget } from '@/components/communication/DeliveryHealthWidget.js';
import type { DeliveryHealthMetrics } from '@/components/communication/DeliveryHealthWidget.js';

const METRICS: DeliveryHealthMetrics = {
  timeToSend: {
    value: 110_000,
    p50: 90_000,
    p95: 150_000,
    p99: 220_000,
    count: 42,
    windowStart: new Date('2025-11-23T00:00:00Z'),
    windowEnd: new Date('2025-11-24T00:00:00Z'),
  },
  successRate: {
    value: 97.4,
    p50: 96.2,
    p95: 98.1,
    p99: 99.0,
    count: 42,
    windowStart: new Date('2025-11-23T00:00:00Z'),
    windowEnd: new Date('2025-11-24T00:00:00Z'),
  },
  retryExhaustionRate: 0.5,
  trend: [100_000, 120_000, 90_000],
};

describe('DeliveryHealthWidget', () => {
  it('renders metrics and progressbars', () => {
    render(<DeliveryHealthWidget metrics={METRICS} timeWindow="24h" />);

    expect(screen.getByRole('heading', { name: /Delivery health/i })).toBeInTheDocument();
    expect(screen.getByText(/24h/)).toBeInTheDocument();

    const successRateBar = screen.getByRole('progressbar', { name: /Delivery success rate/i });
    expect(successRateBar).toHaveAttribute('aria-valuenow', METRICS.successRate.value.toString());
  });
});

