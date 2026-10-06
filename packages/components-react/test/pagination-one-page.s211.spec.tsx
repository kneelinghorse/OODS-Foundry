import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PaginationBar } from '../src/index.js';

afterEach(cleanup);

/** s211-m02: "15 records Showing 1–15 of 15" said the count twice; one page says it once, more pages add the range. */
describe('PaginationBar says its count once', () => {
  it('on one page shows the count and no range', () => {
    const { container } = render(<PaginationBar page={1} pageSize={20} totalItems={15} />);
    expect(container.querySelector('[data-pagination-count]')?.textContent).toBe('15 records');
    expect(container.querySelector('[data-pagination-range]')).toBeNull();
  });
  it('on more than one page shows the range as well', () => {
    const { container } = render(<PaginationBar page={2} pageSize={10} totalItems={15} />);
    expect(container.querySelector('[data-pagination-range]')?.textContent).toBe('Showing 11–15 of 15');
  });
});
