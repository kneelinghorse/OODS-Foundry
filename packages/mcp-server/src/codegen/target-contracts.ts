import {
  componentContracts,
  isVizIntentFragment,
  assertStaticSvg,
  VIZ_THEME_SVG_PROPS,
  type GovernedComponentId,
} from '@oods/component-contracts';

import { PATTERN_COMPOSITE_COMPONENTS } from '../compose/field-patterns.js';
import type { FieldSchemaEntry, UiElement, UiSchema } from '../schemas/generated.js';
import {
  FIELD_CONSUMED_UNBOUND,
  type BindingAnalysis,
  analyzeBindings,
  ownFieldSchemaEntry,
  resolveFieldProps,
  resolveFrameworkChildContent,
} from './binding-utils.js';
import { normalizeSchemaForFramework } from './framework-normalization.js';
import type { CodegenFramework, CodegenIssue, CodegenValidationCheck } from './types.js';

const GENERIC_PROPS = new Set(['field', 'id']);
const CROSS_TARGET_PROP_EXTENSIONS: Readonly<
  Partial<Record<GovernedComponentId, ReadonlySet<string>>>
> = {
  VizAreaPreview: new Set(['svgParameter', 'baselineField', 'curveField', 'opacityField']),
  VizAreaControls: new Set(["baselineField", "curveField", "opacityField", "tensionField", "intentParameter"]),
  VizAxisControls: new Set(["aggregateField", "axis", "fieldField", "kindField", "scaleField", "sortField", "titleField", "zeroField", "intentParameter"]),
  VizAxisSummary: new Set(["axis", "scaleField", "titleField", "zeroField", "intentParameter"]),
  VizColorControls: new Set(["channelField", "contrastField", "redundancyField", "schemeField", "intentParameter"]),
  VizColorLegendConfig: new Set(["field", "redundancyField", "schemeField", "intentParameter"]),
  VizEncodingBadge: new Set(["axis", "fieldField", "intentParameter"]),
  VizHeatmapControls: new Set(["intentParameter"]),
  VizHeatmapPreview: new Set(["svgParameter"]),
  VizLineControls: new Set(["curveField", "joinField", "markersField", "strokeField", "intentParameter"]),
  VizLinePreview: new Set(["curveField", "markersField", "strokeWidthField", "svgParameter"]),
  VizGraphPreview: new Set(["svgParameter"]),
  VizMarkControls: new Set(["cornerRadiusField", "orientationField", "paddingField", "stackingField", "intentParameter"]),
  VizMarkPreview: new Set(["orientationField", "stackingField", "typeField", "svgParameter"]),
  VizOpacityControls: new Set(["intentParameter"]),
  VizOpacitySummary: new Set(["intentParameter"]),
  VizPointControls: new Set(["opacityField", "shapeField", "sizeField", "strokeField", "intentParameter"]),
  VizPointPreview: new Set(["fillField", "shapeField", "sizeField", "svgParameter"]),
  VizRoleBadge: new Set(["labelField", "intentParameter"]),
  VizScaleControls: new Set(["domainMaxField", "domainMinField", "formatField", "modeField", "niceField", "rangeMaxField", "rangeMinField", "type", "zeroField", "intentParameter"]),
  VizScaleSummary: new Set(["domainMaxField", "domainMinField", "modeField", "niceField", "type", "zeroField", "intentParameter"]),
  VizScatterControls: new Set(["intentParameter"]),
  VizScatterPreview: new Set(["svgParameter"]),
  VizShapeControls: new Set(["intentParameter"]),
  VizShapeLegend: new Set(["intentParameter"]),
  VizSizeControls: new Set(["maxAreaField", "maxField", "minAreaField", "minField", "strategyField", "intentParameter"]),
  VizSizeSummary: new Set(["field", "maxField", "minField", "strategyField", "intentParameter"]),
  ArchiveEvent: new Set(["archivedAtField", "restoredAtField", "reasonField", "archivedByField", "metadataField", "restorationMetadataField"]),
  CancellationEvent: new Set(["timestampField", "labelField", "codeField"]),
  StateTransitionEvent: new Set(["historyField", "labelField"]),
  CommunicationDetailPanel: new Set(["channelsField", "templatesField", "policiesField", "conversationsField"]),
  ColorStatePicker: new Set(["parameter"]),
  StatusColorLegend: new Set(["badgeField", "parameter"]),
  GeoFieldMappingForm: new Set(["latitudeField", "longitudeField", "identifierField", "autoDetectField"]),
  GeoResolutionBadge: new Set(["resolutionField"]),
  GeocodablePreview: new Set(["resolutionField", "requiresLookupField", "detectedFieldsField"]),
  AuditSummaryCard: new Set(['auditLogField']),
  SortIndicator: new Set(['sortFieldProp', 'sortDirectionProp', 'sortableFieldsParameter', 'triStateSortParameter', 'defaultSortFieldParameter', 'defaultSortDirectionParameter']),
  // Labelled trait recipe directives lower into title/supporting; they are
  // authoring metadata rather than additions to the public component API.
  BillingSummaryBadge: new Set(['amountField', 'currencyField', 'intervalField', 'minorUnitsParameter']),
  BillingAmountInput: new Set(['amountField', 'currencyField', 'minorUnitsParameter']),
  BillingIntervalSelector: new Set(['intervalField', 'intervalsParameter']),
  BillingCardMeta: new Set(['amountField', 'currencyField', 'intervalField', 'minorUnitsParameter']),
  CycleProgressCard: new Set(['progressField', 'periodStartField', 'periodEndField', 'intervalField']),
  PaymentTimeline: new Set(['lastPaymentField', 'nextPaymentField', 'paymentStatusField', 'paymentMethodField', 'amountField', 'currencyField']),
  PaymentEventTimeline: new Set(['lastPaymentField', 'nextPaymentField', 'paymentStatusField', 'amountField', 'currencyField']),
  ArchivedRowOverlay: new Set(['archivedField', 'labelField', 'style']),
  CardHeader: new Set(['titleField', 'supportingField']),
  ArchiveSummary: new Set(['archivedField', 'archivedAtField', 'reasonField', 'restoredAtField', 'archivedByField', 'metadataField', 'retainHistoryParameter', 'restoreWindowParameter', 'allowPartialRestoreParameter']),
  ArchivePill: new Set(['archivedAtField']),
  CancellationForm: new Set(['reasonField', 'codeField', 'requireReasonParameter', 'allowedReasonsParameter', 'windowParameter']),
  PriceCardMeta: new Set(['modelField', 'intervalField', 'amountField', 'currencyField', 'minorUnitsParameter']),
  OwnerBadge: new Set(['ownerIdField', 'ownerTypeField']),
  OwnershipSummary: new Set(['ownerIdField', 'ownerTypeField', 'roleField', 'transferredAtField', 'allowTransferParameter']),
  OwnershipMeta: new Set(['ownerIdField', 'ownerTypeField', 'roleField']),
  TagSummary: new Set(['countField']),
  LabelCell: new Set(['descriptionField', 'maxLengthParameter']),
  FormLabelGroup: new Set(['labelField', 'descriptionField', 'placeholderField', 'maxLabelLengthParameter', 'maxDescriptionLengthParameter', 'requireDescriptionParameter']),
  ClassificationBadge: new Set(['primaryCategoryField', 'tagPreviewField']),
  ClassificationEditor: new Set(['modeParameter', 'tagPolicyParameter', 'maxTagsParameter']),
  Checkbox: new Set(['name']),
  // Sprint 186 wave-2 directives: consumed by codegen (bound or disclosed unbound), never public props.
  ClassificationPanel: new Set(['categoriesField', 'tagsField', 'metadataField', 'modeParameter']),
  DatePicker: new Set(['name']),
  DetailHeader: new Set(['titleField', 'subtitleField', 'headingLevel']),
  FilterPanel: new Set(['activeField', 'modeParameter', 'collapsibleParameter', 'maxActiveParameter']),
  Input: new Set(['name']),
  PriceSummary: new Set(['amountField', 'currencyField', 'modelField', 'intervalField', 'taxBehaviorField']),
  AddressCollectionPanel: new Set(['roleField', 'defaultRoleField', 'roleParameter']),
  MembershipPanel: new Set(['membershipsField', 'hierarchyField', 'roleField', 'permissionField']),
  PreferencePanel: new Set(['preferencesField', 'metadataField', 'namespaceField']),
  // Trait directives the composer writes onto pattern-group Stacks; the lowering decides which travel.
  Stack: new Set(['as', 'channelsField', 'templatesField', 'policiesField', 'conversationsField', 'historyField', 'labelField', 'showActor', 'showReason']),
  AuditEvent: new Set(['typeField', 'timestampField', 'timezoneParameter']),
  MessageEventTimeline: new Set(['messagesField', 'statusesField']),
  PreferenceTimeline: new Set(['metadataField']),
  AddressEditor: new Set(['roleParameter', 'allowDynamicParameter', 'defaultRoleField']),
  PreferenceEditor: new Set(['namespacesField', 'documentField', 'registryNamespaceParameter']),
  RoleAssignmentForm: new Set(['availableRolesField', 'membershipField', 'defaultRoleParameter']),
  StatusSelector: new Set(['optionsParameter', 'initialParameter', 'allowedTransitionsField', 'requireReasonParameter']),
  TagInput: new Set(['maxTagsParameter', 'allowCustomParameter', 'allowListParameter', 'minLengthParameter', 'maxLengthParameter', 'synonymParameter']),
  TemplatePicker: new Set(['templatesField', 'channelsField']),
  TagManager: new Set(['allowCustomParameter', 'allowListParameter', 'maxTagsParameter', 'moderationParameter', 'synonymParameter']),
  MessageStatusBadge: new Set(['statusesField']),
  PreferenceSummaryBadge: new Set(['namespacesField', 'versionField']),
  RoleBadgeList: new Set(['rolesField', 'fallbackRoleParameter']),
  // The composer's field description lands on TagPills as label; the renderer never reads it.
  TagPills: new Set(['label']),
  Select: new Set(['name']),
  Textarea: new Set(['name']),
};

