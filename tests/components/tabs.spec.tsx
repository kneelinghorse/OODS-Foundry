/* @vitest-environment jsdom */

/**
 * @file Tabs component tests
 * @module tests/components/tabs
 */

import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { Tabs } from '../../src/components/tabs/Tabs.js';
import type { TabItem } from '../../src/components/tabs/types.js';

const basicItems: TabItem[] = [
  { id: 'tab1', label: 'Tab 1', panel: <div>Panel 1 content</div> },
  { id: 'tab2', label: 'Tab 2', panel: <div>Panel 2 content</div> },
  { id: 'tab3', label: 'Tab 3', panel: <div>Panel 3 content</div> },
];

const overflowItems: TabItem[] = [
  { id: 'overview', label: 'Overview', panel: <div>Overview panel</div> },
  { id: 'activity', label: 'Activity', panel: <div>Activity panel</div> },
  { id: 'roadmap', label: 'Roadmap & Delivery', panel: <div>Roadmap panel</div> },
  { id: 'dependencies', label: 'Dependencies', panel: <div>Dependencies panel</div> },
  { id: 'security', label: 'Security & Compliance', panel: <div>Security panel</div> },
  { id: 'change-log', label: 'Release Notes', panel: <div>Change log panel</div> },
];

expect.extend({ toHaveNoViolations });


type ObserverRecord = {
  callback: ResizeObserverCallback;
  instance: ResizeObserver;
};

const resizeObservers: ObserverRecord[] = [];

class ResizeObserverStub {
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    resizeObservers.push({ callback, instance: this as unknown as ResizeObserver });
  }

  observe(): void {
    // no-op; tests manually flush callbacks when needed
  }

  unobserve(): void {
    // no-op
  }

  disconnect(): void {
    // no-op
  }
}

const flushResizeObservers = () => {
  for (const { callback, instance } of resizeObservers) {
    callback([], instance);
  }
};

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  resizeObservers.length = 0;
});

