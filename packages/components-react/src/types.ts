import type * as React from 'react';

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
export type FieldDensity = 'compact' | 'comfortable';

export type FieldValidation = {
  readonly state: 'error' | 'warning' | 'success' | 'info';
  readonly message?: React.ReactNode;
  readonly id?: string;
};

export interface BadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'content'> {
  readonly content?: React.ReactNode;
  readonly status?: string;
  readonly domain?: string;
  readonly tone?: ComponentTone;
  readonly emphasis?: ComponentEmphasis;
  readonly icon?: React.ReactNode;
  readonly iconPosition?: 'start' | 'end';
  readonly showIcon?: boolean;
}

export interface BannerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'content' | 'title'> {
  readonly title?: React.ReactNode;
  readonly detail?: React.ReactNode;
  readonly description?: React.ReactNode;
  readonly content?: React.ReactNode;
  readonly status?: string;
  readonly domain?: string;
  readonly tone?: ComponentTone;
  readonly emphasis?: ComponentEmphasis;
  readonly icon?: React.ReactNode;
  readonly actions?: React.ReactNode;
  readonly onDismiss?: () => void;
  readonly dismissLabel?: string;
  readonly showIcon?: boolean;
  readonly children?: React.ReactNode;
}

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'content'> {
  readonly content?: React.ReactNode;
  readonly children?: React.ReactNode;
  readonly asChild?: boolean;
  readonly intent?: ButtonIntent;
  readonly size?: ButtonSize;
  readonly onActivate?: React.MouseEventHandler<HTMLElement>;
}

type NativeDialogProps = Omit<
  React.DialogHTMLAttributes<HTMLDialogElement>,
  'open' | 'title' | 'children' | 'className' | 'style' | 'onClose' | 'onCancel'
>;

/**
 * s222-m02 (#2502 ruling 11): a native dialog whose consumer owns open. onClose reports the close control, Escape or a
 * browser close request; modal (default true) opens it with showModal(), and modal false shows it in place.
 */
export interface DialogProps extends NativeDialogProps {
  readonly id?: string;
  readonly open?: boolean;
  readonly modal?: boolean;
  readonly title: React.ReactNode;
  readonly description?: React.ReactNode;
  readonly dismissLabel?: string;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly actions?: React.ReactNode;
  readonly children?: React.ReactNode;
  readonly className?: string;
  readonly style?: React.CSSProperties;
  readonly onClose?: () => void;
}

export type SafeContainerElement = 'div' | 'section' | 'article' | 'aside' | 'main';

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  readonly elevated?: boolean;
  readonly as?: SafeContainerElement;
}

export type HeaderElement = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
export type HeaderLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface DetailHeaderProps extends React.HTMLAttributes<HTMLElement> {
  readonly title?: string;
  readonly label?: string;
  readonly text?: string;
  readonly subtitle?: string;
  readonly sublabel?: string;
  readonly description?: string;
  readonly metadata?: string;
  readonly meta?: string;
  readonly level?: HeaderLevel;
  readonly as?: HeaderElement;
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLElement> {
  readonly title?: string;
  readonly label?: string;
  readonly text?: string;
  readonly supporting?: string;
  readonly supportingText?: string;
  readonly subtitle?: string;
  readonly description?: string;
  readonly level?: HeaderLevel;
  readonly as?: HeaderElement;
}

export interface ColorSwatchProps extends React.HTMLAttributes<HTMLSpanElement> {
  readonly color?: string;
  readonly value?: string;
  readonly state?: string;
  readonly label?: string;
}

export interface ColorizedBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  readonly label?: string;
  readonly text?: string;
  readonly state?: string;
  readonly value?: string;
  readonly status?: string;
  readonly color?: string;
  readonly hue?: string;
  readonly swatch?: string;
  readonly variant?: string;
  readonly tone?: ComponentTone;
  readonly emphasis?: ComponentEmphasis;
}

export interface VizAreaPreviewProps extends React.HTMLAttributes<HTMLElement> {
  readonly svg?: string;
  /** The same chart rendered at the narrow size; the figure shows it instead of svg when its own inline size is at most 600px. */
  readonly svgNarrow?: string;
  /** The same chart rendered at the wide size; the figure shows it instead of svg when its own inline size is at least 900px. */
  readonly svgWide?: string;
  /**
   * s222-m02 (F7): the same chart rendered in the dark and high-contrast themes, at the design, narrow and wide sizes. With
   * any of them, svg, svgNarrow and svgWide are the light renders, and the figure shows the renders of the theme the
   * nearest [data-theme] names.
   */
  readonly svgDark?: string;
  readonly svgDarkNarrow?: string;
  readonly svgDarkWide?: string;
  readonly svgHc?: string;
  readonly svgHcNarrow?: string;
  readonly svgHcWide?: string;
  readonly description?: string;
  readonly width?: number;
  readonly height?: number;
}

