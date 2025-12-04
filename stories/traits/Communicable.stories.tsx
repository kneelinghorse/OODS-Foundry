/**
 * Communicable Trait — Multi-Channel Messaging with Template Governance
 *
 * This story demonstrates the Communicable trait which provides:
 * - Channel catalog (provider configurations)
 * - Template catalog (localized templates with variables)
 * - Delivery policies (retry, throttle, quiet hours)
 * - Messages (atomic payloads)
 * - Conversations (threaded multi-party)
 * - Message statuses (queued → sent → delivered → read)
 *
 * Navigation order follows learning progression:
 * 1. Overview - What is this? What problem does it solve?
 * 2. Channel Grid - Available channels and provider configurations
 * 3. Template System - Template browser with variables and localization
 * 4. Delivery Policies - Retry, throttle, and quiet hour rules
 * 5. Conversations - Threaded message discussions
 * 6. How It Works - Schema and configuration examples
 *
 * Research: R20.1 Canonical Notification Model, R20.6 Message Systems Analysis
 */

import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

/* ─────────────────────────────────────────────────────────────────────────────
 * Style constants (consistent with other trait stories)
 * ───────────────────────────────────────────────────────────────────────────── */

const STYLES = {
  page: {
    padding: '2rem',
    maxWidth: '1000px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  heading: {
    marginTop: 0,
    marginBottom: '0.5rem',
  },
  subheading: {
    color: '#666',
    marginTop: 0,
    marginBottom: '2rem',
    fontWeight: 400 as const,
  },
  section: {
    marginBottom: '3rem',
  },
  groupLabel: {
    fontSize: '0.75rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    color: '#888',
    marginBottom: '0.75rem',
    fontWeight: 600 as const,
  },
  card: {
    padding: '1.5rem',
    borderRadius: '0.75rem',
    border: '1px solid #e0e0e0',
    background: '#fafafa',
  },
  codeBlock: {
    padding: '1rem',
    borderRadius: '0.5rem',
    background: '#1e1e1e',
    color: '#d4d4d4',
    fontFamily: 'ui-monospace, monospace',
    fontSize: '0.875rem',
    lineHeight: 1.6,
    overflow: 'auto' as const,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.25rem 0.75rem',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 600 as const,
  },
} as const;

/* ─────────────────────────────────────────────────────────────────────────────
 * Badge Components
 * ───────────────────────────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: 'active' | 'configured' | 'error' | 'disabled' }): JSX.Element {
  const styles = {
    active: { background: '#dcfce7', color: '#166534', border: '1px solid #86efac', icon: '●' },
    configured: { background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd', icon: '○' },
    error: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', icon: '!' },
    disabled: { background: '#f3f4f6', color: '#6b7280', border: '1px solid #d1d5db', icon: '−' },
  };
  const labels = { active: 'Active', configured: 'Configured', error: 'Error', disabled: 'Disabled' };
  const s = styles[status];
  return (
    <span style={{ ...STYLES.badge, background: s.background, color: s.color, border: s.border }}>
      <span style={{ fontSize: '0.625rem' }}>{s.icon}</span>
      {labels[status]}
    </span>
  );
}

function ChannelBadge({ channel }: { channel: 'email' | 'sms' | 'push' | 'in_app' | 'webhook' }): JSX.Element {
  const styles = {
    email: { background: '#dbeafe', color: '#1e40af', icon: '✉️' },
    sms: { background: '#dcfce7', color: '#166534', icon: '💬' },
    push: { background: '#fef3c7', color: '#92400e', icon: '🔔' },
    in_app: { background: '#f3e8ff', color: '#7c3aed', icon: '📱' },
    webhook: { background: '#f3f4f6', color: '#374151', icon: '🔗' },
  };
  const labels = { email: 'Email', sms: 'SMS', push: 'Push', in_app: 'In-App', webhook: 'Webhook' };
  const s = styles[channel];
  return (
    <span style={{ ...STYLES.badge, background: s.background, color: s.color, border: `1px solid ${s.color}20` }}>
      <span>{s.icon}</span>
      {labels[channel]}
    </span>
  );
}

function MessageStatusBadge({ status }: { status: 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed' }): JSX.Element {
  const styles = {
    queued: { background: '#f3f4f6', color: '#6b7280', icon: '⏳' },
    sending: { background: '#dbeafe', color: '#1e40af', icon: '↗' },
    sent: { background: '#dcfce7', color: '#166534', icon: '✓' },
    delivered: { background: '#dcfce7', color: '#166534', icon: '✓✓' },
    read: { background: '#dbeafe', color: '#1e40af', icon: '👁' },
    failed: { background: '#fef2f2', color: '#dc2626', icon: '✗' },
  };
  const s = styles[status];
  return (
    <span style={{ ...STYLES.badge, background: s.background, color: s.color }}>
      <span style={{ fontSize: '0.75rem' }}>{s.icon}</span>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Sample Data
 * ───────────────────────────────────────────────────────────────────────────── */

