import { VizAreaControls, VizAxisControls, VizColorControls, VizHeatmapControls, VizLineControls, VizMarkControls, VizOpacityControls, VizPointControls, VizScaleControls, VizScatterControls, VizShapeControls, VizSizeControls, VizColorLegendConfig, VizShapeLegend, VizAxisSummary, VizOpacitySummary, VizScaleSummary, VizSizeSummary, VizEncodingBadge, VizRoleBadge, VizHeatmapPreview, VizGraphPreview, VizLinePreview, VizMarkPreview, VizPointPreview, VizScatterPreview } from '../src/viz-recipes.js';
import { ArchiveEvent, CancellationEvent, ColorStatePicker, CommunicationDetailPanel, GeoFieldMappingForm, GeoResolutionBadge, GeocodablePreview, StateTransitionEvent, StatusColorLegend } from '../src/trait-recipes.js';
import type { SharedScenario } from '@oods/component-contracts';
import type { ReactElement } from 'react';

import type {
  AddressEditorProps, AddressValidationTimelineProps, DialogProps, FilterPanelProps, MessageEventTimelineProps, PreferenceEditorProps,
  PreferenceTimelineProps, RoleAssignmentFormProps, RoleBadgeListProps, StatusSelectorProps, SwitchProps, TagInputProps, TagManagerProps,
  TagPillsProps, TemplatePickerProps,
} from '../src/index.js';

