import { svgCarriesTitle, vizPreviewLayers } from '@oods/component-contracts';
import { formatDateTime, formatReadOnlyValue, summaryValue, formatReferenceLabel, formatPriceAmount, formatPriceCode, ownershipPhrase } from '@oods/component-contracts';
import * as React from 'react';

import { Badge } from './presentational.js';
import type { ComponentEmphasis, ComponentTone } from './types.js';
import type {
  ArchiveSummaryProps, ArchivePillProps, CancellationFormProps, CancellationBadgeProps, PriceCardMetaProps,
  OwnerBadgeProps, OwnershipSummaryProps, OwnershipMetaProps, TagSummaryProps,
  LabelCellProps, InlineLabelProps, FormLabelGroupProps, ClassificationBadgeProps, ClassificationEditorProps,
  AddressEditorProps,
  AddressEditorValue,
  AddressSummaryBadgeProps,
  AddressValidationTimelineProps,
  AuditEventProps,
  CardHeaderProps,
  ColorSwatchProps,
  ColorizedBadgeProps,
  DetailHeaderProps,
  FilterDescriptor,
  FilterPanelProps,
  HeaderElement,
  HeaderLevel,
  MembershipAuditTimelineProps,
  MessageEventTimelineProps,
  MessageStatusBadgeProps,
  PanelSectionProps,
  PreferenceEditorProps,
  PreferenceSummaryBadgeProps,
  PreferenceTimelineProps,
  PriceSummaryProps,
  RoleAssignmentFormProps,
  RoleBadgeListProps,
  StatusSelectorProps,
  TagInputProps,
  TagManagerProps,
  TagPillsProps,
  TemplatePickerProps,
  VizAreaPreviewProps,
} from './types.js';

const classes = (...values: Array<string | false | null | undefined>): string =>
  values.filter(Boolean).join(' ');

const firstText = (...values: Array<string | undefined>): string | undefined =>
  values.find(value => typeof value === 'string' && value.trim().length > 0);

function childContent(children: React.ReactNode): { scalar?: string; authored: boolean } {
  const flatten = (value: React.ReactNode): React.ReactNode[] => React.Children.toArray(value).flatMap(node => {
    if (React.isValidElement<{ children?: React.ReactNode }>(node) && node.type === React.Fragment) {
      return flatten(node.props.children);
    }
    return [node];
  });
  const nodes = flatten(children);
  if (nodes.every(node => typeof node === 'string' || typeof node === 'number')) {
    const scalar = nodes.join('');
    return { scalar: scalar.trim().length > 0 ? scalar : undefined, authored: false };
  }
  return { authored: nodes.length > 0 };
}

function headingElement(as: HeaderElement | undefined, level: HeaderLevel | undefined, fallback: HeaderLevel): HeaderElement {
  if (as && /^h[1-6]$/.test(as)) return as;
  const bounded = Number.isFinite(level) ? Math.max(1, Math.min(6, Math.trunc(level!))) : fallback;
  return `h${bounded}` as HeaderElement;
}

/** Supporting copy that merely repeats the heading is dropped: the reader learns nothing from it twice. */
function notEcho(supporting: string | undefined, heading: string | undefined): string | undefined {
  if (!supporting || !heading) return supporting;
  return supporting.trim() === heading.trim() ? undefined : supporting;
}

export const DetailHeader = React.forwardRef<HTMLElement, DetailHeaderProps>(
  ({ title, label, text, subtitle, sublabel, description, metadata, meta, level, as, children, className, ...rest }, ref) => {
    const Heading = headingElement(as, level, 2);
    const content = childContent(children);
    const heading = content.scalar ?? firstText(title, label, text) ?? 'Details';
    // A supporting line that only repeats the heading is the doubled-field defect of #2046: every
    // object composing Labelled seeds `description` from its own title, so the record's name printed
    // twice, once as the heading and once beneath it. Saying it once is the whole fix.
    const supporting = notEcho(firstText(subtitle, sublabel, description), heading);
    const metadataText = firstText(metadata, meta);
    return (
      <header ref={ref} className={classes('oods-detail-header', className)} data-oods-component="DetailHeader" {...rest}>
        {content.authored ? children : <>
          <Heading>{heading}</Heading>
          {supporting ? <span data-oods-subtitle="true">{supporting}</span> : null}
          {metadataText ? <span data-oods-metadata="true">{metadataText}</span> : null}
        </>}
      </header>
    );
  }
);
DetailHeader.displayName = 'OODS.DetailHeader';

export const CardHeader = React.forwardRef<HTMLElement, CardHeaderProps>(
  ({ title, label, text, supporting, supportingText, subtitle, description, level, as, children, className, ...rest }, ref) => {
    const Heading = headingElement(as, level, 2);
    const content = childContent(children);
    const heading = content.scalar ?? firstText(title, label, text) ?? 'Card';
    const supportingLabel = notEcho(firstText(supporting, supportingText, subtitle, description), heading);
    return (
      <header ref={ref} className={classes('oods-card-header', className)} data-oods-component="CardHeader" {...rest}>
        {content.authored ? children : <>
          <Heading>{heading}</Heading>
          {supportingLabel ? <span data-oods-supporting="true">{supportingLabel}</span> : null}
        </>}
      </header>
    );
  }
);
CardHeader.displayName = 'OODS.CardHeader';

export const ColorSwatch = React.forwardRef<HTMLSpanElement, ColorSwatchProps>(
  ({ color, value, state, label, children, className, style, ...rest }, ref) => {
    const resolvedColor = firstText(color, value, state);
    const content = childContent(children);
    const resolvedLabel = content.scalar ?? firstText(label) ?? resolvedColor ?? 'default';
    return (
      <span
        ref={ref}
        className={classes('oods-color-swatch', className)}
        data-oods-component="ColorSwatch"
        data-summary-type="color-swatch"
        data-swatch-color={resolvedColor ?? 'default'}
        style={{ '--oods-swatch-color': resolvedColor === 'default' ? undefined : resolvedColor, ...style } as React.CSSProperties}
        {...rest}
      >
        <span data-oods-swatch-chip="true" aria-hidden="true" />
        <span data-oods-swatch-label="true">{resolvedLabel}</span>
        {content.authored ? children : null}
      </span>
    );
  }
);
ColorSwatch.displayName = 'OODS.ColorSwatch';

export const ColorizedBadge = React.forwardRef<HTMLSpanElement, ColorizedBadgeProps>(
  ({ label, text, state, value, status, color, hue, swatch, variant, tone, emphasis, children, className, style, ...rest }, ref) => {
    const content = childContent(children);
    const resolvedLabel = content.scalar ?? firstText(label, text, state, value) ?? 'Color';
    const resolvedColor = firstText(color, hue, swatch, state);
    const resolvedStatus = firstText(status, state, value);
    return (
      <Badge
        ref={ref}
        status={resolvedStatus}
        tone={tone}
        emphasis={emphasis}
        className={classes('oods-colorized-badge', className)}
        data-oods-component="ColorizedBadge"
        data-badge-status={resolvedStatus}
        data-badge-color={resolvedColor}
        data-badge-variant={firstText(variant) ?? 'colorized'}
        icon={<span data-oods-badge-marker="true" aria-hidden="true" />}
        style={{ '--oods-badge-color': resolvedColor, ...style } as React.CSSProperties}
        {...rest}
      >
        <span data-oods-badge-label="true">{resolvedLabel}</span>
        {content.authored ? children : null}
      </Badge>
    );
  }
);
ColorizedBadge.displayName = 'OODS.ColorizedBadge';

