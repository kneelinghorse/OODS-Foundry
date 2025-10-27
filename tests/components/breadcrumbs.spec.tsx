/* @vitest-environment jsdom */

/**
 * @file Breadcrumbs component tests
 * @module tests/components/breadcrumbs
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { act } from 'react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { Breadcrumbs } from '../../src/components/breadcrumbs/Breadcrumbs.js';
import type { BreadcrumbItem } from '../../src/components/breadcrumbs/types.js';

expect.extend({ toHaveNoViolations });

let originalCanvasGetContext: typeof HTMLCanvasElement.prototype.getContext;

beforeAll(() => {
  originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(),
  });
});

afterAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: originalCanvasGetContext,
  });
});

const createItems = (count: number): BreadcrumbItem[] =>
  Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    label: `Level ${i + 1}`,
    href: i < count - 1 ? `/level${i + 1}` : undefined,
  }));

const getVisibleListElement = () => {
  const nav = screen.getByRole('navigation');
  const list = nav.querySelector('ol[data-breadcrumbs="visible"]');
  if (!list) {
    throw new Error('Visible breadcrumb list not found');
  }
  return list;
};

const withinVisibleList = () => within(getVisibleListElement());

describe('Breadcrumbs component', () => {
  describe('rendering', () => {
    it('should render navigation element with aria-label', () => {
      const items = createItems(3);
      render(<Breadcrumbs items={items} />);

      const nav = screen.getByRole('navigation');
      expect(nav).toBeInTheDocument();
      expect(nav).toHaveAttribute('aria-label', 'breadcrumb');
    });

    it('should accept custom aria-label', () => {
      const items = createItems(3);
      render(<Breadcrumbs items={items} aria-label="Custom navigation" />);

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveAttribute('aria-label', 'Custom navigation');
    });

    it('should render all items when count is below maxVisibleItems', () => {
      const items = createItems(4);
      render(<Breadcrumbs items={items} maxVisibleItems={5} />);

      const list = withinVisibleList();
      items.forEach(item => {
        expect(list.getByText(item.label)).toBeInTheDocument();
      });
    });

    it('should render single item', () => {
      const items: BreadcrumbItem[] = [{ id: '1', label: 'Home' }];
      render(<Breadcrumbs items={items} />);

      expect(withinVisibleList().getByText('Home')).toBeInTheDocument();
    });

    it('should render two items with separator', () => {
      const items: BreadcrumbItem[] = [
        { id: '1', label: 'Home', href: '/' },
        { id: '2', label: 'Dashboard' },
      ];
      render(<Breadcrumbs items={items} />);

      const list = withinVisibleList();
      expect(list.getByText('Home')).toBeInTheDocument();
      expect(list.getByText('Dashboard')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const items = createItems(2);
      const { container } = render(
        <Breadcrumbs items={items} className="custom-class" />
      );

      const nav = container.querySelector('.breadcrumbs');
      expect(nav).toHaveClass('custom-class');
    });
  });

  describe('overflow behavior', () => {
    it('should show overflow menu when items exceed maxVisibleItems', () => {
      const items = createItems(7);
      render(<Breadcrumbs items={items} maxVisibleItems={3} />);

      const list = withinVisibleList();

      // First item always visible
      expect(list.getByText('Level 1')).toBeInTheDocument();

      // Last item always visible
      expect(list.getByText('Level 7')).toBeInTheDocument();

      // Overflow trigger should be present
      const overflowTrigger = screen.getByLabelText(/Show \d+ hidden breadcrumb levels/);
      expect(overflowTrigger).toBeInTheDocument();
    });

    it('should preserve first and last items with overflow', () => {
      const items = createItems(9);
      render(<Breadcrumbs items={items} maxVisibleItems={2} />);

      const list = withinVisibleList();
      // Only first and last should be directly visible
      expect(list.getByText('Level 1')).toBeInTheDocument();
      expect(list.getByText('Level 9')).toBeInTheDocument();

      // Middle items should not be directly visible
      expect(list.queryByText('Level 5')).not.toBeInTheDocument();
    });

    it('should use custom overflow label', () => {
      const items = createItems(7);
      render(<Breadcrumbs items={items} maxVisibleItems={3} overflowLabel="More" />);

      const overflowTrigger = screen.getByRole('button', {
        name: /hidden breadcrumb levels/i,
      });
      expect(overflowTrigger).toHaveTextContent('More');
    });

    it('should show all middle items in overflow menu', async () => {
      const user = userEvent.setup();
      const items = createItems(7);
      render(<Breadcrumbs items={items} maxVisibleItems={2} />);

      // Click overflow trigger
      const overflowTrigger = screen.getByLabelText(/Show \d+ hidden breadcrumb levels/);
      await user.click(overflowTrigger);

      // Middle items (2-6) should be in overflow menu
      expect(screen.getByRole('menuitem', { name: 'Level 2' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Level 3' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Level 4' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Level 5' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Level 6' })).toBeInTheDocument();
    });

    it('should collapse into overflow when measured width exceeds container', async () => {
      const items = createItems(4);
      render(<Breadcrumbs items={items} maxVisibleItems={10} />);

      const nav = screen.getByRole('navigation');
      const measurementList = nav.querySelector<HTMLOListElement>('.breadcrumbs__list--measurement');
      expect(measurementList).not.toBeNull();

      Object.defineProperty(nav, 'clientWidth', { configurable: true, value: 120 });
      Object.defineProperty(measurementList as HTMLOListElement, 'scrollWidth', {
        configurable: true,
        value: 320,
      });

      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      const overflowTrigger = await screen.findByLabelText(/Show \d+ hidden breadcrumb levels/);
      expect(overflowTrigger).toBeInTheDocument();

      delete (nav as HTMLElement & { clientWidth?: number }).clientWidth;
      delete (measurementList as HTMLOListElement & { scrollWidth?: number }).scrollWidth;
    });
  });

  describe('accessibility', () => {
    it('should mark last item with aria-current="page"', () => {
      const items = createItems(3);
      render(<Breadcrumbs items={items} />);

      const currentItem = withinVisibleList().getByText('Level 3');
      expect(currentItem).toHaveAttribute('aria-current', 'page');
    });

    it('should render links as anchors when href is provided', () => {
      const items: BreadcrumbItem[] = [
        { id: '1', label: 'Home', href: '/' },
        { id: '2', label: 'Products', href: '/products' },
        { id: '3', label: 'Laptops' },
      ];
      render(<Breadcrumbs items={items} />);

      const list = withinVisibleList();
      const homeLink = list.getByText('Home');
      expect(homeLink.tagName).toBe('A');
      expect(homeLink).toHaveAttribute('href', '/');

      const productsLink = list.getByText('Products');
      expect(productsLink.tagName).toBe('A');
      expect(productsLink).toHaveAttribute('href', '/products');
    });

    it('should render buttons for items without href', () => {
      const items: BreadcrumbItem[] = [
        { id: '1', label: 'Home' },
        { id: '2', label: 'Products' },
        { id: '3', label: 'Current' },
      ];
      render(<Breadcrumbs items={items} />);

      // First two should be buttons (excluding current)
      const list = withinVisibleList();
      const homeButton = list.getByText('Home');
      expect(homeButton.tagName).toBe('BUTTON');

      const productsButton = list.getByText('Products');
      expect(productsButton.tagName).toBe('BUTTON');
    });

    it('should handle disabled items', () => {
      const items: BreadcrumbItem[] = [
        { id: '1', label: 'Home', href: '/' },
        { id: '2', label: 'Disabled', href: '/disabled', disabled: true },
        { id: '3', label: 'Current' },
      ];
      render(<Breadcrumbs items={items} />);

      const disabledItem = withinVisibleList().getByText('Disabled');
      expect(disabledItem.tagName).toBe('SPAN');
      expect(disabledItem).toHaveClass('breadcrumbs__item--disabled');
    });

    it('should mark overflow trigger with aria-haspopup', () => {
      const items = createItems(7);
      render(<Breadcrumbs items={items} maxVisibleItems={3} />);

      const overflowTrigger = screen.getByLabelText(/Show \d+ hidden breadcrumb levels/);
      // Popover sets aria-haspopup="dialog" (ARIA 1.1+)
      expect(overflowTrigger).toHaveAttribute('aria-haspopup');
    });

    it('should pass axe accessibility checks', async () => {
      const items = createItems(5);
      const { container } = render(<Breadcrumbs items={items} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should pass axe checks with overflow menu', async () => {
      const items = createItems(7);
      const { container } = render(<Breadcrumbs items={items} maxVisibleItems={3} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('interactions', () => {
    it('should call onItemClick when link is clicked', async () => {
      const user = userEvent.setup();
      const onItemClick = vi.fn();
      const items: BreadcrumbItem[] = [
        { id: '1', label: 'Home', href: '/' },
        { id: '2', label: 'Products', href: '/products' },
        { id: '3', label: 'Current' },
      ];
      render(<Breadcrumbs items={items} onItemClick={onItemClick} />);

      const homeLink = withinVisibleList().getByText('Home');
      if (homeLink instanceof HTMLAnchorElement) {
        homeLink.addEventListener('click', (event) => event.preventDefault());
      }
      await user.click(homeLink);

      expect(onItemClick).toHaveBeenCalledWith(items[0]);
    });

    it('should not call onItemClick for disabled items', async () => {
      const user = userEvent.setup();
      const onItemClick = vi.fn();
      const items: BreadcrumbItem[] = [
        { id: '1', label: 'Home', href: '/' },
        { id: '2', label: 'Disabled', href: '/disabled', disabled: true },
        { id: '3', label: 'Current' },
      ];
      render(<Breadcrumbs items={items} onItemClick={onItemClick} />);

      const disabledItem = withinVisibleList().getByText('Disabled');
      await user.click(disabledItem);

      expect(onItemClick).not.toHaveBeenCalled();
    });

    it('should not call onItemClick for current page', async () => {
      const user = userEvent.setup();
      const onItemClick = vi.fn();
      const items = createItems(3);
      render(<Breadcrumbs items={items} onItemClick={onItemClick} />);

      const currentItem = withinVisibleList().getByText('Level 3');
      await user.click(currentItem);

      expect(onItemClick).not.toHaveBeenCalled();
    });

    it('should handle overflow menu item clicks', async () => {
      const user = userEvent.setup();
      const onItemClick = vi.fn();
      const items = createItems(7);
      render(<Breadcrumbs items={items} maxVisibleItems={2} onItemClick={onItemClick} />);

      // Open overflow menu
      const overflowTrigger = screen.getByLabelText(/Show \d+ hidden breadcrumb levels/);
      await user.click(overflowTrigger);

      // Click middle item from overflow
      const level4MenuItem = screen.getByRole('menuitem', { name: 'Level 4' });
      if (level4MenuItem instanceof HTMLAnchorElement) {
        level4MenuItem.addEventListener('click', (event) => event.preventDefault());
      }
      await user.click(level4MenuItem);

      expect(onItemClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: '4', label: 'Level 4' })
      );
    });

    it('should not click disabled items in overflow menu', async () => {
      const user = userEvent.setup();
      const onItemClick = vi.fn();
      const items: BreadcrumbItem[] = [
        { id: '1', label: 'Home', href: '/' },
        { id: '2', label: 'Products', href: '/products' },
        { id: '3', label: 'Electronics', href: '/electronics', disabled: true },
        { id: '4', label: 'Laptops', href: '/laptops' },
        { id: '5', label: 'Gaming' },
      ];
      render(<Breadcrumbs items={items} maxVisibleItems={2} onItemClick={onItemClick} />);

      // Open overflow menu
      const overflowTrigger = screen.getByLabelText(/Show \d+ hidden breadcrumb levels/);
      await user.click(overflowTrigger);

      // Try to click disabled item
      const disabledMenuItem = screen.getByRole('menuitem', { name: 'Electronics' });
      expect(disabledMenuItem).toBeDisabled();

      await user.click(disabledMenuItem);
      expect(onItemClick).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle empty items array', () => {
      const { container } = render(<Breadcrumbs items={[]} />);
      const nav = container.querySelector('.breadcrumbs');
      expect(nav).toBeInTheDocument();
    });

    it('should handle maxVisibleItems = 0', () => {
      const items = createItems(3);
      render(<Breadcrumbs items={items} maxVisibleItems={0} />);

      // Should still show first and last
      const list = withinVisibleList();
      expect(list.getByText('Level 1')).toBeInTheDocument();
      expect(list.getByText('Level 3')).toBeInTheDocument();
    });

    it('should handle maxVisibleItems larger than items length', () => {
      const items = createItems(3);
      render(<Breadcrumbs items={items} maxVisibleItems={10} />);

      // All items should be visible
      const list = withinVisibleList();
      items.forEach(item => {
        expect(list.getByText(item.label)).toBeInTheDocument();
      });

      // No overflow menu
      expect(screen.queryByLabelText(/Show \d+ hidden breadcrumb levels/)).not.toBeInTheDocument();
    });

    it('should handle items with very long labels', () => {
      const items: BreadcrumbItem[] = [
        { id: '1', label: 'Home', href: '/' },
        {
          id: '2',
          label: 'This is a very long breadcrumb label that might cause layout issues',
          href: '/long',
        },
        { id: '3', label: 'Current' },
      ];
      const { container } = render(<Breadcrumbs items={items} />);

      const nav = container.querySelector('.breadcrumbs');
      expect(nav).toBeInTheDocument();
      expect(withinVisibleList().getByText(items[1].label)).toBeInTheDocument();
    });

    it('should not show overflow when exactly at maxVisibleItems', () => {
      const items = createItems(5);
      render(<Breadcrumbs items={items} maxVisibleItems={5} />);

      // All items visible, no overflow
      const list = withinVisibleList();
      items.forEach(item => {
        expect(list.getByText(item.label)).toBeInTheDocument();
      });

      expect(screen.queryByLabelText(/Show \d+ hidden breadcrumb levels/)).not.toBeInTheDocument();
    });

    it('should handle items with missing ids gracefully', () => {
      const items: BreadcrumbItem[] = [
        { id: '', label: 'Home', href: '/' },
        { id: '', label: 'Products', href: '/products' },
        { id: '', label: 'Current' },
      ];
      // Should not throw
      expect(() => render(<Breadcrumbs items={items} />)).not.toThrow();
    });
  });

  describe('separators', () => {
    it('should render separators between items', () => {
      const items = createItems(3);
      render(<Breadcrumbs items={items} />);

      const nav = screen.getByRole('navigation');
      const visibleList = nav.querySelector('ol[data-breadcrumbs="visible"]');
      const separators = visibleList?.querySelectorAll('.breadcrumbs__separator') ?? [];
      // Should have 2 separators for 3 items
      expect(separators.length).toBe(2);
    });

    it('should hide separators with aria-hidden', () => {
      const items = createItems(3);
      render(<Breadcrumbs items={items} />);

      const nav = screen.getByRole('navigation');
      const visibleList = nav.querySelector('ol[data-breadcrumbs="visible"]');
      const separatorParents = visibleList?.querySelectorAll('[aria-hidden="true"]') ?? [];
      expect(separatorParents.length).toBeGreaterThan(0);
    });

    it('should render separator before overflow menu', () => {
      const items = createItems(7);
      render(<Breadcrumbs items={items} maxVisibleItems={2} />);

      const nav = screen.getByRole('navigation');
      const visibleList = nav.querySelector('ol[data-breadcrumbs="visible"]');
      const separators = visibleList?.querySelectorAll('.breadcrumbs__separator') ?? [];
      // Should have separators: after first item and before last item
      expect(separators.length).toBeGreaterThanOrEqual(2);
    });
  });
});
