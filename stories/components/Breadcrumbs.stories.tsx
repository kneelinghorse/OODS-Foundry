/**
 * Breadcrumbs component stories
 *
 * Demonstrates overflow patterns, navigation hierarchies, and internationalization.
 */

import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Breadcrumbs } from '../../src/components/breadcrumbs/Breadcrumbs.js';
import type { BreadcrumbsProps, BreadcrumbItem } from '../../src/components/breadcrumbs/types.js';

type Story = StoryObj<BreadcrumbsProps>;

const meta: Meta<BreadcrumbsProps> = {
  title: 'Components/Navigation/Breadcrumbs',
  component: Breadcrumbs,
  parameters: {
    layout: 'centered',
  },
  args: {
    maxVisibleItems: 5,
    overflowLabel: '...',
    'aria-label': 'breadcrumb',
  },
  argTypes: {
    onItemClick: { action: 'item clicked' },
  },
  tags: ['vrt', 'vrt-critical'],
};

export default meta;

const MUTED_TEXT_STYLE: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--cmp-text-muted, var(--sys-text-muted))',
  marginTop: '0.5rem',
};

export const ShortPath: Story = {
  name: 'Short Path',
  args: {
    items: [
      { id: '1', label: 'Home', href: '/' },
      { id: '2', label: 'Products', href: '/products' },
      { id: '3', label: 'Laptops' },
    ],
  },
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Breadcrumbs {...args} />
      <span style={MUTED_TEXT_STYLE}>
        Basic breadcrumb trail with 3 levels. No overflow needed.
      </span>
    </div>
  ),
};

export const LongPathWithOverflow: Story = {
  name: 'Long Path (Overflow)',
  args: {
    items: [
      { id: '1', label: 'Home', href: '/' },
      { id: '2', label: 'Products', href: '/products' },
      { id: '3', label: 'Electronics', href: '/products/electronics' },
      { id: '4', label: 'Computers', href: '/products/electronics/computers' },
      { id: '5', label: 'Laptops', href: '/products/electronics/computers/laptops' },
      { id: '6', label: 'Gaming', href: '/products/electronics/computers/laptops/gaming' },
      { id: '7', label: 'High Performance' },
    ],
    maxVisibleItems: 3,
  },
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Breadcrumbs {...args} />
      <span style={MUTED_TEXT_STYLE}>
        Deep hierarchy with overflow menu. First and last items always visible.
      </span>
    </div>
  ),
};

export const InternationalizedLabels: Story = {
  name: 'Internationalized',
  args: {
    items: [
      { id: '1', label: 'Accueil', href: '/' },
      { id: '2', label: 'Produits', href: '/produits' },
      { id: '3', label: 'Électronique', href: '/produits/electronique' },
      { id: '4', label: 'Ordinateurs portables' },
    ],
  },
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Breadcrumbs {...args} />
      <span style={MUTED_TEXT_STYLE}>
        French labels demonstrating internationalization support.
      </span>
    </div>
  ),
};

export const WithDisabledItems: Story = {
  name: 'Disabled Items',
  args: {
    items: [
      { id: '1', label: 'Home', href: '/' },
      { id: '2', label: 'Products (disabled)', href: '/products', disabled: true },
      { id: '3', label: 'Electronics', href: '/products/electronics' },
      { id: '4', label: 'Laptops' },
    ],
  },
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Breadcrumbs {...args} />
      <span style={MUTED_TEXT_STYLE}>
        Middle item disabled. Demonstrates non-interactive state styling.
      </span>
    </div>
  ),
};

export const MaximalOverflow: Story = {
  name: 'Maximal Overflow',
  args: {
    items: [
      { id: '1', label: 'Root', href: '/' },
      { id: '2', label: 'Level 2', href: '/level2' },
      { id: '3', label: 'Level 3', href: '/level2/level3' },
      { id: '4', label: 'Level 4', href: '/level2/level3/level4' },
      { id: '5', label: 'Level 5', href: '/level2/level3/level4/level5' },
      { id: '6', label: 'Level 6', href: '/level2/level3/level4/level5/level6' },
      { id: '7', label: 'Level 7', href: '/level2/level3/level4/level5/level6/level7' },
      { id: '8', label: 'Level 8', href: '/level2/level3/level4/level5/level6/level7/level8' },
      { id: '9', label: 'Level 9 (Current)' },
    ],
    maxVisibleItems: 2,
  },
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Breadcrumbs {...args} />
      <span style={MUTED_TEXT_STYLE}>
        Deep nesting (9 levels) with minimal visible items. Tests overflow menu capacity.
      </span>
    </div>
  ),
};