export const VizAreaPreview = React.forwardRef<HTMLElement, VizAreaPreviewProps>(
  ({ width = 640, height = 360, svg, svgNarrow, svgWide, svgDark, svgDarkNarrow, svgDarkWide, svgHc, svgHcNarrow, svgHcWide, title, description, children, className, style, ...rest }, ref) => {
    const content = childContent(children);
    if (svg !== undefined) {
      // s222-m02 (#2502 ruling 12, F7): the renders in the one layout the three renderers share; with dark and hc renders,
      // one [data-viz-theme] layer per theme, and CSS shows the one the nearest [data-theme] names.
      const layers = vizPreviewLayers({ svg, svgNarrow, svgWide, svgDark, svgDarkNarrow, svgDarkWide, svgHc, svgHcNarrow, svgHcWide });
      const renders = (layer: (typeof layers)[number]) => layer.renders.map(([attribute, markup]) => <div key={attribute} {...{ [attribute]: 'true' }} dangerouslySetInnerHTML={{ __html: markup }} />);
      return <figure ref={ref} className={classes('oods-viz-area-preview', className)}
        data-oods-component="VizAreaPreview" data-viz-preview-type="area" data-viz-rendered="true"
        data-viz-width={width} data-viz-height={height} data-viz-narrow={svgNarrow !== undefined ? 'true' : undefined} data-viz-wide={svgWide !== undefined ? 'true' : undefined} role="img" aria-label={title ?? description ?? 'Payment amounts'}
        style={{ '--oods-viz-width': `${width}px`, ...style } as React.CSSProperties} {...rest}>
        {title && !svgCarriesTitle(svg, title) ? <figcaption>{title}</figcaption> : null}
        {layers.map(layer => layer.theme === undefined ? renders(layer)
          : <div key={layer.theme} data-viz-theme={layer.theme} data-viz-narrow={layer.narrow ? 'true' : undefined} data-viz-wide={layer.wide ? 'true' : undefined}>{renders(layer)}</div>)}
        {description ? <p data-viz-description="true">{description}</p> : null}
      </figure>;
    }
    return (
      <div
        ref={ref as React.ForwardedRef<HTMLDivElement>}
        className={classes('oods-viz-area-preview', className)}
        data-oods-component="VizAreaPreview"
        data-viz-preview-type="area"
        data-viz-width={width}
        data-viz-height={height}
        style={{ '--oods-viz-width': `${width}px`, '--oods-viz-height': `${height}px`, ...style } as React.CSSProperties}
        {...rest}
      >
        {content.authored || content.scalar !== undefined
          ? children
          : <div data-viz-preview-placeholder="true">Area preview ({width} x {height})</div>}
      </div>
    );
  }
);
VizAreaPreview.displayName = 'OODS.VizAreaPreview';

// Mirrors the HTML renderer's firstSerialized: blank strings are skipped,
// numbers and booleans become visible text.
const firstScalar = (...values: ReadonlyArray<string | number | boolean | undefined>): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string') {
      if (value.trim().length > 0) return value;
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  }
  return undefined;
};

const isRecord = (value: unknown): value is FilterDescriptor => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const descriptorLabel = (descriptor: FilterDescriptor): string => (
  firstText(
    typeof descriptor.label === 'string' ? descriptor.label : undefined,
    typeof descriptor.field === 'string' ? descriptor.field : undefined,
  ) ?? 'Filter'
);

// Every panel-family component mirrors renderPanelSection; only the marker,
// data-panel-type and default title differ between them.
function createPanelSection(component: string, className: string, panelType: string, defaultTitle: string) {
  const Panel = React.forwardRef<HTMLElement, PanelSectionProps>(
    ({ title, label, heading, name, subtitle, description, metadata, summary, text, body, emptyMessage, children, className: consumerClassName, ...rest }, ref) => {
      const content = childContent(children);
      const authored = content.authored || content.scalar !== undefined;
      const resolvedTitle = firstText(title, label, heading, name) ?? defaultTitle;
      const resolvedSubtitle = firstText(subtitle, description, metadata);
      const fallback = firstText(summary, text, body, emptyMessage);
      return (
        <section
          ref={ref}
          className={classes(className, consumerClassName)}
          data-oods-component={component}
          data-panel-type={panelType}
          {...rest}
        >
          <header data-panel-header="true">
            <h2>{resolvedTitle}</h2>
            {resolvedSubtitle ? <span data-panel-subtitle="true">{resolvedSubtitle}</span> : null}
          </header>
          <div data-panel-content="true">
            {authored ? children : fallback ? <span data-panel-summary="true">{fallback}</span> : null}
          </div>
        </section>
      );
    }
  );
  Panel.displayName = `OODS.${component}`;
  return Panel;
}

export const ClassificationPanel = createPanelSection('ClassificationPanel', 'oods-classification-panel', 'classification', 'Classification');
export const AddressCollectionPanel = createPanelSection('AddressCollectionPanel', 'oods-address-collection-panel', 'address', 'Addresses');
export const MembershipPanel = createPanelSection('MembershipPanel', 'oods-membership-panel', 'membership', 'Membership');
export const PreferencePanel = createPanelSection('PreferencePanel', 'oods-preference-panel', 'preference', 'Preferences');

export const FilterPanel = React.forwardRef<HTMLElement, FilterPanelProps>(
  ({ filters, activeFilters, mode, collapsible = true, children, className, ...rest }, ref) => {
    const content = childContent(children);
    const authored = content.authored || content.scalar !== undefined;
    const resolvedMode = firstText(mode) ?? 'immediate';
    const descriptors = (Array.isArray(filters) ? filters : []).filter(isRecord);
    const activeCount = Array.isArray(activeFilters) ? activeFilters.length : 0;
    return (
      <aside
        ref={ref}
        className={classes('oods-filter-panel', className)}
        data-oods-component="FilterPanel"
        data-behavioral="filter"
        data-filter-mode={resolvedMode}
        role="region"
        aria-label="Filters"
        {...rest}
      >
        {authored ? children : <>
          {activeCount > 0 ? (
            <div data-active-filters="true" aria-live="polite">
              <span data-filter-count="true">{activeCount} active</span>
              <button type="button" data-filter-clear-all="true">Clear all</button>
            </div>
          ) : null}
          {descriptors.map((descriptor, index) => (
            <fieldset key={index} data-filter-section="true" data-collapsible={collapsible ? 'true' : undefined}>
              <legend>{descriptorLabel(descriptor)}</legend>
            </fieldset>
          ))}
          {resolvedMode === 'batch' ? <button type="button" data-filter-apply="true">Apply</button> : null}
        </>}
      </aside>
    );
  }
);
FilterPanel.displayName = 'OODS.FilterPanel';

