/**
 * EmptyState component stories
 *
 * Covers canonical scenarios for no data, first-use onboarding, and success moments.
 */

import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { EmptyState } from '../../src/components/empty-state/EmptyState.js';
import type { EmptyStateProps } from '../../src/components/empty-state/EmptyState.js';

type Story = StoryObj<EmptyStateProps>;

const CAPTION_STYLE: React.CSSProperties = {
  fontSize: '0.8125rem',
  color: 'var(--cmp-text-muted, var(--sys-color-text-secondary, #6b7280))',
  maxWidth: '32rem',
  textAlign: 'center',
  margin: 0,
};

const STORY_CONTAINER_STYLE: React.CSSProperties = {
  display: 'grid',
  gap: '0.75rem',
  justifyItems: 'center',
  padding: 'var(--cmp-spacing-inset-default, 1rem)',
};

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: 'primary' | 'secondary';
}

const ActionButton: React.FC<ActionButtonProps> = ({
  variant = 'primary',
  children,
  style,
  type,
  ...props
}) => {
  const isPrimary = variant === 'primary';

  const buttonStyle: React.CSSProperties = {
    borderRadius: '0.75rem',
    paddingBlock: '0.65rem',
    paddingInline: '1.25rem',
    fontWeight: 600,
    fontSize: '0.95rem',
    cursor: 'pointer',
    transition: 'background-color 120ms ease, color 120ms ease, border-color 120ms ease',
    border: isPrimary
      ? '1px solid transparent'
      : '1px solid var(--cmp-border-default, var(--sys-border-subtle, #d1d5db))',
    backgroundColor: isPrimary
      ? 'var(--cmp-surface-action, var(--sys-surface-interactive-primary, #2563eb))'
      : 'transparent',
    color: isPrimary
      ? 'var(--cmp-text-on_action, var(--sys-text-on-interactive, #ffffff))'
      : 'var(--cmp-text-action, var(--sys-text-interactive-primary, #2563eb))',
    boxShadow: isPrimary
      ? 'inset 0 -1px 0 color-mix(in srgb, currentColor 14%, transparent)'
      : 'none',
    textDecoration: 'none',
    ...style,
  };

  return (
    <button type={type ?? 'button'} style={buttonStyle} {...props}>
      {children}
    </button>
  );
};

const meta: Meta<EmptyStateProps> = {
  title: 'Components/Feedback/EmptyState',
  component: EmptyState,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'EmptyState communicates first-run, no-data, and completion states with illustration/headline/body/action slots governed by Statusables tokens.',
      },
    },
  },
  argTypes: {
    intent: {
      control: 'select',
      options: ['neutral', 'info', 'success', 'warning'],
      description: 'Visual intent mapping to Statusables tone tokens.',
    },
    primaryAction: { control: false },
    secondaryAction: { control: false },
    actions: { control: false },
    illustration: { control: false },
    icon: { control: false },
    status: {
      control: 'text',
      description: 'Optional Statusables status key overriding tone/icon mapping.',
    },
    domain: {
      control: 'text',
      description: 'Statusables domain used with the `status` prop.',
    },
  },
  tags: ['vrt', 'vrt-critical'],
  args: {
    intent: 'neutral',
    headlineLevel: 'h2',
  },
};

export default meta;

const SampleIllustration: React.FC = () => (
  <svg
    width="200"
    height="160"
    viewBox="0 0 200 160"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="presentation"
  >
    <rect x="18" y="46" width="164" height="88" rx="12" fill="#E5E7EB" />
    <rect x="38" y="66" width="124" height="10" rx="5" fill="#94A3B8" />
    <rect x="38" y="88" width="92" height="10" rx="5" fill="#CBD5F5" />
    <circle cx="100" cy="114" r="22" fill="#BFDBFE" />
  </svg>
);

const InfoIcon: React.FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" role="presentation">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const CheckIcon: React.FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" role="presentation">
    <path
      d="M9 12l2 2 4-4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const SearchIcon: React.FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" role="presentation">
    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const renderStory = (args: EmptyStateProps, caption: string) => (
  <div style={STORY_CONTAINER_STYLE}>
    <EmptyState {...args} />
    <p style={CAPTION_STYLE}>{caption}</p>
  </div>
);

export const NoData: Story = {
  name: 'No Data',
  args: {
    headline: 'No items found',
    body: 'There are no records to show yet. Start by creating your first entry.',
    primaryAction: <ActionButton>Create Item</ActionButton>,
  },
  render: (args) =>
    renderStory(
      args,
      'Use when a collection or table is empty. Pair with guidance on how to begin.'
    ),
  parameters: {
    docs: {
      description: {
        story: 'Canonical empty state for no-data scenarios. Highlights the next best action.',
      },
    },
  },
};

export const FirstUse: Story = {
  name: 'First Use (Onboarding)',
  args: {
    icon: <InfoIcon />,
    headline: 'Welcome to your workspace',
    body: 'Set up your first project to unlock dashboards, automation, and alerts.',
    primaryAction: <ActionButton>Create Project</ActionButton>,
    secondaryAction: (
      <ActionButton variant="secondary">Explore Templates</ActionButton>
    ),
  },
  render: (args) =>
    renderStory(
      args,
      'Introduce new users to the value of the surface and steer them toward setup.'
    ),
};

export const SuccessCompletion: Story = {
  name: 'Success / Completion',
  args: {
    icon: <CheckIcon />,
    headline: 'All caught up!',
    body: "You're good to go. We will notify you when there’s something new to review.",
    intent: 'success',
  },
  render: (args) =>
    renderStory(args, 'Celebrate completion while reinforcing what will happen next.'),
};

export const StatusDriven: Story = {
  name: 'Status-Driven Tone',
  args: {
    status: 'trialing',
    domain: 'subscription',
    headline: 'Trial in progress',
    body: 'Your workspace trial ends in 3 days. Choose a plan to keep your automations running.',
    primaryAction: <ActionButton>Upgrade Plan</ActionButton>,
    secondaryAction: (
      <ActionButton variant="secondary">View Pricing</ActionButton>
    ),
  },
  render: (args) =>
    renderStory(
      args,
      'Statusables integration: tone and icon derive from the subscription.trialing status.'
    ),
};

export const WithIllustration: Story = {
  name: 'With Illustration',
  args: {
    illustration: <SampleIllustration />,
    headline: 'Build your catalog',
    body: 'Add products, manage inventory, and track engagement from a single hub.',
    primaryAction: <ActionButton>Add Product</ActionButton>,
    secondaryAction: (
      <ActionButton variant="secondary">Import CSV</ActionButton>
    ),
  },
  render: (args) =>
    renderStory(
      args,
      'Use an illustration for first-run or brand moments where you want to inspire exploration.'
    ),
};
