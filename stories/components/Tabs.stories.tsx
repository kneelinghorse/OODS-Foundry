/**
 * @file Tabs component stories
 * @module stories/components/Tabs
 */

import type { Meta, StoryObj } from '@storybook/react';
import '~/src/styles/globals.css';
import '~/src/components/tabs/tabs.css';
import { Tabs } from '~/src/components/tabs/Tabs.js';
import type { TabItem, TabsProps } from '~/src/components/tabs/types.js';

const meta = {
  title: 'Components/Navigation/Tabs',
  component: Tabs,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
Tabs component for organizing related content into separate, switchable views.

## Features
- **Responsive overflow menu** - Automatically collapses excess tabs into a "More" menu
- **Size variants** - Small, medium, and large sizes for different contexts
- **Keyboard navigation** - Full arrow key support, Home/End keys
- **Truncation** - Long labels truncate with tooltips
- **High-contrast mode** - Respects forced-colors for accessibility
- **Manual activation** - Arrow keys move focus, Enter/Space activates

## Accessibility
- Uses \`role="tablist"\`, \`role="tab"\`, and \`role="tabpanel"\`
- Roving tabindex for keyboard navigation
- \`aria-selected\` indicates active tab
- \`aria-controls\` links tabs to panels
- HC mode uses outline/border for active indicator
        `,
      },
    },
  },
  tags: ['vrt'],
  argTypes: {
    items: {
      control: false,
      description: 'Collection of tab definitions rendered by the component.',
    },
    selectedId: {
      control: false,
      description: 'Controlled selected tab identifier.',
    },
    onChange: {
      action: 'onChange',
      description: 'Called when the active tab changes.',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Size variant for tab density',
    },
    overflowLabel: {
      control: 'text',
      description: 'Label for overflow menu button',
    },
  },
  args: {
    size: 'md',
    overflowLabel: 'More',
    'aria-label': 'Primary navigation',
  } satisfies Partial<TabsProps>,
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

// Sample content for panels
const LoremShort = () => (
  <div style={{ padding: '16px' }}>
    <p>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut
      labore et dolore magna aliqua.
    </p>
  </div>
);

const LoremMedium = () => (
  <div style={{ padding: '16px' }}>
    <h3>Panel Content</h3>
    <p>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut enim ad minim veniam, quis
      nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
    </p>
    <p>
      Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
      pariatur.
    </p>
  </div>
);

// Basic tabs dataset
const basicItems: TabItem[] = [
  { id: 'overview', label: 'Overview', panel: <LoremShort /> },
  { id: 'details', label: 'Details', panel: <LoremMedium /> },
  { id: 'settings', label: 'Settings', panel: <LoremShort /> },
  { id: 'history', label: 'History', panel: <LoremMedium /> },
];

// Many tabs to trigger overflow
const manyItems: TabItem[] = [
  { id: '1', label: 'Dashboard', panel: <LoremShort /> },
  { id: '2', label: 'Analytics', panel: <LoremMedium /> },
  { id: '3', label: 'Reports', panel: <LoremShort /> },
  { id: '4', label: 'Settings', panel: <LoremMedium /> },
  { id: '5', label: 'Users', panel: <LoremShort /> },
  { id: '6', label: 'Permissions', panel: <LoremMedium /> },
  { id: '7', label: 'Integrations', panel: <LoremShort /> },
  { id: '8', label: 'Billing', panel: <LoremMedium /> },
  { id: '9', label: 'Support', panel: <LoremShort /> },
  { id: '10', label: 'Documentation', panel: <LoremMedium /> },
];

// Long labels to demonstrate truncation
const longLabelItems: TabItem[] = [
  {
    id: '1',
    label: 'Customer Relationship Management Dashboard',
    panel: <LoremShort />,
  },
  { id: '2', label: 'Financial Reports and Analytics', panel: <LoremMedium /> },
  { id: '3', label: 'User Account Settings', panel: <LoremShort /> },
];

// Tabs with disabled state
const disabledItems: TabItem[] = [
  { id: '1', label: 'Active Tab', panel: <LoremShort /> },
  { id: '2', label: 'Disabled Tab', panel: <LoremMedium />, isDisabled: true },
  { id: '3', label: 'Another Active', panel: <LoremShort /> },
];