export const PriceSummary = React.forwardRef<HTMLElement, PriceSummaryProps>(
  ({
    title, label, heading, name,
    amount, amountCents, unitAmountCents, minorUnits, currency, currencyCode, model, pricingModel, interval, billingInterval,
    summary, text, description, children, className, ...rest
  }, ref) => {
    const content = childContent(children);
    const authored = content.authored || content.scalar !== undefined;
    const resolvedTitle = firstText(title, label, heading, name) ?? 'Price Summary';
    const entries: Array<[string, string | undefined]> = [
      ['Amount', [amount, amountCents, unitAmountCents, currency, currencyCode, model, pricingModel, interval, billingInterval].some(value => value !== undefined) ? formatPriceAmount(amount ?? amountCents ?? unitAmountCents, firstText(currency, currencyCode), minorUnits) : undefined],
      ['Currency', firstScalar(currency, currencyCode)],
      ['Model', formatPriceCode(model ?? pricingModel)],
      ['Interval', formatPriceCode(interval ?? billingInterval)],
    ];
    const terms = entries.filter((entry): entry is [string, string] => entry[1] !== undefined);
    const fallback = firstText(summary, text, description);
    return (
      <section
        ref={ref}
        className={classes('oods-price-summary', className)}
        data-oods-component="PriceSummary"
        data-summary-type="price"
        {...rest}
      >
        <h2 data-summary-title="true">{resolvedTitle}</h2>
        {authored
          ? children
          : terms.length > 0
            ? <dl>{terms.map(([term, value]) => (
                <div key={term} data-summary-item="true"><dt>{term}</dt><dd>{value}</dd></div>
              ))}</dl>
            : fallback
              ? <p data-summary-fallback="true">{fallback}</p>
              : <dl />}
      </section>
    );
  }
);
PriceSummary.displayName = 'OODS.PriceSummary';

// Mirrors the HTML renderer's normalizeBadgeItems for tag entries.
const normalizeTagItems = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const items: string[] = [];
  for (const entry of value) {
    if (entry === undefined || entry === null) continue;
    if (isRecord(entry)) {
      const text = firstScalar(
        ...(['label', 'name', 'role', 'value', 'id'] as const).map((key) => {
          const candidate = entry[key];
          return typeof candidate === 'string' || typeof candidate === 'number' || typeof candidate === 'boolean' ? candidate : undefined;
        }),
      );
      if (text) items.push(text);
      continue;
    }
    items.push(typeof entry === 'object' ? JSON.stringify(entry) : String(entry));
  }
  return items.filter((item) => item.length > 0);
};

export const TagManager = React.forwardRef<HTMLFormElement, TagManagerProps>(
  ({ title, label, heading, name, description, subtitle, hint, tags, value, children, className, onSubmit, ...rest }, ref) => {
    const content = childContent(children);
    const authored = content.authored || content.scalar !== undefined;
    const resolvedTitle = firstText(title, label, heading, name) ?? 'Tag Manager';
    const resolvedSubtitle = firstText(description, subtitle, hint);
    const items = normalizeTagItems(tags ?? value);
    return (
      <form
        ref={ref}
        className={classes('oods-tag-manager', className)}
        data-oods-component="TagManager"
        data-form-type="tag-manager"
        onSubmit={(event) => {
          // The add control is unwired: submitting never navigates.
          event.preventDefault();
          onSubmit?.(event);
        }}
        {...rest}
      >
        <header data-form-header="true">
          <h2>{resolvedTitle}</h2>
          {resolvedSubtitle ? <span data-form-subtitle="true">{resolvedSubtitle}</span> : null}
        </header>
        <div data-form-content="true">
          {authored ? children : <>
            <div data-tag-list="true">
              {items.map((tag, index) => <span key={index} data-tag-item="true">{tag}</span>)}
            </div>
            <label data-form-control="input">
              <span>Add Tag</span>
              <input type="text" name="newTag" placeholder="Type a tag" />
            </label>
          </>}
        </div>
      </form>
    );
  }
);
TagManager.displayName = 'OODS.TagManager';

// Mirrors the HTML renderer's asNumber for pill limits.
const asCount = (value: number | string | undefined): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

type BadgeFamilyOptions = {
  component: string;
  className: string;
  defaultLabel: string;
  defaultVariant: string;
  labelKeys: readonly string[];
  statusKeys: readonly string[];
  booleanProps?: readonly string[];
  /** Words for a boolean label prop, [true, false]; the machine status keeps the literal flag. */
  booleanLabels?: readonly [string, string];
};

// Every badge-family summary mirrors renderBadgePrimitive over the governed
// Badge substrate; only the marker, default label/variant and alias order differ.
function createBadgeFamily<Props extends object>(options: BadgeFamilyOptions) {
  const consumed = new Set([...options.labelKeys, ...options.statusKeys, 'variant', 'tone', 'emphasis', ...(options.booleanProps ? ['hideWhenFalse'] : [])]);
  const Family = React.forwardRef<HTMLSpanElement, Props>((allProps, ref) => {
    const { children, className, ...rest } = allProps as Props & { children?: React.ReactNode; className?: string };
    const record = rest as Record<string, unknown>;
    // s223-m01 (#2527 ruling 7): a chip that only states the default ("Not archived") is not content on a card.
    const flag = options.booleanProps?.map(key => record[key]).find(value => typeof value === 'boolean');
    if (record.hideWhenFalse === true && flag === false) return null;
    const scalar = (key: string): string | undefined => {
      const value = record[key];
      if (typeof value === 'boolean' && options.booleanProps?.includes(key)) return String(value);
      return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
    };
    const content = childContent(children);
    const label = content.scalar ?? firstText(...options.labelKeys.map(key =>
      options.booleanLabels && typeof record[key] === 'boolean' && options.booleanProps?.includes(key)
        ? options.booleanLabels[record[key] ? 0 : 1]
        : scalar(key))) ?? options.defaultLabel;
    const status = firstText(...options.statusKeys.map(scalar));
    const variant = scalar('variant') ?? options.defaultVariant;
    const tone = record.tone as ComponentTone | undefined;
    const emphasis = record.emphasis as ComponentEmphasis | undefined;
    const domRest: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) if (!consumed.has(key)) domRest[key] = value;
    return (
      <Badge
        ref={ref}
        status={status}
        showIcon={false}
        tone={tone}
        emphasis={emphasis}
        className={classes(options.className, className)}
        data-oods-component={options.component}
        data-badge-status={status}
        data-badge-variant={variant}
        {...(domRest as React.HTMLAttributes<HTMLSpanElement>)}
      >
        {content.authored ? children : <span data-oods-badge-label="true">{label}</span>}
      </Badge>
    );
  });
  Family.displayName = `OODS.${options.component}`;
  return Family;
}

