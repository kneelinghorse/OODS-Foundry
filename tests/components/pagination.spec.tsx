/* @vitest-environment jsdom */

/**
 * @file Pagination component and usePagination hook tests
 * @module tests/components/pagination
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook, act as hookAct } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { Pagination } from '../../src/components/pagination/Pagination.js';
import { usePagination } from '../../src/components/pagination/usePagination.js';

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

describe('usePagination hook', () => {
  describe('basic pagination logic', () => {
    it('should return correct items for small page count', () => {
      const { result } = renderHook(() =>
        usePagination({ page: 1, count: 5 })
      );

      const items = result.current.items;
      expect(items).toHaveLength(7); // previous + 5 pages + next
      expect(items[0]).toMatchObject({ type: 'previous', page: 1, disabled: true });
      const pageItems = items.filter(item => item.type === 'page');
      expect(pageItems).toHaveLength(5);
      expect(pageItems[0]).toMatchObject({ type: 'page', page: 1, selected: true });
      expect(pageItems[4]).toMatchObject({ type: 'page', page: 5, selected: false });
      expect(items[items.length - 1]).toMatchObject({ type: 'next', page: 2, disabled: false });
    });

    it('should mark current page as selected', () => {
      const { result } = renderHook(() =>
        usePagination({ page: 3, count: 5 })
      );

      const selectedItem = result.current.items.find(item => item.selected);
      expect(selectedItem).toMatchObject({ type: 'page', page: 3 });
    });

    it('should handle single page', () => {
      const { result } = renderHook(() =>
        usePagination({ page: 1, count: 1 })
      );

      const items = result.current.items;
      expect(items).toHaveLength(3);
      const [previous, current, next] = items;
      expect(previous).toMatchObject({ type: 'previous', page: 1, disabled: true });
      expect(current).toMatchObject({ type: 'page', page: 1, selected: true });
      expect(next).toMatchObject({ type: 'next', page: 1, disabled: true });
    });

    it('should handle zero pages', () => {
      const { result } = renderHook(() =>
        usePagination({ page: 1, count: 0 })
      );

      expect(result.current.items).toHaveLength(2);
      expect(result.current.items[0]).toMatchObject({ type: 'previous', disabled: true });
      expect(result.current.items[1]).toMatchObject({ type: 'next', disabled: true });
    });

    it('should disable previous/next at boundaries and provide targets otherwise', () => {
      const { result: startResult } = renderHook(() =>
        usePagination({ page: 1, count: 10 })
      );
      const { result: middleResult } = renderHook(() =>
        usePagination({ page: 5, count: 10 })
      );
      const { result: endResult } = renderHook(() =>
        usePagination({ page: 10, count: 10 })
      );

      const startItems = startResult.current.items;
      expect(startItems[0]).toMatchObject({ type: 'previous', disabled: true, page: 1 });
      expect(startItems[startItems.length - 1]).toMatchObject({ type: 'next', disabled: false, page: 2 });

      const middleItems = middleResult.current.items;
      const prevItem = middleItems.find(item => item.type === 'previous');
      const nextItem = middleItems.find(item => item.type === 'next');
      expect(prevItem).toMatchObject({ page: 4, disabled: false });
      expect(nextItem).toMatchObject({ page: 6, disabled: false });

      const endItems = endResult.current.items;
      expect(endItems[0]).toMatchObject({ type: 'previous', disabled: false, page: 9 });
      expect(endItems[endItems.length - 1]).toMatchObject({ type: 'next', disabled: true, page: 10 });
    });
  });

  describe('truncation logic', () => {
    it('should show single ellipsis when near start', () => {
      const { result } = renderHook(() =>
        usePagination({ page: 2, count: 10, siblingCount: 1, boundaryCount: 1 })
      );

      const ellipsisCount = result.current.items.filter(item => item.type === 'ellipsis').length;
      expect(ellipsisCount).toBe(1);

      // Should show: [1] [2] [3] [...] [10]
      const pages = result.current.items.filter(item => item.type === 'page').map(item => item.page);
      expect(pages).toContain(1);
      expect(pages).toContain(2);
      expect(pages).toContain(3);
      expect(pages).toContain(10);
    });

    it('should show double ellipsis when in middle', () => {
      const { result } = renderHook(() =>
        usePagination({ page: 25, count: 50, siblingCount: 1, boundaryCount: 1 })
      );

      const ellipsisCount = result.current.items.filter(item => item.type === 'ellipsis').length;
      expect(ellipsisCount).toBe(2);

      // Should show: [1] [...] [24] [25] [26] [...] [50]
      const pages = result.current.items.filter(item => item.type === 'page').map(item => item.page);
      expect(pages).toContain(1);
      expect(pages).toContain(24);
      expect(pages).toContain(25);
      expect(pages).toContain(26);
      expect(pages).toContain(50);
    });

    it('should respect siblingCount', () => {
      const { result } = renderHook(() =>
        usePagination({ page: 10, count: 20, siblingCount: 2, boundaryCount: 1 })
      );

      const pages = result.current.items.filter(item => item.type === 'page').map(item => item.page);
      // Should include pages 8, 9, 10, 11, 12 (current ± 2)
      expect(pages).toContain(8);
      expect(pages).toContain(9);
      expect(pages).toContain(10);
      expect(pages).toContain(11);
      expect(pages).toContain(12);
    });

    it('should respect boundaryCount', () => {
      const { result } = renderHook(() =>
        usePagination({ page: 10, count: 20, siblingCount: 1, boundaryCount: 2 })
      );

      const pages = result.current.items.filter(item => item.type === 'page').map(item => item.page);
      // Should show first 2 and last 2 pages
      expect(pages).toContain(1);
      expect(pages).toContain(2);
      expect(pages).toContain(19);
      expect(pages).toContain(20);
    });
  });

  describe('navigation handlers', () => {
    it('should call onChange when goToPage is invoked', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        usePagination({ page: 1, count: 10, onChange })
      );

      hookAct(() => {
        result.current.goToPage(5);
      });

      expect(onChange).toHaveBeenCalledWith(5);
    });

    it('should call onChange when nextPage is invoked', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        usePagination({ page: 3, count: 10, onChange })
      );

      hookAct(() => {
        result.current.nextPage();
      });

      expect(onChange).toHaveBeenCalledWith(4);
    });

    it('should call onChange when previousPage is invoked', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        usePagination({ page: 3, count: 10, onChange })
      );

      hookAct(() => {
        result.current.previousPage();
      });

      expect(onChange).toHaveBeenCalledWith(2);
    });

    it('should clamp page to valid range', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        usePagination({ page: 1, count: 10, onChange })
      );

      hookAct(() => {
        result.current.goToPage(0); // Below min
      });
      expect(onChange).not.toHaveBeenCalled();

      hookAct(() => {
        result.current.goToPage(20); // Above max
      });
      expect(onChange).toHaveBeenCalledWith(10);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('should guard nextPage at boundary while allowing previous navigation', () => {
      const onChange = vi.fn();
      const { result, rerender } = renderHook(
        (props: Parameters<typeof usePagination>[0]) => usePagination(props),
        {
          initialProps: { page: 10, count: 10, onChange },
        }
      );

      hookAct(() => {
        result.current.nextPage(); // Already at last page
      });

      expect(onChange).not.toHaveBeenCalled();

      hookAct(() => {
        result.current.previousPage(); // Move to 9
      });

      expect(onChange).toHaveBeenCalledWith(9);

      rerender({ page: 9, count: 10, onChange });

      hookAct(() => {
        result.current.previousPage(); // Should call with 8
      });
      expect(onChange).toHaveBeenLastCalledWith(8);
    });
  });

  describe('edge cases', () => {
    it('should handle negative page numbers', () => {
      const { result } = renderHook(() =>
        usePagination({ page: -5, count: 10 })
      );

      const selectedItem = result.current.items.find(item => item.selected);
      expect(selectedItem?.page).toBe(1); // Clamped to min
    });

    it('should handle page exceeding count', () => {
      const { result } = renderHook(() =>
        usePagination({ page: 20, count: 10 })
      );

      const selectedItem = result.current.items.find(item => item.selected);
      expect(selectedItem?.page).toBe(10); // Clamped to max
    });

    it('should ignore navigation attempts when count is zero', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        usePagination({ page: 1, count: 0, onChange })
      );

      hookAct(() => {
        result.current.goToPage(5);
        result.current.nextPage();
        result.current.previousPage();
      });

      expect(onChange).not.toHaveBeenCalled();
    });
  });
});

describe('Pagination component', () => {
  describe('rendering', () => {
    it('should render navigation element', () => {
      render(<Pagination page={1} count={10} onChange={vi.fn()} />);
      const nav = screen.getByRole('navigation');
      expect(nav).toBeInTheDocument();
      expect(nav).toHaveAttribute('aria-label', 'Pagination');
    });

    it('should render page buttons', () => {
      render(<Pagination page={1} count={5} onChange={vi.fn()} />);
      expect(screen.getByLabelText('Page 1')).toBeInTheDocument();
      expect(screen.getByLabelText('Page 2')).toBeInTheDocument();
      expect(screen.getByLabelText('Page 5')).toBeInTheDocument();
    });

    it('should render previous/next buttons', () => {
      render(<Pagination page={5} count={10} onChange={vi.fn()} />);
      expect(screen.getByLabelText('Go to previous page')).toBeInTheDocument();
      expect(screen.getByLabelText('Go to next page')).toBeInTheDocument();
    });

    it('should render first/last buttons when showFirstLast is true', () => {
      render(<Pagination page={5} count={10} onChange={vi.fn()} showFirstLast />);
      expect(screen.getByLabelText('Go to first page')).toBeInTheDocument();
      expect(screen.getByLabelText('Go to last page')).toBeInTheDocument();
    });

    it('should render ellipsis for truncated pages', () => {
      render(<Pagination page={25} count={50} onChange={vi.fn()} />);
      const ellipses = screen.getAllByText('…');
      expect(ellipses.length).toBeGreaterThan(0);
    });
  });

  describe('accessibility', () => {
    it('should mark current page with aria-current', () => {
      render(<Pagination page={3} count={5} onChange={vi.fn()} />);
      const currentPage = screen.getByLabelText('Page 3');
      expect(currentPage).toHaveAttribute('aria-current', 'page');
    });

    it('should disable previous button on first page', () => {
      render(<Pagination page={1} count={10} onChange={vi.fn()} />);
      const prevButton = screen.getByLabelText('Go to previous page');
      expect(prevButton).toBeDisabled();
    });

    it('should disable next button on last page', () => {
      render(<Pagination page={10} count={10} onChange={vi.fn()} />);
      const nextButton = screen.getByLabelText('Go to next page');
      expect(nextButton).toBeDisabled();
    });

    it('should pass axe accessibility checks', async () => {
      const { container } = render(<Pagination page={5} count={10} onChange={vi.fn()} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('interactions', () => {
    it('should call onChange when page button is clicked', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Pagination page={1} count={10} onChange={onChange} />);

      const page5Button = screen.getByLabelText('Page 5');
      await user.click(page5Button);

      expect(onChange).toHaveBeenCalledWith(5);
    });

    it('should call onChange when next button is clicked', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Pagination page={3} count={10} onChange={onChange} />);

      const nextButton = screen.getByLabelText('Go to next page');
      await user.click(nextButton);

      expect(onChange).toHaveBeenCalledWith(4);
    });

    it('should call onChange when previous button is clicked', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Pagination page={3} count={10} onChange={onChange} />);

      const prevButton = screen.getByLabelText('Go to previous page');
      await user.click(prevButton);

      expect(onChange).toHaveBeenCalledWith(2);
    });

    it('should navigate to first page when first button is clicked', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Pagination page={5} count={10} onChange={onChange} showFirstLast />);

      const firstButton = screen.getByLabelText('Go to first page');
      await user.click(firstButton);

      expect(onChange).toHaveBeenCalledWith(1);
    });

    it('should navigate to last page when last button is clicked', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Pagination page={5} count={10} onChange={onChange} showFirstLast />);

      const lastButton = screen.getByLabelText('Go to last page');
      await user.click(lastButton);

      expect(onChange).toHaveBeenCalledWith(10);
    });
  });

  describe('edge cases', () => {
    it('should render empty when count is 0', () => {
      render(<Pagination page={1} count={0} onChange={vi.fn()} />);
      const nav = screen.getByRole('navigation');
      expect(nav).toBeInTheDocument();
      // Buttons should still exist but pages list should be empty
      expect(screen.queryByLabelText(/^Page \d+$/)).not.toBeInTheDocument();
    });

    it('should handle single page gracefully', () => {
      render(<Pagination page={1} count={1} onChange={vi.fn()} />);
      const prevButton = screen.getByLabelText('Go to previous page');
      const nextButton = screen.getByLabelText('Go to next page');
      expect(prevButton).toBeDisabled();
      expect(nextButton).toBeDisabled();
    });
  });
});
