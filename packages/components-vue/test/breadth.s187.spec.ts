/* @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { mount, enableAutoUnmount } from '@vue/test-utils';
import { type Component } from 'vue';
import * as Components from '../src/index.js';
enableAutoUnmount(afterEach);
const mountFamily = (name: keyof typeof Components, props: Record<string, unknown> = {}, children?: string) => {
  const view = mount(Components[name] as Component, { props, ...(children === undefined ? {} : { slots: { default: children } }) });
  return view.element as HTMLElement;
};

describe('Sprint 187 naming and classification semantics', () => {
  it.each(['LabelCell', 'InlineLabel'] as const)('%s preserves alias precedence, truncation edge cases and authored override', (name) => {
    const primary = (element: HTMLElement) => element.querySelector('[data-oods-label-cell-primary]')?.textContent ?? element.textContent;
    expect(primary(mountFamily(name, { value: 'Value' }))).toBe('Value');
    expect(primary(mountFamily(name, { label: ' ', text: 'Text', value: 'Value' }))).toBe('Text');
    expect(primary(mountFamily(name, { label: 'Primary', text: 'Text', maxLength: '4' }))).toBe('Pri...');
    for (const maxLength of [0, -1, 'bad', 100]) expect(primary(mountFamily(name, { label: 'Primary', maxLength }))).toBe('Primary');
    expect(primary(mountFamily(name, { label: 'Primary', maxLength: 1 }))).toBe('...');
    expect(mountFamily(name, { label: 'Primary', description: 'Hidden', maxLength: 1 }, 'Authored content').textContent).toBe('Authored content');
  });
  it('LabelCell keeps supporting aliases and defaults truncation to forty characters', () => {
    const root = mountFamily('LabelCell', { label: 'a'.repeat(50), supporting: 'Supporting', sublabel: 'Sublabel', subtitle: 'Subtitle', description: 'Description', truncate: true });
    expect(root.querySelector('[data-oods-label-cell-primary]')?.textContent).toBe('a'.repeat(39) + '...');
    expect(root.querySelector('[data-oods-label-cell-description]')?.textContent).toBe('Description');
    expect(mountFamily('LabelCell', {}).querySelector('[data-oods-label-cell-description]')).toBeNull();
  });
  it('FormLabelGroup preserves native association and hint precedence around children', () => {
    const root = mountFamily('FormLabelGroup', { htmlFor: 'primary', for: 'secondary', inputId: 'fallback', title: 'Title', text: 'Text', label: 'Label', description: 'Description', hint: 'Hint', placeholder: 'Placeholder' }, 'Child');
    expect(root.tagName).toBe('LABEL');
    expect(root.getAttribute('for')).toBe('primary');
    expect(root.textContent).toBe('LabelChildPlaceholder');
    expect(mountFamily('FormLabelGroup', { inputId: 'fallback' }).getAttribute('for')).toBe('fallback');
    expect(mountFamily('FormLabelGroup').textContent).toBe('Label');
  });
  it('ClassificationBadge exposes classification status and honors authored labels', () => {
    const root = mountFamily('ClassificationBadge', { category: 'Category', value: 'Value', state: 'State', mode: 'Mode' });
    expect(root.textContent).toBe('Category');
    expect(root.getAttribute('data-badge-status')).toBe('State');
    expect(root.getAttribute('data-badge-variant')).toBe('classification');
    expect(mountFamily('ClassificationBadge', { label: 'Label', text: 'Text' }, 'Authored').textContent).toBe('Authored');
  });
  it('ClassificationEditor follows native React selection when the mode is absent', () => {
    expect(mountFamily('ClassificationEditor').querySelector('select')?.value).toBe('strict');
    expect(mountFamily('ClassificationEditor', { modes: ['hybrid', 'tag'] }).querySelector('select')?.value).toBe('hybrid');
  });
  it('ClassificationEditor labels native editable controls but prevents unwired submission', () => {
    const root = mountFamily('ClassificationEditor', { name: 'Heading', hint: 'Hint', primaryCategory: 'Category', tags: ['a'], modes: [{ value: 'strict', label: 'Strict' }, { value: 'flexible', label: 'Flexible' }], classificationMode: 'flexible' });
    expect(root.querySelector('h2')?.textContent).toBe('Heading');
    expect(root.querySelector('[data-form-subtitle]')?.textContent).toBe('Hint');
    const category = root.querySelector<HTMLInputElement>('input[name="category"]')!;
    expect(category.value).toBe('Category');
    expect(category.closest('label')?.querySelector('span')?.textContent).toBe('Category');
    expect(root.querySelector<HTMLInputElement>('input[name="tags"]')?.value).toBe('["a"]');
    const select = root.querySelector<HTMLSelectElement>('select')!;
    expect(select.value).toBe('flexible');
    category.value = 'Changed locally';
    category.dispatchEvent(new Event('input', { bubbles: true }));
    select.value = 'strict';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(category.value).toBe('Changed locally');
    expect(select.value).toBe('strict');
    const event = new Event('submit', { bubbles: true, cancelable: true });
    root.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(root.querySelector('button')).toBeNull();
    const authored = mountFamily('ClassificationEditor', {}, 'Custom controls');
    expect(authored.querySelector('input')).toBeNull();
    expect(authored.querySelector('[data-form-content]')?.textContent).toBe('Custom controls');
  });
});

describe('Sprint 187 ownership and summary semantics', () => {
  const values = (root: HTMLElement) => [...root.querySelectorAll('dd')].map((node) => node.textContent);
  it('OwnerBadge preserves principal aliases, status metadata and authored precedence', () => {
    const root = mountFamily('OwnerBadge', { owner: 'user-7', ownerType: 'person', value: 'fallback', status: 'active', state: 'inactive' });
    expect(root.textContent).toBe('user-7');
    expect(root.getAttribute('data-badge-status')).toBe('active');
    expect(mountFamily('OwnerBadge', { ownerType: 'person' }).textContent).toBe('person');
    expect(mountFamily('OwnerBadge').textContent).toBe('Owner');
    expect(mountFamily('OwnerBadge', { label: 'Label', owner: 'user-7' }, 'Authored').textContent).toBe('Authored');
  });
  it('OwnershipSummary associates owner data with terms and consumes role as data, not ARIA', () => {
    const root = mountFamily('OwnershipSummary', { name: 'By name', owner_id: 'legacy-id', ownerId: 'current-id', owner_type: 'team', ownerType: 'person', ownershipRole: 'legacy-role', role: 'custodian' });
    expect(root.querySelector('h2')?.textContent).toBe('By name');
    // s221-m01 (ruling 12): an owner id with no resolved name reads 'Owner reference not resolved'; 'unavailable' is for no id
    // at all (formatReferenceLabel, s216-m01 65c1c6f84, kept by #2426; the OwnershipSummary contract says both).
    expect(values(root)).toEqual(['Owner reference not resolved', 'person', 'custodian']);
    expect(root.hasAttribute('role')).toBe(false);
    expect(values(mountFamily('OwnershipSummary', { owner_id: 'legacy', owner_type: 'team', ownershipRole: 'steward' }))).toEqual(['Owner reference not resolved', 'team', 'steward']);
    expect(mountFamily('OwnershipSummary', { text: 'Fallback', description: 'Ignored' }).querySelector('[data-summary-fallback]')?.textContent).toBe('Fallback');
    expect(mountFamily('OwnershipSummary').querySelector('dl')?.childNodes).toHaveLength(0);
    const authored = mountFamily('OwnershipSummary', { title: 'Owner', ownerId: 'Hidden' }, 'Authored');
    expect(authored.querySelector('h2')?.textContent).toBe('Owner');
    expect(authored.querySelector('dl')).toBeNull();
    expect(authored.textContent).toBe('OwnerAuthored');
  });
  it('OwnershipMeta keeps literal term separators and lets authored children replace its entire body', () => {
    const root = mountFamily('OwnershipMeta', { label: 'Principal', owner_type: 'team', ownershipRole: 'steward' });
    expect(root.querySelector('[data-meta-title]')?.textContent).toBe('Principal');
    expect([...root.querySelectorAll('[data-meta-item]')].map((node) => node.textContent)).toEqual(['Owner Type: team', 'Role: steward']);
    expect(root.hasAttribute('role')).toBe(false);
    expect(mountFamily('OwnershipMeta').textContent).toBe('Ownership');
    expect(mountFamily('OwnershipMeta', { title: 'Hidden', role: 'Hidden' }, 'Authored').textContent).toBe('Authored');
  });
  it('TagSummary preserves zero counts and scalar text, and shows the trait array using existing tag normalization', () => {
    expect(values(mountFamily('TagSummary', { tagCount: 0, count: 9, tags: 'alpha, beta' }))).toEqual(['0', 'alpha, beta']);
    expect(values(mountFamily('TagSummary', { count: '2', tags: ['alpha', { label: 'Beta', name: 'Ignored' }, { name: 'Gamma' }, null, 0] }))).toEqual(['2', 'alpha, Beta, Gamma, 0']);
    expect(values(mountFamily('TagSummary', { tagCount: 0, tags: [] }))).toEqual(['0']);
    expect(mountFamily('TagSummary', { tags: [], summary: 'No tags' }).querySelector('[data-summary-fallback]')?.textContent).toBe('No tags');
    const authored = mountFamily('TagSummary', { title: 'Tags', tags: ['Hidden'] }, 'Authored');
    expect(authored.textContent).toBe('TagsAuthored');
    expect(authored.querySelector('dl')).toBeNull();
  });
});

describe('Sprint 187 lifecycle and financial semantics', () => {
  const values = (root: HTMLElement) => [...root.querySelectorAll('dd')].map((node) => node.textContent);
  it.each([
    ['ArchivePill', 'isArchived', 'Archive', 'archive'],
    ['CancellationBadge', 'cancelAtPeriodEnd', 'Cancellation', 'cancellation'],
  ] as const)('%s keeps false/true, absent aliases and authored content distinct', (name, field, fallback, variant) => {
    for (const flag of [false, true]) {
      const root = mountFamily(name, { [field]: flag });
      // s220-m01 (#2461): the archive flag reads in words too; a card showed a bare "false".
      const label = name === 'CancellationBadge' ? flag ? 'Cancellation scheduled' : 'No cancellation scheduled' : flag ? 'Archived' : 'Not archived';
      expect(root.textContent).toBe(label);
      expect(root.getAttribute('data-badge-status')).toBe(String(flag));
      expect(root.getAttribute('data-badge-variant')).toBe(variant);
      expect(mountFamily(name, { value: flag }).textContent).toBe(label);
    }
    expect(mountFamily(name).textContent).toBe(fallback);
    expect(mountFamily(name).hasAttribute('data-badge-status')).toBe(false);
    expect(mountFamily(name, { status: 'active', [field]: false }).textContent).toBe('active');
    expect(mountFamily(name, { label: 'Scheduled', [field]: false }).textContent).toBe('Scheduled');
    expect(mountFamily(name, { label: 'Scheduled', [field]: false }, 'Authored').textContent).toBe('Authored');
  });
  it('CancellationBadge uses isCancelled as status only without inventing a label', () => {
    const root = mountFamily('CancellationBadge', { isCancelled: false });
    expect(root.textContent).toBe('Cancellation');
    expect(root.getAttribute('data-badge-status')).toBe('false');
  });
  it('ArchiveSummary preserves false ahead of aliases and keeps fallback and authored body semantics', () => {
    expect(values(mountFamily('ArchiveSummary', { isArchived: false, archived: true, status: 'active', archivedAt: '2026-09-05', reason: 'Primary', archiveReason: 'Alias' }))).toEqual(['No', 'Sep 5, 2026, 12:00 AM', 'Primary']);
    expect(values(mountFamily('ArchiveSummary', { archived: true, archiveReason: 'Alias' }))).toEqual(['Yes', 'Alias']);
    expect(values(mountFamily('ArchiveSummary'))).toEqual([]);
    expect(values(mountFamily('ArchiveSummary', { isArchived: false, archivedAt: null, reason: 'Retained' }))).toEqual(['No', 'Retained']);
    expect(mountFamily('ArchiveSummary', { summary: 'Fallback', text: 'Ignored' }).querySelector('[data-summary-fallback]')?.textContent).toBe('Fallback');
    const authored = mountFamily('ArchiveSummary', { title: 'Archived', isArchived: false }, 'Authored');
    expect(authored.textContent).toBe('ArchivedAuthored');
    expect(authored.querySelector('dl')).toBeNull();
  });
  it('PriceCardMeta retains model/interval precedence and literal inline labels', () => {
    const root = mountFamily('PriceCardMeta', { label: 'Billing', model: 'tiered', pricingModel: 'flat', interval: 'annual', billingInterval: 'monthly' });
    expect(root.querySelector('[data-meta-title]')?.textContent).toBe('Billing');
    // s220-m01: pricing codes read as PriceSummary reads them (formatPriceCode).
    expect([...root.querySelectorAll('[data-meta-item]')].map((node) => node.textContent)).toEqual(['Model: Tiered', 'Interval: Annual']);
    expect(mountFamily('PriceCardMeta').textContent).toBe('Price');
    expect(mountFamily('PriceCardMeta', { model: 'Hidden' }, 'Authored').textContent).toBe('Authored');
  });
  it('CancellationForm initializes and labels native controls, supports local input, and prevents unwired submission', () => {
    const root = mountFamily('CancellationForm', { heading: 'End subscription', hint: 'Only a request', reason: 'Primary', cancellationReason: 'Alias', reasonCode: 'b', allowedReasons: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }] });
    expect(root.querySelector('h2')?.textContent).toBe('End subscription');
    expect(root.querySelector('[data-form-subtitle]')?.textContent).toBe('Only a request');
    const select = root.querySelector<HTMLSelectElement>('select[name="reasonCode"]')!;
    const textarea = root.querySelector<HTMLTextAreaElement>('textarea[name="reason"]')!;
    expect(select.value).toBe('b');
    expect(textarea.value).toBe('Primary');
    expect(select.closest('label')?.querySelector('span')?.textContent).toBe('Reason Code');
    expect(textarea.closest('label')?.querySelector('span')?.textContent).toBe('Reason');
    textarea.value = 'Changed locally'; textarea.dispatchEvent(new Event('input', { bubbles: true }));
    select.value = 'a'; select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(textarea.value).toBe('Changed locally'); expect(select.value).toBe('a');
    const event = new Event('submit', { cancelable: true, bubbles: true }); root.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true); expect(root.querySelector('button')).toBeNull();
    const defaults = mountFamily('CancellationForm', { cancellationReason: 'Alias' });
    expect([...defaults.querySelectorAll('option')].map((node) => node.value)).toEqual(['no_longer_needed', 'budget', 'duplicate']);
    expect(defaults.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('Alias');
    const freeCode = mountFamily('CancellationForm', { allowedReasons: [] }).querySelector<HTMLInputElement>('input[name="reasonCode"]')!;
    expect(freeCode.value).toBe('');
    freeCode.value = 'customer_request'; expect(freeCode.value).toBe('customer_request');
    expect(mountFamily('CancellationForm', {}, 'Authored').querySelector('select')).toBeNull();
  });
});

// Sprint 189: these values must survive native controls and shared display policy.
describe('form/detail value preservation', () => {
  it('shows a seeded reason code even when it is outside the offered choices', () => {
    const root = mountFamily('CancellationForm', { reasonCode: 'customer_request', allowedReasons: ['budget'], reason: 'Keep this reason', embedded: true });
    expect(root.tagName).toBe('FIELDSET');
    expect(root.querySelector<HTMLSelectElement>('select')?.value).toBe('customer_request');
    expect(root.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('Keep this reason');
    expect(root.querySelector('form')).toBeNull();
  });
  it('shows present UTC datetimes in the native datetime-local control', () => {
    const root = mountFamily('Input', { type: 'datetime-local', value: '2026-09-08T12:00:00.000Z', label: 'Requested at' });
    expect(root.querySelector<HTMLInputElement>('input')?.value).toBe('2026-09-08T12:00');
  });
  it('renders both audit history entries and readable timestamps', () => {
    const root = mountFamily('AuditTimeline', { auditLog: [{ from: null, to: 'active', at: '2026-09-01T12:00:00Z' }, { from: 'active', to: 'pending_cancellation', at: '2026-09-08T12:00:00Z', reason: 'Budget' }] });
    expect(root.querySelectorAll('[data-timeline-event]')).toHaveLength(2);
    expect(root.textContent).toContain('Sep 8, 2026, 12:00 PM');
    expect(root.textContent).not.toMatch(/No events|Event 1|\d{4}-\d{2}-\d{2}T/);
  });
});
