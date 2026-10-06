/* @vitest-environment jsdom */

import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  Banner,
  Button,
  Checkbox,
  DatePicker,
  Input,
  Select,
  Table,
  Tabs,
  Textarea,
  type TabItem,
} from '../src/index.js';

afterEach(cleanup);

describe('@oods/components-react interactions', () => {
  it('does not steal existing focus while hydrating Tabs', async () => {
    const items: TabItem[] = [
      { id: 'overview', label: 'Overview', panel: 'Summary' },
      { id: 'billing', label: 'Billing', panel: 'Invoices' },
    ];
    const tabs = <Tabs items={items} defaultSelectedId="overview" />;
    const sentinel = document.createElement('button');
    const container = document.createElement('div');
    sentinel.textContent = 'Existing focus';
    container.innerHTML = renderToString(tabs);
    document.body.append(sentinel, container);
    sentinel.focus();

    let root: Root | undefined;
    await act(async () => {
      root = hydrateRoot(container, tabs);
    });

    expect(document.activeElement).toBe(sentinel);

    await act(async () => root?.unmount());
    sentinel.remove();
    container.remove();
  });

  it('B-07 moves React Tabs selection and focus with ArrowRight', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const items: TabItem[] = [
      { id: 'overview', label: 'Overview', panel: 'Summary' },
      { id: 'disabled', label: 'Disabled', panel: 'Unavailable', disabled: true },
      { id: 'billing', label: 'Billing', panel: 'Invoices' },
    ];
    render(
      <Tabs
        items={items}
        defaultSelectedId="overview"
        ariaLabel="Account sections"
        onChange={onChange}
      />
    );

    const overview = screen.getByRole('tab', { name: 'Overview' });
    overview.focus();
    await user.keyboard('{ArrowRight}');

    const billing = screen.getByRole('tab', { name: 'Billing' });
    expect(billing.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(billing);
    expect(screen.getByRole('tabpanel').textContent).toBe('Invoices');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('billing');
  });

  it('supports Tabs ArrowLeft, Home, End, pointer activation, and controlled selection', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    const items: TabItem[] = [
      { id: 'one', label: 'One', panel: 'First' },
      { id: 'two', label: 'Two', panel: 'Second', isDisabled: true },
      { id: 'three', label: 'Three', panel: 'Third' },
    ];
    const { rerender } = render(
      <Tabs items={items} selectedId="one" onUpdate={onUpdate} />
    );
    const one = screen.getByRole('tab', { name: 'One' });
    one.focus();
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Three' }));
    expect(onUpdate).toHaveBeenLastCalledWith('three');
    expect(one.getAttribute('aria-selected')).toBe('true');

    rerender(<Tabs items={items} selectedId="three" onUpdate={onUpdate} />);
    const three = screen.getByRole('tab', { name: 'Three' });
    three.focus();
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'One' }));
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(three);
    await user.click(one);
    expect(onUpdate).toHaveBeenLastCalledWith('one');
  });

  // s224-m01 (#2542 ruling 2): seven tabs in a narrow list, as the website's mockup has them (d3b3935e). jsdom has no
  // layout, so the list reports 358px and each tab 80px: three tabs fit beside the "More" trigger. The trigger and its
  // menu carry what Vue's carry (the data attribute and the oods-tabs-overflow classes the stylesheet paints as tabs),
  // and the selected tab is always swapped into the row, so the menu never holds the current tab.
  it('moves the tabs that do not fit into a "More" menu with the markup Vue renders', async () => {
    const user = userEvent.setup();
    const offsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get(this: HTMLElement) {
        if (this.getAttribute('role') === 'tablist') return 358;
        if (this.getAttribute('role') === 'tab') return 80;
        return offsetWidth?.get?.call(this) ?? 0;
      },
    });
    try {
      const items: TabItem[] = ['Detail', 'List', 'Form', 'Timeline', 'Card', 'Inline', 'Workflow']
        .map(label => ({ id: label.toLowerCase(), label, panel: `${label} context` }));
      render(<Tabs ariaLabel="Contexts" defaultSelectedId="detail" items={items} />);

      expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Detail', 'List', 'Form']);
      const trigger = screen.getByRole('button', { name: 'More tabs' });
      expect(trigger.getAttribute('data-tabs-overflow-trigger')).toBe('true');
      expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(trigger.classList.contains('oods-tabs-overflow-trigger')).toBe(true);
      expect(trigger.parentElement?.classList.contains('oods-tabs-overflow')).toBe(true);
      expect(screen.queryByRole('menu')).toBeNull();

      await user.click(trigger);
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByRole('menu').classList.contains('oods-tabs-overflow-menu')).toBe(true);
      const menuItems = screen.getAllByRole('menuitem');
      expect(menuItems.map(item => item.textContent)).toEqual(['Timeline', 'Card', 'Inline', 'Workflow']);
      expect(menuItems.filter(item => item.hasAttribute('aria-current'))).toEqual([]);

      await user.click(screen.getByRole('menuitem', { name: 'Workflow' }));
      expect(screen.queryByRole('menu')).toBeNull();
      const workflow = screen.getByRole('tab', { name: 'Workflow' });
      expect(workflow.getAttribute('aria-selected')).toBe('true');
      expect(document.activeElement).toBe(workflow);
      expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Detail', 'List', 'Workflow']);
      expect(screen.getByRole('tabpanel').textContent).toBe('Workflow context');
    } finally {
      if (offsetWidth) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', offsetWidth);
    }
  });

  it('emits idiomatic controlled field changes and preserves native state props', () => {
    const inputUpdate = vi.fn();
    const inputChange = vi.fn();
    const { rerender } = render(
      <Input
        id="email"
        label="Email"
        value="invalid"
        onChange={inputChange}
        onValueChange={inputUpdate}
      />
    );
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.com' },
    });
    expect(inputChange).toHaveBeenCalledTimes(1);
    expect(inputUpdate).toHaveBeenCalledWith('user@example.com');

    const checkedUpdate = vi.fn();
    rerender(
      <Checkbox
        id="marketing"
        label="Product updates"
        checked={false}
        onCheckedChange={checkedUpdate}
      />
    );
    fireEvent.click(screen.getByLabelText('Product updates'));
    expect(checkedUpdate).toHaveBeenCalledWith(true);

    const selectUpdate = vi.fn();
    rerender(
      <Select
        id="plan"
        label="Plan"
        value="pro"
        options={[
          { value: 'basic', label: 'Basic' },
          { value: 'pro', label: 'Pro' },
        ]}
        onValueChange={selectUpdate}
      />
    );
    fireEvent.change(screen.getByLabelText('Plan'), { target: { value: 'basic' } });
    expect(selectUpdate).toHaveBeenCalledWith('basic');

    const textareaUpdate = vi.fn();
    rerender(
      <Textarea
        id="notes"
        label="Notes"
        value="Call before renewal"
        onValueChange={textareaUpdate}
      />
    );
    fireEvent.change(screen.getByLabelText('Notes'), {
      target: { value: 'Call before renewal. Confirm owner.' },
    });
    expect(textareaUpdate).toHaveBeenCalledWith('Call before renewal. Confirm owner.');

    const dateUpdate = vi.fn();
    rerender(
      <DatePicker
        id="renewal"
        label="Renewal date"
        value="2026-09-30"
        min="2026-09-01"
        max="2026-12-31"
        step={1}
        onValueChange={dateUpdate}
      />
    );
    const date = screen.getByLabelText('Renewal date') as HTMLInputElement;
    expect(date.type).toBe('date');
    fireEvent.change(date, { target: { value: '2026-10-01' } });
    expect(dateUpdate).toHaveBeenCalledWith('2026-10-01');
  });

  it('dispatches dismissal, activation, and semantic row activation once', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const onActivate = vi.fn();
    const onRowActivate = vi.fn();
    render(
      <>
        <Banner
          title="Payment failed"
          tone="critical"
          onDismiss={onDismiss}
          dismissLabel="Dismiss payment warning"
        />
        <Button onActivate={onActivate}>Save changes</Button>
        <Table
          caption="Subscriptions"
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'status', label: 'Status' },
          ]}
          rows={[{ id: 'sub-1', name: 'Acme', status: 'Active' }]}
          selectable
          onRowActivate={onRowActivate}
        />
      </>
    );

    await user.click(screen.getByRole('button', { name: 'Dismiss payment warning' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    const rowAction = screen.getByRole('button', { name: 'Acme' });
    rowAction.focus();
    await user.keyboard('{Enter}');

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onRowActivate).toHaveBeenCalledTimes(1);
    expect(onRowActivate.mock.calls[0]?.[0]).toBe('sub-1');
  });
});