/** renderPanelSection aliases shared by every panel-family component. */
export interface PanelSectionProps extends React.HTMLAttributes<HTMLElement> {
  readonly title?: string;
  readonly label?: string;
  readonly heading?: string;
  readonly name?: string;
  readonly subtitle?: string;
  readonly description?: string;
  readonly metadata?: string;
  readonly summary?: string;
  readonly text?: string;
  readonly body?: string;
  readonly emptyMessage?: string;
}

export type ClassificationPanelProps = PanelSectionProps;
export type AddressCollectionPanelProps = PanelSectionProps;
export type MembershipPanelProps = PanelSectionProps;
export type PreferencePanelProps = PanelSectionProps;

export interface TagManagerProps extends React.FormHTMLAttributes<HTMLFormElement> {
  readonly title?: string;
  readonly label?: string;
  readonly heading?: string;
  readonly name?: string;
  readonly description?: string;
  readonly subtitle?: string;
  readonly hint?: string;
  /** Tag entries as the HTML renderer reads them: records use label/name/role/value/id, scalars render as text. */
  readonly tags?: readonly unknown[];
  readonly value?: readonly unknown[];
}

/** Shared shape of the badge-family summaries over the Badge substrate. */
interface BadgeFamilyProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'role'> {
  readonly label?: string;
  readonly text?: string;
  readonly value?: string;
  readonly status?: string;
  readonly state?: string;
  readonly variant?: string;
  readonly tone?: ComponentTone;
  readonly emphasis?: ComponentEmphasis;
}

export interface AddressSummaryBadgeProps extends BadgeFamilyProps {
  /** The address role that names the status; never an ARIA role. */
  readonly role?: string;
}

export interface MessageStatusBadgeProps extends BadgeFamilyProps {
  readonly delivery?: string;
}

export interface PreferenceSummaryBadgeProps extends BadgeFamilyProps {
  readonly namespace?: string;
  readonly version?: string;
}

export interface RoleBadgeListProps extends React.HTMLAttributes<HTMLSpanElement> {
  readonly roles?: readonly unknown[];
  readonly badges?: readonly unknown[];
  readonly roleLabels?: readonly unknown[];
  readonly value?: readonly unknown[];
  readonly variant?: string;
  readonly tone?: string;
  readonly label?: string;
  readonly text?: string;
}

export interface TagPillsProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly tags?: readonly unknown[];
  readonly value?: readonly unknown[];
  readonly maxVisible?: number | string;
  readonly overflowLabel?: string;
}

/** Timeline-family logs over renderTimelineContainer semantics; the event keys differ per family. */
interface TimelineFamilyProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly title?: string;
  readonly label?: string;
  readonly heading?: string;
  readonly name?: string;
  readonly events?: readonly unknown[];
}

export interface AddressValidationTimelineProps extends TimelineFamilyProps {
  readonly validations?: readonly unknown[];
  readonly history?: readonly unknown[];
}

export interface MembershipAuditTimelineProps extends TimelineFamilyProps {
  readonly memberships?: readonly unknown[];
  readonly history?: readonly unknown[];
}

export interface MessageEventTimelineProps extends TimelineFamilyProps {
  readonly messages?: readonly unknown[];
  readonly statuses?: readonly unknown[];
}

export interface PreferenceTimelineProps extends TimelineFamilyProps {
  readonly changes?: readonly unknown[];
  readonly history?: readonly unknown[];
}

export interface AuditEventProps extends React.HTMLAttributes<HTMLElement> {
  readonly label?: string;
  readonly title?: string;
  readonly event?: string;
  readonly status?: string;
  readonly state?: string;
  readonly reason?: string;
  readonly text?: string;
  readonly timestamp?: string;
  readonly datetime?: string;
  readonly time?: string;
  readonly at?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly detail?: string;
  readonly description?: string;
  readonly message?: string;
  readonly from?: string;
  readonly to?: string;
  readonly code?: string;
}

