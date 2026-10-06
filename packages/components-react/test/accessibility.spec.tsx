/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { NUCLEUS_COMPONENT_IDS, sharedScenarios } from '@oods/component-contracts';

import { renderSharedScenario } from './scenario-fixtures.js';

import {
  Badge,
  Banner,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Grid,
  Input,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
} from '../src/index.js';

afterEach(cleanup);

describe('@oods/components-react accessibility', () => {
  const axeScenarios = sharedScenarios;
  it('runs every governed root through the axe loop exactly once', () => {
    expect(axeScenarios.map(scenario => scenario.oodsComponentId)).toEqual(NUCLEUS_COMPONENT_IDS);
    expect(axeScenarios).toHaveLength(NUCLEUS_COMPONENT_IDS.length);
  });
  for (const scenario of axeScenarios) {
    it(`passes axe for the ${scenario.oodsComponentId} shared scenario with visible text semantics`, async () => {
      const { container } = render(<main>{renderSharedScenario(scenario)}</main>);
      // JSDOM does not compute token contrast; browser theme evidence checks
      // contrast separately while these scenarios verify semantic accessibility.
      const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
      expect(result.violations).toEqual([]);
      expect(container.textContent?.trim().length).toBeGreaterThan(0);
    });
  }

  it('B-06 preserves React field label and error associations', () => {
    render(
      <Input
        id="email"
        label="Email"
        value="invalid"
        onChange={() => undefined}
        help="Use a work address"
        validation={{ state: 'error', message: 'Enter a valid email' }}
        required
      />
    );

    const input = document.getElementById('email');
    const label = document.querySelector<HTMLLabelElement>('label[for="email"]');
    expect(label?.textContent).toContain('Email');
    expect(label?.control).toBe(input);
    expect(input).not.toBeNull();
    if (!input) throw new Error('email input did not mount');
    expect(input.tagName).toBe('INPUT');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const descriptionIds = input.getAttribute('aria-describedby')?.split(' ') ?? [];
    expect(descriptionIds).toEqual(['email-description', 'email-validation']);
    expect(descriptionIds.map(id => document.getElementById(id)?.textContent)).toEqual([
      'Use a work address',
      'Enter a valid email',
    ]);
  });

  it('associates labels and descriptions for every native field family', () => {
    render(
      <Stack>
        <Checkbox id="terms" label="Accept terms" help="Required to continue" required />
        <DatePicker id="renewal" label="Renewal date" help="Use an ISO date" />
        <Select
          id="plan"
          label="Plan"
          help="Choose a billing plan"
          options={[{ value: 'pro', label: 'Pro' }]}
        />
        <Textarea id="notes" label="Notes" help="Visible to account managers" />
      </Stack>
    );
    for (const [labelText, id] of [
      ['Accept terms', 'terms'],
      ['Renewal date', 'renewal'],
      ['Plan', 'plan'],
      ['Notes', 'notes'],
    ]) {
      const control = document.getElementById(id);
      const label = document.querySelector<HTMLLabelElement>(`label[for="${id}"]`);
      expect(label?.textContent).toContain(labelText);
      expect(label?.control).toBe(control);
      expect(control).not.toBeNull();
      if (!control) throw new Error(`${id} control did not mount`);
      expect(control.id).toBe(id);
      expect(control.getAttribute('aria-describedby')).toBe(`${id}-description`);
    }
    expect((document.getElementById('terms') as HTMLInputElement).required).toBe(true);
  });

  it('uses native action, announcement, table, and tab semantics', () => {
    render(
      <Stack>
        <Badge status="active" domain="subscription" />
        <Banner tone="critical" title="Payment failed" detail="Update the card" />
        <Button>Save</Button>
        <Card as="section" aria-label="Account summary">Summary</Card>
        <Table
          caption="Subscriptions"
          columns={[{ key: 'name', label: 'Name' }, { key: 'status', label: 'Status' }]}
          rows={[{ id: 'sub-1', name: 'Acme', status: 'Active' }]}
        />
        <Tabs
          ariaLabel="Account sections"
          items={[
            { id: 'overview', label: 'Overview', panel: 'Summary' },
            { id: 'billing', label: 'Billing', panel: 'Invoices' },
          ]}
        />
      </Stack>
    );

    const alert = screen.getByRole('alert');
    expect(alert.getAttribute('aria-live')).toBe('assertive');
    const bannerTitle = alert.querySelector('.oods-banner__title');
    expect(bannerTitle?.tagName).toBe('STRONG');
    expect(bannerTitle?.textContent).toBe('Payment failed');
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.getAttribute('type')).toBe('button');
    expect(button.style.getPropertyValue('--cmp-button-background')).toBe(
      'var(--sys-surface-interactive-primary-default)'
    );
    expect(button.style.getPropertyValue('--cmp-button-text')).toBe(
      'var(--sys-text-on-interactive)'
    );
    expect(button.style.getPropertyValue('--cmp-button-background-disabled')).toBe(
      'var(--sys-surface-disabled)'
    );
    expect(button.style.getPropertyValue('--cmp-button-text-disabled')).toBe(
      'var(--sys-text-disabled)'
    );
    expect(screen.getByRole('table', { name: 'Subscriptions' })).toBeTruthy();
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
    expect(screen.getByRole('tablist', { name: 'Account sections' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected')).toBe('true');
  });

  it('passes automated axe for a mounted nucleus showcase', async () => {
    const { container } = render(
      <main>
        <Grid minColumnWidth="14rem">
          <Card><Text as="strong">Account owner</Text></Card>
          <Card elevated><Badge tone="warning" content="Past due" /></Card>
        </Grid>
        <Banner title="Notice" detail="Review your account" tone="info" />
        <Button disabled>Disabled action</Button>
        <Input id="axe-email" label="Email" help="Work address" />
        <Checkbox id="axe-check" label="Product updates" />
        <DatePicker id="axe-date" label="Renewal date" />
        <Select id="axe-select" label="Plan" options={[{ value: 'basic', label: 'Basic' }]} />
        <Textarea id="axe-notes" label="Notes" />
        <Table
          caption="Axe table"
          columns={[{ key: 'name', label: 'Name' }]}
          rows={[{ id: 'row-1', name: 'Acme' }]}
        />
        <Tabs
          ariaLabel="Axe tabs"
          items={[
            { id: 'one', label: 'One', panel: 'First panel' },
            { id: 'two', label: 'Two', panel: 'Second panel' },
          ]}
        />
      </main>
    );
    const result = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(result.violations).toEqual([]);
  });
});