export const SingleItem: Story = {
  name: 'Single Item',
  args: {
    items: [{ id: '1', label: 'Home' }],
  },
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Breadcrumbs {...args} />
      <span style={MUTED_TEXT_STYLE}>
        Edge case: single breadcrumb item (root page).
      </span>
    </div>
  ),
};

export const TwoItems: Story = {
  name: 'Two Items',
  args: {
    items: [
      { id: '1', label: 'Home', href: '/' },
      { id: '2', label: 'Dashboard' },
    ],
  },
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Breadcrumbs {...args} />
      <span style={MUTED_TEXT_STYLE}>
        Edge case: two-item breadcrumb. No overflow possible.
      </span>
    </div>
  ),
};

export const ResponsiveNarrowViewport: Story = {
  name: 'Narrow Viewport',
  args: {
    items: [
      { id: '1', label: 'Home', href: '/' },
      { id: '2', label: 'Products', href: '/products' },
      { id: '3', label: 'Electronics', href: '/products/electronics' },
      { id: '4', label: 'Computers & Accessories' },
    ],
    maxVisibleItems: 2,
  },
  parameters: {
    layout: 'centered',
  },
  render: (args) => (
    <div
      style={{
        width: 'min(360px, 100%)',
        padding: 'var(--cmp-spacing-inset-default, 1rem)',
        border: '1px solid var(--cmp-border-default, var(--sys-border-subtle))',
        borderRadius: 'var(--cmp-spacing-inline-xs, 0.5rem)',
        background: 'var(--cmp-surface-panel, var(--sys-surface-raised))',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--cmp-spacing-stack-compact, 0.5rem)',
      }}
    >
      <span style={MUTED_TEXT_STYLE}>360px viewport preview</span>
      <Breadcrumbs {...args} />
      <span style={MUTED_TEXT_STYLE}>
        Overflow menu preserves first/last items on narrow screens.
      </span>
    </div>
  ),
};

const PAGE_CONTENT: Record<string, { title: string; description: string }> = {
  '1': { title: 'Home', description: 'Welcome to the knowledge base' },
  '2': { title: 'Documentation', description: 'Product documentation hub' },
  '3': { title: 'Getting Started', description: 'Quick start guides and tutorials' },
  '4': { title: 'Installation', description: 'Installation instructions and requirements' },
};

export const WithPageContext: Story = {
  name: 'With Page Context',
  args: {
    items: [
      { id: '1', label: 'Home', href: '#home' },
      { id: '2', label: 'Documentation', href: '#docs' },
      { id: '3', label: 'Getting Started', href: '#getting-started' },
      { id: '4', label: 'Installation' },
    ],
  },
  render: (args) => {
    const currentPage = args.items[args.items.length - 1];
    const content = PAGE_CONTENT[currentPage.id];

    return (
      <div
        style={{
          width: 'min(640px, 100%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--cmp-spacing-stack-default, 1rem)',
        }}
      >
        <nav
          style={{
            padding: 'var(--cmp-spacing-inset-compact, 0.75rem)',
            background: 'var(--cmp-surface-subtle, var(--sys-surface-subtle))',
            borderRadius: 'var(--cmp-spacing-inline-xs, 0.5rem)',
          }}
        >
          <Breadcrumbs {...args} />
        </nav>

        <main
          style={{
            padding: 'var(--cmp-spacing-inset-default, 1rem)',
            border: '1px solid var(--cmp-border-default, var(--sys-border-subtle))',
            borderRadius: 'var(--cmp-spacing-inline-xs, 0.5rem)',
            background: 'var(--cmp-surface-panel, var(--sys-surface-raised))',
          }}
        >
          <h1 style={{ marginTop: 0 }}>{content.title}</h1>
          <p style={{ color: 'var(--cmp-text-muted, var(--sys-text-muted))' }}>
            {content.description}
          </p>
        </main>

        <span style={MUTED_TEXT_STYLE}>
          Breadcrumbs in a navigation landmark above page content.
        </span>
      </div>
    );
  },
};

export const HighContrast: Story = {
  name: 'High-Contrast Mode',
  args: {
    items: [
      { id: '1', label: 'Home', href: '/' },
      { id: '2', label: 'Products', href: '/products' },
      { id: '3', label: 'Electronics', href: '/products/electronics' },
      { id: '4', label: 'Computers', href: '/products/electronics/computers' },
      { id: '5', label: 'Laptops' },
    ],
    maxVisibleItems: 3,
  },
  parameters: {
    chromatic: { forcedColors: 'active' },
  },
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Breadcrumbs {...args} />
      <span style={MUTED_TEXT_STYLE}>
        High-contrast mode proof: forced-colors styling and outline-based focus.
      </span>
    </div>
  ),
};
