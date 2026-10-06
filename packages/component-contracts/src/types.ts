export const COMPONENT_CLASSIFICATIONS = [
  'native',
  'recipe',
  'alias',
  'authoring-only',
  'merged',
  'retired',
] as const;

export type ComponentClassification = (typeof COMPONENT_CLASSIFICATIONS)[number];

export const NUCLEUS_COMPONENT_IDS = [
  'AddressCollectionPanel',
  'AddressEditor',
  'AddressSummaryBadge',
  'AddressValidationTimeline',
  'ArchiveEvent',
  'ArchivePill',
  'ArchiveSummary',
  'ArchivedRowOverlay',
  'AuditEvent',
  'AuditSummaryCard',
  'AuditTimeline',
  'Badge',
  'Banner',
  'BillingAmountInput',
  'BillingCardMeta',
  'BillingIntervalSelector',
  'BillingSummaryBadge',
  'Button',
  'CancellationBadge',
  'CancellationEvent',
  'CancellationForm',
  'CancellationSummary',
  'Card',
  'CardHeader',
  'Checkbox',
  'ClassificationBadge',
  'ClassificationEditor',
  'ClassificationPanel',
  'ColorStatePicker',
  'ColorSwatch',
  'ColorizedBadge',
  'Combobox',
  'CommunicationDetailPanel',
  'CycleProgressCard',
  'DatePicker',
  'DetailHeader',
  'Dialog',
  'FilterPanel',
  'FormLabelGroup',
  'GeoFieldMappingForm',
  'GeoResolutionBadge',
  'GeocodablePreview',
  'Grid',
  'InlineLabel',
  'Input',
  'LabelCell',
  'MembershipAuditTimeline',
  'MembershipPanel',
  'MessageEventTimeline',
  'MessageStatusBadge',
  'OwnerBadge',
  'OwnershipMeta',
  'OwnershipSummary',
  'PaginationBar',
  'PaymentEventTimeline',
  'PaymentTimeline',
  'PreferenceEditor',
  'PreferencePanel',
  'PreferenceSummaryBadge',
  'PreferenceTimeline',
  'PriceBadge',
  'PriceCardMeta',
  'PriceSummary',
  'RelativeTimestamp',
  'RoleAssignmentForm',
  'RoleBadgeList',
  'SearchInput',
  'SegmentedControl',
  'Select',
  'SortIndicator',
  'Stack',
  'StateTransitionEvent',
  'StatusBadge',
  'StatusColorLegend',
  'StatusSelector',
  'StatusTimeline',
  'Switch',
  'Table',
  'Tabs',
  'TagInput',
  'TagManager',
  'TagPills',
  'TagSummary',
  'TemplatePicker',
  'Text',
  'Textarea',
  'TimelineEntryLabel',
  'VizAreaControls',
  'VizAreaPreview',
  'VizAxisControls',
  'VizAxisSummary',
  'VizColorControls',
  'VizColorLegendConfig',
  'VizEncodingBadge',
  'VizGraphPreview',
  'VizHeatmapControls',
  'VizHeatmapPreview',
  'VizLineControls',
  'VizLinePreview',
  'VizMarkControls',
  'VizMarkPreview',
  'VizOpacityControls',
  'VizOpacitySummary',
  'VizPointControls',
  'VizPointPreview',
  'VizRoleBadge',
  'VizScaleControls',
  'VizScaleSummary',
  'VizScatterControls',
  'VizScatterPreview',
  'VizShapeControls',
  'VizShapeLegend',
  'VizSizeControls',
  'VizSizeSummary',
] as const;

export type NucleusComponentId = (typeof NUCLEUS_COMPONENT_IDS)[number];

const HISTORICAL_PORTED_COMPONENT_IDS = [
  'AuditTimeline',
  'CancellationSummary',
  'PaginationBar',
  'PriceBadge',
  'RelativeTimestamp',
  'SearchInput',
  'StatusBadge',
  'StatusTimeline',
] as const satisfies readonly NucleusComponentId[];

/** @deprecated Historical compatibility cohort; all members belong to NucleusComponentId. */
export type PortedComponentId = (typeof HISTORICAL_PORTED_COMPONENT_IDS)[number];

/** @deprecated Compatibility subset derived from the canonical nucleus, not a second governed union. */
export const PORTED_COMPONENT_IDS: readonly PortedComponentId[] = NUCLEUS_COMPONENT_IDS.filter(
  (id): id is PortedComponentId => HISTORICAL_PORTED_COMPONENT_IDS.some((componentId) => componentId === id),
);

export type GovernedComponentId = NucleusComponentId;

/**
 * Cross-component workflow states understood by generated UI branches.
 *
 * These are deliberately separate from `ComponentContract.states`, which
 * describe a component's own visual or interaction states.
 */
export const UI_WORKFLOW_STATES = [
  'loading',
  'empty',
  'error',
  'success',
] as const;

export type UiWorkflowState = (typeof UI_WORKFLOW_STATES)[number];

export type ComponentContract = {
  id: GovernedComponentId;
  version: '1.0.0' | '1.1.0';
  props: readonly string[];
  /**
   * s221-m02 (#2482 ruling 5): saved-schema composition directives the React and Vue components accept, which code
   * generation consumes (a field binding, a pattern's parts) and the component reads no value from; listed apart from
   * the props a consumer passes.
   */
  directives?: readonly string[];
  /** Public props needed to name or identify a field; substitution must preserve them. */
  requiredProps?: readonly string[];
  slots: readonly string[];
  events: readonly string[];
  states: readonly string[];
  tokenRoles: readonly string[];
  accessibility: readonly string[];
  role?: string;
  name?: { strategy: 'label' | 'aria-label' | 'heading' | 'none'; target: string };
  keyboard?: Readonly<Record<string, string>>;
  compatibility: string;
};

export type SharedScenario = {
  id: string;
  oodsComponentId: GovernedComponentId;
  props: Readonly<Record<string, unknown>>;
  slots: Readonly<Record<string, unknown>>;
  initialState: Readonly<Record<string, unknown>>;
  interaction: 'interactive' | 'none';
  interactionReason?: string;
  event: readonly ScenarioTrigger[];
  renderExpectation: {
    name: string;
    trigger: string;
    expected: string;
  };
  assertions: readonly string[];
};

export type EvidenceStatus = 'passed' | 'failed' | 'missing' | 'skipped' | 'environment-blocked';

export type EvidenceResult = {
  status: EvidenceStatus;
  refs: readonly string[];
};

/** Executable actions and outcomes, shared by both framework suites. */
export type ScenarioTrigger = {
  trigger: 'keyboard' | 'pointer';
  target: string;
  key?: string;
  /**
   * s223-m02 (#2527 ruling 11): keys pressed first on the target, in the same fresh scenario, before key, whose effect is
   * asserted. A combobox's Enter, Home and End act on an open list, which a key such as ArrowDown opens.
   */
  keys?: readonly string[];
  action?: 'click' | 'select';
  value?: string;
  /**
   * active-option (s223-m02): the target's popup is open (aria-expanded true), its aria-activedescendant names the option
   * whose text is value, and nothing was picked (no event).
   */
  effect: { kind: 'focus' | 'event' | 'value' | 'selected-tab' | 'active-option'; value?: unknown; target?: string };
};
export type ComponentBehavior = {
  role: string;
  name: NonNullable<ComponentContract['name']>;
  keyboard: Readonly<Record<string, string>>;
  interaction: SharedScenario['interaction'];
  interactionReason?: string;
  event: readonly ScenarioTrigger[];
};