const CHANNELS = [
  { type: 'email' as const, provider: 'SendGrid', status: 'active' as const, config: { apiKey: '***', from: 'noreply@example.com' } },
  { type: 'sms' as const, provider: 'Twilio', status: 'active' as const, config: { accountSid: '***', from: '+1234567890' } },
  { type: 'push' as const, provider: 'FCM', status: 'configured' as const, config: { projectId: 'my-project' } },
  { type: 'in_app' as const, provider: 'WebSocket', status: 'active' as const, config: { endpoint: 'wss://notify.example.com' } },
  { type: 'webhook' as const, provider: 'HTTP', status: 'disabled' as const, config: { url: 'https://hooks.example.com' } },
];

const TEMPLATES = [
  {
    id: 'welcome',
    name: 'Welcome Email',
    channels: ['email'] as const,
    subject: 'Welcome to {{ app.name }}, {{ user.name }}!',
    body: 'Hi {{ user.name }},\n\nThank you for joining {{ app.name }}. Your account is ready.',
    variables: ['user.name', 'app.name'],
    locales: ['en', 'es', 'fr'],
  },
  {
    id: 'order_confirmation',
    name: 'Order Confirmation',
    channels: ['email', 'sms'] as const,
    subject: 'Order #{{ order.id }} Confirmed',
    body: 'Your order #{{ order.id }} for {{ order.total }} has been confirmed.',
    variables: ['order.id', 'order.total', 'user.name'],
    locales: ['en', 'es'],
  },
  {
    id: 'password_reset',
    name: 'Password Reset',
    channels: ['email'] as const,
    subject: 'Reset your password',
    body: 'Click the link to reset your password: {{ reset.url }}',
    variables: ['user.name', 'reset.url', 'reset.expiry'],
    locales: ['en', 'es', 'fr', 'de'],
  },
];

const SAMPLE_MESSAGES = [
  { id: 'msg_001', template: 'welcome', channel: 'email', recipient: 'jane@example.com', status: 'delivered' as const, sentAt: '2025-12-04T10:30:00Z', deliveredAt: '2025-12-04T10:30:05Z' },
  { id: 'msg_002', template: 'order_confirmation', channel: 'sms', recipient: '+1987654321', status: 'sent' as const, sentAt: '2025-12-04T10:45:00Z' },
  { id: 'msg_003', template: 'password_reset', channel: 'email', recipient: 'john@example.com', status: 'queued' as const },
  { id: 'msg_004', template: 'welcome', channel: 'email', recipient: 'error@invalid', status: 'failed' as const, error: 'Invalid email address' },
];

