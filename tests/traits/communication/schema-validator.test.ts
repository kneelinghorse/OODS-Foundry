import { describe, expect, it } from 'vitest';

import {
  isChannel,
  isMessage,
  validateChannel,
  validateMessage,
  validateTemplate,
} from '@/traits/communication/schema-validator.js';

const template = {
  id: 'welcome-email-v1',
  name: 'Welcome Email',
  channel_type: 'email',
  subject: 'Welcome, {{user.name}}',
  body: 'Hi {{user.name}}, welcome to {{organization.name}}.',
  variables: ['user.name', 'organization.name'],
  locale: 'en-US',
};

const channel = {
  id: 'primary-email',
  name: 'Primary Email',
  type: 'email',
  enabled: true,
  config: {
    provider: 'smtp',
    host: 'smtp.example.com',
    port: 465,
    secure: true,
    from: { name: 'Notifications', email: 'notifications@example.com' },
  },
};

const message = {
  id: 'msg_01hf0v1',
  sender_id: 'user_admin',
  recipient_ids: ['user_new'],
  channel_type: 'email',
  template_id: template.id,
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
      attempt: 0,
    },
  ],
};

describe('communication schema validator', () => {
  it('validates channels and exposes type guards', () => {
    const result = validateChannel(channel);
    expect(result.success).toBe(true);
    expect(isChannel(channel)).toBe(true);
  });

  it('validates well-formed messages', () => {
    const result = validateMessage(message);
    expect(result.success).toBe(true);
    expect(isMessage(result.data)).toBe(true);
  });

  it('fails template validation when placeholders do not match variables', () => {
    const invalidTemplate = { ...template, variables: ['user.name'] };
    const result = validateTemplate(invalidTemplate);
    expect(result.success).toBe(false);
    expect(result.errors[0]?.message).toContain('undeclared variables');
  });

  it('fails message validation when timestamps regress', () => {
    const invalid = {
      ...message,
      sent_at: '2025-11-20T04:59:00Z',
    };
    const result = validateMessage(invalid);
    expect(result.success).toBe(false);
    expect(result.errors[0]?.message).toContain('monotonic');
  });
});