export const AddressSummaryBadge = createBadgeFamily<AddressSummaryBadgeProps>({
  component: 'AddressSummaryBadge', className: 'oods-address-summary-badge', defaultLabel: 'Address', defaultVariant: 'address',
  labelKeys: ['label', 'text', 'role', 'value'], statusKeys: ['status', 'state', 'role'],
});
export const MessageStatusBadge = createBadgeFamily<MessageStatusBadgeProps>({
  component: 'MessageStatusBadge', className: 'oods-message-status-badge', defaultLabel: 'Message', defaultVariant: 'message',
  labelKeys: ['label', 'text', 'status', 'delivery', 'value'], statusKeys: ['status', 'state', 'delivery', 'value'],
});
export const PreferenceSummaryBadge = createBadgeFamily<PreferenceSummaryBadgeProps>({
  component: 'PreferenceSummaryBadge', className: 'oods-preference-summary-badge', defaultLabel: 'Preferences', defaultVariant: 'preference',
  labelKeys: ['label', 'text', 'namespace', 'value'], statusKeys: ['status', 'state', 'version'],
});

export const RoleBadgeList = React.forwardRef<HTMLSpanElement, RoleBadgeListProps>(
  ({ roles, badges, roleLabels, value, variant, tone, label, text, children, className, ...rest }, ref) => {
    const content = childContent(children);
    const authored = content.authored || content.scalar !== undefined;
    const items = normalizeTagItems(roles ?? badges ?? roleLabels ?? value);
    const resolvedVariant = firstText(variant, tone) ?? 'roles';
    return (
      <span
        ref={ref}
        className={classes('oods-role-badge-list', className)}
        data-oods-component="RoleBadgeList"
        data-badge-variant={resolvedVariant}
        {...rest}
      >
        {authored
          ? children
          : items.length > 0
            ? items.map((role, index) => <span key={index} data-role-badge="true">{role}</span>)
            : firstText(label, text) ?? 'Roles'}
      </span>
    );
  }
);
RoleBadgeList.displayName = 'OODS.RoleBadgeList';

export const TagPills = React.forwardRef<HTMLDivElement, TagPillsProps>(
  ({ tags, value, maxVisible, overflowLabel, children, className, ...rest }, ref) => {
    const content = childContent(children);
    const authored = content.authored || content.scalar !== undefined;
    const items = normalizeTagItems(tags ?? value);
    const limit = asCount(maxVisible) ?? items.length;
    const visible = items.slice(0, Math.max(0, limit));
    const overflow = items.length - visible.length;
    const template = firstText(overflowLabel);
    // {{ tag_count }} is the total tag count, exactly as renderTagPills substitutes it.
    const overflowText = overflow > 0
      ? template ? template.replace('{{ tag_count }}', String(items.length)) : `+${overflow}`
      : '';
    return (
      <div
        ref={ref}
        className={classes('oods-tag-pills', className)}
        data-oods-component="TagPills"
        data-summary-type="tag-pills"
        {...rest}
      >
        {authored ? children : <>
          {visible.map((tag, index) => <span key={index} data-tag-pill="true">{tag}</span>)}
          {overflowText ? <span data-tag-overflow="true">{overflowText}</span> : null}
        </>}
      </div>
    );
  }
);
TagPills.displayName = 'OODS.TagPills';

type TimelineItem = { label: string; timestamp?: string; detail?: string };

// Mirrors the HTML renderer's normalizeTimelineItems.
const normalizeTimelineItems = (raw: unknown): TimelineItem[] => {
  if (!Array.isArray(raw)) return [];
  const items: TimelineItem[] = [];
  const read = (record: FilterDescriptor, keys: readonly string[]): string | undefined => firstScalar(
    ...keys.map((key) => {
      const value = record[key];
      return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : undefined;
    }),
  );
  for (const entry of raw) {
    if (entry === undefined || entry === null) continue;
    if (isRecord(entry)) {
      items.push({
        label: read(entry, ['label', 'title', 'event', 'status', 'state', 'text', 'name']) ?? 'Event',
        timestamp: read(entry, ['timestamp', 'datetime', 'time', 'at', 'createdAt', 'updatedAt']),
        detail: read(entry, ['detail', 'description', 'reason', 'message', 'from', 'to']),
      });
      continue;
    }
    items.push({ label: typeof entry === 'object' ? JSON.stringify(entry) : String(entry) });
  }
  return items;
};

type TimelineFamilyOptions = {
  component: string;
  className: string;
  defaultTitle: string;
  timelineType: string;
  eventKeys: readonly string[];
};

// Every timeline-family log mirrors renderTimelineContainer; only the marker,
// data-timeline-type, default title and event keys differ.
function createTimelineFamily<Props extends object>(options: TimelineFamilyOptions) {
  const consumed = new Set(['title', 'label', 'heading', 'name', ...options.eventKeys]);
  const Family = React.forwardRef<HTMLDivElement, Props>((allProps, ref) => {
    const { children, className, ...rest } = allProps as Props & { children?: React.ReactNode; className?: string };
    const record = rest as Record<string, unknown>;
    const text = (key: string): string | undefined => {
      const value = record[key];
      return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
    };
    const content = childContent(children);
    const authored = content.authored || content.scalar !== undefined;
    const title = firstText(text('title'), text('label'), text('heading'), text('name')) ?? options.defaultTitle;
    const events = normalizeTimelineItems(options.eventKeys.map((key) => record[key]).find((value) => Array.isArray(value)));
    const domRest: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) if (!consumed.has(key)) domRest[key] = value;
    return (
      <div
        ref={ref}
        className={classes(options.className, className)}
        data-oods-component={options.component}
        data-timeline-type={options.timelineType}
        role="log"
        aria-label={title}
        {...(domRest as React.HTMLAttributes<HTMLDivElement>)}
      >
        <h2 data-timeline-title="true">{title}</h2>
        <ol data-timeline-events="true">
          {authored
            ? children
            : events.length > 0
              ? events.map((item, index) => (
                <li key={index}>
                  <article data-timeline-event="true">
                    <p data-timeline-label="true">{item.label}</p>
                    {item.timestamp ? <time data-timeline-time="true" dateTime={item.timestamp}>{item.timestamp}</time> : null}
                    {item.detail ? <p data-timeline-detail="true">{item.detail}</p> : null}
                  </article>
                </li>
              ))
              : <li data-timeline-empty="true">No events</li>}
        </ol>
      </div>
    );
  });
  Family.displayName = `OODS.${options.component}`;
  return Family;
}

export const AddressValidationTimeline = createTimelineFamily<AddressValidationTimelineProps>({
  component: 'AddressValidationTimeline', className: 'oods-address-validation-timeline',
  defaultTitle: 'Address Validation Timeline', timelineType: 'address-validation', eventKeys: ['events', 'validations', 'history'],
});
export const MembershipAuditTimeline = createTimelineFamily<MembershipAuditTimelineProps>({
  component: 'MembershipAuditTimeline', className: 'oods-membership-audit-timeline',
  defaultTitle: 'Membership Timeline', timelineType: 'membership', eventKeys: ['events', 'memberships', 'history'],
});
export const MessageEventTimeline = createTimelineFamily<MessageEventTimelineProps>({
  component: 'MessageEventTimeline', className: 'oods-message-event-timeline',
  defaultTitle: 'Message Timeline', timelineType: 'message', eventKeys: ['events', 'messages', 'statuses'],
});
export const PreferenceTimeline = createTimelineFamily<PreferenceTimelineProps>({
  component: 'PreferenceTimeline', className: 'oods-preference-timeline',
  defaultTitle: 'Preference Timeline', timelineType: 'preference', eventKeys: ['events', 'changes', 'history'],
});