/**
 * Default tabs with medium size
 */
export const Default: Story = {
  args: {
    items: basicItems,
    defaultSelectedId: 'overview',
    size: 'md',
  },
};

/**
 * Small size variant - compact density for tight spaces
 */
export const SizeSmall: Story = {
  args: {
    items: basicItems,
    defaultSelectedId: 'overview',
    size: 'sm',
  },
};

/**
 * Large size variant - spacious for touch devices
 */
export const SizeLarge: Story = {
  args: {
    items: basicItems,
    defaultSelectedId: 'overview',
    size: 'lg',
  },
};

/**
 * Overflow behavior - many tabs trigger "More" menu
 * Resize the viewport to see responsive overflow
 */
export const WithOverflow: Story = {
  args: {
    items: manyItems,
    defaultSelectedId: '1',
    size: 'md',
    overflowLabel: 'More',
    'aria-label': 'Product settings navigation',
  },
  render: (args) => (
    <div
      style={{
        maxWidth: '360px',
        border: '1px dashed var(--color-border-subtle, #d1d5db)',
        padding: '12px',
        borderRadius: '8px',
      }}
    >
      <Tabs {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'When tabs exceed container width, excess tabs collapse into an overflow menu. The selected tab always remains visible.',
      },
    },
  },
};

/**
 * Long labels truncate with ellipsis and show full text on hover
 */
export const LongLabels: Story = {
  args: {
    items: longLabelItems,
    defaultSelectedId: '1',
    size: 'md',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Labels longer than ~200px truncate with ellipsis. Hover to see full text in native tooltip.',
      },
    },
  },
};

/**
 * Tabs with disabled items - keyboard navigation skips disabled tabs
 */
export const WithDisabled: Story = {
  args: {
    items: disabledItems,
    defaultSelectedId: '1',
    size: 'md',
  },
  parameters: {
    docs: {
      description: {
        story: 'Disabled tabs are not selectable and are skipped during keyboard navigation.',
      },
    },
  },
};

/**
 * Custom overflow label
 */
export const CustomOverflowLabel: Story = {
  args: {
    items: manyItems,
    defaultSelectedId: '1',
    size: 'md',
    overflowLabel: 'Other Tabs',
  },
};

/**
 * Single tab - edge case
 */
export const SingleTab: Story = {
  args: {
    items: [{ id: 'only', label: 'Only Tab', panel: <LoremShort /> }],
    defaultSelectedId: 'only',
    size: 'md',
  },
};

/**
 * Two tabs - minimal viable case
 */
export const TwoTabs: Story = {
  args: {
    items: [
      { id: 'first', label: 'First', panel: <LoremShort /> },
      { id: 'second', label: 'Second', panel: <LoremMedium /> },
    ],
    defaultSelectedId: 'first',
    size: 'md',
  },
};

/**
 * All sizes comparison - visual regression baseline
 */
export const AllSizes: Story = {
  args: {
    items: basicItems,
    defaultSelectedId: 'overview',
    size: 'md',
  },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <h3 style={{ marginBottom: '8px' }}>Small</h3>
        <Tabs items={basicItems} defaultSelectedId="overview" size="sm" />
      </div>
      <div>
        <h3 style={{ marginBottom: '8px' }}>Medium</h3>
        <Tabs items={basicItems} defaultSelectedId="overview" size="md" />
      </div>
      <div>
        <h3 style={{ marginBottom: '8px' }}>Large</h3>
        <Tabs items={basicItems} defaultSelectedId="overview" size="lg" />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Visual comparison of all three size variants.',
      },
    },
  },
};

/**
 * High-contrast mode proof
 * Uses outline/border for active indicator
 */
export const HighContrast: Story = {
  args: {
    items: basicItems,
    defaultSelectedId: 'details',
    size: 'md',
  },
  parameters: {
    backgrounds: { default: 'dark' },
    docs: {
      description: {
        story:
          'In forced-colors mode (Windows High Contrast), the active tab indicator uses borders that respect system colors.',
      },
    },
  },
  tags: ['vrt-hc'],
};
