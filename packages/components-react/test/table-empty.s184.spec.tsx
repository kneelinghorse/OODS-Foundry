/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Table } from '../src/index.js';

afterEach(cleanup);

describe('@oods/components-react Table empty affordance', () => {
  it('renders non-empty text spanning every declared column when rows are empty', () => {
    const { container } = render(
      <Table
        caption="Subscriptions"
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'status', label: 'Status' },
        ]}
        rows={[]}
      />
    );

    const body = container.querySelector('tbody');
    expect(body).not.toBeNull();
    expect(body?.textContent?.trim()).toBe('No rows available.');
    expect(body?.textContent?.trim().length).toBeGreaterThan(0);
    expect(body?.querySelectorAll('tr')).toHaveLength(1);
    expect(body?.querySelector('td')?.colSpan).toBe(2);
  });

  // s222-m02 (#2502 ruling 11): a caption hidden on request stays the table's accessible name; only its box is hidden.
  it('keeps a hidden caption as the table name', () => {
    const { container } = render(<Table caption="Invoices" showCaption={false} columns={[{ key: 'n', label: 'Invoice' }]} rows={[{ id: '1', n: 'INV-1' }]} />);
    const caption = container.querySelector('caption');
    expect(caption?.textContent).toBe('Invoices');
    expect(caption?.getAttribute('data-visually-hidden')).toBe('true');
    const shown = render(<Table caption="Invoices" columns={[{ key: 'n', label: 'Invoice' }]} rows={[]} />);
    expect(shown.container.querySelector('caption')?.hasAttribute('data-visually-hidden')).toBe(false);
  });
});