export const AuditEvent = React.forwardRef<HTMLElement, AuditEventProps>(
  ({
    label, title, event, status, state, reason, text,
    timestamp, datetime, time, at, createdAt, updatedAt,
    detail, description, message, from, to, code, children, className, ...rest
  }, ref) => {
    const content = childContent(children);
    const authored = content.authored || content.scalar !== undefined;
    // A lone reason is both the label and the detail, exactly as renderEventArticle shows it.
    const resolvedLabel = firstText(label, title, event, status, state, reason, text) ?? 'Audit Event';
    const resolvedTimestamp = firstText(timestamp, datetime, time, at, createdAt, updatedAt);
    const resolvedDetail = firstText(detail, description, reason, message, from, to, code);
    return (
      <article
        ref={ref}
        className={classes('oods-audit-event', className)}
        data-oods-component="AuditEvent"
        data-event-type="audit"
        {...rest}
      >
        {authored ? children : <>
          {resolvedTimestamp ? <time data-event-time="true" dateTime={resolvedTimestamp}>{resolvedTimestamp}</time> : null}
          <p data-event-label="true">{resolvedLabel}</p>
          {resolvedDetail ? <p data-event-detail="true">{resolvedDetail}</p> : null}
        </>}
      </article>
    );
  }
);
AuditEvent.displayName = 'OODS.AuditEvent';

type SelectChoice = { value: string; label: string };

// Mirrors the HTML renderer's normalizeSelectOptions (records retain value/id and display label/name, scalars render as text).
const normalizeSelectOptions = (raw: unknown): SelectChoice[] => {
  if (!Array.isArray(raw)) return [];
  const choices: SelectChoice[] = [];
  for (const entry of raw) {
    if (isRecord(entry)) {
      const text = (key: string) => (typeof entry[key] === 'string' && (entry[key] as string).length > 0 ? entry[key] as string : undefined);
      const value = text('value') ?? text('id') ?? text('label') ?? '';
      const label = text('label') ?? text('name') ?? formatReadOnlyValue(value, 'string', true);
      if (!value && !label) continue;
      choices.push({ value, label });
      continue;
    }
    if (entry === undefined || entry === null) continue;
    const value = typeof entry === 'object' ? JSON.stringify(entry) : String(entry);
    if (!value) continue;
    choices.push({ value, label: formatReadOnlyValue(value, 'string', true) });
  }
  return choices;
};

const selectOptionsMarkup = (choices: SelectChoice[]): React.ReactNode => (
  choices.length > 0
    ? choices.map((choice, index) => <option key={index} value={choice.value}>{choice.label}</option>)
    : <option value="">Select...</option>
);

const preventSubmit = (event: React.FormEvent<HTMLFormElement>): void => { event.preventDefault(); };

const formHeader = (title: string, subtitle: string | undefined): React.ReactNode => (
  <header data-form-header="true">
    <h2>{title}</h2>
    {subtitle ? <span data-form-subtitle="true">{subtitle}</span> : null}
  </header>
);

const fieldsetHeader = (title: string, subtitle: string | undefined): React.ReactNode => <>
  <legend>{title}</legend>
  {subtitle ? <span data-form-subtitle="true">{subtitle}</span> : null}
</>;

const addressRecord = (form: HTMLFormElement | null): AddressEditorValue => {
  const read = (name: string): string => {
    const control = form?.elements.namedItem(name);
    return control instanceof HTMLInputElement ? control.value : '';
  };
  return { street: read('street'), city: read('city'), region: read('region'), postalCode: read('postalCode') };
};

export const AddressEditor = React.forwardRef<HTMLFormElement, AddressEditorProps>(
  ({
    title, label, heading, name, description, subtitle, hint,
    street, line1, addressLine1, city, region, state, postalCode, zip,
    children, className, onChange, onSubmit, ...rest
  }, ref) => {
    const content = childContent(children);
    const authored = content.authored || content.scalar !== undefined;
    const resolvedTitle = firstText(title, label, heading, name) ?? 'Address Editor';
    const resolvedSubtitle = firstText(description, subtitle, hint);
    const publish = (event: React.ChangeEvent<HTMLInputElement>) => onChange?.(addressRecord(event.currentTarget.form));
    const control = (fieldLabel: string, fieldName: string, initial: string | undefined) => (
      <label data-form-control="input">
        <span>{fieldLabel}</span>
        <input type="text" name={fieldName} defaultValue={initial} onChange={publish} />
      </label>
    );
    return (
      <form
        ref={ref}
        className={classes('oods-address-editor', className)}
        data-oods-component="AddressEditor"
        data-form-type="address-editor"
        onSubmit={(event) => { preventSubmit(event); onSubmit?.(event); }}
        {...rest}
      >
        {formHeader(resolvedTitle, resolvedSubtitle)}
        <div data-form-content="true">
          {authored ? children : <>
            {control('Street', 'street', firstText(street, line1, addressLine1))}
            {control('City', 'city', firstText(city))}
            {control('Region', 'region', firstText(region, state))}
            {control('Postal Code', 'postalCode', firstText(postalCode, zip))}
          </>}
        </div>
      </form>
    );
  }
);
AddressEditor.displayName = 'OODS.AddressEditor';

export const PreferenceEditor = React.forwardRef<HTMLFormElement, PreferenceEditorProps>(
  ({ title, label, heading, name, description, subtitle, hint, namespaces, namespace, document, json, value, children, className, onSubmit, ...rest }, ref) => {
    const content = childContent(children);
    const authored = content.authored || content.scalar !== undefined;
    const resolvedTitle = firstText(title, label, heading, name) ?? 'Preference Editor';
    const resolvedSubtitle = firstText(description, subtitle, hint);
    const choices = normalizeSelectOptions(Array.isArray(namespaces) ? namespaces : ['default']);
    return (
      <form
        ref={ref}
        className={classes('oods-preference-editor', className)}
        data-oods-component="PreferenceEditor"
        data-form-type="preference-editor"
        onSubmit={(event) => { preventSubmit(event); onSubmit?.(event); }}
        {...rest}
      >
        {formHeader(resolvedTitle, resolvedSubtitle)}
        <div data-form-content="true">
          {authored ? children : <>
            <label data-form-control="select">
              <span>Namespace</span>
              <select name="namespace" defaultValue={firstText(namespace)}>{selectOptionsMarkup(choices)}</select>
            </label>
            <label data-form-control="textarea">
              <span>Preference Document</span>
              <textarea name="preferenceDocument" defaultValue={firstScalar(document, json, value) ?? ''} />
            </label>
          </>}
        </div>
      </form>
    );
  }
);
PreferenceEditor.displayName = 'OODS.PreferenceEditor';

