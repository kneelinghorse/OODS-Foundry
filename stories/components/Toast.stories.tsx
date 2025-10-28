import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ToastPortal } from '../../src/components/toast/ToastPortal.js';
import {
  ToastProvider,
  useToast,
  type ToastAPI,
} from '../../src/components/toast/toastService.js';
import '../../src/styles/globals.css';

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
  const toneStyles: Record<typeof tone, React.CSSProperties> = {
    info: { backgroundColor: '#2563eb' },
    success: { backgroundColor: '#16a34a' },
    warning: { backgroundColor: '#ca8a04' },
    error: { backgroundColor: '#dc2626' },
  };

  return (
    <button
      type="button"
      style={{
        borderRadius: 8,
        padding: '0.5rem 1rem',
        color: '#fff',
        fontWeight: 600,
        border: 'none',
        cursor: 'pointer',
        transition: 'filter 120ms ease',
        ...toneStyles[tone],
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
      background: 'linear-gradient(135deg, rgba(15,23,42,0.35), rgba(15,118,110,0.25))',
      color: '#0f172a',
    }}
  >
    {children}
    <p style={{ margin: 0, fontSize: '0.875rem', color: 'rgba(15,23,42,0.72)' }}>
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
      <p style={{ margin: 0, maxWidth: '34rem', color: 'rgba(15,23,42,0.75)' }}>
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
      <p style={{ margin: 0, color: 'rgba(15,23,42,0.75)' }}>
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
      <p style={{ margin: 0, color: 'rgba(15,23,42,0.75)' }}>
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