/** renderFormContainer aliases shared by every form-family component. */
interface FormShellProps {
  readonly title?: string;
  readonly label?: string;
  readonly heading?: string;
  readonly name?: string;
  readonly description?: string;
  readonly subtitle?: string;
  readonly hint?: string;
}

/** The record an AddressEditor hands its consumer on every edit. */
export type AddressEditorValue = { street: string; city: string; region: string; postalCode: string };

export interface AddressEditorProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'onChange' | 'title' | 'name'>, FormShellProps {
  readonly street?: string;
  readonly line1?: string;
  readonly addressLine1?: string;
  readonly city?: string;
  readonly region?: string;
  readonly state?: string;
  readonly postalCode?: string;
  readonly zip?: string;
  readonly onChange?: (address: AddressEditorValue) => void;
}

export interface PreferenceEditorProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'title' | 'name'>, FormShellProps {
  readonly namespaces?: readonly unknown[];
  readonly namespace?: string;
  readonly document?: string;
  readonly json?: string;
  readonly value?: string;
}

export interface RoleAssignmentFormProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'title' | 'name'>, FormShellProps {
  readonly roles?: readonly unknown[];
  readonly availableRoles?: readonly unknown[];
  readonly role?: string;
  readonly defaultRoleId?: string;
  readonly assignee?: string;
  readonly member?: string;
}

export interface StatusSelectorProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'title'> {
  readonly help?: string;
  readonly label?: string;
  readonly title?: string;
  readonly options?: readonly unknown[];
  readonly states?: readonly unknown[];
  readonly value?: string;
  readonly status?: string;
  readonly onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  readonly onValueChange?: (value: string) => void;
  readonly onUpdate?: (value: string) => void;
}

export interface TagInputProps extends Omit<React.FieldsetHTMLAttributes<HTMLFieldSetElement>, 'onChange' | 'title' | 'name'>, FormShellProps {
  readonly tags?: readonly unknown[];
  readonly value?: string;
  readonly placeholder?: string;
  readonly onChange?: React.ChangeEventHandler<HTMLInputElement>;
  readonly onValueChange?: (value: string) => void;
  readonly onUpdate?: (value: string) => void;
}

export interface TemplatePickerProps extends Omit<React.FieldsetHTMLAttributes<HTMLFieldSetElement>, 'title' | 'name'>, FormShellProps {
  readonly templates?: readonly unknown[];
  readonly options?: readonly unknown[];
  readonly templateId?: string;
  readonly value?: string;
  readonly channels?: readonly unknown[];
  readonly channel?: string;
}

/** A saved-schema filter descriptor; the renderer reads label and field, exactly as the HTML renderer does. */
export type FilterDescriptor = Readonly<Record<string, unknown>>;

export interface FilterPanelProps extends React.HTMLAttributes<HTMLElement> {
  readonly filters?: readonly FilterDescriptor[];
  readonly activeFilters?: readonly FilterDescriptor[];
  readonly mode?: string;
  readonly collapsible?: boolean;
}

export interface PriceSummaryProps extends React.HTMLAttributes<HTMLElement> {
  readonly title?: string;
  readonly label?: string;
  readonly heading?: string;
  readonly name?: string;
  readonly amount?: string | number;
  readonly amountCents?: string | number;
  readonly unitAmountCents?: string | number;
  readonly minorUnits?: number;
  readonly currency?: string;
  readonly currencyCode?: string;
  readonly model?: string;
  readonly pricingModel?: string;
  readonly interval?: string;
  readonly billingInterval?: string;
  readonly summary?: string;
  readonly text?: string;
  readonly description?: string;
}

