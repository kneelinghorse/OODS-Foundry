import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ToastPortal } from '../../src/components/toast/ToastPortal.js';
import {
  ToastProvider,
  useToast,
  type ToastAPI,
} from '../../src/components/toast/toastService.js';
import { formatTokenReference } from '../../src/utils/token-values.js';
import '../../src/styles/globals.css';

const SURFACE_SUBTLE = formatTokenReference('sys.surface.subtle', '--cmp-surface-subtle', 'Canvas');
const TEXT_BODY = formatTokenReference('sys.text.primary', '--cmp-text-body', 'CanvasText');
const TEXT_MUTED = formatTokenReference('sys.text.secondary', '--cmp-text-muted', 'GrayText');
const TEXT_ACTION = formatTokenReference(
  'sys.text.on.interactive',
  '--cmp-text-on_action',
  'HighlightText'
);

const TONE_PRESETS = {
  info: {
    surface: formatTokenReference('sys.status.info.surface', '--cmp-status-info-surface', 'Canvas'),
    text: formatTokenReference('sys.status.info.text', '--cmp-status-info-text', 'CanvasText'),
  },
  success: {
    surface: formatTokenReference('sys.status.success.surface', '--cmp-status-success-surface', 'Canvas'),
    text: formatTokenReference('sys.status.success.text', '--cmp-status-success-text', 'CanvasText'),
  },
  warning: {
    surface: formatTokenReference('sys.status.warning.surface', '--cmp-status-warning-surface', 'Canvas'),
    text: formatTokenReference('sys.status.warning.text', '--cmp-status-warning-text', 'CanvasText'),
  },
  error: {
    surface: formatTokenReference('sys.status.critical.surface', '--cmp-status-critical-surface', 'Canvas'),
    text: formatTokenReference('sys.status.critical.text', '--cmp-status-critical-text', 'CanvasText'),
  },
} as const;

type Story = StoryObj<typeof ToastPortal>;

const meta: Meta<typeof ToastPortal> = {
  title: 'Components/Feedback/Toast',
  component: ToastPortal,
  parameters: {
    layout: 'fullscreen',
    chromatic: { disableSnapshot: false },
  },
  decorators: [
    (StoryComponent) => (
      <ToastProvider>
        <StoryComponent />
        <ToastPortal />
      </ToastProvider>
    ),
  ],
  tags: ['vrt', 'vrt-critical'],
};

export default meta;

const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { readonly tone?: 'info' | 'success' | 'warning' | 'error' }
> = ({ tone = 'info', children, style, ...props }) => {
  const toneTokens = TONE_PRESETS[tone];
  return (
    <button
      type="button"
      style={{
        borderRadius: 8,
        padding: '0.5rem 1rem',
        color: toneTokens.text || TEXT_ACTION,
        fontWeight: 600,
        border: 'none',
        cursor: 'pointer',
        transition: 'filter 120ms ease',
        background: toneTokens.surface,
        ...style,
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.filter = 'brightness(1.05)';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.filter = 'none';
      }}
      {...props}
    >
      {children}
    </button>
  );
};

const DemoSurface: React.FC<React.PropsWithChildren<unknown>> = ({ children }) => (
  <div
    style={{
      display: 'grid',
      gap: '1rem',
      alignItems: 'start',
      padding: '2rem',
      minHeight: '100vh',
      background: SURFACE_SUBTLE,
      color: TEXT_BODY,
    }}
  >
    {children}
    <p style={{ margin: 0, fontSize: '0.875rem', color: TEXT_MUTED }}>
      Keyboard shortcut: <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>M</kbd> focuses the most recent toast.
    </p>
  </div>
);

