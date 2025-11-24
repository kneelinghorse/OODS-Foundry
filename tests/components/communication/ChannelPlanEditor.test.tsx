/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { ChannelPlanEditor } from '@/components/communication/ChannelPlanEditor.js';
import type { DeliveryPolicy } from '@/schemas/communication/delivery-policy.js';

const BASE_POLICY: DeliveryPolicy = {
  id: 'policy-standard',
  name: 'Standard',
  retry: { max_attempts: 3, backoff_strategy: 'exponential', initial_delay_seconds: 30 },
  throttling: { max_per_minute: 60, max_per_hour: 480, max_per_day: 4800 },
  priority: 'normal',
  metadata: {},
};

describe('ChannelPlanEditor', () => {
  it('renders retry and throttling sections', () => {
    const onChange = vi.fn();
    render(<ChannelPlanEditor policy={BASE_POLICY} channelTypes={['email']} onChange={onChange} />);

    expect(screen.getByLabelText(/Retry strategy/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Throttling/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Max attempts/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Per minute/i)).toBeInTheDocument();
  });

  it('invokes onChange with updated retry attempts', async () => {
    const onChange = vi.fn();
    render(<ChannelPlanEditor policy={BASE_POLICY} channelTypes={['email', 'sms']} onChange={onChange} />);

    const input = screen.getByLabelText(/Max attempts/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '5' } });

    expect(onChange).toHaveBeenCalled();
    const [nextPolicy, validation] = onChange.mock.calls.at(-1) ?? [];
    expect((nextPolicy as DeliveryPolicy).retry.max_attempts).toBe(5);
    expect(validation.isValid).toBe(true);
  });
});