import {
  AuditSummaryCard, SortIndicator, TimelineEntryLabel,
  CycleProgressCard, PaymentTimeline, PaymentEventTimeline, BillingCardMeta, ArchivedRowOverlay,
  BillingSummaryBadge, BillingAmountInput, BillingIntervalSelector,
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
  Dialog,
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
  Switch,
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

// s223-m02 (#2527 ruling 11).
import { Combobox, type ComboboxProps } from '../src/index.js';

// s223-m02 (#2527 ruling 10).
import { SegmentedControl, type SegmentedControlProps } from '../src/index.js';

export type SharedScenarioHandlers = {
  readonly onEvent?: (value?: unknown) => void;
};

export function renderSharedScenario(
  scenario: SharedScenario,
  handlers: SharedScenarioHandlers = {}
): ReactElement {
  const { onEvent } = handlers;
  switch (scenario.id) {
    case 'VizAreaControls': return <VizAreaControls {...scenario.props} onChange={onEvent} />;
    case 'VizAxisControls': return <VizAxisControls {...scenario.props} onChange={onEvent} />;
    case 'VizColorControls': return <VizColorControls {...scenario.props} onChange={onEvent} />;
    case 'VizHeatmapControls': return <VizHeatmapControls {...scenario.props} onChange={onEvent} />;
    case 'VizLineControls': return <VizLineControls {...scenario.props} onChange={onEvent} />;
    case 'VizMarkControls': return <VizMarkControls {...scenario.props} onChange={onEvent} />;
    case 'VizOpacityControls': return <VizOpacityControls {...scenario.props} onChange={onEvent} />;
    case 'VizPointControls': return <VizPointControls {...scenario.props} onChange={onEvent} />;
    case 'VizScaleControls': return <VizScaleControls {...scenario.props} onChange={onEvent} />;
    case 'VizScatterControls': return <VizScatterControls {...scenario.props} onChange={onEvent} />;
    case 'VizShapeControls': return <VizShapeControls {...scenario.props} onChange={onEvent} />;
    case 'VizSizeControls': return <VizSizeControls {...scenario.props} onChange={onEvent} />;
    case 'VizColorLegendConfig': return <VizColorLegendConfig {...scenario.props} onChange={onEvent} />;
    case 'VizShapeLegend': return <VizShapeLegend {...scenario.props} onChange={onEvent} />;
    case 'VizAxisSummary': return <VizAxisSummary {...scenario.props} />;
    case 'VizOpacitySummary': return <VizOpacitySummary {...scenario.props} />;
    case 'VizScaleSummary': return <VizScaleSummary {...scenario.props} />;
    case 'VizSizeSummary': return <VizSizeSummary {...scenario.props} />;
    case 'VizEncodingBadge': return <VizEncodingBadge {...scenario.props} />;
    case 'VizRoleBadge': return <VizRoleBadge {...scenario.props} />;
    case 'VizHeatmapPreview': return <VizHeatmapPreview {...scenario.props} />;
    case 'VizGraphPreview': return <VizGraphPreview {...scenario.props} />;
    case 'VizLinePreview': return <VizLinePreview {...scenario.props} />;
    case 'VizMarkPreview': return <VizMarkPreview {...scenario.props} />;
    case 'VizPointPreview': return <VizPointPreview {...scenario.props} />;
    case 'VizScatterPreview': return <VizScatterPreview {...scenario.props} />;
    case 'ArchiveEvent': return <ArchiveEvent {...scenario.props} />;
    case 'CancellationEvent': return <CancellationEvent {...scenario.props} />;
    case 'StateTransitionEvent': return <StateTransitionEvent {...scenario.props} />;
    case 'ColorStatePicker': return <ColorStatePicker {...scenario.props} onChange={onEvent} />;
    case 'StatusColorLegend': return <StatusColorLegend {...scenario.props} />;
    case 'CommunicationDetailPanel': return <CommunicationDetailPanel {...scenario.props} />;
    case 'GeoFieldMappingForm': return <GeoFieldMappingForm {...scenario.props} onChange={onEvent} />;
    case 'GeoResolutionBadge': return <GeoResolutionBadge {...scenario.props} />;
    case 'GeocodablePreview': return <GeocodablePreview {...scenario.props} />;

    case 'AuditSummaryCard': return <AuditSummaryCard {...scenario.props} />;
    case 'SortIndicator': return <SortIndicator {...scenario.props} onChange={onEvent} />;
    case 'TimelineEntryLabel': return <TimelineEntryLabel {...scenario.props} />;
    case 'billing-cycle-progress': return <CycleProgressCard {...scenario.props} />;
    case 'billing-payment-detail': return <PaymentTimeline {...scenario.props} />;
    case 'billing-payment-events': return <PaymentEventTimeline {...scenario.props} />;
    case 'billing-card-minor-units': return <BillingCardMeta {...scenario.props} />;
    case 'archived-row-presentation': return <ArchivedRowOverlay {...scenario.props} />;
    case 'billing-summary-minor-units': return <BillingSummaryBadge {...scenario.props} />;
    case 'billing-amount-half-up': return <BillingAmountInput {...scenario.props} onChange={onEvent} />;
    case 'billing-interval-subscription': return <BillingIntervalSelector {...scenario.props} onChange={onEvent} />;
    case 'badge-status':
      return <Badge content="Past due" tone="critical" emphasis="solid" icon="!" />;
    case 'banner-dismissible':
      return (
        <Banner
          title="Payment failed"
          detail="Update the card"
          tone="critical"
          dismissLabel="Dismiss payment warning"
          onDismiss={() => onEvent?.()}
          actions={<Button>Update card</Button>}
        />
      );
    case 'button-activate':
      return <Button onActivate={event => onEvent?.(event)}>Save changes</Button>;
    case 'card-elevated-content':
      return <Card elevated>Account summary</Card>;
    case 'card-header-supporting-text':
      return <CardHeader {...scenario.props} />;
    case 'classification-panel-title-and-summary':
      return <ClassificationPanel {...scenario.props} />;
    case 'address-collection-panel-title-and-summary':
      return <AddressCollectionPanel {...scenario.props} />;
    case 'membership-panel-title-and-summary':
      return <MembershipPanel {...scenario.props} />;
    case 'preference-panel-title-and-summary':
      return <PreferencePanel {...scenario.props} />;
    case 'tag-manager-list-and-add-control':
      return <TagManager {...(scenario.props as TagManagerProps)} />;
    case 'address-summary-badge-role':
      return <AddressSummaryBadge {...scenario.props} />;
    case 'message-status-badge-delivery':
      return <MessageStatusBadge {...scenario.props} />;
    case 'preference-summary-badge-namespace-and-version':
      return <PreferenceSummaryBadge {...scenario.props} />;
    case 'role-badge-list-items':
      return <RoleBadgeList {...(scenario.props as RoleBadgeListProps)} />;
    case 'tag-pills-overflow-template':
      return <TagPills {...(scenario.props as TagPillsProps)} />;
    case 'address-validation-timeline-events':
      return <AddressValidationTimeline {...(scenario.props as AddressValidationTimelineProps)} />;
    case 'audit-event-type-and-timestamp':
      return <AuditEvent {...scenario.props} />;
    case 'membership-audit-timeline-empty':
      return <MembershipAuditTimeline {...scenario.props} />;
    case 'message-event-timeline-statuses':
      return <MessageEventTimeline {...(scenario.props as MessageEventTimelineProps)} />;
    case 'preference-timeline-changes':
      return <PreferenceTimeline {...(scenario.props as PreferenceTimelineProps)} />;
    case 'address-editor-fields-and-change':
      return <AddressEditor {...(scenario.props as AddressEditorProps)} onChange={address => onEvent?.(address)} />;
    case 'preference-editor-namespace-and-document':
      return <PreferenceEditor {...(scenario.props as PreferenceEditorProps)} />;
    case 'role-assignment-form-roles':
      return <RoleAssignmentForm {...(scenario.props as RoleAssignmentFormProps)} />;
    case 'status-selector-controlled':
      return <StatusSelector {...(scenario.props as StatusSelectorProps)} onValueChange={value => onEvent?.(value)} />;
    case 'tag-input-typed-text':
      return <TagInput {...(scenario.props as TagInputProps)} onValueChange={value => onEvent?.(value)} />;
    case 'template-picker-selects':
      return <TemplatePicker {...(scenario.props as TemplatePickerProps)} />;
    case 'filter-panel-batch-mode':
      return <FilterPanel {...(scenario.props as FilterPanelProps)} />;
    case 'price-summary-terms':
      return <PriceSummary {...scenario.props} />;
    case 'color-swatch-label-and-chip':
      return <ColorSwatch {...scenario.props} />;
    case 'colorized-badge-color-marker':
      return <ColorizedBadge {...scenario.props} />;
    case 'detail-header-heading-level':
      return <DetailHeader {...scenario.props} />;
    case 'viz-area-preview-frame-placeholder-and-slot':
      return <VizAreaPreview {...scenario.props}>{String(scenario.slots.default)}</VizAreaPreview>;
    case 'checkbox-controlled':
      return (
        <Checkbox
          id="marketing"
          label="Product updates"
          checked={false}
          onCheckedChange={checked => onEvent?.(checked)}
          required
          help="Choose whether to subscribe"
        />
      );
    // s222-m02 (#2502 ruling 11): the example's actions slot is two real Buttons, as a consumer passes them.
    case 'dialog-confirm':
      return (
        <Dialog
          {...(scenario.props as unknown as DialogProps)}
          onClose={() => onEvent?.()}
          actions={<><Button>Cancel</Button><Button intent="primary">Archive workspace</Button></>}
        >
          {String(scenario.slots.default)}
        </Dialog>
      );
    case 'switch-controlled':
      return <Switch {...(scenario.props as unknown as SwitchProps)} onCheckedChange={checked => onEvent?.(checked)} />;
    // s223-m02 (#2527 ruling 11): the combobox reports a picked value through onValueChange, as Select does.
    case 'combobox-filter-and-pick':
      return <Combobox {...(scenario.props as unknown as ComboboxProps)} onValueChange={value => onEvent?.(value)} />;
    case 'date-picker-bounded':
      return (
        <DatePicker
          id="renewal"
          label="Renewal date"
          value="2026-09-30"
          onValueChange={value => onEvent?.(value)}
          min="2026-09-01"
          max="2026-12-31"
          step={1}
        />
      );
    case 'grid-responsive':
      return <Grid minColumnWidth="16rem" gap="md"><Card>First card</Card><Card>Second card</Card></Grid>;
    case 'input-invalid':
      return (
        <Input
          id="email"
          label="Email"
          type="email"
          value="invalid"
          onValueChange={value => onEvent?.(value)}
          required
          help="Use a work address"
          validation={{ state: 'error', message: 'Enter a valid email' }}
        />
      );
    // s223-m02 (#2527 ruling 10): a chosen option reports its value through onValueChange, as Select does.
    case 'segmented-control-billing-period':
      return <SegmentedControl {...(scenario.props as unknown as SegmentedControlProps)} onValueChange={value => onEvent?.(value)} />;
    case 'select-controlled':
      return (
        <Select
          id="plan"
          label="Plan"
          value="pro"
          onValueChange={value => onEvent?.(value)}
          options={[
            { value: 'basic', label: 'Basic' },
            { value: 'pro', label: 'Pro' },
          ]}
        />
      );
    case 'stack-wrapped-row':
      return <Stack direction="row" gap="sm" align="center" wrap><Button>Primary</Button><Button>Secondary</Button></Stack>;
    case 'table-selectable-row':
      return (
        <Table
          caption="Subscriptions"
          columns={[{ key: 'name', label: 'Name' }, { key: 'status', label: 'Status' }]}
          rows={[{ id: 'sub-1', name: 'Acme', status: 'Active' }]}
          density="compact"
          selectable
          onRowActivate={id => onEvent?.(id)}
        />
      );
    case 'tabs-keyboard':
      return (
        <Tabs
          ariaLabel="Account sections"
          defaultSelectedId="overview"
          onChange={id => onEvent?.(id)}
          items={[
            { id: 'overview', label: 'Overview', panel: 'Summary' },
            { id: 'billing', label: 'Billing', panel: 'Invoices' },
          ]}
        />
      );
    case 'text-semantic':
      return <Text as="strong" size="md" weight="semibold">Account owner</Text>;
    case 'textarea-controlled':
      return (
        <Textarea
          id="notes"
          label="Notes"
          value="Call before renewal"
          onValueChange={value => onEvent?.(value)}
          rows={4}
          help="Visible to account managers"
        />
      );
    case 'audit-timeline-transitions':
      return <AuditTimeline {...scenario.props} />;
    case 'cancellation-summary-boolean':
      return <CancellationSummary {...scenario.props} />;
    case 'pagination-bar-navigation':
      return <PaginationBar {...scenario.props} onPageChange={page => onEvent?.(page)} />;
    case 'price-badge-currency':
      return <PriceBadge {...scenario.props} />;
    case 'relative-timestamp-fixed':
      return <RelativeTimestamp {...scenario.props} />;
    case 'search-input-clear':
      return <SearchInput {...scenario.props} onUpdate={value => onEvent?.(value)} />;
    case 'status-badge-mapped':
      return <StatusBadge {...scenario.props} />;
    case 'status-timeline-history':
      return <StatusTimeline {...scenario.props} />;
    case 'label-cell-truncation-and-description':
      return <LabelCell {...scenario.props} />;
    case 'inline-label-truncation':
      return <InlineLabel {...scenario.props} />;
    case 'form-label-group-association':
      return <FormLabelGroup {...scenario.props} />;
    case 'classification-badge-category':
      return <ClassificationBadge {...scenario.props} />;
    case 'classification-editor-presentational-controls':
      return <ClassificationEditor {...scenario.props} />;
    case 'owner-badge-principal': return <OwnerBadge {...scenario.props} />;
    case 'ownership-summary-terms': return <OwnershipSummary {...scenario.props} />;
    case 'ownership-meta-inline-terms': return <OwnershipMeta {...scenario.props} />;
    case 'tag-summary-zero-and-tags': return <TagSummary {...scenario.props} />;
    case 'archive-summary-false-and-reason': return <ArchiveSummary {...scenario.props} />;
    case 'archive-pill-false': return <ArchivePill {...scenario.props} />;
    case 'cancellation-badge-false': return <CancellationBadge {...scenario.props} />;
    case 'cancellation-form-presentational-controls': return <CancellationForm {...scenario.props} />;
    case 'price-card-meta-inline-terms': return <PriceCardMeta {...scenario.props} />;
    default:
      throw new Error(`Unimplemented shared React scenario: ${scenario.id}`);
  }
}