export const RoleAssignmentForm = React.forwardRef<HTMLFormElement, RoleAssignmentFormProps>(
  ({ title, label, heading, name, description, subtitle, hint, roles, availableRoles, role, defaultRoleId, assignee, member, children, className, onSubmit, ...rest }, ref) => {
    const content = childContent(children);
    const authored = content.authored || content.scalar !== undefined;
    const resolvedTitle = firstText(title, label, heading, name) ?? 'Role Assignment';
    const resolvedSubtitle = firstText(description, subtitle, hint);
    const choices = normalizeSelectOptions(roles ?? availableRoles ?? []);
    return (
      <form
        ref={ref}
        className={classes('oods-role-assignment-form', className)}
        data-oods-component="RoleAssignmentForm"
        data-form-type="role-assignment"
        onSubmit={(event) => { preventSubmit(event); onSubmit?.(event); }}
        {...rest}
      >
        {formHeader(resolvedTitle, resolvedSubtitle)}
        <div data-form-content="true">
          {authored ? children : <>
            <label data-form-control="select">
              <span>Role</span>
              <select name="role" defaultValue={firstText(role, defaultRoleId)}>{selectOptionsMarkup(choices)}</select>
            </label>
            <label data-form-control="input">
              <span>Assignee</span>
              <input type="text" name="assignee" defaultValue={firstText(assignee, member)} />
            </label>
          </>}
        </div>
      </form>
    );
  }
);
RoleAssignmentForm.displayName = 'OODS.RoleAssignmentForm';

export const StatusSelector = React.forwardRef<HTMLDivElement, StatusSelectorProps>(
  ({ label, title, help, options, states, value, status, children, className, onChange, onValueChange, onUpdate, ...rest }, ref) => {
    const content = childContent(children);
    const authored = content.authored || content.scalar !== undefined;
    const resolvedLabel = firstText(label, title) ?? 'Status';
    const choices = normalizeSelectOptions(options ?? states ?? ['draft', 'active', 'inactive']);
    const handleChange: React.ChangeEventHandler<HTMLSelectElement> = (event) => {
      onChange?.(event);
      if (!event.defaultPrevented) {
        onValueChange?.(event.currentTarget.value);
        onUpdate?.(event.currentTarget.value);
      }
    };
    const controlled = value !== undefined;
    return (
      <div
        ref={ref}
        className={classes('oods-status-selector', className)}
        data-oods-component="StatusSelector"
        data-summary-type="status-selector"
        {...rest}
      >
        {authored ? children : (
          <label data-form-control="select">
            <span>{resolvedLabel}</span>
            <select
              name="status"
              {...(controlled ? { value } : { defaultValue: firstText(status) })}
              onChange={handleChange}
            >
              {selectOptionsMarkup(choices)}
            </select>
          </label>
        )}
        {help && <p className="oods-field-help">{help}</p>}
      </div>
    );
  }
);
StatusSelector.displayName = 'OODS.StatusSelector';

export const TagInput = React.forwardRef<HTMLFieldSetElement, TagInputProps>(
  ({ title, label, heading, name, description, subtitle, hint, tags, value, placeholder, children, className, onChange, onValueChange, onUpdate, ...rest }, ref) => {
    const content = childContent(children);
    const authored = content.authored || content.scalar !== undefined;
    const resolvedTitle = firstText(title, label, heading, name) ?? 'Tag Input';
    const resolvedSubtitle = firstText(description, subtitle, hint);
    const items = normalizeTagItems(tags);
    const handleChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
      onChange?.(event);
      if (!event.defaultPrevented) {
        onValueChange?.(event.currentTarget.value);
        onUpdate?.(event.currentTarget.value);
      }
    };
    const controlled = value !== undefined;
    return (
      <fieldset
        ref={ref}
        className={classes('oods-tag-input', className)}
        data-oods-component="TagInput"
        data-form-type="tag-input"
        {...rest}
      >
        {fieldsetHeader(resolvedTitle, resolvedSubtitle)}
        <div data-form-content="true">
          {authored ? children : <>
            <label data-form-control="input">
              <span>Tag</span>
              <input
                type="text"
                name="tag"
                placeholder={firstText(placeholder)}
                {...(controlled ? { value } : {})}
                onChange={handleChange}
              />
            </label>
            {items.length > 0 ? (
              <div data-tag-list="true">
                {items.map((tag, index) => <span key={index} data-tag-item="true">{tag}</span>)}
              </div>
            ) : null}
          </>}
        </div>
      </fieldset>
    );
  }
);
TagInput.displayName = 'OODS.TagInput';

export const TemplatePicker = React.forwardRef<HTMLFieldSetElement, TemplatePickerProps>(
  ({ title, label, heading, name, description, subtitle, hint, templates, options, templateId, value, channels, channel, children, className, ...rest }, ref) => {
    const content = childContent(children);
    const authored = content.authored || content.scalar !== undefined;
    const resolvedTitle = firstText(title, label, heading, name) ?? 'Template Picker';
    const resolvedSubtitle = firstText(description, subtitle, hint);
    const templateChoices = normalizeSelectOptions(templates ?? options ?? []);
    const channelChoices = normalizeSelectOptions(channels ?? ['email', 'sms', 'in_app']);
    return (
      <fieldset
        ref={ref}
        className={classes('oods-template-picker', className)}
        data-oods-component="TemplatePicker"
        data-form-type="template-picker"
        {...rest}
      >
        {fieldsetHeader(resolvedTitle, resolvedSubtitle)}
        <div data-form-content="true">
          {authored ? children : <>
            <label data-form-control="select">
              <span>Template</span>
              <select name="template" defaultValue={firstText(templateId, value)}>{selectOptionsMarkup(templateChoices)}</select>
            </label>
            <label data-form-control="select">
              <span>Channel</span>
              <select name="channel" defaultValue={firstText(channel)}>{selectOptionsMarkup(channelChoices)}</select>
            </label>
          </>}
        </div>
      </fieldset>
    );
  }
);
TemplatePicker.displayName = 'OODS.TemplatePicker';

// Matches truncateText in the HTML authority, including its three-dot suffix.
const truncateLabel = (value: string, maxLength: number | string | undefined): string => {
  const limit = typeof maxLength === 'number' ? maxLength : Number(maxLength);
  return !Number.isFinite(limit) || limit <= 0 || value.length <= limit
    ? value : `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}...`;
};

export const InlineLabel = React.forwardRef<HTMLSpanElement, InlineLabelProps>(
  ({ label, text, value, maxLength, children, className, ...rest }, ref) => {
    const content = childContent(children);
    return <span ref={ref} className={classes('oods-inline-label', className)} data-oods-component="InlineLabel" {...rest}>
      {content.authored || content.scalar !== undefined ? children : truncateLabel(firstText(label, text, value) ?? '', maxLength)}
    </span>;
  }
);
InlineLabel.displayName = 'OODS.InlineLabel';

