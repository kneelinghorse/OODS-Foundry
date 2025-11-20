import { describe, expect, it } from 'vitest';

import { createCommunicableTrait } from '@/traits/communication/communication-trait.js';

const sampleChannel = {
  id: 'primary-email',
  name: 'Primary Email',
  type: 'email',
  enabled: true,
  config: {
    provider: 'smtp',
    host: 'smtp.example.com',
    port: 587,
    secure: true,
    from: { name: 'Notifications', email: 'notifications@example.com' },
  },
};

const sampleTemplate = {
  id: 'welcome-email-v1',
  name: 'Welcome Email',
  channel_type: 'email',
  subject: 'Welcome, {{user.name}}',
  body: 'Hi {{user.name}}, welcome to {{organization.name}}.',
  variables: ['user.name', 'organization.name'],
  locale: 'en-US',
};

const samplePolicy = {
  id: 'standard-policy',
  name: 'Standard Delivery',
  priority: 'normal',
  retry: { max_attempts: 3, backoff_strategy: 'exponential', initial_delay_seconds: 30 },
  throttling: { max_per_minute: 60, max_per_hour: 500, max_per_day: 5000 },
};

describe('CommunicableTrait runtime', () => {
  it('exposes channels and templates', () => {
    const trait = createCommunicableTrait({
      channels: [sampleChannel],
      templates: [sampleTemplate],
      deliveryPolicies: [samplePolicy],
    });

    expect(trait.getChannels()).toHaveLength(1);
    expect(trait.getTemplates('email')).toHaveLength(1);
    expect(trait.getDeliveryPolicies()).toHaveLength(1);
  });

  it('queues messages and records status transitions', () => {
    const trait = createCommunicableTrait({
      channels: [sampleChannel],
      templates: [sampleTemplate],
      deliveryPolicies: [samplePolicy],
    });

    const queueResult = trait.queueMessage({
      id: 'msg_01hf0v1',
      sender_id: 'user_admin',
      recipient_ids: ['user_new'],
      channel_type: 'email',
      template_id: sampleTemplate.id,
      variables: {
        'user.name': 'Jordan',
        'organization.name': 'OODS',
      },
      created_at: '2025-11-20T05:00:00Z',
      status: 'queued',
      status_history: [
        {
          message_id: 'msg_01hf0v1',
          state: 'queued',
          occurred_at: '2025-11-20T05:00:00Z',
        },
      ],
    }, samplePolicy.id);

    expect(queueResult.success).toBe(true);
    expect(trait.getMessages()).toHaveLength(1);

    const statusResult = trait.recordStatus('msg_01hf0v1', {
      message_id: 'msg_01hf0v1',
      state: 'sent',
      occurred_at: '2025-11-20T05:01:00Z',
    });

    expect(statusResult.success).toBe(true);
    expect(trait.getStatusHistory('msg_01hf0v1')).toHaveLength(2);
  });

  it('rejects disallowed channel types when a whitelist is provided', () => {
    const trait = createCommunicableTrait({}, { enforceChannelWhitelist: ['email'] });
    const smsChannel = { ...sampleChannel, id: 'sms-primary', type: 'sms', config: { provider: 'twilio', sender_id: '12345' } };
    const result = trait.registerChannel(smsChannel);

    expect(result.success).toBe(false);
  });
});