const CONVERSATION = {
  id: 'conv_001',
  subject: 'Order #12345 - Delivery Question',
  status: 'open' as const,
  participants: [
    { id: 'user_001', name: 'Jane Customer', role: 'customer' },
    { id: 'agent_001', name: 'Support Agent', role: 'agent' },
  ],
  messages: [
    { id: 'cm_001', sender: 'user_001', content: 'Hi, I have a question about my order delivery.', timestamp: '2025-12-04T09:00:00Z', status: 'read' as const },
    { id: 'cm_002', sender: 'agent_001', content: 'Hello Jane! I would be happy to help. What is your order number?', timestamp: '2025-12-04T09:05:00Z', status: 'read' as const },
    { id: 'cm_003', sender: 'user_001', content: 'It is order #12345. When will it arrive?', timestamp: '2025-12-04T09:10:00Z', status: 'delivered' as const },
  ],
};

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. OVERVIEW — What is Communicable?
 * ───────────────────────────────────────────────────────────────────────────── */

function OverviewStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Communicable</h1>
      <h2 style={STYLES.subheading}>
        Multi-channel messaging with template governance and delivery policies
      </h2>

      <section style={STYLES.section}>
        <p style={{ fontSize: '1.125rem', lineHeight: 1.7, marginBottom: '2rem' }}>
          Communicable unifies <strong>multi-channel delivery</strong>, <strong>template management</strong>,
          and <strong>delivery policies</strong> into a single, orchestration-ready trait.
          Send notifications via email, SMS, push, in-app, or webhooks with consistent governance.
        </p>

        {/* Problem/Solution */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ ...STYLES.card, borderColor: '#fca5a5', background: '#fef2f2' }}>
            <h3 style={{ marginTop: 0, color: '#dc2626', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Without Communicable
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8, color: '#555' }}>
              <li>Scattered notification code</li>
              <li>No template management</li>
              <li>Inconsistent delivery handling</li>
              <li>No audit trail</li>
            </ul>
          </div>

          <div style={{ ...STYLES.card, borderColor: '#86efac', background: '#f0fdf4' }}>
            <h3 style={{ marginTop: 0, color: '#16a34a', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              With Communicable
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8, color: '#555' }}>
              <li>Unified channel catalog</li>
              <li>Localized template system</li>
              <li>Policy enforcement (retry, throttle)</li>
              <li>Full delivery audit trail</li>
            </ul>
          </div>
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Key Components</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>channel_catalog</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Provider configurations</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>template_catalog</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Localized templates</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>delivery_policies</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Retry/throttle rules</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>messages</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Atomic message queue</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>conversations</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Threaded discussions</span>
          </div>
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Supported Channels</h3>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <ChannelBadge channel="email" />
          <ChannelBadge channel="sms" />
          <ChannelBadge channel="push" />
          <ChannelBadge channel="in_app" />
          <ChannelBadge channel="webhook" />
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Used By</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {['User', 'Organization', 'Ticket', 'Order'].map((obj) => (
            <span key={obj} style={{
              padding: '0.5rem 1rem',
              background: '#eff6ff',
              color: '#3b82f6',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}>
              {obj}
            </span>
          ))}
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Dependencies</h3>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ ...STYLES.badge, background: '#dcfce7', color: '#166534' }}>Preferenceable (required)</span>
          <span style={{ ...STYLES.badge, background: '#dcfce7', color: '#166534' }}>Authable (required)</span>
          <span style={{ ...STYLES.badge, background: '#f3f4f6', color: '#6b7280' }}>Classifiable (optional)</span>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. CHANNEL GRID — Provider configurations
 * ───────────────────────────────────────────────────────────────────────────── */

