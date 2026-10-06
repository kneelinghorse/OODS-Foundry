/**
 * Content strategy mapping for codegen prop binding.
 *
 * Tells emitters HOW to render a field value for each component type:
 * - 'children'    — field renders as JSX children: <Text>{field}</Text>
 * - 'value-prop'  — field renders as value attribute: <Input value={field} />
 * - 'label-prop'  — field renders as label attribute: <Badge label={field} />
 * - 'status-prop' — field renders as status/variant: <StatusBadge status={field} />
 * - 'none'        — layout/container components, no field content
 */

export type ContentStrategy = 'children' | 'value-prop' | 'label-prop' | 'status-prop' | 'none';

const STRATEGY_MAP: Record<string, ContentStrategy> = {
  // --- Primitives ---
  Text: 'children',
  Button: 'label-prop',
  Badge: 'label-prop',
  Banner: 'children',
  Input: 'value-prop',
  Select: 'value-prop',
  // s223-m02 (#2527 ruling 12): the two Select-like controls bind a field's value as Select does.
  SegmentedControl: 'value-prop',
  Combobox: 'value-prop',
  Card: 'none',
  Stack: 'none',
  Grid: 'none',
  Table: 'none',
  Tabs: 'none',

  // --- Content ---
  CardHeader: 'children',
  DetailHeader: 'children',
  FormLabelGroup: 'label-prop',
  InlineLabel: 'children',
  LabelCell: 'children',
  TimelineEntryLabel: 'children',

  // --- Behavioral ---
  FilterPanel: 'none',
  PaginationBar: 'none',
  SearchInput: 'value-prop',
  TagInput: 'value-prop',
  TagManager: 'none',
  TagPills: 'children',
  TagSummary: 'children',

  // --- Communication ---
  CommunicationDetailPanel: 'none',
  MessageEventTimeline: 'none',
  MessageStatusBadge: 'status-prop',
  TemplatePicker: 'value-prop',

  // --- Core ---
  AddressCollectionPanel: 'none',
  AddressEditor: 'value-prop',
  AddressSummaryBadge: 'label-prop',
  AddressValidationTimeline: 'none',
  ClassificationBadge: 'label-prop',
  ClassificationEditor: 'value-prop',
  ClassificationPanel: 'none',
  MembershipAuditTimeline: 'none',
  MembershipPanel: 'none',
  PreferenceEditor: 'value-prop',
  PreferencePanel: 'none',
  PreferenceSummaryBadge: 'label-prop',
  PreferenceTimeline: 'none',
  RoleAssignmentForm: 'value-prop',
  RoleBadgeList: 'children',

  // --- Financial ---
  BillingAmountInput: 'value-prop',
  BillingCardMeta: 'children',
  BillingIntervalSelector: 'value-prop',
  BillingSummaryBadge: 'label-prop',
  CycleProgressCard: 'none',
  PaymentEventTimeline: 'none',
  PaymentTimeline: 'none',
  PriceBadge: 'label-prop',
  PriceCardMeta: 'children',
  PriceSummary: 'children',

  // --- Lifecycle ---
  ArchiveEvent: 'none',
  ArchivePill: 'label-prop',
  ArchiveSummary: 'children',
  ArchivedRowOverlay: 'none',
  AuditEvent: 'none',
  AuditSummaryCard: 'none',
  SortIndicator: 'none',
  AuditTimeline: 'none',
  CancellationBadge: 'label-prop',
  CancellationEvent: 'none',
  CancellationForm: 'value-prop',
  CancellationSummary: 'children',
  RelativeTimestamp: 'children',
  StateTransitionEvent: 'none',
  StatusBadge: 'status-prop',
  StatusSelector: 'value-prop',
  StatusTimeline: 'status-prop',

  // --- Structural ---
  OwnerBadge: 'label-prop',
  OwnershipMeta: 'children',
  OwnershipSummary: 'children',

  // --- Visual ---
  ColorStatePicker: 'value-prop',
  ColorSwatch: 'none',
  ColorizedBadge: 'label-prop',
  StatusColorLegend: 'none',

  // --- Viz Encoding ---
  VizAxisControls: 'none',
  VizAxisSummary: 'none',
  VizColorControls: 'none',
  VizColorLegendConfig: 'none',
  VizEncodingBadge: 'none',
  VizSizeControls: 'none',
  VizSizeSummary: 'none',

  // --- Viz Mark ---
  VizAreaControls: 'none',
  VizAreaPreview: 'none',
  VizLineControls: 'none',
  VizLinePreview: 'none',
  VizGraphPreview: 'none',
  VizMarkControls: 'none',
  VizMarkPreview: 'none',
  VizPointControls: 'none',
  VizPointPreview: 'none',
  VizScatterControls: 'none',
  VizScatterPreview: 'none',
  VizHeatmapControls: 'none',
  VizHeatmapPreview: 'none',
  VizOpacityControls: 'none',
  VizOpacitySummary: 'none',
  VizShapeControls: 'none',
  VizShapeLegend: 'none',
  VizRoleBadge: 'none',

  // --- Viz Scale ---
  VizScaleControls: 'none',
  VizScaleSummary: 'none',

  // --- Viz Spatial ---
  GeoFieldMappingForm: 'value-prop',
  GeoResolutionBadge: 'label-prop',
  GeocodablePreview: 'none',
};

/**
 * Look up the content strategy for a component by name.
 * Returns 'none' for unknown components (safe default — no content injection).
 */
export function getContentStrategy(componentName: string): ContentStrategy {
  return Object.hasOwn(STRATEGY_MAP, componentName)
    ? STRATEGY_MAP[componentName]!
    : 'none';
}

/**
 * Check whether a component accepts field content (any strategy except 'none').
 */
export function acceptsFieldContent(componentName: string): boolean {
  return getContentStrategy(componentName) !== 'none';
}