export const LabelCell = React.forwardRef<HTMLSpanElement, LabelCellProps>(
  ({ label, text, value, description, subtitle, sublabel, supporting, truncate, maxLength, children, className, ...rest }, ref) => {
    const content = childContent(children);
    const limit = truncate ? maxLength ?? 40 : maxLength;
    const primary = truncateLabel(firstText(label, text, value) ?? '', limit);
    // A description that only repeats the label prints the same words twice in a list row; see notEcho.
    const detail = notEcho(firstText(description, subtitle, sublabel, supporting), firstText(label, text, value));
    return <span ref={ref} className={classes('oods-label-cell', className)} data-oods-component="LabelCell" {...rest}>
      {content.authored || content.scalar !== undefined ? children : <>
        <span data-oods-label-cell-primary="true">{primary}</span>
        {detail ? <span data-oods-label-cell-description="true">{truncateLabel(detail, limit)}</span> : null}
      </>}
    </span>;
  }
);
LabelCell.displayName = 'OODS.LabelCell';

export const FormLabelGroup = React.forwardRef<HTMLLabelElement, FormLabelGroupProps>(
  ({ label, text, title, placeholder, hint, description, htmlFor, for: forId, inputId, children, className, ...rest }, ref) => {
    const detail = firstText(placeholder, hint, description);
    return <label ref={ref} className={classes('oods-form-label-group', className)} data-oods-component="FormLabelGroup" htmlFor={htmlFor ?? forId ?? inputId} {...rest}>
      <span data-oods-form-label="true">{firstText(label, text, title) ?? 'Label'}</span>
      {children}
      {detail ? <span data-oods-form-hint="true">{detail}</span> : null}
    </label>;
  }
);
FormLabelGroup.displayName = 'OODS.FormLabelGroup';

export const ClassificationBadge = createBadgeFamily<ClassificationBadgeProps>({
  component: 'ClassificationBadge', className: 'oods-classification-badge', defaultLabel: 'Classification', defaultVariant: 'classification',
  labelKeys: ['label', 'text', 'category', 'value'], statusKeys: ['status', 'state', 'mode'],
});

export const ClassificationEditor = React.forwardRef<HTMLFormElement, ClassificationEditorProps>(
  ({ title, label, heading, name, description, subtitle, hint, category, primaryCategory, tags, modes, mode, classificationMode, children, className, onSubmit, ...rest }, ref) => {
    const content = childContent(children);
    const tagText = typeof tags === 'string' ? tags : tags === undefined ? '' : JSON.stringify(tags);
    return <form ref={ref} className={classes('oods-classification-editor', className)} data-oods-component="ClassificationEditor" data-form-type="classification-editor"
      onSubmit={(event) => { preventSubmit(event); onSubmit?.(event); }} {...rest}>
      {formHeader(firstText(title, label, heading, name) ?? 'Classification Editor', firstText(description, subtitle, hint))}
      <div data-form-content="true">{content.authored || content.scalar !== undefined ? children : <>
        <label data-form-control="input"><span>Category</span><input type="text" name="category" defaultValue={firstText(category, primaryCategory) ?? ''} /></label>
        <label data-form-control="input"><span>Tags</span><input type="text" name="tags" placeholder="tag-1, tag-2" defaultValue={tagText} /></label>
        <label data-form-control="select"><span>Mode</span><select name="mode" defaultValue={firstText(mode, classificationMode)}>{selectOptionsMarkup(normalizeSelectOptions(Array.isArray(modes) ? modes : ['strict', 'flexible']))}</select></label>
      </>}</div>
    </form>;
  }
);
ClassificationEditor.displayName = 'OODS.ClassificationEditor';

export const OwnerBadge = createBadgeFamily<OwnerBadgeProps>({
  component: 'OwnerBadge', className: 'oods-owner-badge', defaultLabel: 'Owner', defaultVariant: 'owner',
  labelKeys: ['label', 'text', 'owner', 'ownerType', 'value'], statusKeys: ['status', 'state'],
});

export const OwnershipSummary = React.forwardRef<HTMLElement, OwnershipSummaryProps>(
  ({ title, label, heading, name, ownerLabel, ownerId, owner_id, ownerType, owner_type, role, ownershipRole, summary, text, description, children, className, ...rest }, ref) => {
    const content = childContent(children);
    const terms = ([['Owner', ownerId === undefined && owner_id === undefined && ownerLabel === undefined ? undefined : formatReferenceLabel(ownerId ?? owner_id, ownerLabel, 'Owner')], ['Owner Type', firstScalar(ownerType, owner_type)], ['Role', firstScalar(role, ownershipRole)]] as Array<[string, string | undefined]>).filter((entry): entry is [string, string] => entry[1] !== undefined);
    const fallback = firstText(summary, text, description);
    return <section ref={ref} className={classes('oods-ownership-summary', className)} data-oods-component="OwnershipSummary" data-summary-type="ownership" {...rest}>
      <h2 data-summary-title="true">{firstText(title, label, heading, name) ?? 'Ownership Summary'}</h2>
      {content.authored || content.scalar !== undefined ? children : terms.length
        ? <dl>{terms.map(([term, value]) => <div key={term} data-summary-item="true"><dt>{term}</dt><dd>{value}</dd></div>)}</dl>
        : fallback ? <p data-summary-fallback="true">{fallback}</p> : <dl />}
    </section>;
  }
);
OwnershipSummary.displayName = 'OODS.OwnershipSummary';

export const TagSummary = React.forwardRef<HTMLElement, TagSummaryProps>(
  ({ title, label, heading, name, tagCount, count, tags, summary, text, description, children, className, ...rest }, ref) => {
    const content = childContent(children);
    const tagText = Array.isArray(tags) ? normalizeTagItems(tags).join(', ') || undefined : firstText(tags as string | undefined);
    const terms = ([['Tag Count', firstScalar(tagCount, count)], ['Tags', tagText]] as Array<[string, string | undefined]>).filter((entry): entry is [string, string] => entry[1] !== undefined);
    const fallback = firstText(summary, text, description);
    return <section ref={ref} className={classes('oods-tags-summary', className)} data-oods-component="TagSummary" data-summary-type="tags" {...rest}>
      <h2 data-summary-title="true">{firstText(title, label, heading, name) ?? 'Tag Summary'}</h2>
      {content.authored || content.scalar !== undefined ? children : terms.length
        ? <dl>{terms.map(([term, value]) => <div key={term} data-summary-item="true"><dt>{term}</dt><dd>{value}</dd></div>)}</dl>
        : fallback ? <p data-summary-fallback="true">{fallback}</p> : <dl />}
    </section>;
  }
);
TagSummary.displayName = 'OODS.TagSummary';