export interface CommonFieldProps {
  readonly id: string;
  readonly label: React.ReactNode;
  readonly help?: React.ReactNode;
  readonly description?: React.ReactNode;
  readonly validation?: FieldValidation;
  readonly density?: FieldDensity;
  readonly requiredIndicator?: React.ReactNode;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

type NativeInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'id' | 'children' | 'className' | 'style'
>;

export interface InputProps extends NativeInputProps, CommonFieldProps {
  readonly inputClassName?: string;
  readonly inputStyle?: React.CSSProperties;
  readonly onValueChange?: (value: string) => void;
  readonly onUpdate?: (value: string) => void;
}

export interface DatePickerProps extends Omit<InputProps, 'type'> {
  readonly pickerClassName?: string;
  readonly pickerStyle?: React.CSSProperties;
}

type NativeCheckboxProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'id' | 'type' | 'children' | 'className' | 'style'
>;

export interface CheckboxProps extends NativeCheckboxProps, CommonFieldProps {
  readonly checkboxClassName?: string;
  readonly checkboxStyle?: React.CSSProperties;
  readonly onCheckedChange?: (checked: boolean) => void;
  readonly onUpdate?: (checked: boolean) => void;
}

type NativeSwitchProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'id' | 'type' | 'role' | 'value' | 'children' | 'className' | 'style' | 'onChange'
>;

/** s222-m02 (#2502 ruling 11): Checkbox's field API on a button with role switch; native button props reach the button. */
export interface SwitchProps extends NativeSwitchProps {
  readonly id: string;
  readonly label: React.ReactNode;
  readonly checked?: boolean;
  readonly defaultChecked?: boolean;
  readonly required?: boolean;
  readonly help?: React.ReactNode;
  readonly validation?: FieldValidation;
  readonly size?: 'sm' | 'md';
  readonly className?: string;
  readonly style?: React.CSSProperties;
  readonly onCheckedChange?: (checked: boolean) => void;
  readonly onUpdate?: (checked: boolean) => void;
}

type NativeSegmentedControlProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'id' | 'role' | 'children' | 'className' | 'style' | 'defaultValue' | 'onChange'
>;

/**
 * s223-m02 (#2527 ruling 10): one choice from two to five options, shown as joined segments. Select's value API on native
 * radios: value (controlled) or defaultValue, onChange with the radio's change event, then onValueChange and onUpdate with
 * the chosen value. Native div props reach the radiogroup.
 */
export interface SegmentedControlProps extends NativeSegmentedControlProps {
  readonly id: string;
  readonly label: React.ReactNode;
  readonly options: readonly SelectOption[];
  readonly value?: string;
  readonly defaultValue?: string;
  readonly name?: string;
  readonly size?: 'xs' | 'sm' | 'md' | 'lg';
  readonly disabled?: boolean;
  readonly className?: string;
  readonly style?: React.CSSProperties;
  readonly onChange?: React.ChangeEventHandler<HTMLInputElement>;
  readonly onValueChange?: (value: string) => void;
  readonly onUpdate?: (value: string) => void;
}

export type SelectOption = {
  readonly value: string;
  readonly label: React.ReactNode;
  readonly disabled?: boolean;
};

type NativeSelectProps = Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  'id' | 'className' | 'style'
>;

export interface SelectProps extends NativeSelectProps, CommonFieldProps {
  readonly options?: readonly SelectOption[];
  readonly placeholder?: string;
  readonly selectClassName?: string;
  readonly selectStyle?: React.CSSProperties;
  readonly onValueChange?: (value: string) => void;
  readonly onUpdate?: (value: string) => void;
}

/** s223-m02 (#2527 ruling 11): a combobox option. Its label is text, because typing filters the list on it. */
export type ComboboxOption = {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
};

type NativeComboboxProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  | 'id' | 'type' | 'role' | 'value' | 'defaultValue' | 'size' | 'name' | 'placeholder' | 'required' | 'disabled'
  | 'children' | 'className' | 'style' | 'onChange'
>;

/**
 * s223-m02 (#2527 ruling 11): pick one value from a list by typing to filter it. Select's field API on an input with role
 * combobox: value (controlled) or defaultValue (uncontrolled) names the chosen option, and picking one calls
 * onValueChange and onUpdate with its value. The input's own text is the filter, so its native onChange is not offered;
 * other native input props reach the input.
 */
export interface ComboboxProps extends NativeComboboxProps {
  readonly id: string;
  readonly label: React.ReactNode;
  readonly options?: readonly ComboboxOption[];
  readonly value?: string;
  readonly defaultValue?: string;
  readonly placeholder?: string;
  readonly name?: string;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly help?: React.ReactNode;
  readonly validation?: FieldValidation;
  /** The control height, as Button, Input and Select: xs 24, sm 28, md 32 (default) or lg 40. */
  readonly size?: 'xs' | 'sm' | 'md' | 'lg';
  readonly className?: string;
  readonly style?: React.CSSProperties;
  readonly onValueChange?: (value: string) => void;
  readonly onUpdate?: (value: string) => void;
}

type NativeTextareaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'id' | 'children' | 'className' | 'style'
>;

export interface TextareaProps extends NativeTextareaProps, CommonFieldProps {
  readonly textareaClassName?: string;
  readonly textareaStyle?: React.CSSProperties;
  readonly onValueChange?: (value: string) => void;
  readonly onUpdate?: (value: string) => void;
}

export type LayoutGap = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | string;

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly columns?: number | 'auto-fit';
  readonly minColumnWidth?: string;
  readonly gap?: LayoutGap;
  readonly align?: React.CSSProperties['alignItems'];
  readonly justify?: React.CSSProperties['justifyContent'];
}

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly direction?: 'row' | 'column';
  readonly gap?: LayoutGap;
  readonly align?: React.CSSProperties['alignItems'];
  readonly justify?: React.CSSProperties['justifyContent'];
  readonly wrap?: boolean;
}