function ChannelGridStory(): JSX.Element {
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Channel Grid</h1>
      <h2 style={STYLES.subheading}>
        Available channels and provider configurations
      </h2>

      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Configured Channels</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {CHANNELS.map((channel) => (
            <div
              key={channel.type}
              onClick={() => setSelectedChannel(channel.type === selectedChannel ? null : channel.type)}
              style={{
                ...STYLES.card,
                background: selectedChannel === channel.type ? '#eff6ff' : '#fff',
                borderColor: selectedChannel === channel.type ? '#3b82f6' : '#e0e0e0',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <ChannelBadge channel={channel.type} />
                <StatusBadge status={channel.status} />
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>Provider</div>
                <div style={{ fontWeight: 600, color: '#374151' }}>{channel.provider}</div>
              </div>

              {selectedChannel === channel.type && (
                <div style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  background: '#f9fafb',
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Configuration</div>
                  <pre style={{ margin: 0, fontSize: '0.6875rem', color: '#555' }}>
                    {JSON.stringify(channel.config, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Channel Status Legend</div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <StatusBadge status="active" />
            <span style={{ fontSize: '0.875rem', color: '#555' }}>Ready to send</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <StatusBadge status="configured" />
            <span style={{ fontSize: '0.875rem', color: '#555' }}>Needs activation</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <StatusBadge status="error" />
            <span style={{ fontSize: '0.875rem', color: '#555' }}>Configuration error</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <StatusBadge status="disabled" />
            <span style={{ fontSize: '0.875rem', color: '#555' }}>Manually disabled</span>
          </div>
        </div>
      </section>

      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Providers by Channel Type</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <ChannelBadge channel="email" />
            <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#555' }}>
              <li>SMTP</li>
              <li>SendGrid</li>
              <li>Amazon SES</li>
              <li>Mailgun</li>
            </ul>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <ChannelBadge channel="sms" />
            <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#555' }}>
              <li>Twilio</li>
              <li>Vonage</li>
              <li>AWS SNS</li>
            </ul>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <ChannelBadge channel="push" />
            <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#555' }}>
              <li>FCM</li>
              <li>APNS</li>
              <li>OneSignal</li>
            </ul>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <ChannelBadge channel="in_app" />
            <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#555' }}>
              <li>WebSocket</li>
              <li>SSE</li>
              <li>Polling</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. TEMPLATE SYSTEM — Template browser with variables
 * ───────────────────────────────────────────────────────────────────────────── */

function TemplateSystemStory(): JSX.Element {
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);
  const [selectedLocale, setSelectedLocale] = useState('en');
  const [previewData, setPreviewData] = useState({
    'user.name': 'Jane Doe',
    'app.name': 'Acme App',
    'order.id': '12345',
    'order.total': '$99.99',
    'reset.url': 'https://example.com/reset/abc123',
    'reset.expiry': '24 hours',
  });

  const renderPreview = (text: string): string => {
    let result = text;
    Object.entries(previewData).forEach(([key, value]) => {
      result = result.replace(new RegExp(`\\{\\{\\s*${key.replace('.', '\\.')}\\s*\\}\\}`, 'g'), value);
    });
    return result;
  };

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Template System</h1>
      <h2 style={STYLES.subheading}>
        Template browser with variables and localization
      </h2>

      <section style={STYLES.section}>
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '2rem' }}>
          {/* Template List */}
          <div>
            <div style={STYLES.groupLabel}>Template Catalog</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  style={{
                    padding: '1rem',
                    background: selectedTemplate.id === template.id ? '#eff6ff' : '#fff',
                    border: selectedTemplate.id === template.id ? '2px solid #3b82f6' : '1px solid #e0e0e0',
                    borderRadius: '0.5rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{template.name}</div>
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    {template.channels.map((ch) => (
                      <span key={ch} style={{
                        padding: '0.125rem 0.375rem',
                        background: '#f3f4f6',
                        borderRadius: '0.25rem',
                        fontSize: '0.625rem',
                        textTransform: 'uppercase',
                      }}>
                        {ch}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Template Detail */}
          <div>
            <div style={STYLES.groupLabel}>Template: {selectedTemplate.name}</div>
            <div style={{ ...STYLES.card, background: '#fff' }}>
              {/* Locale Tabs */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {selectedTemplate.locales.map((locale) => (
                  <button
                    key={locale}
                    onClick={() => setSelectedLocale(locale)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: selectedLocale === locale ? '#3b82f6' : '#f3f4f6',
                      color: selectedLocale === locale ? '#fff' : '#374151',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      fontSize: '0.75rem',
                    }}
                  >
                    {locale}
                  </button>
                ))}
              </div>

              {/* Variables */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.5rem' }}>Variables</div>
                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                  {selectedTemplate.variables.map((v) => (
                    <span key={v} style={{
                      padding: '0.25rem 0.5rem',
                      background: '#fef3c7',
                      color: '#92400e',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontFamily: 'ui-monospace, monospace',
                    }}>
                      {'{{ '}{v}{' }}'}
                    </span>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>Subject</div>
                <div style={{
                  padding: '0.75rem',
                  background: '#f9fafb',
                  borderRadius: '0.375rem',
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '0.875rem',
                }}>
                  {selectedTemplate.subject}
                </div>
              </div>

              {/* Body */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>Body</div>
                <pre style={{
                  padding: '0.75rem',
                  background: '#f9fafb',
                  borderRadius: '0.375rem',
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '0.875rem',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                }}>
                  {selectedTemplate.body}
                </pre>
              </div>

              {/* Preview */}
              <div>
                <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.5rem' }}>
                  Preview (with sample data)
                </div>
                <div style={{
                  padding: '1rem',
                  background: '#dcfce7',
                  borderRadius: '0.5rem',
                  border: '1px solid #86efac',
                }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                    {renderPreview(selectedTemplate.subject)}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#374151', whiteSpace: 'pre-wrap' }}>
                    {renderPreview(selectedTemplate.body)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Variable Validation */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Variable Validation</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {Object.entries(previewData).map(([key, value]) => (
            <div key={key} style={{ ...STYLES.card, background: '#fff', padding: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>
                {'{{ '}{key}{' }}'}
              </div>
              <input
                type="text"
                value={value}
                onChange={(e) => setPreviewData({ ...previewData, [key]: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #e0e0e0',
                  borderRadius: '0.25rem',
                  fontSize: '0.875rem',
                }}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. DELIVERY POLICIES — Retry, throttle, quiet hours
 * ───────────────────────────────────────────────────────────────────────────── */

function DeliveryPoliciesStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Delivery Policies</h1>
      <h2 style={STYLES.subheading}>
        Retry, throttle, and quiet hour configuration
      </h2>

      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Policy Types</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
          {/* Retry Policy */}
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <h4 style={{ marginTop: 0, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🔄</span> Retry Policy
            </h4>
            <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1rem' }}>
              Automatic retry on failure with exponential backoff.
            </p>
            <div style={{
              padding: '0.75rem',
              background: '#f9fafb',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              fontFamily: 'ui-monospace, monospace',
            }}>
              <div><strong>maxAttempts:</strong> 3</div>
              <div><strong>backoff:</strong> exponential</div>
              <div><strong>initialDelay:</strong> 1000ms</div>
              <div><strong>maxDelay:</strong> 60000ms</div>
            </div>
          </div>

          {/* Throttle Policy */}
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <h4 style={{ marginTop: 0, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>⏱</span> Throttle Policy
            </h4>
            <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1rem' }}>
              Rate limiting per channel to avoid provider limits.
            </p>
            <div style={{
              padding: '0.75rem',
              background: '#f9fafb',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              fontFamily: 'ui-monospace, monospace',
            }}>
              <div><strong>email:</strong> 100/min</div>
              <div><strong>sms:</strong> 10/min</div>
              <div><strong>push:</strong> 1000/min</div>
              <div><strong>webhook:</strong> 50/min</div>
            </div>
          </div>

          {/* Quiet Hours */}
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <h4 style={{ marginTop: 0, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🌙</span> Quiet Hours
            </h4>
            <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1rem' }}>
              Pause non-urgent delivery during specified hours.
            </p>
            <div style={{
              padding: '0.75rem',
              background: '#f9fafb',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              fontFamily: 'ui-monospace, monospace',
            }}>
              <div><strong>start:</strong> 22:00</div>
              <div><strong>end:</strong> 08:00</div>
              <div><strong>timezone:</strong> user_local</div>
              <div><strong>exceptions:</strong> critical</div>
            </div>
          </div>
        </div>
      </section>

      {/* Message Lifecycle */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Message Lifecycle</div>
        <div style={{
          ...STYLES.card,
          background: '#fff',
          padding: '2rem',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}>
            <MessageStatusBadge status="queued" />
            <span style={{ color: '#888' }}>→</span>
            <MessageStatusBadge status="sending" />
            <span style={{ color: '#888' }}>→</span>
            <MessageStatusBadge status="sent" />
            <span style={{ color: '#888' }}>→</span>
            <MessageStatusBadge status="delivered" />
            <span style={{ color: '#888' }}>→</span>
            <MessageStatusBadge status="read" />
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: '1rem',
            gap: '1rem',
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              color: '#dc2626',
            }}>
              <span style={{ fontSize: '1.5rem' }}>↓</span>
              <MessageStatusBadge status="failed" />
              <span style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>retry →</span>
            </div>
          </div>
        </div>
      </section>

      {/* Delivery Timeline */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Delivery Timeline</div>
        <div style={{ ...STYLES.card, background: '#fff' }}>
          {SAMPLE_MESSAGES.map((msg, index) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem',
                borderBottom: index < SAMPLE_MESSAGES.length - 1 ? '1px solid #e5e7eb' : 'none',
              }}
            >
              <div style={{ width: '80px' }}>
                <MessageStatusBadge status={msg.status} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{msg.template}</div>
                <div style={{ fontSize: '0.75rem', color: '#888' }}>
                  {msg.channel} → {msg.recipient}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#888' }}>
                {msg.sentAt ? new Date(msg.sentAt).toLocaleTimeString() : 'Pending'}
                {msg.error && (
                  <div style={{ color: '#dc2626', marginTop: '0.25rem' }}>{msg.error}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 5. CONVERSATIONS — Threaded message discussions
 * ───────────────────────────────────────────────────────────────────────────── */

function ConversationsStory(): JSX.Element {
  const [replyText, setReplyText] = useState('');

  const getParticipant = (id: string) => CONVERSATION.participants.find(p => p.id === id);

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Conversations</h1>
      <h2 style={STYLES.subheading}>
        Threaded multi-party discussions
      </h2>

      <section style={STYLES.section}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '2rem' }}>
          {/* Conversation Viewer */}
          <div>
            <div style={STYLES.groupLabel}>ConversationViewer</div>
            <div style={{ ...STYLES.card, background: '#fff', padding: 0, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{
                padding: '1rem 1.5rem',
                background: '#f9fafb',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{CONVERSATION.subject}</div>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>
                    {CONVERSATION.participants.length} participants
                  </div>
                </div>
                <span style={{
                  ...STYLES.badge,
                  background: '#dcfce7',
                  color: '#166534',
                }}>
                  Open
                </span>
              </div>

              {/* Messages */}
              <div style={{ padding: '1rem' }}>
                {CONVERSATION.messages.map((msg) => {
                  const participant = getParticipant(msg.sender);
                  const isAgent = participant?.role === 'agent';
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        flexDirection: isAgent ? 'row-reverse' : 'row',
                        marginBottom: '1rem',
                      }}
                    >
                      <div style={{
                        maxWidth: '70%',
                        padding: '0.75rem 1rem',
                        background: isAgent ? '#dbeafe' : '#f3f4f6',
                        borderRadius: isAgent ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
                      }}>
                        <div style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: isAgent ? '#1e40af' : '#374151',
                          marginBottom: '0.25rem',
                        }}>
                          {participant?.name}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                          {msg.content}
                        </div>
                        <div style={{
                          fontSize: '0.625rem',
                          color: '#888',
                          marginTop: '0.5rem',
                          display: 'flex',
                          gap: '0.5rem',
                          justifyContent: isAgent ? 'flex-start' : 'flex-end',
                        }}>
                          <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                          <MessageStatusBadge status={msg.status} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Input */}
              <div style={{
                padding: '1rem',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                gap: '0.5rem',
              }}>
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type a reply..."
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                  }}
                />
                <button style={{
                  padding: '0.75rem 1.5rem',
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}>
                  Send
                </button>
              </div>
            </div>
          </div>

          {/* Conversation Meta */}
          <div>
            <div style={STYLES.groupLabel}>Participants</div>
            <div style={{ ...STYLES.card, background: '#fff', marginBottom: '1rem' }}>
              {CONVERSATION.participants.map((p) => (
                <div key={p.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.5rem 0',
                }}>
                  <div style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    background: p.role === 'agent' ? '#dbeafe' : '#f3e8ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: p.role === 'agent' ? '#1e40af' : '#7c3aed',
                  }}>
                    {p.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#888' }}>{p.role}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={STYLES.groupLabel}>Lifecycle</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {['open', 'resolved', 'archived'].map((status, index) => (
                <div
                  key={status}
                  style={{
                    padding: '0.75rem',
                    background: index === 0 ? '#dcfce7' : '#f9fafb',
                    borderRadius: '0.375rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span style={{
                    width: '1.5rem',
                    height: '1.5rem',
                    borderRadius: '50%',
                    background: index === 0 ? '#166534' : '#e5e7eb',
                    color: index === 0 ? '#fff' : '#888',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                  }}>
                    {index + 1}
                  </span>
                  <span style={{
                    fontWeight: index === 0 ? 600 : 400,
                    color: index === 0 ? '#166534' : '#888',
                    textTransform: 'capitalize',
                  }}>
                    {status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 6. HOW IT WORKS — Schema and configuration
 * ───────────────────────────────────────────────────────────────────────────── */

function HowItWorksStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>How It Works</h1>
      <h2 style={STYLES.subheading}>
        Schema definition and configuration examples
      </h2>

      {/* Schema Overview */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Schema Definition</div>
        <pre style={STYLES.codeBlock}>
{`trait:
  name: Communicable
  category: communication

schema:
  channel_catalog:
    type: Channel[]
    description: Provider config (SMTP/Twilio/FCM/Webhook)

  template_catalog:
    type: Template[]
    description: Localized templates with variables

  delivery_policies:
    type: DeliveryPolicy[]
    description: Retry/throttle/quiet-hour rules

  messages:
    type: Message[]
    description: Atomic message payloads

  conversations:
    type: Conversation[]
    description: Multi-party threaded discussions

  message_statuses:
    type: MessageStatusEntry[]
    description: Delivery state machine transitions`}
        </pre>
      </section>

      {/* Channel Configuration */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Channel Configuration</div>
        <pre style={STYLES.codeBlock}>
{`// Configure email channel with SendGrid
{
  type: "email",
  provider: "sendgrid",
  status: "active",
  config: {
    apiKey: process.env.SENDGRID_API_KEY,
    from: "noreply@example.com",
    replyTo: "support@example.com"
  },
  limits: {
    rateLimit: 100,      // per minute
    dailyLimit: 10000
  }
}

// Configure SMS channel with Twilio
{
  type: "sms",
  provider: "twilio",
  status: "active",
  config: {
    accountSid: process.env.TWILIO_SID,
    authToken: process.env.TWILIO_TOKEN,
    from: "+1234567890"
  }
}`}
        </pre>
      </section>

      {/* Template Creation */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Template Creation</div>
        <pre style={STYLES.codeBlock}>
{`// Create a template with localization
{
  id: "order_confirmation",
  name: "Order Confirmation",
  channels: ["email", "sms"],
  variables: ["user.name", "order.id", "order.total"],
  content: {
    en: {
      subject: "Order #{{ order.id }} Confirmed",
      body: "Hi {{ user.name }}, your order for {{ order.total }} is confirmed."
    },
    es: {
      subject: "Pedido #{{ order.id }} Confirmado",
      body: "Hola {{ user.name }}, tu pedido de {{ order.total }} está confirmado."
    }
  },
  metadata: {
    category: "transactional",
    priority: "high"
  }
}`}
        </pre>
      </section>

      {/* Message Sending */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Message Sending Flow</div>
        <pre style={STYLES.codeBlock}>
{`// Send a message using a template
await communicate.send({
  template: "order_confirmation",
  channel: "email",
  recipient: {
    email: "jane@example.com",
    locale: "en"
  },
  variables: {
    "user.name": "Jane Doe",
    "order.id": "12345",
    "order.total": "$99.99"
  },
  options: {
    priority: "high",
    respectQuietHours: false  // Transactional override
  }
});

// Message lifecycle:
// 1. Validate template and variables
// 2. Check channel availability
// 3. Apply delivery policies (throttle check)
// 4. Queue message (status: "queued")
// 5. Send via provider (status: "sending" → "sent")
// 6. Track delivery (status: "delivered")
// 7. Track engagement (status: "read")`}
        </pre>
      </section>

      {/* Preferenceable Integration */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Integration with Preferenceable</div>
        <pre style={STYLES.codeBlock}>
{`// User notification preferences (from Preferenceable trait)
{
  user_id: "user_123",
  notification_preferences: {
    channels: {
      email: { enabled: true, frequency: "immediate" },
      sms: { enabled: false },
      push: { enabled: true, frequency: "daily_digest" }
    },
    categories: {
      marketing: { enabled: false },
      transactional: { enabled: true },
      updates: { enabled: true, channel: "email" }
    },
    quiet_hours: {
      enabled: true,
      start: "22:00",
      end: "08:00",
      timezone: "America/New_York"
    }
  }
}

// Communicable checks Preferenceable before sending:
// 1. Is this channel enabled for the user?
// 2. Is this category enabled?
// 3. Is it quiet hours? (with priority override)
// 4. Apply frequency batching if needed`}
        </pre>
      </section>

      {/* View Extensions */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>View Extension Mappings</div>
        <pre style={STYLES.codeBlock}>
{`view_extensions:
  list:
    - component: MessageStatusBadge
      props:
        statusesField: message_statuses

  detail:
    - component: CommunicationDetailPanel
      props:
        channelsField: channel_catalog
        templatesField: template_catalog
        policiesField: delivery_policies
        conversationsField: conversations

  form:
    - component: TemplatePicker
      props:
        templatesField: template_catalog
        channelsField: channel_catalog

  timeline:
    - component: MessageEventTimeline
      props:
        messagesField: messages
        statusesField: message_statuses`}
        </pre>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Storybook Configuration
 * ───────────────────────────────────────────────────────────────────────────── */

type Story = StoryObj<Record<string, never>>;

const meta: Meta = {
  title: 'Traits/Core/Communicable',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

// 1. Overview — First in nav
export const Overview: Story = {
  name: '1. Overview',
  render: () => <OverviewStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 2. Channel Grid — Provider configurations
export const ChannelGrid: Story = {
  name: '2. Channel Grid',
  render: () => <ChannelGridStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 3. Template System — Template browser
export const TemplateSystem: Story = {
  name: '3. Template System',
  render: () => <TemplateSystemStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 4. Delivery Policies — Retry/throttle rules
export const DeliveryPolicies: Story = {
  name: '4. Delivery Policies',
  render: () => <DeliveryPoliciesStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 5. Conversations — Threaded discussions
export const Conversations: Story = {
  name: '5. Conversations',
  render: () => <ConversationsStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 6. How It Works — Schema and configuration
export const HowItWorks: Story = {
  name: '6. How It Works',
  render: () => <HowItWorksStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};
