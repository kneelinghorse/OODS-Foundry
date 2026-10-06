import { NUCLEUS_COMPONENT_IDS, sharedScenarios } from '@oods/component-contracts';
import { renderToString } from '@vue/server-renderer';
import { defineComponent, h } from 'vue';
import { describe, expect, it } from 'vitest';
import { renderSharedScenario } from './scenario-fixtures.js';

import {
  AuditSummaryCard, SortIndicator, TimelineEntryLabel,
  ArchivedRowOverlay, BillingSummaryBadge, BillingAmountInput, BillingIntervalSelector, CycleProgressCard, PaymentTimeline, PaymentEventTimeline, BillingCardMeta,
  ArchiveSummary, ArchivePill, CancellationBadge, CancellationForm, PriceCardMeta,
  OwnerBadge, OwnershipSummary, OwnershipMeta, TagSummary,
  LabelCell, InlineLabel, FormLabelGroup, ClassificationBadge, ClassificationEditor,
  AuditTimeline,
  CancellationSummary,
  PaginationBar,
  PriceBadge,
  RelativeTimestamp,
  SearchInput,
  StatusBadge,
  StatusTimeline,
  AddressCollectionPanel,
  AddressEditor,
  AddressSummaryBadge,
  AddressValidationTimeline,
  AuditEvent,
  Badge,
  Banner,
  Button,
  Card,
  CardHeader,
  Checkbox,
  ClassificationPanel,
  ColorSwatch,
  ColorizedBadge,
  DatePicker,
  DetailHeader,
  FilterPanel,
  Grid,
  Input,
  MembershipAuditTimeline,
  MembershipPanel,
  MessageEventTimeline,
  MessageStatusBadge,
  PreferenceEditor,
  PreferencePanel,
  PreferenceSummaryBadge,
  PreferenceTimeline,
  PriceSummary,
  RoleAssignmentForm,
  RoleBadgeList,
  Select,
  Stack,
  StatusSelector,
  Table,
  Tabs,
  TagInput,
  TagManager,
  TagPills,
  TemplatePicker,
  Text,
  Textarea,
  VizAreaPreview,
} from '../src/index.js';