export const OwnershipMeta = React.forwardRef<HTMLDivElement, OwnershipMetaProps>(
  ({ title, label, heading, name, ownerType, owner_type, role, ownershipRole, ownerLabel, children, className, ...rest }, ref) => {
    const content = childContent(children);
    const terms = ([['Owner Type', firstScalar(ownerType, owner_type)], ['Role', firstScalar(role, ownershipRole)]] as Array<[string, string | undefined]>).filter((entry): entry is [string, string] => entry[1] !== undefined);
    // s223-m01 (#2527 ruling 6): given the owner's label (a generated card binds it), the meta is one phrase, never
    // "Ownership Owner Type: team". Without it the inline terms stay as they were.
    const phrase = ownerLabel !== undefined ? ownershipPhrase(ownerLabel, firstScalar(ownerType, owner_type), firstScalar(role, ownershipRole)) : undefined;
    return <div ref={ref} className={classes('oods-ownership-meta', className)} data-oods-component="OwnershipMeta" data-meta-type="ownership" {...rest}>
      {content.authored || content.scalar !== undefined ? children : phrase ? <span data-meta-item="true">{phrase}</span> : <>
        <span data-meta-title="true">{firstText(title, label, heading, name) ?? 'Ownership'}</span>
        {terms.map(([term, value]) => <span key={term} data-meta-item="true"><strong>{term}:</strong> {value}</span>)}
      </>}
    </div>;
  }
);
OwnershipMeta.displayName = 'OODS.OwnershipMeta';

// s220-m01 (#2461): a card read a bare "false" beside "No cancellation scheduled"; the flag now reads in words.
export const ArchivePill = createBadgeFamily<ArchivePillProps>({
  component: 'ArchivePill', className: 'oods-archive-pill', defaultLabel: 'Archive', defaultVariant: 'archive',
  labelKeys: ['label', 'text', 'status', 'state', 'isArchived', 'value'], statusKeys: ['status', 'state', 'isArchived', 'value'],
  booleanProps: ['isArchived', 'value'], booleanLabels: ['Archived', 'Not archived'],
});
export const CancellationBadge = createBadgeFamily<CancellationBadgeProps>({
  component: 'CancellationBadge', className: 'oods-cancellation-badge', defaultLabel: 'Cancellation', defaultVariant: 'cancellation',
  labelKeys: ['label', 'text', 'status', 'state', 'cancelAtPeriodEnd', 'value'], statusKeys: ['status', 'state', 'cancelAtPeriodEnd', 'isCancelled', 'value'],
  booleanProps: ['cancelAtPeriodEnd', 'isCancelled', 'value'], booleanLabels: ['Cancellation scheduled', 'No cancellation scheduled'],
});

export const ArchiveSummary = React.forwardRef<HTMLElement, ArchiveSummaryProps>(
  ({ title, label, heading, name, isArchived, archived, status, archivedAt, reason, archiveReason, summary, text, description, hideWhenDefault, children, className, ...rest }, ref) => {
    const content = childContent(children);
    // s224-m01 (#2542 ruling 6): "Archived: No" alone only states the default, so a detail page asking to hide it shows no
    // card; an archived record, or one with a date, reason or authored content, keeps it.
    if (hideWhenDefault === true && (isArchived ?? archived ?? status) === false && !archivedAt && !firstText(reason, archiveReason)
      && !content.authored && content.scalar === undefined) return null;
    const terms = ([['Archived', summaryValue(isArchived ?? archived ?? status)], ['Archived At', archivedAt ? formatDateTime(archivedAt) : undefined], ['Reason', firstText(reason, archiveReason)]] as Array<[string, string | undefined]>).filter((entry): entry is [string, string] => entry[1] !== undefined);
    const fallback = firstText(summary, text, description);
    return <section ref={ref} className={classes('oods-archive-summary', className)} data-oods-component="ArchiveSummary" data-summary-type="archive" {...rest}>
      <h2 data-summary-title="true">{firstText(title, label, heading, name) ?? 'Archive Summary'}</h2>
      {content.authored || content.scalar !== undefined ? children : terms.length
        ? <dl>{terms.map(([term, value]) => <div key={term} data-summary-item="true"><dt>{term}</dt><dd>{value}</dd></div>)}</dl>
        : fallback ? <p data-summary-fallback="true">{fallback}</p> : <dl />}
    </section>;
  }
);
ArchiveSummary.displayName = 'OODS.ArchiveSummary';

export const PriceCardMeta = React.forwardRef<HTMLDivElement, PriceCardMetaProps>(
  ({ title, label, heading, name, model, pricingModel, interval, billingInterval, children, className, ...rest }, ref) => {
    const content = childContent(children);
    // s220-m01: a card reads its pricing terms as PriceSummary does; "Model: one_time" showed the raw code.
    const terms = ([['Model', formatPriceCode(firstText(model, pricingModel))], ['Interval', formatPriceCode(firstText(interval, billingInterval))]] as Array<[string, string | undefined]>).filter((entry): entry is [string, string] => entry[1] !== undefined);
    return <div ref={ref} className={classes('oods-price-card-meta', className)} data-oods-component="PriceCardMeta" data-meta-type="price" {...rest}>
      {content.authored || content.scalar !== undefined ? children : <>
        <span data-meta-title="true">{firstText(title, label, heading, name) ?? 'Price'}</span>
        {terms.map(([term, value]) => <span key={term} data-meta-item="true"><strong>{term}:</strong> {value}</span>)}
      </>}
    </div>;
  }
);
PriceCardMeta.displayName = 'OODS.PriceCardMeta';

export const CancellationForm = React.forwardRef<HTMLFormElement | HTMLFieldSetElement, CancellationFormProps>(
  ({ title, label, heading, name, description, subtitle, hint, allowedReasons, reasonCode, reason, cancellationReason, embedded, reasonHelp, codeHelp, children, className, onSubmit, ...rest }, ref) => {
    const content = childContent(children);
    const choices = normalizeSelectOptions(allowedReasons ?? ['no_longer_needed', 'budget', 'duplicate']);
    if (reasonCode && !choices.some(choice => choice.value === reasonCode)) choices.unshift({ value: reasonCode, label: reasonCode });
    return React.createElement(embedded ? 'fieldset' : 'form', {
      ...rest, ref, className: classes('oods-cancellation-form', className), 'data-oods-component': 'CancellationForm', 'data-form-type': 'cancellation',
      ...(!embedded ? { onSubmit: (event: React.FormEvent<HTMLFormElement>) => { preventSubmit(event); onSubmit?.(event); } } : {}),
    }, <>
      {formHeader(firstText(title, label, heading, name) ?? 'Cancellation Form', firstText(description, subtitle, hint))}
      <div data-form-content="true">{content.authored || content.scalar !== undefined ? children : <>
        <label data-form-control="select"><span>Reason Code</span>{allowedReasons?.length === 0 ? <input name="reasonCode" defaultValue={reasonCode ?? ''} /> : <select name="reasonCode" defaultValue={reasonCode}>{selectOptionsMarkup(choices)}</select>}</label>
        {codeHelp && <p className="oods-field-help">{codeHelp}</p>}
        <label data-form-control="textarea"><span>Reason</span><textarea name="reason" defaultValue={firstText(reason, cancellationReason) ?? ''} /></label>
        {reasonHelp && <p className="oods-field-help">{reasonHelp}</p>}
      </>}</div>
    </>);
  }
);
CancellationForm.displayName = 'OODS.CancellationForm';