/** Extension directives whose values are not plain field names. */
const EXTENSION_VALUE_CONTRACTS: Readonly<Record<string, PropValueContract>> = {
  // Declared inline: this map sits above the shared value constants.
  showActor: valueContract('a boolean', (value) => typeof value === 'boolean'),
  showReason: valueContract('a boolean', (value) => typeof value === 'boolean'),
  headingLevel: {
    expected: 'an integer heading level from 1 to 6',
    accepts: (value) => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 6,
  },
};

const REQUIRED_PROPS: Readonly<Partial<Record<GovernedComponentId, readonly string[]>>> = {
  // Vue supplies an empty runtime default, but React's public TabsProps requires
  // items. The shared generation contract must compile against both packages.
  Tabs: ['items'],
  // s223-m02 (#2527 ruling 10): the same holds for a SegmentedControl's options.
  SegmentedControl: ['options'],
};

type PropValueContract = {
  expected: string;
  accepts: (value: unknown) => boolean;
};

function valueContract(
  expected: string,
  accepts: (value: unknown) => boolean,
): PropValueContract {
  return { expected, accepts };
}

function enumContract(values: readonly string[]): PropValueContract {
  const allowed = new Set(values);
  return valueContract(
    values.map((value) => JSON.stringify(value)).join(' or '),
    (value) => typeof value === 'string' && allowed.has(value),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(record).every((key) => allowed.has(key));
}

const STRING_VALUE = valueContract('a string', (value) => typeof value === 'string');
const STATIC_SVG_VALUE = valueContract('a passive, self-contained SVG string', value => {
  if (typeof value !== 'string') return false;
  try { assertStaticSvg(value); return true; } catch { return false; }
});
/** s222-m02 (#2502 ruling 12, F7): a placed chart's dark and high-contrast renders, each a static SVG like svg. */
const THEME_SVG_VALUES = Object.fromEntries(VIZ_THEME_SVG_PROPS.map((prop) => [prop, STATIC_SVG_VALUE])) as Record<(typeof VIZ_THEME_SVG_PROPS)[number], typeof STATIC_SVG_VALUE>;
const NON_EMPTY_STRING_ARRAY_VALUE = valueContract(
  'a non-empty array of strings',
  (value) => Array.isArray(value)
    && value.length > 0
    && value.every((entry) => typeof entry === 'string' && entry.length > 0),
);
const BOOLEAN_VALUE = valueContract('a boolean', (value) => typeof value === 'boolean');
const NUMBER_VALUE = valueContract(
  'a finite number',
  (value) => typeof value === 'number' && Number.isFinite(value),
);
const STRING_OR_NUMBER_VALUE = valueContract(
  'a string or finite number',
  (value) => typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)),
);
const STRING_ARRAY_VALUE = valueContract(
  'an array of strings',
  (value) => Array.isArray(value) && value.every((entry) => typeof entry === 'string'),
);
const NUMBER_ARRAY_VALUE = valueContract(
  'an array of finite numbers',
  (value) => Array.isArray(value) && value.every((entry) => (
    typeof entry === 'number' && Number.isFinite(entry)
  )),
);
const RECORD_ARRAY_VALUE = valueContract(
  'an array of objects',
  (value) => Array.isArray(value) && value.every(isRecord),
);
const ATTRIBUTE_VALUE = valueContract(
  'a string, finite number, or boolean',
  (value) => (
    typeof value === 'string'
    || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value))
  ),
);
const BOOLEANISH_VALUE = valueContract(
  'a boolean or the string "true" or "false"',
  (value) => value === true || value === false || value === 'true' || value === 'false',
);
const ARIA_CHECKED_VALUE = valueContract(
  'a boolean, "true", "false", or "mixed"',
  (value) => (
    value === true || value === false || value === 'true' || value === 'false' || value === 'mixed'
  ),
);
const ARIA_CURRENT_VALUE = valueContract(
  'a boolean, "true", "false", "page", "step", "location", "date", or "time"',
  (value) => (
    value === true
    || value === false
    || ['true', 'false', 'page', 'step', 'location', 'date', 'time'].includes(String(value))
  ),
);
const ARIA_HASPOPUP_VALUE = valueContract(
  'a boolean, "true", "false", "menu", "listbox", "tree", "grid", or "dialog"',
  (value) => (
    value === true
    || value === false
    || ['true', 'false', 'menu', 'listbox', 'tree', 'grid', 'dialog'].includes(String(value))
  ),
);
const ARIA_INVALID_VALUE = valueContract(
  'a boolean, "true", "false", "grammar", or "spelling"',
  (value) => (
    value === true
    || value === false
    || ['true', 'false', 'grammar', 'spelling'].includes(String(value))
  ),
);

/**
 * React's public nucleus props extend the corresponding DOM attribute types.
 * Keep this list explicit so an arbitrary JSON value cannot pass the build
 * gate and then fail the generated target's semantic TypeScript compile.
 */
