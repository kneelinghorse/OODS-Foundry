import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { PerfProfiler, initProfilerMetrics, clearProfilerMetrics } from '~/src/perf/instrumentation';
import { Button } from '~/src/components/base/Button';
import { ToastPortal } from '~/src/components/toast/ToastPortal.js';
import {
  ToastProvider,
  useToast,
  type ToastAPI,
} from '~/src/components/toast/toastService.js';
import '~/src/styles/globals.css';

const meta: Meta = {
  title: 'Explorer/Performance/Compositor Harness',
  parameters: {
    layout: 'fullscreen',
    chromatic: { disableSnapshot: true },
    controls: { hideNoControlsWarning: true },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

const InstrumentedCard: React.FC<React.PropsWithChildren<{ readonly id: string }>> = ({
  id,
  children,
}) => {
  if (typeof window !== 'undefined' && !Array.isArray(window.__PERF_PROFILER_METRICS__)) {
    initProfilerMetrics();
  }
  useEffect(() => {
    return () => {
      clearProfilerMetrics();
    };
  }, []);
  return (
    <PerfProfiler id={id}>
      <div
        style={{
          display: 'grid',
          gap: '1rem',
          maxWidth: '24rem',
          padding: '1.25rem',
          borderRadius: '0.75rem',
          backgroundColor: 'var(--perf-surface, rgba(15, 23, 42, 0.05))',
        }}
      >
        {children}
      </div>
    </PerfProfiler>
  );
};

const ButtonStateUpdateDemo: React.FC = () => {
  const [isActive, setIsActive] = useState(false);

  return (
    <InstrumentedCard id="Compositor.Button.StateUpdate">
      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--perf-text, #1f2937)' }}>
        Click the button to toggle its intent state. React Profiler metrics capture the render.
      </p>
      <Button
        data-testid="perf-button-toggle"
        intent={isActive ? 'success' : 'neutral'}
        onClick={() => setIsActive((prev) => !prev)}
      >
        {isActive ? 'Active' : 'Idle'}
      </Button>
      <span style={{ fontSize: '0.75rem', color: 'var(--perf-text-muted, #4b5563)' }}>
        Current state: <strong data-testid="perf-button-state">{isActive ? 'Active' : 'Idle'}</strong>
      </span>
    </InstrumentedCard>
  );
};

const ToastQueueDemo: React.FC = () => {
  const toastApi = useToast();

  const triggerSequence = () => {
    toastApi.dismissAll();
    toastApi.show({ intent: 'info', title: 'Replica promoted', description: 'Shard 5 promoted to primary.' });
    setTimeout(
      () => toastApi.show({ intent: 'warning', title: 'Queue depth rising', description: 'Retry budget at 72%.' }),
      120,
    );
    setTimeout(
      () => toastApi.show({ intent: 'error', title: 'Connector failure', description: 'Invoice webhook failing.' }),
      240,
    );
  };

  return (
    <ToastProvider>
      <InstrumentedCard id="Compositor.Toast.Queue">
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--perf-text, #1f2937)' }}>
          Triggering toast updates drives compositor work measured by the React Profiler.
        </p>
        <Button data-testid="perf-toast-trigger" intent="neutral" onClick={triggerSequence}>
          Trigger toast sequence
        </Button>
        <ToastPortal />
      </InstrumentedCard>
    </ToastProvider>
  );
};

export const ButtonStateUpdate: Story = {
  name: 'Button state update',
  render: () => <ButtonStateUpdateDemo />,
};

export const ToastQueue: Story = {
  name: 'Toast queue',
  render: () => <ToastQueueDemo />,
};