const ServerShowcase = defineComponent({
  name: 'ServerShowcase',
  setup() {
    return () => h('main', [
      h(ArchivePill, { isArchived: false }),
      h(ArchiveSummary, { isArchived: false, reason: 'Retention' }),
      h(CancellationBadge, { cancelAtPeriodEnd: false }),
      h(CancellationForm, { reasonCode: 'budget', reason: 'Cost' }),
      h(PriceCardMeta, { interval: 'monthly' }),
      h(OwnerBadge, { owner: 'user-7' }),
      h(OwnershipSummary, { ownerId: 'user-7', role: 'administrator' }),
      h(OwnershipMeta, { ownerType: 'organization', role: 'custodian' }),
      h(TagSummary, { tagCount: 0, tags: ['alpha'] }),
      h(LabelCell, { label: 'Product name', description: 'Supporting text' }),
      h(InlineLabel, { label: 'Product name' }),
      h(FormLabelGroup, { label: 'Product name', inputId: 'product-label' }),
      h(ClassificationBadge, { category: 'Electronics', mode: 'strict' }),
      h(ClassificationEditor, { category: 'Electronics', tags: ['alpha'] }),
      h(AuditTimeline, { events: [{ label: 'Subscription created', timestamp: '2026-09-05T12:00:00Z' }] }),
      h(CancellationSummary, { cancelAtPeriodEnd: true }),
      h(PaginationBar, { page: 2, pageSize: 25, totalItems: 80 }),
      h(PriceBadge, { amountCents: 2500, currency: 'usd' }),
      h(RelativeTimestamp, { datetime: '2026-09-05T12:00:00Z', relative: '2 hours ago' }),
      h(SearchInput, { value: 'past due' }),
      h(StatusBadge, { status: 'past_due' }),
      h(StatusTimeline, { status: 'active', allowedTransitions: ['past_due', 'cancelled'] }),
      h(Badge, { content: 'Past due', tone: 'critical' }),
      h(Banner, { title: 'Payment failed', tone: 'critical' }),
      h(Button, { content: 'Save changes' }),
      h(Card, {}, { default: () => 'Account summary' }),
      h(CardHeader, { title: 'Account summary', supporting: 'Current subscription' }),
      h(ColorSwatch, { color: '#2563eb', label: 'Ocean blue' }),
      h(ColorizedBadge, { label: 'Active', status: 'active', color: '#15803d' }),
      h(DetailHeader, { title: 'Subscription details', as: 'h1', subtitle: 'Pro plan' }),
      h(VizAreaPreview, { width: 320, height: 180 }),
      h(ClassificationPanel, { title: 'Classification', summary: 'Electronics > Mobile' }),
      h(FilterPanel, { filters: [{ field: 'status', label: 'Status' }], mode: 'batch' }),
      h(PriceSummary, { amount: 2500, currency: 'USD' }),
      h(AddressCollectionPanel, { summary: '2 addresses on file' }),
      h(MembershipPanel, { summary: 'Owner of 2 workspaces' }),
      h(PreferencePanel, { summary: 'No preferences saved' }),
      h(TagManager, { tags: ['alpha'] }),
      h(AddressSummaryBadge, { label: 'Billing address', role: 'billing' }),
      h(MessageStatusBadge, { delivery: 'delivered' }),
      h(PreferenceSummaryBadge, { namespace: 'notifications', version: 'v3' }),
      h(RoleBadgeList, { roles: ['owner'] }),
      h(TagPills, { tags: ['alpha', 'beta'], maxVisible: 1, overflowLabel: '+{{ tag_count }}' }),
      h(AddressValidationTimeline, { validations: ['Geocoded'] }),
      h(AuditEvent, { event: 'user.updated' }),
      h(MembershipAuditTimeline, {}),
      h(MessageEventTimeline, { statuses: [{ status: 'delivered' }] }),
      h(PreferenceTimeline, { changes: [{ event: 'notifications.email' }] }),
      h(AddressEditor, { street: '1 Main St', city: 'Springfield' }),
      h(PreferenceEditor, { namespaces: ['default'], document: '{}' }),
      h(RoleAssignmentForm, { roles: ['owner'], role: 'owner' }),
      h(StatusSelector, { value: 'active' }),
      h(TagInput, { tags: ['alpha'], placeholder: 'Add a tag' }),
      h(TemplatePicker, { templates: ['welcome'], templateId: 'welcome' }),
      h(Checkbox, { id: 'marketing', label: 'Product updates' }),
      h(DatePicker, { id: 'renewal', label: 'Renewal date', value: '2026-09-30' }),
      h(Grid, {}, { default: () => [h('span', 'First'), h('span', 'Second')] }),
      h(Input, { id: 'email', label: 'Email', value: 'owner@example.com' }),
      h(Select, {
        id: 'plan',
        label: 'Plan',
        defaultValue: 'pro',
        options: [
          { value: 'basic', label: 'Basic' },
          { value: 'pro', label: 'Pro' },
        ],
      }),
      h(Stack, {}, { default: () => 'Stack content' }),
      h(Table, {
        caption: 'Subscriptions',
        columns: [{ key: 'name', label: 'Name' }],
        rows: [{ id: 'sub-1', name: 'Acme' }],
      }),
      h(Tabs, {
        ariaLabel: 'Account sections',
        items: [{ id: 'overview', label: 'Overview', panel: 'Summary' }],
      }),
      h(Text, { as: 'strong', content: 'Account owner' }),
      h(Textarea, { id: 'notes', label: 'Notes', value: 'Call before renewal' }),
      h(AuditSummaryCard, { auditLog: [] }),
      h(SortIndicator, { sortField: 'name' }),
      h(TimelineEntryLabel, { label: 'Timeline label' }),
      // Sprint 188 added these eight families to the nucleus inventory.
      h(ArchivedRowOverlay, { isArchived: true, label: 'Retained subscription' }, { default: () => 'Archived record' }),
      h(BillingSummaryBadge, { amount: 1900, currency: 'usd', interval: 'monthly' }),
      h(BillingAmountInput, { amount: 1900, currency: 'usd' }),
      h(BillingIntervalSelector, { interval: 'monthly' }),
      h(CycleProgressCard, { periodStart: '2026-09-01T00:00:00Z', periodEnd: '2026-10-01T00:00:00Z', now: '2026-09-15T00:00:00Z' }),
      h(PaymentTimeline, { lastPayment: '2026-09-01T00:00:00Z', nextPayment: '2026-10-01T00:00:00Z' }),
      h(PaymentEventTimeline, { lastPayment: '2026-09-01T00:00:00Z', nextPayment: '2026-10-01T00:00:00Z' }),
      h(BillingCardMeta, { amount: 1900, currency: 'usd' }),
    ]);
  },
});

describe('@oods/components-vue server rendering', () => {
  it('SSR-renders every nucleus component family with semantic markup', async () => {
    const html = await renderToString(h(ServerShowcase));
    const scenarios = await renderToString(h("div", {}, sharedScenarios.map(scenario => renderSharedScenario(scenario))));
    for (const componentId of NUCLEUS_COMPONENT_IDS) {
      expect(scenarios, componentId).toContain(`data-oods-component="${componentId}"`);
    }
    expect(html).toContain('<table');
    // s221-m02 (#2482 ruling 2): the caption carries its part class, as React's does.
    expect(html).toContain('<caption class="oods-table__caption">Subscriptions</caption>');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('type="button"');
    expect(html).toContain('<option value="pro" selected>Pro</option>');
    expect(html).toContain('data-form-type="address-editor"');
    // s221-m01: the stored value stays 'active'; its label is readable (s215-m01 #2388, 25d727945).
    expect(html).toContain('<option value="active" selected>Active</option>');
    expect(html).toContain('placeholder="Add a tag"');
  });
});