const ARIA_VALUE_CONTRACTS: Readonly<Record<string, PropValueContract>> = {
  'aria-activedescendant': STRING_VALUE,
  'aria-atomic': BOOLEANISH_VALUE,
  'aria-autocomplete': enumContract(['none', 'inline', 'list', 'both']),
  'aria-braillelabel': STRING_VALUE,
  'aria-brailleroledescription': STRING_VALUE,
  'aria-busy': BOOLEANISH_VALUE,
  'aria-checked': ARIA_CHECKED_VALUE,
  'aria-colcount': NUMBER_VALUE,
  'aria-colindex': NUMBER_VALUE,
  'aria-colindextext': STRING_VALUE,
  'aria-colspan': NUMBER_VALUE,
  'aria-controls': STRING_VALUE,
  'aria-current': ARIA_CURRENT_VALUE,
  'aria-describedby': STRING_VALUE,
  'aria-description': STRING_VALUE,
  'aria-details': STRING_VALUE,
  'aria-disabled': BOOLEANISH_VALUE,
  'aria-dropeffect': enumContract(['none', 'copy', 'execute', 'link', 'move', 'popup']),
  'aria-errormessage': STRING_VALUE,
  'aria-expanded': BOOLEANISH_VALUE,
  'aria-flowto': STRING_VALUE,
  'aria-grabbed': BOOLEANISH_VALUE,
  'aria-haspopup': ARIA_HASPOPUP_VALUE,
  'aria-hidden': BOOLEANISH_VALUE,
  'aria-invalid': ARIA_INVALID_VALUE,
  'aria-keyshortcuts': STRING_VALUE,
  'aria-label': STRING_VALUE,
  'aria-labelledby': STRING_VALUE,
  'aria-level': NUMBER_VALUE,
  'aria-live': enumContract(['off', 'assertive', 'polite']),
  'aria-modal': BOOLEANISH_VALUE,
  'aria-multiline': BOOLEANISH_VALUE,
  'aria-multiselectable': BOOLEANISH_VALUE,
  'aria-orientation': enumContract(['horizontal', 'vertical']),
  'aria-owns': STRING_VALUE,
  'aria-placeholder': STRING_VALUE,
  'aria-posinset': NUMBER_VALUE,
  'aria-pressed': ARIA_CHECKED_VALUE,
  'aria-readonly': BOOLEANISH_VALUE,
  'aria-relevant': enumContract([
    'additions',
    'additions removals',
    'additions text',
    'all',
    'removals',
    'removals additions',
    'removals text',
    'text',
    'text additions',
    'text removals',
  ]),
  'aria-required': BOOLEANISH_VALUE,
  'aria-roledescription': STRING_VALUE,
  'aria-rowcount': NUMBER_VALUE,
  'aria-rowindex': NUMBER_VALUE,
  'aria-rowindextext': STRING_VALUE,
  'aria-rowspan': NUMBER_VALUE,
  'aria-selected': BOOLEANISH_VALUE,
  'aria-setsize': NUMBER_VALUE,
  'aria-sort': enumContract(['none', 'ascending', 'descending', 'other']),
  'aria-valuemax': NUMBER_VALUE,
  'aria-valuemin': NUMBER_VALUE,
  'aria-valuenow': NUMBER_VALUE,
  'aria-valuetext': STRING_VALUE,
};
const TONE_VALUE = enumContract([
  'neutral', 'info', 'accent', 'positive', 'success', 'warning', 'critical', 'danger',
]);
const EMPHASIS_VALUE = enumContract(['subtle', 'solid']);
const SIZE_VALUE = enumContract(['sm', 'md', 'lg']);
const HEADING_TAG_VALUE = enumContract(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const HEADING_LEVEL_VALUE = valueContract(
  'an integer from 1 to 6',
  (value) => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 6,
);
const VALIDATION_VALUE = valueContract(
  'an object with state "error", "warning", or "success" and a string message',
  (value) => {
    if (!isRecord(value) || !hasOnlyKeys(value, ['state', 'message'])) return false;
    return (
      (value.state === 'error' || value.state === 'warning' || value.state === 'success')
      && typeof value.message === 'string'
    );
  },
);
const SELECT_OPTIONS_VALUE = valueContract(
  'an array of { value: string, label: string, disabled?: boolean } objects',
  (value) => Array.isArray(value) && value.every((option) => (
    isRecord(option)
    && hasOnlyKeys(option, ['value', 'label', 'disabled'])
    && typeof option.value === 'string'
    && typeof option.label === 'string'
    && (option.disabled === undefined || typeof option.disabled === 'boolean')
  )),
);
/** s223-m02 (#2527 ruling 10): a segmented control offers two to five of Select's options. */
const SEGMENTED_OPTIONS_VALUE = valueContract(
  'an array of 2 to 5 { value: string, label: string, disabled?: boolean } objects',
  (value) => Array.isArray(value) && value.length >= 2 && value.length <= 5 && SELECT_OPTIONS_VALUE.accepts(value),
);
const TABLE_COLUMNS_VALUE = valueContract(
  'an array of { key: string, label: string } objects',
  (value) => Array.isArray(value) && value.every((column) => (
    isRecord(column)
    && hasOnlyKeys(column, ['key', 'label'])
    && typeof column.key === 'string'
    && typeof column.label === 'string'
  )),
);
const TABLE_ROWS_VALUE = valueContract(
  'an array of objects with string ids',
  (value) => Array.isArray(value) && value.every((row) => (
    isRecord(row) && typeof row.id === 'string'
  )),
);
const TAB_ITEMS_VALUE = valueContract(
  'an array of { id: string, label: string|number, panel: string|number, disabled?: boolean } objects',
  (value) => Array.isArray(value) && value.every((item) => (
    isRecord(item)
    && hasOnlyKeys(item, ['id', 'label', 'panel', 'disabled', 'isDisabled'])
    && typeof item.id === 'string'
    && (typeof item.label === 'string' || typeof item.label === 'number')
    && (typeof item.panel === 'string' || typeof item.panel === 'number')
    && (item.disabled === undefined || typeof item.disabled === 'boolean')
    && (item.isDisabled === undefined || typeof item.isDisabled === 'boolean')
  )),
);

/** renderPanelSection aliases shared by every panel-family component. */
const PANEL_SECTION_VALUES: Readonly<Record<string, PropValueContract>> = {
  title: STRING_VALUE,
  label: STRING_VALUE,
  heading: STRING_VALUE,
  name: STRING_VALUE,
  subtitle: STRING_VALUE,
  description: STRING_VALUE,
  metadata: STRING_VALUE,
  summary: STRING_VALUE,
  text: STRING_VALUE,
  body: STRING_VALUE,
  emptyMessage: STRING_VALUE,
};
const TAG_ITEMS_VALUE = valueContract('an array of tag entries', (value) => Array.isArray(value));

const BADGE_FAMILY_VALUES: Readonly<Record<string, PropValueContract>> = {
  label: STRING_VALUE,
  text: STRING_VALUE,
  value: STRING_VALUE,
  status: STRING_VALUE,
  state: STRING_VALUE,
  variant: STRING_VALUE,
  tone: TONE_VALUE,
  emphasis: EMPHASIS_VALUE,
};

const TIMELINE_TITLE_VALUES: Readonly<Record<string, PropValueContract>> = {
  title: STRING_VALUE,
  label: STRING_VALUE,
  heading: STRING_VALUE,
  name: STRING_VALUE,
};

const FORM_SHELL_VALUES: Readonly<Record<string, PropValueContract>> = {
  title: STRING_VALUE,
  label: STRING_VALUE,
  heading: STRING_VALUE,
  name: STRING_VALUE,
  description: STRING_VALUE,
  subtitle: STRING_VALUE,
  hint: STRING_VALUE,
};

const PROP_VALUE_CONTRACTS: Readonly<
  Record<GovernedComponentId, Readonly<Record<string, PropValueContract>>>
> = {
  VizAreaControls: { title: STRING_VALUE, value: valueContract('a Cartesian viz.render input fragment', isVizIntentFragment), channel: valueContract('a chart channel', value => ['x', 'y', 'color', 'size', 'shape'].includes(String(value))), disabled: BOOLEAN_VALUE },
  VizAxisControls: { title: STRING_VALUE, value: valueContract('a Cartesian viz.render input fragment', isVizIntentFragment), channel: valueContract('a chart channel', value => ['x', 'y', 'color', 'size', 'shape'].includes(String(value))), disabled: BOOLEAN_VALUE },
  VizColorControls: { title: STRING_VALUE, value: valueContract('a Cartesian viz.render input fragment', isVizIntentFragment), channel: valueContract('a chart channel', value => ['x', 'y', 'color', 'size', 'shape'].includes(String(value))), disabled: BOOLEAN_VALUE },
  VizHeatmapControls: { title: STRING_VALUE, value: valueContract('a Cartesian viz.render input fragment', isVizIntentFragment), channel: valueContract('a chart channel', value => ['x', 'y', 'color', 'size', 'shape'].includes(String(value))), disabled: BOOLEAN_VALUE },
  VizLineControls: { title: STRING_VALUE, value: valueContract('a Cartesian viz.render input fragment', isVizIntentFragment), channel: valueContract('a chart channel', value => ['x', 'y', 'color', 'size', 'shape'].includes(String(value))), disabled: BOOLEAN_VALUE },
  VizMarkControls: { title: STRING_VALUE, value: valueContract('a Cartesian viz.render input fragment', isVizIntentFragment), channel: valueContract('a chart channel', value => ['x', 'y', 'color', 'size', 'shape'].includes(String(value))), disabled: BOOLEAN_VALUE },
  VizOpacityControls: { title: STRING_VALUE, value: valueContract('a Cartesian viz.render input fragment', isVizIntentFragment), channel: valueContract('a chart channel', value => ['x', 'y', 'color', 'size', 'shape'].includes(String(value))), disabled: BOOLEAN_VALUE },
  VizPointControls: { title: STRING_VALUE, value: valueContract('a Cartesian viz.render input fragment', isVizIntentFragment), channel: valueContract('a chart channel', value => ['x', 'y', 'color', 'size', 'shape'].includes(String(value))), disabled: BOOLEAN_VALUE },
  VizScaleControls: { title: STRING_VALUE, value: valueContract('a Cartesian viz.render input fragment', isVizIntentFragment), channel: valueContract('a chart channel', value => ['x', 'y', 'color', 'size', 'shape'].includes(String(value))), disabled: BOOLEAN_VALUE },
  VizScatterControls: { title: STRING_VALUE, value: valueContract('a Cartesian viz.render input fragment', isVizIntentFragment), channel: valueContract('a chart channel', value => ['x', 'y', 'color', 'size', 'shape'].includes(String(value))), disabled: BOOLEAN_VALUE },
  VizShapeControls: { title: STRING_VALUE, value: valueContract('a Cartesian viz.render input fragment', isVizIntentFragment), channel: valueContract('a chart channel', value => ['x', 'y', 'color', 'size', 'shape'].includes(String(value))), disabled: BOOLEAN_VALUE },
  VizSizeControls: { title: STRING_VALUE, value: valueContract('a Cartesian viz.render input fragment', isVizIntentFragment), channel: valueContract('a chart channel', value => ['x', 'y', 'color', 'size', 'shape'].includes(String(value))), disabled: BOOLEAN_VALUE },
  VizColorLegendConfig: { title: STRING_VALUE, value: valueContract('a Cartesian viz.render input fragment', isVizIntentFragment), channel: valueContract('a chart channel', value => ['x', 'y', 'color', 'size', 'shape'].includes(String(value))), disabled: BOOLEAN_VALUE },
  VizShapeLegend: { title: STRING_VALUE, value: valueContract('a Cartesian viz.render input fragment', isVizIntentFragment), channel: valueContract('a chart channel', value => ['x', 'y', 'color', 'size', 'shape'].includes(String(value))), disabled: BOOLEAN_VALUE },
  VizAxisSummary: { title: STRING_VALUE, value: valueContract('a Cartesian viz.render input fragment', isVizIntentFragment), channel: valueContract('a chart channel', value => ['x', 'y', 'color', 'size', 'shape'].includes(String(value))) },
  VizOpacitySummary: { title: STRING_VALUE, value: valueContract('a Cartesian viz.render input fragment', isVizIntentFragment), channel: valueContract('a chart channel', value => ['x', 'y', 'color', 'size', 'shape'].includes(String(value))) },
  VizScaleSummary: { title: STRING_VALUE, value: valueContract('a Cartesian viz.render input fragment', isVizIntentFragment), channel: valueContract('a chart channel', value => ['x', 'y', 'color', 'size', 'shape'].includes(String(value))) },
  VizSizeSummary: { title: STRING_VALUE, value: valueContract('a Cartesian viz.render input fragment', isVizIntentFragment), channel: valueContract('a chart channel', value => ['x', 'y', 'color', 'size', 'shape'].includes(String(value))) },
  VizEncodingBadge: { title: STRING_VALUE, value: valueContract('a Cartesian viz.render input fragment', isVizIntentFragment), channel: valueContract('a chart channel', value => ['x', 'y', 'color', 'size', 'shape'].includes(String(value))) },
  VizRoleBadge: { title: STRING_VALUE, value: valueContract('a Cartesian viz.render input fragment', isVizIntentFragment), channel: valueContract('a chart channel', value => ['x', 'y', 'color', 'size', 'shape'].includes(String(value))) },
  VizHeatmapPreview: { svg: STATIC_SVG_VALUE, svgNarrow: STATIC_SVG_VALUE, svgWide: STATIC_SVG_VALUE, ...THEME_SVG_VALUES, title: STRING_VALUE, description: STRING_VALUE, width: NUMBER_VALUE, height: NUMBER_VALUE },
  VizLinePreview: { svg: STATIC_SVG_VALUE, svgNarrow: STATIC_SVG_VALUE, svgWide: STATIC_SVG_VALUE, ...THEME_SVG_VALUES, title: STRING_VALUE, description: STRING_VALUE, width: NUMBER_VALUE, height: NUMBER_VALUE },
  VizGraphPreview: { svg: STATIC_SVG_VALUE, svgNarrow: STATIC_SVG_VALUE, svgWide: STATIC_SVG_VALUE, ...THEME_SVG_VALUES, title: STRING_VALUE, description: STRING_VALUE, width: NUMBER_VALUE, height: NUMBER_VALUE },
  VizMarkPreview: { svg: STATIC_SVG_VALUE, svgNarrow: STATIC_SVG_VALUE, svgWide: STATIC_SVG_VALUE, ...THEME_SVG_VALUES, title: STRING_VALUE, description: STRING_VALUE, width: NUMBER_VALUE, height: NUMBER_VALUE },
  VizPointPreview: { svg: STATIC_SVG_VALUE, svgNarrow: STATIC_SVG_VALUE, svgWide: STATIC_SVG_VALUE, ...THEME_SVG_VALUES, title: STRING_VALUE, description: STRING_VALUE, width: NUMBER_VALUE, height: NUMBER_VALUE },
  VizScatterPreview: { svg: STATIC_SVG_VALUE, svgNarrow: STATIC_SVG_VALUE, svgWide: STATIC_SVG_VALUE, ...THEME_SVG_VALUES, title: STRING_VALUE, description: STRING_VALUE, width: NUMBER_VALUE, height: NUMBER_VALUE },
  AddressCollectionPanel: PANEL_SECTION_VALUES,
  AddressEditor: {
    ...FORM_SHELL_VALUES,
    street: STRING_VALUE, line1: STRING_VALUE, addressLine1: STRING_VALUE, city: STRING_VALUE,
    region: STRING_VALUE, state: STRING_VALUE, postalCode: STRING_VALUE, zip: STRING_VALUE,
  },
  PreferenceEditor: {
    ...FORM_SHELL_VALUES,
    namespaces: TAG_ITEMS_VALUE, namespace: STRING_VALUE, document: STRING_VALUE, json: STRING_VALUE, value: STRING_VALUE,
  },
  RoleAssignmentForm: {
    ...FORM_SHELL_VALUES,
    roles: TAG_ITEMS_VALUE, availableRoles: TAG_ITEMS_VALUE, role: STRING_VALUE, defaultRoleId: STRING_VALUE,
    assignee: STRING_VALUE, member: STRING_VALUE,
  },
  StatusSelector: {
    help: STRING_VALUE, label: STRING_VALUE, title: STRING_VALUE, options: TAG_ITEMS_VALUE, states: TAG_ITEMS_VALUE, value: STRING_VALUE, status: STRING_VALUE,
  },
  TagInput: {
    ...FORM_SHELL_VALUES,
    tags: TAG_ITEMS_VALUE, value: STRING_VALUE, placeholder: STRING_VALUE,
  },
  TemplatePicker: {
    ...FORM_SHELL_VALUES,
    templates: TAG_ITEMS_VALUE, options: TAG_ITEMS_VALUE, templateId: STRING_VALUE, value: STRING_VALUE,
    channels: TAG_ITEMS_VALUE, channel: STRING_VALUE,
  },
  AddressValidationTimeline: { ...TIMELINE_TITLE_VALUES, events: TAG_ITEMS_VALUE, validations: TAG_ITEMS_VALUE, history: TAG_ITEMS_VALUE },
  AuditEvent: Object.fromEntries([
    'label', 'title', 'event', 'status', 'state', 'reason', 'text', 'timestamp', 'datetime', 'time', 'at', 'createdAt', 'updatedAt',
    'detail', 'description', 'message', 'from', 'to', 'code',
  ].map((prop) => [prop, STRING_VALUE])),
  MembershipAuditTimeline: { ...TIMELINE_TITLE_VALUES, events: TAG_ITEMS_VALUE, memberships: TAG_ITEMS_VALUE, history: TAG_ITEMS_VALUE },
  MessageEventTimeline: { ...TIMELINE_TITLE_VALUES, events: TAG_ITEMS_VALUE, messages: TAG_ITEMS_VALUE, statuses: TAG_ITEMS_VALUE },
  PreferenceTimeline: { ...TIMELINE_TITLE_VALUES, events: TAG_ITEMS_VALUE, changes: TAG_ITEMS_VALUE, history: TAG_ITEMS_VALUE },
  AddressSummaryBadge: { ...BADGE_FAMILY_VALUES, role: STRING_VALUE },
  MessageStatusBadge: { ...BADGE_FAMILY_VALUES, delivery: STRING_VALUE },
  PreferenceSummaryBadge: { ...BADGE_FAMILY_VALUES, namespace: STRING_VALUE, version: STRING_VALUE },
  RoleBadgeList: {
    roles: TAG_ITEMS_VALUE,
    badges: TAG_ITEMS_VALUE,
    roleLabels: TAG_ITEMS_VALUE,
    value: TAG_ITEMS_VALUE,
    variant: STRING_VALUE,
    tone: STRING_VALUE,
    label: STRING_VALUE,
    text: STRING_VALUE,
  },
  TagPills: {
    tags: TAG_ITEMS_VALUE,
    value: TAG_ITEMS_VALUE,
    maxVisible: STRING_OR_NUMBER_VALUE,
    overflowLabel: STRING_VALUE,
  },
  MembershipPanel: PANEL_SECTION_VALUES,
  PreferencePanel: PANEL_SECTION_VALUES,
  TagManager: {
    title: STRING_VALUE,
    label: STRING_VALUE,
    heading: STRING_VALUE,
    name: STRING_VALUE,
    description: STRING_VALUE,
    subtitle: STRING_VALUE,
    hint: STRING_VALUE,
    tags: TAG_ITEMS_VALUE,
    value: TAG_ITEMS_VALUE,
  },
  ArchiveEvent: { title: STRING_VALUE, archivedAt: STRING_VALUE, restoredAt: STRING_VALUE, archivedBy: STRING_VALUE, reason: STRING_VALUE, showActor: BOOLEAN_VALUE, showReason: BOOLEAN_VALUE },
  CancellationEvent: { title: STRING_VALUE, timestamp: STRING_VALUE, reason: STRING_VALUE, code: STRING_VALUE, showReason: BOOLEAN_VALUE },
  StateTransitionEvent: { title: STRING_VALUE, history: valueContract('an array of trait records', Array.isArray), status: STRING_VALUE, showActor: BOOLEAN_VALUE, showReason: BOOLEAN_VALUE },
  ColorStatePicker: { title: STRING_VALUE, colorStates: STRING_ARRAY_VALUE, value: STRING_VALUE, disabled: BOOLEAN_VALUE },
  StatusColorLegend: { title: STRING_VALUE, colorStates: STRING_ARRAY_VALUE, value: STRING_VALUE, showTokenReferences: BOOLEAN_VALUE },
  CommunicationDetailPanel: { title: STRING_VALUE, channels: valueContract('an array of trait records', Array.isArray), templates: valueContract('an array of trait records', Array.isArray), policies: valueContract('an array of trait records', Array.isArray), conversations: valueContract('an array of trait records', Array.isArray) },
  GeoFieldMappingForm: { title: STRING_VALUE, latitude: STRING_VALUE, longitude: STRING_VALUE, identifier: STRING_VALUE, autoDetect: BOOLEAN_VALUE, embedded: BOOLEAN_VALUE, disabled: BOOLEAN_VALUE },
  GeoResolutionBadge: { resolution: STRING_VALUE },
  GeocodablePreview: { title: STRING_VALUE, resolution: STRING_VALUE, requiresLookup: BOOLEAN_VALUE, detectedFields: valueContract('an array of trait records', Array.isArray) },
  AuditSummaryCard: { title: STRING_VALUE, auditLog: RECORD_ARRAY_VALUE, lastN: NUMBER_VALUE, showTransitionCount: BOOLEAN_VALUE, showLastTransitionTime: BOOLEAN_VALUE, showLastActor: BOOLEAN_VALUE },
  SortIndicator: { label: STRING_VALUE, sortField: STRING_VALUE, sortDirection: STRING_VALUE, sortActive: BOOLEAN_VALUE, triStateSort: BOOLEAN_VALUE, sortableFields: STRING_ARRAY_VALUE, defaultSortField: STRING_VALUE, defaultSortDirection: STRING_VALUE },
  TimelineEntryLabel: { label: STRING_VALUE, text: STRING_VALUE, value: STRING_VALUE, maxLength: STRING_OR_NUMBER_VALUE, compact: BOOLEAN_VALUE },
  AuditTimeline: {
    title: STRING_VALUE,
    events: RECORD_ARRAY_VALUE,
    history: RECORD_ARRAY_VALUE,
    entries: RECORD_ARRAY_VALUE,
    auditLog: RECORD_ARRAY_VALUE,
    auditLogField: STRING_VALUE,
    createdField: STRING_VALUE,
    updatedField: STRING_VALUE,
    eventField: STRING_VALUE,
    eventTimestampField: STRING_VALUE,
    eventOptionsParameter: STRING_VALUE,
    maxVisible: NUMBER_VALUE,
    showFromState: BOOLEAN_VALUE,
    showActorId: BOOLEAN_VALUE,
    showReason: BOOLEAN_VALUE,
  },
  Badge: {
    content: STRING_OR_NUMBER_VALUE,
    status: STRING_VALUE,
    domain: STRING_VALUE,
    tone: TONE_VALUE,
    emphasis: EMPHASIS_VALUE,
    icon: STRING_OR_NUMBER_VALUE,
  },
  Banner: {
    title: STRING_VALUE,
    detail: STRING_VALUE,
    content: STRING_OR_NUMBER_VALUE,
    status: STRING_VALUE,
    domain: STRING_VALUE,
    tone: TONE_VALUE,
    emphasis: EMPHASIS_VALUE,
    dismissLabel: STRING_VALUE,
  },
  Button: {
    content: STRING_OR_NUMBER_VALUE,
    // s222-m02 (#2502 rulings 9 and 11): the six variants and the xs control size.
    intent: enumContract(['neutral', 'primary', 'secondary', 'outline', 'ghost', 'link', 'destructive', 'success', 'warning', 'danger']),
    size: enumContract(['xs', 'sm', 'md', 'lg']),
    disabled: BOOLEAN_VALUE,
    type: enumContract(['button', 'submit', 'reset']),
  },
  Card: {
    elevated: BOOLEAN_VALUE,
    as: enumContract(['div', 'section', 'article', 'aside']),
  },
  ArchiveSummary: { title: STRING_VALUE, label: STRING_VALUE, heading: STRING_VALUE, name: STRING_VALUE, isArchived: valueContract('a boolean or string', (value) => typeof value === 'boolean' || typeof value === 'string'), archived: valueContract('a boolean or string', (value) => typeof value === 'boolean' || typeof value === 'string'), status: valueContract('a boolean or string', (value) => typeof value === 'boolean' || typeof value === 'string'), archivedAt: valueContract('a string or null', (value) => typeof value === 'string' || value === null), reason: STRING_VALUE, archiveReason: STRING_VALUE, summary: STRING_VALUE, text: STRING_VALUE, description: STRING_VALUE },
  ArchivePill: { label: STRING_VALUE, text: STRING_VALUE, status: STRING_VALUE, state: STRING_VALUE, value: valueContract('a boolean or string', (value) => typeof value === 'boolean' || typeof value === 'string'), variant: STRING_VALUE, tone: TONE_VALUE, emphasis: EMPHASIS_VALUE, isArchived: valueContract('a boolean or string', (value) => typeof value === 'boolean' || typeof value === 'string') },
  CancellationForm: { embedded: BOOLEAN_VALUE, reasonHelp: STRING_VALUE, codeHelp: STRING_VALUE, title: STRING_VALUE, label: STRING_VALUE, heading: STRING_VALUE, name: STRING_VALUE, description: STRING_VALUE, subtitle: STRING_VALUE, hint: STRING_VALUE, allowedReasons: valueContract('an array of reason choices', Array.isArray), reasonCode: STRING_VALUE, reason: STRING_VALUE, cancellationReason: STRING_VALUE },
  CancellationBadge: { label: STRING_VALUE, text: STRING_VALUE, status: STRING_VALUE, state: STRING_VALUE, value: valueContract('a boolean or string', (value) => typeof value === 'boolean' || typeof value === 'string'), variant: STRING_VALUE, tone: TONE_VALUE, emphasis: EMPHASIS_VALUE, cancelAtPeriodEnd: valueContract('a boolean or string', (value) => typeof value === 'boolean' || typeof value === 'string'), isCancelled: valueContract('a boolean or string', (value) => typeof value === 'boolean' || typeof value === 'string') },
  CycleProgressCard: { progress: NUMBER_VALUE, periodStart: STRING_VALUE, periodEnd: STRING_VALUE, interval: STRING_VALUE, now: STRING_VALUE, title: STRING_VALUE },
  PaymentTimeline: { lastPayment: STRING_VALUE, nextPayment: STRING_VALUE, paymentStatus: STRING_VALUE, paymentMethod: STRING_VALUE, amount: NUMBER_VALUE, currency: STRING_VALUE, minorUnits: valueContract('a positive safe integer', (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1), title: STRING_VALUE },
  PaymentEventTimeline: { lastPayment: STRING_VALUE, nextPayment: STRING_VALUE, paymentStatus: STRING_VALUE, amount: NUMBER_VALUE, currency: STRING_VALUE, minorUnits: valueContract('a positive safe integer', (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1), title: STRING_VALUE },
  BillingCardMeta: { amount: NUMBER_VALUE, currency: STRING_VALUE, minorUnits: valueContract('a positive safe integer', (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1), interval: STRING_VALUE },
  ArchivedRowOverlay: { isArchived: BOOLEAN_VALUE, showBadge: BOOLEAN_VALUE, separateTab: BOOLEAN_VALUE, tabLabel: STRING_VALUE, label: STRING_VALUE, style: valueContract('grayed', (value) => value === 'grayed') },
  BillingSummaryBadge: { showInterval: BOOLEAN_VALUE, amount: NUMBER_VALUE, currency: STRING_VALUE, minorUnits: valueContract('a positive safe integer', (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1), interval: STRING_VALUE },
  BillingAmountInput: { help: STRING_VALUE, amount: NUMBER_VALUE, currency: STRING_VALUE, minorUnits: valueContract('a positive safe integer', (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1), label: STRING_VALUE, name: STRING_VALUE, disabled: BOOLEAN_VALUE },
  BillingIntervalSelector: { help: STRING_VALUE, interval: STRING_VALUE, intervals: NON_EMPTY_STRING_ARRAY_VALUE, label: STRING_VALUE, name: STRING_VALUE, disabled: BOOLEAN_VALUE },
  PriceCardMeta: { title: STRING_VALUE, label: STRING_VALUE, heading: STRING_VALUE, name: STRING_VALUE, model: STRING_VALUE, pricingModel: STRING_VALUE, interval: STRING_VALUE, billingInterval: STRING_VALUE },
  OwnerBadge: { label: STRING_VALUE, text: STRING_VALUE, owner: STRING_VALUE, ownerType: STRING_VALUE, value: STRING_VALUE, status: STRING_VALUE, state: STRING_VALUE, variant: STRING_VALUE, tone: TONE_VALUE, emphasis: EMPHASIS_VALUE },
  OwnershipSummary: { title: STRING_VALUE, label: STRING_VALUE, heading: STRING_VALUE, name: STRING_VALUE, ownerId: STRING_VALUE, owner_id: STRING_VALUE, ownerType: STRING_VALUE, owner_type: STRING_VALUE, role: STRING_VALUE, ownershipRole: STRING_VALUE, summary: STRING_VALUE, text: STRING_VALUE, description: STRING_VALUE },
  OwnershipMeta: { title: STRING_VALUE, label: STRING_VALUE, heading: STRING_VALUE, name: STRING_VALUE, ownerType: STRING_VALUE, owner_type: STRING_VALUE, role: STRING_VALUE, ownershipRole: STRING_VALUE },
  TagSummary: { title: STRING_VALUE, label: STRING_VALUE, heading: STRING_VALUE, name: STRING_VALUE, tagCount: STRING_OR_NUMBER_VALUE, count: STRING_OR_NUMBER_VALUE, tags: valueContract('a string or tag array', (value) => typeof value === 'string' || Array.isArray(value)), summary: STRING_VALUE, text: STRING_VALUE, description: STRING_VALUE },
  LabelCell: { label: STRING_VALUE, text: STRING_VALUE, value: STRING_VALUE, description: STRING_VALUE, subtitle: STRING_VALUE, sublabel: STRING_VALUE, supporting: STRING_VALUE, truncate: BOOLEAN_VALUE, maxLength: STRING_OR_NUMBER_VALUE },
  InlineLabel: { label: STRING_VALUE, text: STRING_VALUE, value: STRING_VALUE, maxLength: STRING_OR_NUMBER_VALUE },
  FormLabelGroup: { label: STRING_VALUE, text: STRING_VALUE, title: STRING_VALUE, placeholder: STRING_VALUE, hint: STRING_VALUE, description: STRING_VALUE, htmlFor: STRING_VALUE, for: STRING_VALUE, inputId: STRING_VALUE },
  ClassificationBadge: { label: STRING_VALUE, text: STRING_VALUE, category: STRING_VALUE, value: STRING_VALUE, status: STRING_VALUE, state: STRING_VALUE, mode: STRING_VALUE, variant: STRING_VALUE, tone: TONE_VALUE, emphasis: EMPHASIS_VALUE },
  ClassificationEditor: { title: STRING_VALUE, label: STRING_VALUE, heading: STRING_VALUE, name: STRING_VALUE, description: STRING_VALUE, subtitle: STRING_VALUE, hint: STRING_VALUE, category: STRING_VALUE, primaryCategory: STRING_VALUE, tags: valueContract('a string or array', (value) => typeof value === 'string' || Array.isArray(value)), modes: valueContract('an array of mode choices', Array.isArray), mode: STRING_VALUE, classificationMode: STRING_VALUE },
  CardHeader: {
    title: STRING_VALUE,
    label: STRING_VALUE,
    text: STRING_VALUE,
    supporting: STRING_VALUE,
    supportingText: STRING_VALUE,
    subtitle: STRING_VALUE,
    description: STRING_VALUE,
    level: HEADING_LEVEL_VALUE,
    as: HEADING_TAG_VALUE,
  },
  Checkbox: {
    id: STRING_VALUE,
    label: STRING_VALUE,
    checked: BOOLEAN_VALUE,
    defaultChecked: BOOLEAN_VALUE,
    required: BOOLEAN_VALUE,
    disabled: BOOLEAN_VALUE,
    help: STRING_VALUE,
    validation: VALIDATION_VALUE,
  },
  // s222-m02 (#2502 ruling 11): the two components 0.4.0 adds. A Dialog's actions are framework content (a React node or
  // a Vue slot), so a saved schema carries no value for them.
  Switch: {
    id: STRING_VALUE,
    label: STRING_VALUE,
    checked: BOOLEAN_VALUE,
    defaultChecked: BOOLEAN_VALUE,
    required: BOOLEAN_VALUE,
    disabled: BOOLEAN_VALUE,
    help: STRING_VALUE,
    validation: VALIDATION_VALUE,
    size: enumContract(['sm', 'md']),
  },
  Dialog: {
    id: STRING_VALUE,
    open: BOOLEAN_VALUE,
    modal: BOOLEAN_VALUE,
    title: STRING_VALUE,
    description: STRING_VALUE,
    dismissLabel: STRING_VALUE,
    size: SIZE_VALUE,
  },
  // s223-m02 (#2527 ruling 11): Combobox takes Select's { value, label, disabled? } options and the four control sizes.
  Combobox: {
    id: STRING_VALUE,
    label: STRING_VALUE,
    options: SELECT_OPTIONS_VALUE,
    value: STRING_VALUE,
    defaultValue: STRING_VALUE,
    placeholder: STRING_VALUE,
    name: STRING_VALUE,
    required: BOOLEAN_VALUE,
    disabled: BOOLEAN_VALUE,
    help: STRING_VALUE,
    validation: VALIDATION_VALUE,
    size: enumContract(['xs', 'sm', 'md', 'lg']),
  },
  ClassificationPanel: PANEL_SECTION_VALUES,
  CancellationSummary: {
    title: STRING_VALUE,
    label: STRING_VALUE,
    cancelAtPeriodEnd: BOOLEAN_VALUE,
    requestedAt: STRING_VALUE,
    reason: STRING_VALUE,
    code: STRING_VALUE,
    cancelAtPeriodEndField: STRING_VALUE,
    requestedAtField: STRING_VALUE,
    reasonField: STRING_VALUE,
    codeField: STRING_VALUE,
  },
  ColorSwatch: {
    color: STRING_VALUE,
    value: STRING_VALUE,
    state: STRING_VALUE,
    label: STRING_VALUE,
  },
  ColorizedBadge: {
    label: STRING_VALUE,
    text: STRING_VALUE,
    state: STRING_VALUE,
    value: STRING_VALUE,
    status: STRING_VALUE,
    color: STRING_VALUE,
    hue: STRING_VALUE,
    swatch: STRING_VALUE,
    variant: STRING_VALUE,
    tone: TONE_VALUE,
    emphasis: EMPHASIS_VALUE,
  },
  DatePicker: {
    id: STRING_VALUE,
    label: STRING_VALUE,
    value: STRING_VALUE,
    defaultValue: STRING_VALUE,
    min: STRING_VALUE,
    max: STRING_VALUE,
    step: STRING_OR_NUMBER_VALUE,
    required: BOOLEAN_VALUE,
    disabled: BOOLEAN_VALUE,
    readOnly: BOOLEAN_VALUE,
    help: STRING_VALUE,
    validation: VALIDATION_VALUE,
  },
  DetailHeader: {
    title: STRING_VALUE,
    label: STRING_VALUE,
    text: STRING_VALUE,
    subtitle: STRING_VALUE,
    sublabel: STRING_VALUE,
    description: STRING_VALUE,
    metadata: STRING_VALUE,
    meta: STRING_VALUE,
    level: HEADING_LEVEL_VALUE,
    as: HEADING_TAG_VALUE,
  },
  FilterPanel: {
    filters: RECORD_ARRAY_VALUE,
    activeFilters: RECORD_ARRAY_VALUE,
    mode: STRING_VALUE,
    collapsible: BOOLEAN_VALUE,
  },
  Grid: {
    columns: valueContract(
      'a finite number or "auto-fit"',
      (value) => value === 'auto-fit' || (typeof value === 'number' && Number.isFinite(value)),
    ),
    minColumnWidth: STRING_VALUE,
    gap: STRING_VALUE,
    align: STRING_VALUE,
    justify: STRING_VALUE,
  },
  Input: {
    id: STRING_VALUE,
    label: STRING_VALUE,
    type: STRING_VALUE,
    value: STRING_VALUE,
    defaultValue: STRING_VALUE,
    placeholder: STRING_VALUE,
    required: BOOLEAN_VALUE,
    disabled: BOOLEAN_VALUE,
    readOnly: BOOLEAN_VALUE,
    help: STRING_VALUE,
    validation: VALIDATION_VALUE,
  },
  PaginationBar: {
    page: NUMBER_VALUE,
    pageSize: NUMBER_VALUE,
    totalItems: NUMBER_VALUE,
    totalPages: NUMBER_VALUE,
    pageSizeOptions: NUMBER_ARRAY_VALUE,
    showPageSizeSelector: BOOLEAN_VALUE,
    showGotoPage: BOOLEAN_VALUE,
    showItemRange: BOOLEAN_VALUE,
    pageField: STRING_VALUE,
    pageSizeField: STRING_VALUE,
    totalItemsField: STRING_VALUE,
    totalPagesField: STRING_VALUE,
    pageSizeOptionsParameter: STRING_VALUE,
    showPageSizeSelectorParameter: STRING_VALUE,
    showGotoPageParameter: STRING_VALUE,
    showItemRangeParameter: STRING_VALUE,
  },
  PriceBadge: {
    amountCents: NUMBER_VALUE,
    unitAmountCents: NUMBER_VALUE,
    amount: NUMBER_VALUE,
    unitAmount: NUMBER_VALUE,
    currency: STRING_VALUE,
    currencyCode: STRING_VALUE,
    label: STRING_VALUE,
    value: STRING_OR_NUMBER_VALUE,
    emphasis: EMPHASIS_VALUE,
    amountField: STRING_VALUE,
    currencyField: STRING_VALUE,
    intervalField: STRING_VALUE,
    minorUnitsParameter: STRING_VALUE,
    minorUnits: NUMBER_VALUE,
  },
  RelativeTimestamp: {
    datetime: STRING_VALUE,
    timestamp: STRING_VALUE,
    value: STRING_VALUE,
    updatedAt: STRING_VALUE,
    createdAt: STRING_VALUE,
    relative: STRING_VALUE,
    label: STRING_VALUE,
    text: STRING_VALUE,
    timezone: STRING_VALUE,
    now: STRING_OR_NUMBER_VALUE,
    fallbackField: STRING_VALUE,
    timezoneParameter: STRING_VALUE,
  },
  SearchInput: {
    id: STRING_VALUE,
    label: STRING_VALUE,
    value: STRING_VALUE,
    defaultValue: STRING_VALUE,
    placeholder: STRING_VALUE,
    clearable: BOOLEAN_VALUE,
    debounceMs: NUMBER_VALUE,
    debounce: NUMBER_VALUE,
    minQueryLength: NUMBER_VALUE,
    disabled: BOOLEAN_VALUE,
    placeholderParameter: STRING_VALUE,
    debounceParameter: STRING_VALUE,
    minQueryLengthParameter: STRING_VALUE,
    clearableParameter: STRING_VALUE,
  },
  PriceSummary: {
    title: STRING_VALUE,
    label: STRING_VALUE,
    heading: STRING_VALUE,
    name: STRING_VALUE,
    amount: STRING_OR_NUMBER_VALUE,
    amountCents: STRING_OR_NUMBER_VALUE,
    unitAmountCents: STRING_OR_NUMBER_VALUE,
    currency: STRING_VALUE,
    currencyCode: STRING_VALUE,
    model: STRING_VALUE,
    pricingModel: STRING_VALUE,
    interval: STRING_VALUE,
    billingInterval: STRING_VALUE,
    summary: STRING_VALUE,
    text: STRING_VALUE,
    description: STRING_VALUE,
  },
  Select: {
    id: STRING_VALUE,
    label: STRING_VALUE,
    value: STRING_VALUE,
    defaultValue: STRING_VALUE,
    placeholder: STRING_VALUE,
    required: BOOLEAN_VALUE,
    disabled: BOOLEAN_VALUE,
    options: SELECT_OPTIONS_VALUE,
    help: STRING_VALUE,
    validation: VALIDATION_VALUE,
  },
  // s223-m02 (#2527 ruling 10).
  SegmentedControl: {
    id: STRING_VALUE,
    label: STRING_VALUE,
    options: SEGMENTED_OPTIONS_VALUE,
    value: STRING_VALUE,
    defaultValue: STRING_VALUE,
    name: STRING_VALUE,
    size: enumContract(['xs', 'sm', 'md', 'lg']),
    disabled: BOOLEAN_VALUE,
  },
  Stack: {
    direction: enumContract(['row', 'column']),
    gap: STRING_VALUE,
    align: STRING_VALUE,
    justify: STRING_VALUE,
    wrap: BOOLEAN_VALUE,
    patternComponent: enumContract([...PATTERN_COMPOSITE_COMPONENTS]),
    fields: NON_EMPTY_STRING_ARRAY_VALUE,
  },
  StatusBadge: {
    status: STRING_VALUE,
    value: STRING_VALUE,
    label: STRING_VALUE,
    content: STRING_OR_NUMBER_VALUE,
    domain: STRING_VALUE,
    tone: enumContract([
      'lifecycle', 'neutral', 'info', 'accent', 'positive', 'success', 'warning',
      'critical', 'danger',
    ]),
    emphasis: EMPHASIS_VALUE,
    showIcon: BOOLEAN_VALUE,
    variant: STRING_VALUE,
    statusField: STRING_VALUE,
    domainField: STRING_VALUE,
    readOnly: BOOLEAN_VALUE,
    compact: BOOLEAN_VALUE,
  },
  StatusTimeline: {
    title: STRING_VALUE,
    events: RECORD_ARRAY_VALUE,
    history: RECORD_ARRAY_VALUE,
    entries: RECORD_ARRAY_VALUE,
    stateHistory: RECORD_ARRAY_VALUE,
    status: STRING_VALUE,
    allowedTransitions: STRING_ARRAY_VALUE,
    historyField: STRING_VALUE,
    statesParameter: STRING_VALUE,
    showActorId: BOOLEAN_VALUE,
    showReason: BOOLEAN_VALUE,
    maxVisible: NUMBER_VALUE,
  },
  Table: {
    caption: STRING_VALUE,
    // s222-m02 (#2502 ruling 11): false hides the caption visually and keeps it as the table's name.
    showCaption: BOOLEAN_VALUE,
    columns: TABLE_COLUMNS_VALUE,
    rows: TABLE_ROWS_VALUE,
    density: enumContract(['compact']),
    selectable: BOOLEAN_VALUE,
  },
  Tabs: {
    items: TAB_ITEMS_VALUE,
    selectedId: STRING_VALUE,
    defaultSelectedId: STRING_VALUE,
    size: SIZE_VALUE,
    overflowLabel: STRING_VALUE,
    ariaLabel: STRING_VALUE,
  },
  Text: {
    content: STRING_OR_NUMBER_VALUE,
    label: STRING_VALUE,
    as: enumContract([
      'span', 'p', 'strong', 'em', 'small', 'div', 'label',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    ]),
    size: SIZE_VALUE,
    weight: enumContract(['regular', 'medium', 'semibold']),
  },
  Textarea: {
    id: STRING_VALUE,
    label: STRING_VALUE,
    value: STRING_VALUE,
    defaultValue: STRING_VALUE,
    rows: NUMBER_VALUE,
    placeholder: STRING_VALUE,
    required: BOOLEAN_VALUE,
    disabled: BOOLEAN_VALUE,
    readOnly: BOOLEAN_VALUE,
    help: STRING_VALUE,
    validation: VALIDATION_VALUE,
  },
  VizAreaPreview: {
    svg: STATIC_SVG_VALUE,
    svgNarrow: STATIC_SVG_VALUE,
    svgWide: STATIC_SVG_VALUE,
    ...THEME_SVG_VALUES,
    title: STRING_VALUE,
    description: STRING_VALUE,
    width: NUMBER_VALUE,
    height: NUMBER_VALUE,
  },
};

function propValueContract(
  component: GovernedComponentId,
  prop: string,
): PropValueContract | undefined {
  const componentRules = Object.hasOwn(PROP_VALUE_CONTRACTS, component)
    ? PROP_VALUE_CONTRACTS[component]
    : undefined;
  const canonical = componentRules && Object.hasOwn(componentRules, prop)
    ? componentRules[prop]
    : undefined;
  if (canonical) return canonical;
  if (component === 'Tabs' && prop === 'aria-label') return STRING_VALUE;
  if (GENERIC_PROPS.has(prop)) return STRING_VALUE;
  const extensions = Object.hasOwn(CROSS_TARGET_PROP_EXTENSIONS, component)
    ? CROSS_TARGET_PROP_EXTENSIONS[component]
    : undefined;
  if (extensions?.has(prop)) {
    return Object.hasOwn(EXTENSION_VALUE_CONTRACTS, prop) ? EXTENSION_VALUE_CONTRACTS[prop]! : STRING_VALUE;
  }
  if (prop.startsWith('data-')) return ATTRIBUTE_VALUE;
  if (prop.startsWith('aria-') && Object.hasOwn(ARIA_VALUE_CONTRACTS, prop)) {
    return ARIA_VALUE_CONTRACTS[prop];
  }
  return undefined;
}

function isKnownAriaProp(prop: string): boolean {
  return Object.hasOwn(ARIA_VALUE_CONTRACTS, prop);
}

function valueType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number' && !Number.isFinite(value)) return 'non-finite number';
  return typeof value;
}
const CONTRACT_CHECK_ORDER: readonly CodegenValidationCheck[] = [
  'props-contract',
  'slots-contract',
  'events-contract',
];

function nodesInDocumentOrder(screens: readonly UiElement[]): UiElement[] {
  const nodes: UiElement[] = [];
  const stack = [...screens].reverse();
  while (stack.length > 0) {
    const node = stack.pop()!;
    nodes.push(node);
    if (node.children) stack.push(...node.children.slice().reverse());
  }
  return nodes;
}

function contractFor(component: string) {
  if (Object.hasOwn(componentContracts, component)) {
    return componentContracts[component as keyof typeof componentContracts];
  }
  return undefined;
}

function semanticEventName(bindingEvent: string): string {
  if (!bindingEvent.startsWith('on') || bindingEvent.length <= 2) return bindingEvent;
  return `${bindingEvent[2]!.toLowerCase()}${bindingEvent.slice(3)}`;
}

function issue(message: string, node?: UiElement): CodegenIssue {
  return {
    code: 'OODS-V007',
    message,
    ...(node ? { nodeId: node.id, component: node.component } : {}),
  };
}

type FieldValueKind = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'unknown';

function fieldValueKind(entry: FieldSchemaEntry): FieldValueKind {
  if (entry.enum?.length) return 'string';
  // Nullable data retains its field kind; emitters handle the empty control value.
  const type = entry.type.replace(/\?$/, '');
  if (type.endsWith('[]')) return 'array';
  if (['string', 'datetime', 'email', 'date', 'url', 'uuid'].includes(type)) {
    return 'string';
  }
  if (type === 'integer' || type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';
  if (type === 'object') return 'object';
  if (type === 'array') return 'array';
  return 'unknown';
}

function acceptedFieldKinds(
  framework: CodegenFramework,
  component: string,
  propName: string | undefined,
  isChildren: boolean,
  localStateType: string | undefined,
): readonly FieldValueKind[] {
  // Data props a generic field lowers to are independent of any local form state on the node.
  if ((propName === 'isArchived' && component === 'ArchivePill') || (propName === 'cancelAtPeriodEnd' && component === 'CancellationBadge')) return ['string', 'boolean'];
  if (propName === 'tags' && component === 'TagSummary') return ['string', 'array'];
  if (propName === 'filters' && component === 'FilterPanel') return ['array'];
  if (propName === 'tags' && (component === 'TagManager' || component === 'TagPills' || component === 'TagInput')) return ['array'];
  if (propName === 'role' && component === 'AddressSummaryBadge') return ['string'];
  if (propName === 'events' && (component === 'AddressValidationTimeline' || component === 'MembershipAuditTimeline')) return ['array'];
  if (localStateType === 'boolean') return ['boolean'];
  if (localStateType === 'string') return ['string', 'number', 'boolean'];
  if (propName === 'checked') return ['boolean'];
  if (propName === 'value') {
    if (component === 'Select') {
      return framework === 'vue'
        ? ['string', 'boolean']
        : ['string', 'number', 'boolean'];
    }
    return framework === 'vue' ? ['string'] : ['string', 'number'];
  }
  if (propName === 'content') return ['string', 'number'];
  if (propName === 'description' && component === 'ClassificationEditor') return ['string'];
  if (propName === 'label' && ['LabelCell', 'InlineLabel', 'TimelineEntryLabel', 'FormLabelGroup'].includes(component)) return ['string'];
  if (propName === 'label' && component === 'PriceBadge') return ['string', 'number'];
  if (propName === 'datetime' && component === 'RelativeTimestamp') return ['string'];
  if (propName === 'status') return ['string'];
  if (isChildren) {
    // Both emitters explicitly lower boolean text to Yes/No (null stays empty).
    return component === 'Text' ? ['string', 'number', 'boolean', 'array'] : ['string', 'number'];
  }
  return [];
}

function fieldContractIssues(
  node: UiElement,
  schema: UiSchema,
  framework: CodegenFramework,
  localStateType: string | undefined,
): CodegenIssue[] {
  const fieldName = node.props?.field;
  if (typeof fieldName !== 'string') return [];
  const fieldEntry = ownFieldSchemaEntry(schema.objectSchema, fieldName);
  if (!fieldEntry) {
    return [issue(
      `Field ${JSON.stringify(fieldName)} referenced by ${node.component} does not exist in objectSchema.`,
      node,
    )];
  }
  // The field exists; this container names its collection without any
  // renderer reading it as data, so the directive is consumed unbound.
  if (FIELD_CONSUMED_UNBOUND.has(node.component)) return [];
  // A pattern-group Stack's generic field restates its first `fields` entry;
  // the composition lowering presents the fields, so the Stack reads none.
  if (node.component === 'Stack' && node.props?.patternComponent !== undefined) return [];

  const resolution = resolveFrameworkChildContent(node, schema.objectSchema);
  if (!resolution) {
    return [issue(
      `Field ${JSON.stringify(fieldName)} cannot be represented by ${node.component} on the `
      + `${framework} target; generation would discard the binding.`,
      node,
    )];
  }

  const actualKind = fieldValueKind(fieldEntry);
  const acceptedKinds = acceptedFieldKinds(
    framework,
    node.component,
    resolution.propName,
    resolution.isChildren,
    localStateType,
  );
  if (!acceptedKinds.includes(actualKind)) {
    const targetSurface = resolution.isChildren
      ? `${node.component} children`
      : `${node.component}.${resolution.propName}`;
    return [issue(
      `Field ${JSON.stringify(fieldName)} has ${actualKind} data, which cannot bind to `
      + `${targetSurface} on the ${framework} target; accepted field kinds: `
      + `${acceptedKinds.join(', ') || 'none'}.`,
      node,
    )];
  }
  return [];
}

function compositionDirectiveIssues(node: UiElement, schema: UiSchema): CodegenIssue[] {
  if (node.component !== 'Stack') return [];
  const patternComponent = node.props?.patternComponent;
  const fields = node.props?.fields;
  if (patternComponent === undefined && fields === undefined) return [];
  if (patternComponent === undefined || fields === undefined) {
    return [issue(
      'Stack composition directives require patternComponent and fields together.',
      node,
    )];
  }
  if (typeof patternComponent !== 'string' || !PATTERN_COMPOSITE_COMPONENTS.includes(patternComponent) || !Array.isArray(fields)) return [];

  return fields.flatMap((field) => (
    typeof field === 'string' && !ownFieldSchemaEntry(schema.objectSchema, field)
      ? [issue(
          `Composition field ${JSON.stringify(field)} referenced by Stack does not exist in objectSchema.`,
          node,
        )]
      : []
  ));
}

const HEADER_RECIPE_FIELDS: Readonly<Record<string, readonly string[]>> = {
  CardHeader: ['titleField', 'supportingField'],
  DetailHeader: ['titleField', 'subtitleField'],
};

function headerRecipeFieldIssues(node: UiElement, schema: UiSchema): CodegenIssue[] {
  if (!Object.hasOwn(HEADER_RECIPE_FIELDS, node.component)) return [];
  return HEADER_RECIPE_FIELDS[node.component]!.flatMap((prop) => {
    const field = node.props?.[prop];
    // The ordinary prop value check diagnoses non-string directives.
    if (typeof field !== 'string') return [];
    const entry = ownFieldSchemaEntry(schema.objectSchema, field);
    if (!entry) return [issue(
      `Field ${JSON.stringify(field)} referenced by ${node.component}.${prop} does not exist in objectSchema.`,
      node,
    )];
    const numericRecordTitle = prop === 'titleField' && entry.semanticType === 'text.label' && /^(integer|number)\??$/.test(entry.type);
    if (fieldValueKind(entry) !== 'string' && !numericRecordTitle) return [issue(
      `Field ${JSON.stringify(field)} referenced by ${node.component}.${prop} must contain string data.`,
      node,
    )];
    return [];
  });
}

/** Validate governed props, default-slot use, and supported event mappings. */
export function preflightTargetContracts(
  schema: UiSchema,
  framework: CodegenFramework,
): {
  checks: CodegenValidationCheck[];
  issues: CodegenIssue[];
  bindingSafetyIssues: CodegenIssue[];
  /** Display onChange bindings that name no writer; advisory, never blocking. */
  inertSubscriptions: BindingAnalysis['inertSubscriptions'];
} {
  const normalized = normalizeSchemaForFramework(schema, framework);
  const nodes = nodesInDocumentOrder(normalized.screens);
  const bindingAnalysis = analyzeBindings(normalized.screens);
  const hasGovernedComponent = nodes.some((node) => contractFor(node.component) !== undefined);
  const issues: CodegenIssue[] = [];

  for (const node of nodes) {
    const contract = contractFor(node.component);
    if (!contract) continue;
    const localStateType = bindingAnalysis.occurrences.find((occurrence) => (
      occurrence.kind === 'local' && occurrence.nodeId === node.id
    ))?.signature?.parameters[0]?.type;
    issues.push(...fieldContractIssues(node, normalized, framework, localStateType));
    issues.push(...compositionDirectiveIssues(node, normalized));
    issues.push(...headerRecipeFieldIssues(node, normalized));
    const enrichedProps = resolveFieldProps(node, schema.objectSchema);
    const props: Record<string, unknown> = {
      ...(node.props ?? {}),
      ...(enrichedProps ?? {}),
    };
    // Button/Badge field values are emitted through canonical content; their
    // legacy label enrichment is intentionally suppressed by both emitters.
    if (
      (node.component === 'Button' || node.component === 'Badge')
      && node.props?.label === undefined
    ) {
      delete props.label;
    }
    // s221-m02: a contract lists its composition directives apart from its props; a saved schema may author either.
    const allowedProps = new Set([...contract.props, ...(contract.directives ?? [])]);
    const component = node.component as GovernedComponentId;
    const targetExtensions = Object.hasOwn(CROSS_TARGET_PROP_EXTENSIONS, component)
      ? CROSS_TARGET_PROP_EXTENSIONS[component]
      : undefined;
    const requiredProps = Object.hasOwn(REQUIRED_PROPS, component)
      ? REQUIRED_PROPS[component]
      : undefined;
    for (const requiredProp of requiredProps ?? []) {
      if (props[requiredProp] === undefined) {
        issues.push(issue(
          `Required prop ${JSON.stringify(requiredProp)} is missing from the canonical `
          + `${node.component} contract.`,
          node,
        ));
      }
    }
    for (const prop of Object.keys(props).sort()) {
      const isDefaultSlotContent = prop === 'children' && contract.slots.includes('default');
      if (
        !allowedProps.has(prop)
        && !GENERIC_PROPS.has(prop)
        && !targetExtensions?.has(prop)
        && !prop.startsWith('data-')
        && !(prop.startsWith('aria-') && isKnownAriaProp(prop))
        && !isDefaultSlotContent
      ) {
        issues.push(issue(
          `Prop ${JSON.stringify(prop)} is not in the canonical ${node.component} contract.`,
          node,
        ));
        continue;
      }

      const value = props[prop];
      const valueRule = propValueContract(component, prop);
      if (value !== undefined && valueRule && !valueRule.accepts(value)) {
        issues.push(issue(
          `Prop ${JSON.stringify(prop)} on ${node.component} must be ${valueRule.expected}; `
          + `received ${valueType(value)}.`,
          node,
        ));
      }
    }

    const childrenUseTabsPanelSlot = node.component === 'Tabs'
      && contract.slots.includes('panel');
    if (node.children?.length && !contract.slots.includes('default') && !childrenUseTabsPanelSlot) {
      issues.push(issue(
        `Component ${node.component} has children but its canonical contract has no default slot.`,
        node,
      ));
    }
  }

  const bindingSafetyIssues = bindingAnalysis.issues.map((bindingIssue): CodegenIssue => ({
    code: 'OODS-V007',
    message: bindingIssue.message,
    ...(bindingIssue.nodeId ? { nodeId: bindingIssue.nodeId } : {}),
    ...(bindingIssue.component ? { component: bindingIssue.component } : {}),
  }));

  for (const occurrence of bindingAnalysis.occurrences) {
    if (occurrence.scope !== 'component') continue;
    const contract = contractFor(occurrence.component);
    if (!contract) continue;
    const eventName = semanticEventName(occurrence.event);
    if (!contract.events.includes(eventName)) {
      issues.push({
        code: 'OODS-V007',
        message:
          `Binding ${occurrence.component}.${occurrence.event} does not map to a canonical `
          + `${occurrence.component} event.`,
        nodeId: occurrence.nodeId,
        component: occurrence.component,
      });
    }
  }

  return {
    checks: CONTRACT_CHECK_ORDER.filter((check) => (
      check === 'events-contract' || hasGovernedComponent
    )),
    issues,
    bindingSafetyIssues,
    inertSubscriptions: bindingAnalysis.inertSubscriptions,
  };
}