export type TableRowData = {
  readonly id: string;
  readonly [key: string]: unknown;
};

export type TableColumn<Row extends TableRowData = TableRowData> = {
  readonly key: string;
  readonly label: React.ReactNode;
  readonly numeric?: boolean;
  readonly render?: (value: unknown, row: Row) => React.ReactNode;
};

export interface TableProps<Row extends TableRowData = TableRowData>
  extends Omit<React.TableHTMLAttributes<HTMLTableElement>, 'children'> {
  readonly caption?: React.ReactNode;
  // s222-m02 (#2502 ruling 11): false keeps the caption as the table's accessible name but hides it visually.
  readonly showCaption?: boolean;
  readonly columns?: readonly TableColumn<Row>[];
  readonly rows?: readonly Row[];
  readonly density?: FieldDensity;
  readonly selectable?: boolean;
  readonly onRowActivate?: (
    id: string,
    row: Row,
    event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>
  ) => void;
  readonly children?: React.ReactNode;
  readonly containerClassName?: string;
  readonly containerStyle?: React.CSSProperties;
}

export interface TableHeadProps extends React.HTMLAttributes<HTMLTableSectionElement> {}
export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {}
export type TableCaptionProps = React.ComponentPropsWithoutRef<'caption'>;

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  readonly selectable?: boolean;
  readonly selected?: boolean;
  readonly onActivate?: (
    event: React.MouseEvent<HTMLTableRowElement> | React.KeyboardEvent<HTMLTableRowElement>
  ) => void;
}

export interface TableHeaderCellProps extends React.ComponentPropsWithoutRef<'th'> {
  readonly numeric?: boolean;
}

export interface TableCellProps extends React.ComponentPropsWithoutRef<'td'> {
  readonly numeric?: boolean;
  readonly status?: string;
  readonly statusDomain?: string;
  readonly tone?: ComponentTone;
  readonly statusEmphasis?: 'surface' | 'text';
}

export type TableCompound = React.ForwardRefExoticComponent<
  TableProps & React.RefAttributes<HTMLTableElement>
> & {
  readonly Head: React.ForwardRefExoticComponent<
    TableHeadProps & React.RefAttributes<HTMLTableSectionElement>
  >;
  readonly Body: React.ForwardRefExoticComponent<
    TableBodyProps & React.RefAttributes<HTMLTableSectionElement>
  >;
  readonly Caption: React.ForwardRefExoticComponent<
    TableCaptionProps & React.RefAttributes<HTMLTableCaptionElement>
  >;
  readonly Row: React.ForwardRefExoticComponent<
    TableRowProps & React.RefAttributes<HTMLTableRowElement>
  >;
  readonly HeaderCell: React.ForwardRefExoticComponent<
    TableHeaderCellProps & React.RefAttributes<HTMLTableCellElement>
  >;
  readonly Cell: React.ForwardRefExoticComponent<
    TableCellProps & React.RefAttributes<HTMLTableCellElement>
  >;
};

export type TabItem = {
  readonly id: string;
  readonly label: React.ReactNode;
  readonly panel: React.ReactNode;
  readonly isDisabled?: boolean;
  readonly disabled?: boolean;
};

export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  readonly items: readonly TabItem[];
  readonly selectedId?: string;
  readonly defaultSelectedId?: string;
  readonly size?: ComponentSize;
  readonly overflowLabel?: string;
  readonly ariaLabel?: string;
  readonly onChange?: (id: string) => void;
  readonly onUpdate?: (id: string) => void;
}

export type SafeTextElement =
  | 'span'
  | 'p'
  | 'strong'
  | 'em'
  | 'small'
  | 'div'
  | 'dt'
  | 'dd'
  | 'label'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6';

