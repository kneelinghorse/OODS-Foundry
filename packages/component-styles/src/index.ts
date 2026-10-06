import { brands } from '@oods/tokens/brands';

export const COMPONENT_STYLE_VERSION = '1.0.0' as const;

export const COMPONENT_STYLE_IDS = [
  'AddressCollectionPanel', 'AddressEditor', 'AddressSummaryBadge', 'AddressValidationTimeline', 'ArchivePill',
  'ArchiveSummary', 'AuditEvent', 'AuditTimeline', 'Badge', 'Banner',
  'ArchivedRowOverlay', 'BillingSummaryBadge', 'BillingAmountInput', 'BillingIntervalSelector', 'BillingCardMeta',
  'AuditSummaryCard', 'SortIndicator', 'TimelineEntryLabel',
  'CycleProgressCard', 'PaymentTimeline', 'PaymentEventTimeline',
  'Button', 'CancellationBadge', 'CancellationForm', 'CancellationSummary', 'Card',
  'CardHeader', 'Checkbox', 'ClassificationBadge', 'ClassificationEditor', 'ClassificationPanel',
  'ColorSwatch', 'ColorizedBadge', 'DatePicker', 'DetailHeader', 'FilterPanel',
  'FormLabelGroup', 'Grid', 'InlineLabel', 'Input', 'LabelCell',
  'MembershipAuditTimeline', 'MembershipPanel', 'MessageEventTimeline', 'MessageStatusBadge', 'OwnerBadge',
  'OwnershipMeta', 'OwnershipSummary', 'PaginationBar', 'PreferenceEditor', 'PreferencePanel',
  'PreferenceSummaryBadge', 'PreferenceTimeline', 'PriceBadge', 'PriceCardMeta', 'PriceSummary',
  'RelativeTimestamp', 'RoleAssignmentForm', 'RoleBadgeList', 'SearchInput', 'Select',
  'Stack', 'StatusBadge', 'StatusSelector', 'StatusTimeline', 'Table',
  'Tabs', 'TagInput', 'TagManager', 'TagPills', 'TagSummary',
  'TemplatePicker', 'Text', 'Textarea', 'VizAreaPreview',
  'ArchiveEvent', 'CancellationEvent', 'ColorStatePicker', 'CommunicationDetailPanel', 'GeoFieldMappingForm',
  'GeoResolutionBadge', 'GeocodablePreview', 'StateTransitionEvent', 'StatusColorLegend', 'VizAreaControls',
  'VizAxisControls', 'VizAxisSummary', 'VizColorControls', 'VizColorLegendConfig', 'VizEncodingBadge',
  'VizGraphPreview', 'VizHeatmapControls', 'VizHeatmapPreview', 'VizLineControls', 'VizLinePreview', 'VizMarkControls',
  'VizMarkPreview', 'VizOpacityControls', 'VizOpacitySummary', 'VizPointControls', 'VizPointPreview',
  'VizRoleBadge', 'VizScaleControls', 'VizScaleSummary', 'VizScatterControls', 'VizScatterPreview',
  'VizShapeControls', 'VizShapeLegend', 'VizSizeControls', 'VizSizeSummary',
  // s222-m02 (#2502 ruling 11): styled in components-overlay.css, which components.css imports.
  'Dialog', 'Switch',
  // s223-m02 (#2527 ruling 11): styled in components-combobox.css, which components.css imports.
  'Combobox',
  // s223-m02 (#2527 ruling 10): styled in components-segmented-control.css, which components.css imports.
  'SegmentedControl',
] as const;

/**
 * Every brand × theme cell the component styles serve. Components read only brand-independent variables, so each
 * brand the token build carries is a cell in each theme (s213-m04: the list comes from the brand registry).
 */
export const SUPPORTED_COMPONENT_THEME_CELLS: ReadonlyArray<{ readonly brand: string; readonly theme: 'light' | 'dark' | 'hc' }> =
  Object.freeze(brands.flatMap(brand => (['light', 'dark', 'hc'] as const).map(theme => Object.freeze({ brand, theme }))));

export const COMPONENT_DATA_ATTRIBUTE = 'data-oods-component' as const;
