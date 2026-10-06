import type { VNodeChild } from 'vue';

export type ComponentTone =
  | 'neutral'
  | 'info'
  | 'accent'
  | 'positive'
  | 'success'
  | 'warning'
  | 'critical'
  | 'danger';
export type ComponentEmphasis = 'subtle' | 'solid';
export type ComponentSize = 'sm' | 'md' | 'lg';
// s222-m02 (#2502 ruling 9): a button also has the 24px xs control size.
export type ButtonSize = 'xs' | ComponentSize;
// s222-m02 (#2502 ruling 11): the six variants, beside the neutral default and the two status intents.
export type ButtonIntent = 'neutral' | 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive' | 'success' | 'warning' | 'danger';
export type LayoutGap = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | string;

export type ValidationMessage = {
  state: 'error' | 'warning' | 'success';
  message: string;
};

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

/** s223-m02 (#2527 ruling 11): a combobox option, Select's shape; its label is text, because typing filters the list on it. */
export type ComboboxOption = SelectOption;

export type TableColumn = {
  key: string;
  label: string;
};

export type TableRecord = {
  id: string;
  [key: string]: unknown;
};

export type TabItem = {
  id: string;
  label: VNodeChild;
  panel: VNodeChild;
  disabled?: boolean;
  /** Compatibility alias for existing OODS item fixtures. */
  isDisabled?: boolean;
};

export type TextElement =
  | 'span'
  | 'p'
  | 'strong'
  | 'em'
  | 'small'
  | 'div'
  | 'label'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6';

export type HeaderElement = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
export type HeaderLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type DetailHeaderProps = {
  title?: string;
  label?: string;
  text?: string;
  subtitle?: string;
  sublabel?: string;
  description?: string;
  metadata?: string;
  meta?: string;
  level?: HeaderLevel;
  as?: HeaderElement;
};

export type CardHeaderProps = {
  title?: string;
  label?: string;
  text?: string;
  supporting?: string;
  supportingText?: string;
  subtitle?: string;
  description?: string;
  level?: HeaderLevel;
  as?: HeaderElement;
};

export type ColorSwatchProps = {
  color?: string;
  value?: string;
  state?: string;
  label?: string;
};

export type ColorizedBadgeProps = {
  label?: string;
  text?: string;
  state?: string;
  value?: string;
  status?: string;
  color?: string;
  hue?: string;
  swatch?: string;
  variant?: string;
  tone?: ComponentTone;
  emphasis?: ComponentEmphasis;
};

export type VizAreaPreviewProps = {
  svg?: string;
  title?: string;
  description?: string;
  width?: number;
  height?: number;
};

/** renderPanelSection aliases shared by every panel-family component. */
export type PanelSectionProps = {
  title?: string;
  label?: string;
  heading?: string;
  name?: string;
  subtitle?: string;
  description?: string;
  metadata?: string;
  summary?: string;
  text?: string;
  body?: string;
  emptyMessage?: string;
};

export type ClassificationPanelProps = PanelSectionProps;
export type AddressCollectionPanelProps = PanelSectionProps;
export type MembershipPanelProps = PanelSectionProps;
export type PreferencePanelProps = PanelSectionProps;

export type TagManagerProps = {
  title?: string;
  label?: string;
  heading?: string;
  name?: string;
  description?: string;
  subtitle?: string;
  hint?: string;
  /** Tag entries as the HTML renderer reads them: records use label/name/role/value/id, scalars render as text. */
  tags?: readonly unknown[];
  value?: readonly unknown[];
};

/** Shared shape of the badge-family summaries over the Badge substrate. */
type BadgeFamilyProps = {
  label?: string;
  text?: string;
  value?: string;
  status?: string;
  state?: string;
  variant?: string;
  tone?: ComponentTone;
  emphasis?: ComponentEmphasis;
};

/** role is the address role that names the status; never an ARIA role. */
export type AddressSummaryBadgeProps = BadgeFamilyProps & { role?: string };
export type MessageStatusBadgeProps = BadgeFamilyProps & { delivery?: string };
export type PreferenceSummaryBadgeProps = BadgeFamilyProps & { namespace?: string; version?: string };

export type RoleBadgeListProps = {
  roles?: readonly unknown[];
  badges?: readonly unknown[];
  roleLabels?: readonly unknown[];
  value?: readonly unknown[];
  variant?: string;
  tone?: string;
  label?: string;
  text?: string;
};

export type TagPillsProps = {
  tags?: readonly unknown[];
  value?: readonly unknown[];
  maxVisible?: number | string;
  overflowLabel?: string;
};

/** Timeline-family logs over renderTimelineContainer semantics; the event keys differ per family. */
type TimelineFamilyProps = {
  title?: string;
  label?: string;
  heading?: string;
  name?: string;
  events?: readonly unknown[];
};

export type AddressValidationTimelineProps = TimelineFamilyProps & { validations?: readonly unknown[]; history?: readonly unknown[] };
export type MembershipAuditTimelineProps = TimelineFamilyProps & { memberships?: readonly unknown[]; history?: readonly unknown[] };
export type MessageEventTimelineProps = TimelineFamilyProps & { messages?: readonly unknown[]; statuses?: readonly unknown[] };
export type PreferenceTimelineProps = TimelineFamilyProps & { changes?: readonly unknown[]; history?: readonly unknown[] };