const IntentGalleryDemo: React.FC = () => {
  const toastApi = useToast();

  const triggerIntent = (intent: Parameters<ToastAPI['show']>[0]['intent']) => {
    toastApi.show({
      intent,
      title:
        intent === 'success'
          ? 'Changes saved'
          : intent === 'warning'
          ? 'Review pending items'
          : intent === 'error'
          ? 'Operation failed'
          : 'System notice',
      description:
        intent === 'error'
          ? 'Retry the request or contact support.'
          : 'Contextual feedback appears without interrupting the flow.',
    });
  };

  return (
    <DemoSurface>
      <h2 style={{ fontSize: '1.5rem', marginBottom: 0 }}>Toast intents</h2>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Button tone="info" onClick={() => triggerIntent('info')}>
          Info
        </Button>
        <Button tone="success" onClick={() => triggerIntent('success')}>
          Success
        </Button>
        <Button tone="warning" onClick={() => triggerIntent('warning')}>
          Warning
        </Button>
        <Button tone="error" onClick={() => triggerIntent('error')}>
          Error
        </Button>
      </div>
    </DemoSurface>
  );
};

export const Intents: Story = {
  render: () => <IntentGalleryDemo />,
  parameters: {
    vrt: { tags: ['vrt-critical'] },
  },
};

const QueueStackingDemo: React.FC = () => {
  const toastApi = useToast();

  const handleStack = () => {
    toastApi.success('Profile updated');
    setTimeout(() => toastApi.show({ intent: 'info', title: 'Billing sync queued' }), 150);
    setTimeout(
      () =>
        toastApi.show({
          intent: 'warning',
          title: 'Pending approvals',
          description: 'Three invoices await review.',
        }),
      300
    );
    setTimeout(
      () =>
        toastApi.show({
          intent: 'error',
          title: 'Webhook failure',
          description: 'Delivery retried and will escalate after 3 attempts.',
        }),
      450
    );
  };

  return (
    <DemoSurface>
      <h2 style={{ fontSize: '1.5rem', marginBottom: 0 }}>Queue stacking</h2>
      <p style={{ margin: 0, maxWidth: '34rem', color: TEXT_MUTED }}>
        Trigger multiple toasts rapidly to validate FIFO ordering, spacing, and animation offsets.
      </p>
      <Button tone="info" onClick={handleStack}>
        Trigger 4 stacked toasts
      </Button>
    </DemoSurface>
  );
};

export const QueueStacking: Story = {
  render: () => <QueueStackingDemo />,
};

const StickyToastDemo: React.FC = () => {
  const toastApi = useToast();

  const handleShowSticky = () => {
    toastApi.show({
      intent: 'error',
      title: 'Critical connector failure',
      description: 'Retry manually after verifying credentials. This toast is sticky.',
      duration: 0,
    });
  };

  return (
    <DemoSurface>
      <h2 style={{ fontSize: '1.5rem', marginBottom: 0 }}>Sticky toast</h2>
      <p style={{ margin: 0, color: TEXT_MUTED }}>
        Sticky toasts omit auto-dismiss to keep persistent issues visible until acknowledged.
      </p>
      <Button tone="error" onClick={handleShowSticky}>
        Show critical toast
      </Button>
    </DemoSurface>
  );
};

export const Sticky: Story = {
  render: () => <StickyToastDemo />,
};

const ActionToastDemo: React.FC = () => {
  const toastApi = useToast();

  const handleShowAction = () => {
    toastApi.show({
      intent: 'info',
      title: 'Update available',
      description: 'Deploy window opens in 10 minutes.',
      action: {
        label: 'Review',
        onClick: () => {
          // eslint-disable-next-line no-console
          console.log('User opted to review deployment details');
          toastApi.dismissAll();
        },
      },
    });
  };

  return (
    <DemoSurface>
      <h2 style={{ fontSize: '1.5rem', marginBottom: 0 }}>Custom action</h2>
      <p style={{ margin: 0, color: TEXT_MUTED }}>
        Provide a contextual CTA with extended timeout for actionable notifications.
      </p>
      <Button tone="info" onClick={handleShowAction}>
        Show actionable toast
      </Button>
    </DemoSurface>
  );
};

export const WithAction: Story = {
  render: () => <ActionToastDemo />,
};
