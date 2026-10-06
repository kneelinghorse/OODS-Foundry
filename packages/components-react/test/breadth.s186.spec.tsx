/* @vitest-environment jsdom */

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AddressCollectionPanel, AddressSummaryBadge, AddressValidationTimeline, AuditEvent, ClassificationPanel, FilterPanel,
  MembershipAuditTimeline, MembershipPanel, MessageEventTimeline, MessageStatusBadge, PreferencePanel, PreferenceSummaryBadge,
  PreferenceTimeline, PriceSummary, RoleBadgeList, TagManager, TagPills,
  AddressEditor, PreferenceEditor, RoleAssignmentForm, StatusSelector, TagInput, TemplatePicker,
} from '../src/index.js';

afterEach(cleanup);

// Every expectation here mirrors the HTML renderer (renderPanelSection,
// renderFilterPanel, renderSummarySection): same aliases, same precedence,
// same fallbacks, same unwired controls.
describe('Sprint 186 React wave-2 components', () => {
  it('ClassificationPanel defaults its heading and keeps the content area empty without summary or children', () => {
    const { container } = render(<ClassificationPanel />);
    const panel = container.querySelector('[data-oods-component="ClassificationPanel"]')!;
    expect(panel.tagName).toBe('SECTION');
    expect(panel.getAttribute('data-panel-type')).toBe('classification');
    expect(screen.getByRole('heading', { level: 2, name: 'Classification' })).toBeTruthy();
    expect(panel.querySelector('[data-panel-subtitle]')).toBeNull();
    expect(panel.querySelector('[data-panel-content]')?.childNodes).toHaveLength(0);
  });

  it.each([
    [{ name: 'By name' }, 'By name'],
    [{ heading: 'By heading', name: 'By name' }, 'By heading'],
    [{ label: 'By label', heading: 'By heading' }, 'By label'],
    [{ title: 'By title', label: 'By label' }, 'By title'],
    [{ title: ' ', label: 'Blank title falls through' }, 'Blank title falls through'],
  ] as const)('ClassificationPanel resolves the heading from %o in title/label/heading/name order', (props, expected) => {
    const { container } = render(<ClassificationPanel {...props} />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(expected);
    for (const attribute of ['title', 'label', 'heading', 'name']) {
      expect(container.querySelector('section')?.hasAttribute(attribute)).toBe(false);
    }
  });

  it('ClassificationPanel resolves subtitle and summary aliases in renderer order and lets children replace the summary', () => {
    const { container, rerender } = render(<ClassificationPanel metadata="Meta" emptyMessage="Empty" />);
    expect(container.querySelector('[data-panel-subtitle]')?.textContent).toBe('Meta');
    expect(container.querySelector('[data-panel-content] > [data-panel-summary]')?.textContent).toBe('Empty');
    rerender(<ClassificationPanel description="Description" metadata="Meta" body="Body" emptyMessage="Empty" />);
    expect(container.querySelector('[data-panel-subtitle]')?.textContent).toBe('Description');
    expect(container.querySelector('[data-panel-summary]')?.textContent).toBe('Body');
    rerender(<ClassificationPanel subtitle="Subtitle" description="Description" summary="Summary" text="Text" body="Body" />);
    expect(container.querySelector('[data-panel-subtitle]')?.textContent).toBe('Subtitle');
    expect(container.querySelector('[data-panel-summary]')?.textContent).toBe('Summary');
    rerender(<ClassificationPanel summary="Summary"><ul><li>Electronics</li></ul></ClassificationPanel>);
    expect(container.querySelector('[data-panel-summary]')).toBeNull();
    expect(container.querySelector('[data-panel-content] > ul > li')?.textContent).toBe('Electronics');
    rerender(<ClassificationPanel summary="Summary">Bound text</ClassificationPanel>);
    expect(container.querySelector('[data-panel-content]')?.textContent).toBe('Bound text');
  });

  it('FilterPanel renders an empty immediate region by default and passes native attributes through', () => {
    const { container } = render(<FilterPanel id="filters" className="consumer" />);
    const region = screen.getByRole('region', { name: 'Filters' });
    expect(region.tagName).toBe('ASIDE');
    expect(region.id).toBe('filters');
    expect(region.classList.contains('consumer')).toBe(true);
    expect(region.getAttribute('data-behavioral')).toBe('filter');
    expect(region.getAttribute('data-filter-mode')).toBe('immediate');
    expect(container.querySelector('fieldset, button, [data-active-filters]')).toBeNull();
  });

  it('FilterPanel labels descriptors by label, then field, then Filter, and skips non-record descriptors', () => {
    const { container, rerender } = render(
      <FilterPanel filters={[{ field: 'status', label: 'Status' }, { field: 'release_channel' }, {}, 'bogus' as never, null as never]} />
    );
    expect([...container.querySelectorAll('legend')].map(legend => legend.textContent)).toEqual(['Status', 'release_channel', 'Filter']);
    expect(container.querySelectorAll('fieldset[data-collapsible="true"]')).toHaveLength(3);
    rerender(<FilterPanel filters={[{ field: 'status' }]} collapsible={false} />);
    expect(container.querySelector('fieldset')?.hasAttribute('data-collapsible')).toBe(false);
  });

  it('FilterPanel announces the active count politely, adds Apply only in batch mode, and keeps both controls unwired', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { container, rerender } = render(
      <FilterPanel activeFilters={[{ field: 'status', operator: 'eq', value: 'active' }, { field: 'sku', operator: 'in', value: [] }]} onClick={onClick} />
    );
    const live = container.querySelector('[data-active-filters]')!;
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.querySelector('[data-filter-count]')?.textContent).toBe('2 active');
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
    const clear = screen.getByRole('button', { name: 'Clear all' });
    expect(clear.getAttribute('type')).toBe('button');
    await user.click(clear);
    expect(onClick).toHaveBeenCalledTimes(1); // bubbles to the consumer's own handler; the panel itself owns no behaviour
    rerender(<FilterPanel mode="batch" />);
    expect(container.querySelector('[data-active-filters]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Apply' }).getAttribute('data-filter-apply')).toBe('true');
    rerender(<FilterPanel mode="" />);
    expect(container.querySelector('[data-oods-component="FilterPanel"]')?.getAttribute('data-filter-mode')).toBe('immediate');
    rerender(<FilterPanel mode="batch" filters={[{ field: 'status' }]}><p>Authored filters</p></FilterPanel>);
    expect(container.querySelector('fieldset, button')).toBeNull();
    expect(container.querySelector('aside > p')?.textContent).toBe('Authored filters');
  });

  it('PriceSummary defaults its heading and renders an empty definition list when nothing resolves', () => {
    const { container } = render(<PriceSummary />);
    const summary = container.querySelector('[data-oods-component="PriceSummary"]')!;
    expect(summary.tagName).toBe('SECTION');
    expect(summary.getAttribute('data-summary-type')).toBe('price');
    expect(screen.getByRole('heading', { level: 2, name: 'Price Summary' }).getAttribute('data-summary-title')).toBe('true');
    expect(summary.querySelector('dl')?.childNodes).toHaveLength(0);
    expect(summary.querySelector('[data-summary-fallback]')).toBeNull();
  });

  it('PriceSummary reads each term from its aliases in renderer order and formats stored minor units, including zero, as currency', () => {
    const { container, rerender } = render(
      <PriceSummary unitAmountCents={0} currencyCode="eur" pricingModel="tiered" billingInterval="year" />
    );
    const items = () => [...container.querySelectorAll('[data-summary-item]')]
      .map(item => [item.querySelector('dt')?.textContent, item.querySelector('dd')?.textContent]);
    expect(items()).toEqual([['Amount', '€0.00'], ['Currency', 'eur'], ['Model', 'Tiered'], ['Interval', 'Year']]);
    rerender(<PriceSummary amountCents={2500} unitAmountCents={0} currency="" currencyCode="usd" model="recurring" pricingModel="tiered" interval="month" billingInterval="year" />);
    expect(items()).toEqual([['Amount', '$25.00'], ['Currency', 'usd'], ['Model', 'Recurring'], ['Interval', 'Month']]);
    rerender(<PriceSummary amount="29.00" amountCents={2500} />);
    expect(items()).toEqual([['Amount', '$0.29']]);
    rerender(<PriceSummary label="Plan pricing" heading="Ignored" text="No price recorded" />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Plan pricing');
    expect(container.querySelector('dl')).toBeNull();
    expect(container.querySelector('p[data-summary-fallback]')?.textContent).toBe('No price recorded');
    rerender(<PriceSummary amount={1} summary="Unused fallback"><dl><div data-summary-item="true"><dt>Authored</dt><dd>Value</dd></div></dl></PriceSummary>);
    expect(items()).toEqual([['Authored', 'Value']]);
    expect(container.querySelector('[data-summary-fallback]')).toBeNull();
  });

  it.each([
    ['AddressCollectionPanel', AddressCollectionPanel, 'address', 'Addresses'],
    ['MembershipPanel', MembershipPanel, 'membership', 'Membership'],
    ['PreferencePanel', PreferencePanel, 'preference', 'Preferences'],
  ] as const)('%s mirrors renderPanelSection with its own marker, panel type and default title', (name, Panel, panelType, defaultTitle) => {
    const { container, rerender } = render(<Panel id="panel" />);
    const panel = container.querySelector(`[data-oods-component="${name}"]`)!;
    expect(panel.tagName).toBe('SECTION');
    expect(panel.id).toBe('panel');
    expect(panel.getAttribute('data-panel-type')).toBe(panelType);
    expect(screen.getByRole('heading', { level: 2, name: defaultTitle })).toBeTruthy();
    expect(panel.querySelector('[data-panel-content]')?.childNodes).toHaveLength(0);
    rerender(<Panel name="By name" metadata="Meta" emptyMessage="Empty" />);
    expect(screen.getByRole('heading', { level: 2, name: 'By name' })).toBeTruthy();
    expect(container.querySelector('[data-panel-subtitle]')?.textContent).toBe('Meta');
    expect(container.querySelector('[data-panel-summary]')?.textContent).toBe('Empty');
    rerender(<Panel title="Title" summary="Summary"><p>Authored</p></Panel>);
    expect(container.querySelector('[data-panel-summary]')).toBeNull();
    expect(container.querySelector('[data-panel-content] > p')?.textContent).toBe('Authored');
    for (const attribute of ['name', 'title', 'metadata', 'summary']) expect(panel.hasAttribute(attribute)).toBe(false);
  });

  it('TagManager mirrors renderTagManager: aliases, tag normalization, the labelled add input, and an unwired submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { container, rerender } = render(<TagManager id="tags" onSubmit={onSubmit} />);
    const form = container.querySelector<HTMLFormElement>('[data-oods-component="TagManager"]')!;
    expect(form.tagName).toBe('FORM');
    expect(form.id).toBe('tags');
    expect(form.getAttribute('data-form-type')).toBe('tag-manager');
    expect(screen.getByRole('heading', { level: 2, name: 'Tag Manager' })).toBeTruthy();
    expect(form.querySelector('[data-form-subtitle]')).toBeNull();
    expect(form.querySelectorAll('[data-tag-list] > [data-tag-item]')).toHaveLength(0);
    const input = screen.getByRole('textbox', { name: 'Add Tag' }) as HTMLInputElement;
    expect(input.name).toBe('newTag');
    await user.type(input, 'gamma{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].defaultPrevented).toBe(true);
    expect(input.value).toBe('gamma');
    rerender(<TagManager heading="By heading" hint="Hint" tags={['alpha', { label: 'beta' }, { name: 'gamma' }, { role: 'delta' }, { value: 'epsilon' }, { id: 'zeta' }, 7, true, null, undefined, { other: 'ignored' }, '']} />);
    expect(screen.getByRole('heading', { level: 2, name: 'By heading' })).toBeTruthy();
    expect(container.querySelector('[data-form-subtitle]')?.textContent).toBe('Hint');
    expect([...container.querySelectorAll('[data-tag-item]')].map(item => item.textContent))
      .toEqual(['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', '7', 'true']);
    rerender(<TagManager label="By label" description="Description" hint="Hint" value={['from value']} />);
    expect(screen.getByRole('heading', { level: 2, name: 'By label' })).toBeTruthy();
    expect(container.querySelector('[data-form-subtitle]')?.textContent).toBe('Description');
    expect([...container.querySelectorAll('[data-tag-item]')].map(item => item.textContent)).toEqual(['from value']);
    rerender(<TagManager tags={['alpha']}><ul><li>Authored tags</li></ul></TagManager>);
    expect(container.querySelector('[data-tag-list], input')).toBeNull();
    expect(container.querySelector('[data-form-content] > ul > li')?.textContent).toBe('Authored tags');
    for (const attribute of ['tags', 'label', 'heading', 'hint']) expect(form.hasAttribute(attribute)).toBe(false);
  });

  it('TagPills substitutes {{ tag_count }} with the total count, limits visible pills, and falls back to +hidden without a template', () => {
    const { container, rerender } = render(<TagPills tags={['alpha', 'beta', 'gamma', 'delta', 'epsilon']} maxVisible={3} overflowLabel="+{{ tag_count }}" />);
    const pills = () => [...container.querySelectorAll('[data-tag-pill]')].map(pill => pill.textContent);
    const overflow = () => container.querySelector('[data-tag-overflow]')?.textContent ?? null;
    expect(pills()).toEqual(['alpha', 'beta', 'gamma']);
    expect(overflow()).toBe('+5');
    expect(container.textContent).not.toContain('{{ tag_count }}');
    rerender(<TagPills tags={['alpha', 'beta', 'gamma']} maxVisible="2" />);
    expect(pills()).toEqual(['alpha', 'beta']);
    expect(overflow()).toBe('+1');
    rerender(<TagPills value={[{ label: 'from value' }, 7]} />);
    expect(pills()).toEqual(['from value', '7']);
    expect(overflow()).toBeNull();
    rerender(<TagPills tags={['alpha']} maxVisible={0} overflowLabel="{{ tag_count }} tags hidden" />);
    expect(pills()).toEqual([]);
    expect(overflow()).toBe('1 tags hidden');
    rerender(<TagPills tags={['alpha']}><em>Authored</em></TagPills>);
    expect(container.querySelector('[data-tag-pill]')).toBeNull();
    expect(container.querySelector('[data-oods-component="TagPills"] > em')?.textContent).toBe('Authored');
  });

  it('badge-family summaries resolve label and status aliases in renderer order over the Badge substrate', () => {
    const { container, rerender } = render(<AddressSummaryBadge role="billing" />);
    const badge = () => container.querySelector<HTMLElement>('[data-oods-component]')!;
    expect(badge().getAttribute('data-oods-component')).toBe('AddressSummaryBadge');
    expect(badge().classList.contains('oods-badge')).toBe(true);
    expect(badge().querySelector('[data-oods-badge-label]')?.textContent).toBe('billing');
    expect(badge().getAttribute('data-badge-status')).toBe('billing');
    expect(badge().getAttribute('data-badge-variant')).toBe('address');
    expect(badge().hasAttribute('role')).toBe(false);
    rerender(<AddressSummaryBadge text="Text alias" state="verified" role="billing" variant="compact" id="address" />);
    expect(badge().querySelector('[data-oods-badge-label]')?.textContent).toBe('Text alias');
    expect(badge().getAttribute('data-badge-status')).toBe('verified');
    expect(badge().getAttribute('data-badge-variant')).toBe('compact');
    expect(badge().id).toBe('address');
    rerender(<MessageStatusBadge />);
    expect(badge().querySelector('[data-oods-badge-label]')?.textContent).toBe('Message');
    expect(badge().hasAttribute('data-badge-status')).toBe(false);
    expect(badge().getAttribute('data-badge-variant')).toBe('message');
    rerender(<MessageStatusBadge value="queued" delivery="sent" />);
    expect(badge().querySelector('[data-oods-badge-label]')?.textContent).toBe('sent');
    expect(badge().getAttribute('data-badge-status')).toBe('sent');
    rerender(<PreferenceSummaryBadge version="v2" tone="warning" emphasis="solid" />);
    expect(badge().querySelector('[data-oods-badge-label]')?.textContent).toBe('Preferences');
    expect(badge().getAttribute('data-badge-status')).toBe('v2');
    expect(badge().getAttribute('data-tone')).toBe('warning');
    expect(badge().getAttribute('data-emphasis')).toBe('solid');
    rerender(<PreferenceSummaryBadge namespace="alerts"><strong>Authored</strong></PreferenceSummaryBadge>);
    expect(badge().querySelector('[data-oods-badge-label]')).toBeNull();
    expect(badge().querySelector('strong')?.textContent).toBe('Authored');
    rerender(<RoleBadgeList />);
    expect(badge().textContent).toBe('Roles');
    expect(badge().getAttribute('data-badge-variant')).toBe('roles');
    rerender(<RoleBadgeList badges={[{ name: 'owner' }, { role: 'admin' }]} tone="accent" label="Unused" />);
    expect([...badge().querySelectorAll('[data-role-badge]')].map(item => item.textContent)).toEqual(['owner', 'admin']);
    expect(badge().getAttribute('data-badge-variant')).toBe('accent');
    rerender(<RoleBadgeList roles={[]} text="No roles yet" />);
    expect(badge().textContent).toBe('No roles yet');
  });

  it('timeline-family logs mirror renderTimelineContainer: title aliases, first-array event keys, item aliases, empty state and authored children', () => {
    const { container, rerender } = render(<MessageEventTimeline id="log" messages={[{ title: 'Welcome email', at: '2026-09-01T09:00:00Z' }]} statuses={[{ status: 'delivered' }]} />);
    const log = () => container.querySelector<HTMLElement>('[data-oods-component]')!;
    const labels = () => [...log().querySelectorAll('[data-timeline-label]')].map(item => item.textContent);
    expect(log().getAttribute('data-oods-component')).toBe('MessageEventTimeline');
    expect(log().getAttribute('role')).toBe('log');
    expect(log().id).toBe('log');
    expect(log().getAttribute('data-timeline-type')).toBe('message');
    expect(screen.getByRole('heading', { level: 2, name: 'Message Timeline' })).toBeTruthy();
    // messages precede statuses in the renderer's event keys, so statuses are ignored here.
    expect(labels()).toEqual(['Welcome email']);
    expect(log().querySelector('time[data-timeline-time]')?.getAttribute('datetime')).toBe('2026-09-01T09:00:00Z');
    rerender(<MessageEventTimeline name="By name" heading="By heading" statuses={[{ state: 'queued', updatedAt: '2026-09-01T10:00:00Z', from: 'a', to: 'b' }, 7, null, 'plain']} />);
    expect(screen.getByRole('heading', { level: 2, name: 'By heading' })).toBeTruthy();
    expect(labels()).toEqual(['queued', '7', 'plain']);
    expect(log().querySelector('[data-timeline-detail]')?.textContent).toBe('a');
    rerender(<AddressValidationTimeline validations={[]} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Address Validation Timeline' })).toBeTruthy();
    expect(container.querySelector('[data-timeline-empty]')?.textContent).toBe('No events');
    expect(container.querySelectorAll('[data-timeline-events] > li')).toHaveLength(1);
    rerender(<PreferenceTimeline title="Authored" changes={[{ event: 'x' }]}><li>Authored event</li></PreferenceTimeline>);
    expect(container.querySelector('[data-timeline-label]')).toBeNull();
    expect(container.querySelector('[data-timeline-events] > li')?.textContent).toBe('Authored event');
    rerender(<MembershipAuditTimeline history={[{ name: 'Joined workspace', createdAt: '2026-08-01T00:00:00Z', reason: 'Invited' }]} />);
    expect(container.querySelector('[data-oods-component="MembershipAuditTimeline"]')?.getAttribute('data-timeline-type')).toBe('membership');
    expect(labels()).toEqual(['Joined workspace']);
    expect(container.querySelector('[data-timeline-detail]')?.textContent).toBe('Invited');
  });

  it('AuditEvent mirrors renderEventArticle alias orders, with a lone reason as both label and detail', () => {
    const { container, rerender } = render(<AuditEvent />);
    const article = () => container.querySelector<HTMLElement>('[data-oods-component="AuditEvent"]')!;
    expect(article().tagName).toBe('ARTICLE');
    expect(article().getAttribute('data-event-type')).toBe('audit');
    expect(article().querySelector('[data-event-label]')?.textContent).toBe('Audit Event');
    expect(article().querySelector('time, [data-event-detail]')).toBeNull();
    rerender(<AuditEvent reason="Rotated keys" />);
    expect(article().querySelector('[data-event-label]')?.textContent).toBe('Rotated keys');
    expect(article().querySelector('[data-event-detail]')?.textContent).toBe('Rotated keys');
    rerender(<AuditEvent status="active" state="ignored" reason="Why" text="ignored" createdAt="2026-01-01T00:00:00Z" updatedAt="ignored" code="E1" message="Msg" />);
    expect(article().querySelector('[data-event-label]')?.textContent).toBe('active');
    expect(article().querySelector('time[data-event-time]')?.getAttribute('datetime')).toBe('2026-01-01T00:00:00Z');
    expect(article().querySelector('[data-event-detail]')?.textContent).toBe('Why');
    rerender(<AuditEvent id="event" event="user.updated"><p>Authored body</p></AuditEvent>);
    expect(article().id).toBe('event');
    expect(article().querySelector('[data-event-label]')).toBeNull();
    expect(article().querySelector('p')?.textContent).toBe('Authored body');
  });

  it('forwards refs and native attributes on all three roots', () => {
    const panel = React.createRef<HTMLElement>();
    const filters = React.createRef<HTMLElement>();
    const summary = React.createRef<HTMLElement>();
    render(<>
      <ClassificationPanel ref={panel} id="panel" aria-describedby="panel-help" />
      <FilterPanel ref={filters} id="filters" />
      <PriceSummary ref={summary} id="summary" lang="en" />
    </>);
    expect(panel.current?.id).toBe('panel');
    expect(panel.current?.getAttribute('aria-describedby')).toBe('panel-help');
    expect(filters.current?.id).toBe('filters');
    expect(summary.current?.getAttribute('lang')).toBe('en');
  });

  // m05: the form family mirrors renderFormContainer and its control renderers.
  it('StatusSelector defaults its label and options, honours status when uncontrolled, and stays controlled by value', () => {
    const { container, rerender } = render(<StatusSelector status="inactive" />);
    const select = screen.getByLabelText('Status') as HTMLSelectElement;
    expect(container.querySelector('[data-oods-component="StatusSelector"]')?.getAttribute('data-summary-type')).toBe('status-selector');
    expect([...select.options].map(option => option.value)).toEqual(['draft', 'active', 'inactive']);
    expect(select.value).toBe('inactive');
    const onChange = vi.fn();
    const onValueChange = vi.fn();
    rerender(<StatusSelector title="Lifecycle" options={[{ id: 'a', label: 'Alpha' }, 'beta', null]} value="beta" onChange={onChange} onValueChange={onValueChange} />);
    const controlled = screen.getByLabelText('Lifecycle') as HTMLSelectElement;
    // s221-m01: a scalar option's label is readable (s215-m01 #2388, 25d727945); the authored 'Alpha' still wins.
    expect([...controlled.options].map(option => [option.value, option.textContent])).toEqual([['a', 'Alpha'], ['beta', 'Beta']]);
    expect(controlled.value).toBe('beta');
    fireEvent.change(controlled, { target: { value: 'a' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('a');
    expect(controlled.value).toBe('beta');
    rerender(<StatusSelector options={[]} value=""><em>Authored</em></StatusSelector>);
    expect(container.querySelector('select')).toBeNull();
    expect(container.textContent).toBe('Authored');
  });

  it('TagInput resolves its legend from title/label/heading/name, lists normalized tags, and forwards typed text', () => {
    const onChange = vi.fn();
    const onValueChange = vi.fn();
    const { container, rerender } = render(<TagInput name="By name" hint="Hint" onChange={onChange} onValueChange={onValueChange} />);
    const fieldset = container.querySelector('fieldset[data-oods-component="TagInput"]')!;
    expect(fieldset.querySelector('legend')?.textContent).toBe('By name');
    expect(fieldset.querySelector('[data-form-subtitle]')?.textContent).toBe('Hint');
    expect(fieldset.querySelector('[data-tag-list]')).toBeNull();
    const input = screen.getByLabelText('Tag') as HTMLInputElement;
    expect(input.value).toBe('');
    fireEvent.change(input, { target: { value: 'x' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('x');
    rerender(<TagInput heading="By heading" name="By name" tags={[{ label: 'Alpha' }, { name: 'Beta' }, { id: 'id-only' }, 'gamma', 4]} />);
    expect(fieldset.querySelector('legend')?.textContent).toBe('By heading');
    expect([...fieldset.querySelectorAll('[data-tag-item]')].map(item => item.textContent)).toEqual(['Alpha', 'Beta', 'id-only', 'gamma', '4']);
    rerender(<TagInput />);
    expect(fieldset.querySelector('legend')?.textContent).toBe('Tag Input');
  });

  it('AddressEditor resolves street/region/postal aliases in renderer order and emits the whole record from any input', () => {
    const onChange = vi.fn();
    render(<AddressEditor line1="L1" state="CA" zip="90210" onChange={onChange} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Address Editor' })).toBeTruthy();
    expect((screen.getByLabelText('Street') as HTMLInputElement).value).toBe('L1');
    expect((screen.getByLabelText('Region') as HTMLInputElement).value).toBe('CA');
    expect((screen.getByLabelText('Postal Code') as HTMLInputElement).value).toBe('90210');
    fireEvent.change(screen.getByLabelText('Street'), { target: { value: 'New' } });
    expect(onChange).toHaveBeenCalledWith({ street: 'New', city: '', region: 'CA', postalCode: '90210' });
  });

  it('PreferenceEditor, RoleAssignmentForm and TemplatePicker default their titles and options and let children replace the body', () => {
    const { container, rerender } = render(<PreferenceEditor />);
    expect(screen.getByRole('heading', { level: 2, name: 'Preference Editor' })).toBeTruthy();
    expect([...(screen.getByLabelText('Namespace') as HTMLSelectElement).options].map(option => option.value)).toEqual(['default']);
    expect((screen.getByLabelText('Preference Document') as HTMLTextAreaElement).value).toBe('');
    rerender(<PreferenceEditor json='{"a":1}' namespaces={['x']} />);
    expect((screen.getByLabelText('Preference Document') as HTMLTextAreaElement).value).toBe('{"a":1}');
    rerender(<RoleAssignmentForm />);
    expect(screen.getByRole('heading', { level: 2, name: 'Role Assignment' })).toBeTruthy();
    expect([...(screen.getByLabelText('Role') as HTMLSelectElement).options].map(option => option.textContent)).toEqual(['Select...']);
    rerender(<RoleAssignmentForm roles={['admin']} availableRoles={['viewer']} defaultRoleId="admin" member="m@example.test" />);
    const role = screen.getByLabelText('Role') as HTMLSelectElement;
    expect([...role.options].map(option => option.value)).toEqual(['admin']);
    expect(role.value).toBe('admin');
    expect((screen.getByLabelText('Assignee') as HTMLInputElement).value).toBe('m@example.test');
    rerender(<TemplatePicker />);
    expect(container.querySelector('legend')?.textContent).toBe('Template Picker');
    expect([...(screen.getByLabelText('Template') as HTMLSelectElement).options].map(option => option.textContent)).toEqual(['Select...']);
    expect([...(screen.getByLabelText('Channel') as HTMLSelectElement).options].map(option => option.value)).toEqual(['email', 'sms', 'in_app']);
    rerender(<TemplatePicker options={['a']} value="a"><p>Authored</p></TemplatePicker>);
    expect(container.querySelector('select')).toBeNull();
    expect(container.querySelector('[data-form-content]')?.textContent).toBe('Authored');
  });
});