export type AuditEventProps = {
  label?: string;
  title?: string;
  event?: string;
  status?: string;
  state?: string;
  reason?: string;
  text?: string;
  timestamp?: string;
  datetime?: string;
  time?: string;
  at?: string;
  createdAt?: string;
  updatedAt?: string;
  detail?: string;
  description?: string;
  message?: string;
  from?: string;
  to?: string;
  code?: string;
};

/** renderFormContainer aliases shared by every form-family component. */
type FormShellProps = {
  title?: string;
  label?: string;
  heading?: string;
  name?: string;
  description?: string;
  subtitle?: string;
  hint?: string;
};

/** The record an AddressEditor hands its consumer on every edit. */
export type AddressEditorValue = { street: string; city: string; region: string; postalCode: string };

export type AddressEditorProps = FormShellProps & {
  street?: string; line1?: string; addressLine1?: string; city?: string; region?: string; state?: string; postalCode?: string; zip?: string;
};
export type PreferenceEditorProps = FormShellProps & {
  namespaces?: readonly unknown[]; namespace?: string; document?: string; json?: string; value?: string;
};
export type RoleAssignmentFormProps = FormShellProps & {
  roles?: readonly unknown[]; availableRoles?: readonly unknown[]; role?: string; defaultRoleId?: string; assignee?: string; member?: string;
};
export type StatusSelectorProps = {
  label?: string; title?: string; options?: readonly unknown[]; states?: readonly unknown[]; value?: string; status?: string; modelValue?: string;
};
export type TagInputProps = FormShellProps & {
  tags?: readonly unknown[]; value?: string; placeholder?: string; modelValue?: string;
};
export type TemplatePickerProps = FormShellProps & {
  templates?: readonly unknown[]; options?: readonly unknown[]; templateId?: string; value?: string; channels?: readonly unknown[]; channel?: string;
};

/** A saved-schema filter descriptor; the renderer reads label and field, exactly as the HTML renderer does. */
export type FilterDescriptor = Readonly<Record<string, unknown>>;

export type FilterPanelProps = {
  filters?: readonly FilterDescriptor[];
  activeFilters?: readonly FilterDescriptor[];
  mode?: string;
  collapsible?: boolean;
};

export type PriceSummaryProps = {
  title?: string;
  label?: string;
  heading?: string;
  name?: string;
  amount?: string | number;
  amountCents?: string | number;
  unitAmountCents?: string | number;
  minorUnits?: number;
  currency?: string;
  currencyCode?: string;
  model?: string;
  pricingModel?: string;
  interval?: string;
  billingInterval?: string;
  summary?: string;
  text?: string;
  description?: string;
};

export type InlineLabelProps = { label?: string; text?: string; value?: string; maxLength?: number | string };
export type LabelCellProps = InlineLabelProps & {
  description?: string; subtitle?: string; sublabel?: string; supporting?: string; truncate?: boolean;
};
export type FormLabelGroupProps = { label?: string; text?: string; title?: string; placeholder?: string; hint?: string; description?: string; htmlFor?: string; for?: string; inputId?: string };
export type ClassificationBadgeProps = { label?: string; text?: string; category?: string; value?: string; status?: string; state?: string; mode?: string; variant?: string; tone?: ComponentTone; emphasis?: ComponentEmphasis };
export type ClassificationEditorProps = {
  title?: string; label?: string; heading?: string; name?: string; description?: string; subtitle?: string; hint?: string;
  category?: string; primaryCategory?: string; tags?: string | readonly unknown[]; modes?: readonly unknown[]; mode?: string; classificationMode?: string;
};

export type OwnerBadgeProps = Omit<ClassificationBadgeProps, 'category' | 'mode'> & { owner?: string; ownerType?: string };
export type OwnershipSummaryProps = {
  title?: string; label?: string; heading?: string; name?: string;
  ownerLabel?: string; ownerId?: string; owner_id?: string; ownerType?: string; owner_type?: string; role?: string; ownershipRole?: string;
  summary?: string; text?: string; description?: string;
};
export type OwnershipMetaProps = {
  title?: string; label?: string; heading?: string; name?: string;
  ownerType?: string; owner_type?: string; role?: string; ownershipRole?: string;
};
export type TagSummaryProps = {
  title?: string; label?: string; heading?: string; name?: string;
  tagCount?: number | string; count?: number | string; tags?: string | readonly unknown[];
  summary?: string; text?: string; description?: string;
};

export type ArchiveSummaryProps = {
  title?: string; label?: string; heading?: string; name?: string;
  isArchived?: boolean | string; archived?: boolean | string; status?: boolean | string;
  archivedAt?: string | null; reason?: string; archiveReason?: string; summary?: string; text?: string; description?: string;
};
export type ArchivePillProps = Omit<ClassificationBadgeProps, 'category' | 'mode' | 'value'> & { isArchived?: boolean | string; value?: boolean | string };
export type CancellationBadgeProps = Omit<ClassificationBadgeProps, 'category' | 'mode' | 'value'> & { cancelAtPeriodEnd?: boolean | string; isCancelled?: boolean | string; value?: boolean | string };
export type CancellationFormProps = {
  title?: string; label?: string; heading?: string; name?: string; description?: string; subtitle?: string; hint?: string;
  allowedReasons?: readonly unknown[]; reasonCode?: string; reason?: string; cancellationReason?: string;
};
export type PriceCardMetaProps = {
  title?: string; label?: string; heading?: string; name?: string;
  model?: string; pricingModel?: string; interval?: string; billingInterval?: string;
};