describe('Tabs', () => {
  describe('rendering', () => {
    it('renders all tabs and panels', () => {
      render(<Tabs items={basicItems} defaultSelectedId="tab1" />);

      expect(screen.getByRole('tab', { name: 'Tab 1' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Tab 2' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Tab 3' })).toBeInTheDocument();

      expect(screen.getByRole('tabpanel', { hidden: false })).toHaveTextContent('Panel 1 content');
    });

    it('renders with default first tab selected if no default provided', () => {
      render(<Tabs items={basicItems} />);

      const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
      expect(tab1).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tabpanel', { hidden: false })).toHaveTextContent('Panel 1 content');
    });

    it('renders with specified default selected tab', () => {
      render(<Tabs items={basicItems} defaultSelectedId="tab2" />);

      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
      expect(tab2).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tabpanel', { hidden: false })).toHaveTextContent('Panel 2 content');
    });

    it('applies size variant classes', () => {
      const { rerender } = render(<Tabs items={basicItems} size="sm" />);
      expect(screen.getAllByRole('tab')[0]).toHaveAttribute('data-size', 'sm');

      rerender(<Tabs items={basicItems} size="md" />);
      expect(screen.getAllByRole('tab')[0]).toHaveAttribute('data-size', 'md');

      rerender(<Tabs items={basicItems} size="lg" />);
      expect(screen.getAllByRole('tab')[0]).toHaveAttribute('data-size', 'lg');
    });
  });

  describe('selection and state', () => {
    it('changes selection on tab click', async () => {
      const user = userEvent.setup();
      render(<Tabs items={basicItems} defaultSelectedId="tab1" />);

      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
      await user.click(tab2);

      expect(tab2).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tabpanel', { hidden: false })).toHaveTextContent('Panel 2 content');
    });

    it('calls onChange callback when selection changes', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Tabs items={basicItems} defaultSelectedId="tab1" onChange={onChange} />);

      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
      await user.click(tab2);

      expect(onChange).toHaveBeenCalledWith('tab2');
    });

    it('works in controlled mode', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const { rerender } = render(
        <Tabs items={basicItems} selectedId="tab1" onChange={onChange} />
      );

      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
      await user.click(tab2);

      expect(onChange).toHaveBeenCalledWith('tab2');

      // Parent controls state, so selection shouldn't change yet
      expect(screen.getByRole('tab', { name: 'Tab 1' })).toHaveAttribute('aria-selected', 'true');

      // Simulate parent updating state
      rerender(<Tabs items={basicItems} selectedId="tab2" onChange={onChange} />);

      expect(screen.getByRole('tab', { name: 'Tab 2' })).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('disabled state', () => {
    const itemsWithDisabled: TabItem[] = [
      { id: 'tab1', label: 'Tab 1', panel: <div>Panel 1</div> },
      { id: 'tab2', label: 'Tab 2', panel: <div>Panel 2</div>, isDisabled: true },
      { id: 'tab3', label: 'Tab 3', panel: <div>Panel 3</div> },
    ];

    it('renders disabled tabs correctly', () => {
      render(<Tabs items={itemsWithDisabled} defaultSelectedId="tab1" />);

      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
      expect(tab2).toBeDisabled();
      expect(tab2).toHaveClass('tabs__tab--disabled');
    });

    it('does not select disabled tab on click', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Tabs items={itemsWithDisabled} defaultSelectedId="tab1" onChange={onChange} />);

      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
      await user.click(tab2);

      expect(onChange).not.toHaveBeenCalled();
      expect(tab2).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('keyboard navigation', () => {
    it('uses manual activation with Arrow keys and Enter', async () => {
      const user = userEvent.setup();
      render(<Tabs items={basicItems} defaultSelectedId="tab1" />);

      const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });

      tab1.focus();
      await user.keyboard('{ArrowRight}');

      expect(tab2).toHaveFocus();
      expect(tab1).toHaveAttribute('aria-selected', 'true');
      expect(tab2).toHaveAttribute('aria-selected', 'false');

      await user.keyboard('{Enter}');

      expect(tab2).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tabpanel', { hidden: false })).toHaveTextContent('Panel 2 content');
    });

    it('wraps focus at ends without changing selection until activated', async () => {
      const user = userEvent.setup();
      render(<Tabs items={basicItems} defaultSelectedId="tab3" />);

      const tab3 = screen.getByRole('tab', { name: 'Tab 3' });
      const tab1 = screen.getByRole('tab', { name: 'Tab 1' });

      tab3.focus();
      await user.keyboard('{ArrowRight}');

      expect(tab1).toHaveFocus();
      expect(tab3).toHaveAttribute('aria-selected', 'true');
      expect(tab1).toHaveAttribute('aria-selected', 'false');

      await user.keyboard(' ');
      expect(tab1).toHaveAttribute('aria-selected', 'true');
    });

    it('moves focus with Home and End keys while keeping current selection', async () => {
      const user = userEvent.setup();
      render(<Tabs items={basicItems} defaultSelectedId="tab2" />);

      const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
      const tab3 = screen.getByRole('tab', { name: 'Tab 3' });

      tab2.focus();
      await user.keyboard('{End}');

      expect(tab3).toHaveFocus();
      expect(tab2).toHaveAttribute('aria-selected', 'true');

      await user.keyboard('{Home}');
      expect(tab1).toHaveFocus();
      expect(tab2).toHaveAttribute('aria-selected', 'true');
    });

    it('skips disabled tabs when moving focus', async () => {
      const user = userEvent.setup();
      const itemsWithDisabled: TabItem[] = [
        { id: 'tab1', label: 'Tab 1', panel: <div>Panel 1</div> },
        { id: 'tab2', label: 'Tab 2', panel: <div>Panel 2</div>, isDisabled: true },
        { id: 'tab3', label: 'Tab 3', panel: <div>Panel 3</div> },
      ];

      render(<Tabs items={itemsWithDisabled} defaultSelectedId="tab1" />);

      const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
      const tab3 = screen.getByRole('tab', { name: 'Tab 3' });

      tab1.focus();
      await user.keyboard('{ArrowRight}');

      expect(tab3).toHaveFocus();
      expect(tab1).toHaveAttribute('aria-selected', 'true');
      expect(tab3).toHaveAttribute('aria-selected', 'false');
    });

    it('updates roving tabindex to follow the focused tab', async () => {
      const user = userEvent.setup();
      render(<Tabs items={basicItems} defaultSelectedId="tab1" />);

      const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });

      expect(tab1).toHaveAttribute('tabindex', '0');
      expect(tab2).toHaveAttribute('tabindex', '-1');

      tab1.focus();
      await user.keyboard('{ArrowRight}');

      expect(tab1).toHaveAttribute('tabindex', '-1');
      expect(tab2).toHaveAttribute('tabindex', '0');
    });
  });

  describe('ARIA and semantics', () => {
    it('has proper tablist role and ARIA attributes', () => {
      render(<Tabs items={basicItems} defaultSelectedId="tab1" aria-label="Main navigation" />);

      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveAttribute('aria-label', 'Main navigation');
    });

    it('links tabs to panels with aria-controls and aria-labelledby', () => {
      render(<Tabs items={basicItems} defaultSelectedId="tab1" />);

      const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
      const panel = screen.getByRole('tabpanel', { hidden: false });

      const controlsId = tab1.getAttribute('aria-controls');
      const panelId = panel.getAttribute('id');
      expect(controlsId).toBe(panelId);

      const labelledBy = panel.getAttribute('aria-labelledby');
      const tabId = tab1.getAttribute('id');
      expect(labelledBy).toBe(tabId);
    });

    it('uses roving tabindex correctly', () => {
      render(<Tabs items={basicItems} defaultSelectedId="tab2" />);

      const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
      const tab3 = screen.getByRole('tab', { name: 'Tab 3' });

      // Selected tab has tabindex 0, others have -1
      expect(tab1).toHaveAttribute('tabindex', '-1');
      expect(tab2).toHaveAttribute('tabindex', '0');
      expect(tab3).toHaveAttribute('tabindex', '-1');
    });

    it('hides inactive panels with hidden attribute', () => {
      render(<Tabs items={basicItems} defaultSelectedId="tab1" />);

      const panels = screen.getAllByRole('tabpanel', { hidden: true });
      const hiddenPanels = panels.filter(panel => panel.hasAttribute('hidden'));
      expect(hiddenPanels).toHaveLength(2); // Tab 2 and Tab 3 panels are hidden
      expect(panels.find(panel => !panel.hasAttribute('hidden'))).toBeDefined();
    });
  });

  describe('overflow behaviour', () => {
    it('collapses extra tabs into an overflow menu and keeps the active tab visible', async () => {
      const user = userEvent.setup();
      const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');

      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        configurable: true,
        get() {
          const element = this as HTMLElement;
          if (element.classList.contains('tabs__list')) return 360;
          if (element.classList.contains('tabs__tab')) return 140;
          return originalOffsetWidth?.get ? originalOffsetWidth.get.call(element) : 100;
        },
      });

      try {
        render(<Tabs items={overflowItems} defaultSelectedId="overview" overflowLabel="More" />);

        await act(async () => {
          flushResizeObservers();
        });

        const visibleTabs = screen.getAllByRole('tab');
        expect(visibleTabs).toHaveLength(2);
        expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');

        const overflowTrigger = screen.getByRole('button', { name: /more tabs/i });
        await user.click(overflowTrigger);

        const menu = within(await screen.findByRole('menu'));
        const securityItem = menu.getByRole('menuitem', { name: 'Security & Compliance' });
        await user.click(securityItem);

        await act(async () => {
          flushResizeObservers();
        });

        const promotedTab = screen.getByRole('tab', { name: 'Security & Compliance' });
        expect(promotedTab).toHaveAttribute('aria-selected', 'true');
        expect(promotedTab).toHaveFocus();
        expect(screen.getAllByRole('tab')).toHaveLength(2);
      } finally {
        if (originalOffsetWidth) {
          Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
        } else {
          delete (HTMLElement.prototype as any).offsetWidth;
        }
      }
    });
  });

  describe('accessibility', () => {
    it('passes axe accessibility checks', async () => {
      const { container } = render(<Tabs items={basicItems} defaultSelectedId="tab1" />);
      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: false },
        },
      });
      expect(results).toHaveNoViolations();
    });

    it('passes axe with disabled tabs', async () => {
      const itemsWithDisabled: TabItem[] = [
        { id: 'tab1', label: 'Tab 1', panel: <div>Panel 1</div> },
        { id: 'tab2', label: 'Tab 2', panel: <div>Panel 2</div>, isDisabled: true },
        { id: 'tab3', label: 'Tab 3', panel: <div>Panel 3</div> },
      ];
      const { container } = render(
        <Tabs items={itemsWithDisabled} defaultSelectedId="tab1" />
      );
      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: false },
        },
      });
      expect(results).toHaveNoViolations();
    });
  });

  describe('design tokens', () => {
    it('does not emit inline literal color values', () => {
      const { container } = render(<Tabs items={basicItems} defaultSelectedId="tab1" />);
      expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,6}/i);
    });
  });

  describe('edge cases', () => {
    it('handles single tab gracefully', () => {
      const singleItem: TabItem[] = [
        { id: 'only', label: 'Only Tab', panel: <div>Only panel</div> },
      ];
      render(<Tabs items={singleItem} />);

      const tab = screen.getByRole('tab', { name: 'Only Tab' });
      expect(tab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tabpanel')).toHaveTextContent('Only panel');
    });

    it('handles empty items array', () => {
      render(<Tabs items={[]} />);

      const tablist = screen.getByRole('tablist');
      expect(tablist).toBeInTheDocument();
      expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    });
  });
});