export interface TextProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'content'> {
  readonly content?: React.ReactNode;
  readonly children?: React.ReactNode;
  readonly label?: string;
  readonly size?: ComponentSize;
  readonly weight?: 'regular' | 'medium' | 'semibold';
  readonly as?: SafeTextElement;
}

export interface InlineLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  readonly label?: string; readonly text?: string; readonly value?: string; readonly maxLength?: number | string;
}
export interface LabelCellProps extends InlineLabelProps {
  readonly description?: string; readonly subtitle?: string; readonly sublabel?: string; readonly supporting?: string;
  readonly truncate?: boolean;
}
export interface FormLabelGroupProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  readonly label?: string; readonly text?: string; readonly title?: string;
  readonly placeholder?: string; readonly hint?: string; readonly description?: string;
  readonly for?: string; readonly inputId?: string;
}
export interface ClassificationBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  readonly label?: string; readonly text?: string; readonly category?: string; readonly value?: string;
  readonly status?: string; readonly state?: string; readonly mode?: string; readonly variant?: string;
  readonly tone?: ComponentTone; readonly emphasis?: ComponentEmphasis;
}
export interface ClassificationEditorProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'title' | 'name'>, FormShellProps {
  readonly category?: string; readonly primaryCategory?: string; readonly tags?: string | readonly unknown[];
  readonly modes?: readonly unknown[]; readonly mode?: string; readonly classificationMode?: string;
}

export interface OwnerBadgeProps extends Omit<ClassificationBadgeProps, 'category' | 'mode'> {
  readonly owner?: string; readonly ownerType?: string;
}
export interface OwnershipSummaryProps extends Omit<React.HTMLAttributes<HTMLElement>, 'role'> {
  readonly label?: string; readonly heading?: string; readonly name?: string;
  readonly ownerLabel?: string; readonly ownerId?: string; readonly owner_id?: string; readonly ownerType?: string; readonly owner_type?: string;
  readonly role?: string; readonly ownershipRole?: string; readonly summary?: string; readonly text?: string; readonly description?: string;
}
export interface OwnershipMetaProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'role'> {
  readonly label?: string; readonly heading?: string; readonly name?: string;
  readonly ownerType?: string; readonly owner_type?: string; readonly role?: string; readonly ownershipRole?: string;
  /** s223-m01: the owner's display name; with it the meta reads as one phrase, "Owned by <name> · <type>". */
  readonly ownerLabel?: string;
}
export interface TagSummaryProps extends React.HTMLAttributes<HTMLElement> {
  readonly label?: string; readonly heading?: string; readonly name?: string;
  readonly tagCount?: number | string; readonly count?: number | string; readonly tags?: string | readonly unknown[];
  readonly summary?: string; readonly text?: string; readonly description?: string;
}

export interface ArchiveSummaryProps extends React.HTMLAttributes<HTMLElement> {
  readonly label?: string; readonly heading?: string; readonly name?: string;
  readonly isArchived?: boolean | string; readonly archived?: boolean | string; readonly status?: boolean | string;
  readonly archivedAt?: string | null; readonly reason?: string; readonly archiveReason?: string;
  readonly summary?: string; readonly text?: string; readonly description?: string;
  /** s224-m01: render nothing while the card would only say "Archived: No", so a detail page states no default. */
  readonly hideWhenDefault?: boolean;
}
export interface ArchivePillProps extends Omit<ClassificationBadgeProps, 'category' | 'mode' | 'value'> {
  readonly isArchived?: boolean | string; readonly value?: boolean | string;
  /** s223-m01: render nothing while the record is not archived, so a card shows only a state worth stating. */
  readonly hideWhenFalse?: boolean;
}
export interface CancellationBadgeProps extends Omit<ClassificationBadgeProps, 'category' | 'mode' | 'value'> {
  readonly cancelAtPeriodEnd?: boolean | string; readonly isCancelled?: boolean | string; readonly value?: boolean | string;
  /** s223-m01: render nothing while no cancellation is scheduled. */
  readonly hideWhenFalse?: boolean;
}
export interface CancellationFormProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'title' | 'name'>, FormShellProps {
  readonly embedded?: boolean; readonly reasonHelp?: string; readonly codeHelp?: string;
  readonly allowedReasons?: readonly unknown[]; readonly reasonCode?: string; readonly reason?: string; readonly cancellationReason?: string;
}
export interface PriceCardMetaProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly label?: string; readonly heading?: string; readonly name?: string;
  readonly model?: string; readonly pricingModel?: string; readonly interval?: string; readonly billingInterval?: string;
}
