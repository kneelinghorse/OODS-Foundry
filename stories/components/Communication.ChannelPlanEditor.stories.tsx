import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { ChannelPlanEditor } from '../../src/components/communication/ChannelPlanEditor.js';
import type { ChannelPlanValidationResult } from '../../src/components/communication/ChannelPlanEditor.js';
import type { DeliveryPolicy } from '../../src/schemas/communication/delivery-policy.js';

type Story = StoryObj<typeof ChannelPlanEditor>;

const meta: Meta<typeof ChannelPlanEditor> = {
  title: 'Domain Patterns/Communication/Channel Plan Editor',
  component: ChannelPlanEditor,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

export const Default: Story = {
  render: () => <ChannelPlanEditorStory />,
};

function ChannelPlanEditorStory(): JSX.Element {
  const [policy, setPolicy] = useState<DeliveryPolicy>(() => buildBasePolicy());
  const [validation, setValidation] = useState<ChannelPlanValidationResult | null>(null);

  return (
    <div className="min-h-screen bg-[--cmp-surface-canvas] p-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[--sys-text-muted]">Communication</p>
          <h1 className="text-lg font-semibold text-[--sys-text-primary]">ChannelPlanEditor</h1>
          <p className="text-sm text-[--sys-text-muted]">
            Edit retry and throttling policies for email, SMS, and push channels. Changes are validated live.
          </p>
        </header>
        <ChannelPlanEditor
          policy={policy}
          channelTypes={['email', 'sms', 'push']}
          onChange={(next, nextValidation) => {
            setPolicy(next);
            setValidation(nextValidation);
          }}
        />
        <pre className="mt-2 overflow-auto rounded-md bg-[--cmp-surface-subtle] p-3 text-xs text-[--sys-text-muted]">
          <code>{JSON.stringify({ policy, validation }, null, 2)}</code>
        </pre>
      </div>
    </div>
  );
}

function buildBasePolicy(): DeliveryPolicy {
  return {
    id: 'policy-standard',
    name: 'Standard communication',
    retry: { max_attempts: 3, backoff_strategy: 'exponential', initial_delay_seconds: 30 },
    throttling: { max_per_minute: 60, max_per_hour: 480, max_per_day: 4800 },
    priority: 'normal',
    metadata: { channel_types: ['email', 'sms', 'push'] },
  };
}

