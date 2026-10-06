import { recipeItemLabels, traitEventRows, type TraitEventKind, auditSummary, initialSort, ariaSort, assertStaticSvg, svgCarriesTitle, vizPreviewLayers, VIZ_THEME_SVG_PROPS, type VizPreviewLayer } from '@oods/component-contracts';
import { getStatusPresentation, resolveStatusIcon, statusIconMarkup } from '@oods/component-contracts';
import { currencyMinorUnits, dateTimeInputValue, formatDateTime, formatReadOnlyValue, summaryValue, formatReferenceLabel, formatPriceAmount, formatPriceCode, ownershipPhrase } from '@oods/component-contracts';
import { billingCycle, billingPaymentRows, billingPaymentSummary, BILLING_INTERVALS, BILLING_MINOR_UNITS, billingAmountMessage, billingAmountText, billingIntervalMessage, billingSummary, formatBillingAmount } from '@oods/component-contracts';
import type { UiElement } from '../schemas/generated.js';
import { escapeHtml } from './escape-html.js';
import { resolveSpacingLeaf } from './spacing-leaf.js';

export type ComponentRenderer = (
  node: UiElement,
  childrenHtml?: string,
  renderedChildren?: readonly string[],
) => string;

type TableColumn = { key: string; label: string; numeric?: boolean };
type TabItem = { id: string; label: string; panel: string; active: boolean; disabled: boolean };

/** Composer slot names describe placement, never record content or user-facing labels. */
function displayLabel(node: UiElement): string | undefined {
  return node.meta?.intent?.startsWith('slot:') ? undefined : node.meta?.label;
}

const BOOLEAN_ATTRIBUTES = new Set([
  'autofocus',
  'checked',
  'disabled',
  'hidden',
  'multiple',
  'readonly',
  'required',
  'selected',
]);

const TEXT_TAGS = new Set(['p', 'span', 'small', 'strong', 'em', 'div', 'label', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

const BUTTON_HTML_ATTRS = new Set(['type', 'name', 'value', 'title', 'disabled', 'autofocus']);
const TEXT_HTML_ATTRS = new Set(['title']);
const INPUT_HTML_ATTRS = new Set([
  'type',
  'name',
  'value',
  'placeholder',
  'disabled',
  'required',
  'readonly',
  'min',
  'max',
  'step',
  'autocomplete',
  'title',
]);
const CHECKBOX_HTML_ATTRS = new Set([...INPUT_HTML_ATTRS, 'checked']);
const SELECT_HTML_ATTRS = new Set(['name', 'multiple', 'disabled', 'required', 'size', 'title']);
const TEXTAREA_HTML_ATTRS = new Set([
  'name',
  'placeholder',
  'disabled',
  'required',
  'readonly',
  'rows',
  'cols',
  'maxlength',
  'minlength',
  'autocomplete',
  'title',
]);
const GENERIC_HTML_ATTRS = new Set(['title', 'hidden']);
const TABLE_HTML_ATTRS = new Set(['title', 'summary']);
const FORM_LABEL_HTML_ATTRS = new Set(['for', 'title']);
const FORM_HTML_ATTRS = new Set(['action', 'method', 'autocomplete', 'novalidate', 'title']);
const FIELDSET_HTML_ATTRS = new Set(['title']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function serializePropValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  if (value == null) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isHtmlAttribute(name: string, allowlist: Set<string>): boolean {
  return name === 'role' || name === 'class' || name === 'style' || name.startsWith('aria-') || name.startsWith('data-') || allowlist.has(name);
}

function renderAttribute(name: string, value: unknown): string {
  if (typeof value === 'boolean' && BOOLEAN_ATTRIBUTES.has(name)) {
    return value ? ` ${name}` : '';
  }
  return ` ${name}="${escapeHtml(serializePropValue(value))}"`;
}

type BuildAttrOptions = {
  allowedHtmlAttrs: Set<string>;
  consumedProps?: Set<string>;
  htmlOverrides?: Record<string, unknown>;
  dataOverrides?: Record<string, unknown>;
};

function buildAttributes(node: UiElement, options: BuildAttrOptions): string {
  const htmlAttrs = new Map<string, unknown>();
  const dataAttrs = new Map<string, unknown>();
  const consumedProps = options.consumedProps ?? new Set<string>();
  const props = isRecord(node.props) ? node.props : {};

  htmlAttrs.set('id', asString(props.id) ?? node.id);
  dataAttrs.set('data-oods-component', node.component);
  dataAttrs.set('data-oods-node-id', node.id);
  if (node.layout?.type) dataAttrs.set('data-layout', node.layout.type);
  if (node.meta?.label) dataAttrs.set('data-oods-label', node.meta.label);
  if (node.meta?.confidence !== undefined) {
    dataAttrs.set('data-oods-confidence', String(node.meta.confidence));
    if (node.meta.confidenceLevel) dataAttrs.set('data-confidence-level', node.meta.confidenceLevel);
  }

  for (const [key, value] of Object.entries(options.htmlOverrides ?? {})) {
    htmlAttrs.set(key, value);
  }
  for (const [key, value] of Object.entries(options.dataOverrides ?? {})) {
    if (value === undefined) dataAttrs.delete(key);
    else dataAttrs.set(key, value);
  }

  for (const [rawKey, rawValue] of Object.entries(props)) {
    if (rawValue === undefined || rawValue === null) continue;
    const normalizedKey = rawKey === 'className' ? 'class' : rawKey;
    // buildAttributes already emitted the public id (or the stable node id).
    if (rawKey === 'id') continue;
    if (consumedProps.has(rawKey) || consumedProps.has(normalizedKey)) continue;

    if (isHtmlAttribute(normalizedKey, options.allowedHtmlAttrs)) {
      htmlAttrs.set(normalizedKey, rawValue);
      continue;
    }

    // Unrecognized component props are authoring metadata, not HTML attributes.
  }

  let output = '';
  for (const [name, value] of htmlAttrs) {
    output += renderAttribute(name, value);
  }
  for (const [name, value] of dataAttrs) {
    output += renderAttribute(name, value);
  }
  return output;
}

function hasChildrenHtml(childrenHtml?: string): boolean {
  return Boolean(childrenHtml && childrenHtml.trim().length > 0);
}

function firstString(props: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = asString(props[key]);
    if (value) return value;
  }
  return undefined;
}

function firstSerialized(props: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = props[key];
    if (value === undefined || value === null) continue;
    const asText = asString(value);
    if (asText) return asText;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return String(value);
    }
  }
  return undefined;
}

function headingTag(level: unknown, fallback: number): string {
  const parsed = asNumber(level) ?? fallback;
  const bounded = Math.max(1, Math.min(6, parsed));
  return `h${bounded}`;
}

function truncateText(value: string, maxLength: unknown): string {
  const limit = asNumber(maxLength);
  if (!limit || limit <= 0 || value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}...`;
}

function renderButton(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: BUTTON_HTML_ATTRS,
    consumedProps: new Set(['content', 'label', 'text', 'class', 'className']),
    // s221-m01: only an authored intent is written; an undefined one printed data-intent="", a second attribute beside the
    // screen-action bar's own data-intent (invalid HTML).
    // s222-m02 (#2502 ruling 9): an authored size is written too, so an sm or lg button is its control height in HTML.
    dataOverrides: {
      ...(asString(props.intent) ? { 'data-intent': asString(props.intent) } : {}),
      ...(asString(props.size) ? { 'data-size': asString(props.size) } : {}),
    },
    // Canonical button CSS includes forced-colors handling keyed to this class.
    htmlOverrides: { type: asString(props.type) ?? 'button', class: ['oods-button', asString(props.className) ?? asString(props.class)].filter(Boolean).join(' ') },
  });
  const label = firstSerialized(props, ['content', 'label', 'text']) ?? displayLabel(node) ?? 'Button';
  const content = hasChildrenHtml(childrenHtml) ? childrenHtml : escapeHtml(label);
  return `<button${attrs}>${content}</button>`;
}

function renderCard(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const tag = typeof props.as === 'string' && ['div', 'section', 'article', 'aside'].includes(props.as)
    ? props.as
    : 'article';
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['as', 'body', 'children']),
  });
  const body = firstSerialized(props, ['children', 'body']) ?? '';
  const content = hasChildrenHtml(childrenHtml) ? childrenHtml : escapeHtml(body);
  return `<${tag}${attrs}>${content}</${tag}>`;
}

function renderStack(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  // s222-m03 (#2502 ruling 13): a collection is the markup React and Vue write: a section holding an ordered list of its
  // records, one item each (record-renderer.ts).
  const list = asString(props['data-oods-collection-list']);
  const tag = list ? 'ol' : props['data-oods-row'] !== undefined ? 'li' : props['data-oods-collection'] !== undefined ? 'section' : 'div';
  // The list and its items are plain elements, as React writes them; a Stack's layout rules would shrink the list to its content.
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    dataOverrides: tag === 'ol' || tag === 'li' ? { 'data-oods-component': undefined, 'data-layout': undefined } : { 'data-layout': node.layout?.type ?? 'stack' },
    ...(list ? { htmlOverrides: { class: 'oods-collection', 'aria-label': list === 'events' ? 'Lifecycle history' : 'Records' } } : {}),
  });
  return `<${tag}${attrs}>${childrenHtml}</${tag}>`;
}

function normalizeGridToken(token: string): string {
  return token.trim().replace(/[.\s_]+/g, '-');
}

function renderGrid(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const columns = asNumber(props.columns);
  const rows = asNumber(props.rows);
  const gap = asString(props.gap);
  const columnGap = asString(props.columnGap);
  const rowGap = asString(props.rowGap);

  const gridStyles: string[] = ['display:grid'];
  if (columns && columns > 0) {
    gridStyles.push(`--oods-grid-columns:${columns}`);
  }
  if (rows) {
    gridStyles.push(`grid-template-rows:repeat(${rows}, minmax(0, 1fr))`);
  }
  if (gap) {
    // #552: canonical reference prefix is --ref-space-* (was the dead --ref-spacing-*).
    // sprint-125 m03: resolve a bare t-shirt size (sm/md/lg) to its scale-<size> leaf.
    gridStyles.push(`--oods-layout-gap:var(--ref-space-${normalizeGridToken(resolveSpacingLeaf(gap))});gap:var(--oods-layout-gap)`);
  }
  if (columnGap) {
    gridStyles.push(`column-gap:var(--ref-space-${normalizeGridToken(resolveSpacingLeaf(columnGap))})`);
  }
  if (rowGap) {
    gridStyles.push(`row-gap:var(--ref-space-${normalizeGridToken(resolveSpacingLeaf(rowGap))})`);
  }

  // Merge with any existing style from layout/style token resolution
  const existingStyle = typeof props.style === 'string' && props.style.trim() ? props.style.trim().replace(/;+\s*$/, '') : '';
  // Numeric columns use the same responsive maximum as the React/Vue Grid.
  const baseStyle = columns && columns > 0 ? existingStyle.replace(/grid-template-columns\s*:[^;]+;?/g, '') : existingStyle;
  const mergedStyle = baseStyle ? `${baseStyle};${gridStyles.join(';')}` : gridStyles.join(';');

  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['columns', 'rows', 'gap', 'columnGap', 'rowGap', 'style']),
    htmlOverrides: { style: mergedStyle },
    // s221-m01: data-max-columns only for a real count; an empty one still matched the maximum-columns rule, which then had
    // no count, so a Grid without columns fell back to one column where React and Vue lay columns out automatically.
    dataOverrides: { 'data-layout': 'grid', ...(columns && columns > 0 ? { 'data-max-columns': columns } : {}) },
  });
  return `<div${attrs}>${childrenHtml}</div>`;
}

function renderText(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const tagCandidate = asString(props.as)?.toLowerCase();
  // s223-m02 (#2527 ruling 13c): the element and class React and Vue write, a span.oods-text, unless `as` names another.
  const tag = tagCandidate && TEXT_TAGS.has(tagCandidate) ? tagCandidate : 'span';
  const label = asString(props.label);
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: TEXT_HTML_ATTRS,
    consumedProps: new Set(['as', 'content', 'label', 'text', 'value', 'class', 'className']),
    htmlOverrides: {
      class: ['oods-text', asString(props.className) ?? asString(props.class)].filter(Boolean).join(' '),
      ...(label ? { 'aria-description': label } : {}),
    },
  });
  const text = firstSerialized(props, ['content', 'text', 'value']) ?? displayLabel(node) ?? '';
  const content = hasChildrenHtml(childrenHtml) ? childrenHtml : escapeHtml(text);
  return `<${tag}${attrs}>${content}</${tag}>`;
}

function renderBillingSummaryBadge(node: UiElement): string {
  const props = node.props ?? {};
  const amount = typeof props.amount === 'number' ? props.amount : undefined;
  const currency = asString(props.currency);
  const minorUnits = typeof props.minorUnits === 'number' ? props.minorUnits : undefined;
  return `<span id="${escapeHtml(asString(props.id) ?? node.id)}" class="oods-billing-summary" data-oods-component="BillingSummaryBadge">${escapeHtml(props.showInterval === false ? formatBillingAmount(amount, currency, minorUnits) : billingSummary(amount, currency, minorUnits, asString(props.interval)))}</span>`;
}

function renderBillingAmountInput(node: UiElement): string {
  const props = node.props ?? {};
  const id = asString(props.id) ?? node.id;
  const amount = typeof props.amount === 'number' ? props.amount : undefined;
  const minorUnits = typeof props.minorUnits === 'number' ? props.minorUnits : BILLING_MINOR_UNITS;
  const error = billingAmountMessage(amount, minorUnits);
  const description = `${id}-currency${error ? ` ${id}-error` : ''}`;
  return `<div class="oods-billing-field" data-oods-component="BillingAmountInput" data-state="${error ? 'invalid' : 'editing'}"><label for="${escapeHtml(id)}">${escapeHtml(asString(props.label) ?? 'Billing amount')}</label><span id="${escapeHtml(id)}-currency">${escapeHtml((asString(props.currency) ?? 'usd').toUpperCase())}</span><input id="${escapeHtml(id)}"${typeof props.name === 'string' ? ` name="${escapeHtml(props.name)}"` : ''} type="text" inputmode="decimal" value="${escapeHtml(billingAmountText(amount, minorUnits))}" data-billing-minor-units="${minorUnits}" aria-describedby="${escapeHtml(description)}"${error ? ' aria-invalid="true"' : ''}${props.disabled ? ' disabled' : ''}>${props.help ? `<p class="oods-field-help">${escapeHtml(String(props.help))}</p>` : ''}${error ? `<p id="${escapeHtml(id)}-error" role="alert">${escapeHtml(error)}</p>` : ''}</div>`;
}

function renderBillingIntervalSelector(node: UiElement): string {
  const props = node.props ?? {};
  const id = asString(props.id) ?? node.id;
  const value = asString(props.interval) ?? '';
  const intervals: readonly string[] = Array.isArray(props.intervals) ? props.intervals.filter((item): item is string => typeof item === 'string') : BILLING_INTERVALS;
  const error = billingIntervalMessage(value || undefined, intervals);
  const placeholder = intervals.includes(value) ? '' : `<option value="${escapeHtml(value)}" disabled selected>${escapeHtml(value || 'Choose interval')}</option>`;
  const options = intervals.map((interval) => `<option value="${escapeHtml(interval)}"${interval === value ? ' selected' : ''}>${escapeHtml(formatReadOnlyValue(interval, 'string', true))}</option>`).join('');
  return `<div class="oods-billing-field" data-oods-component="BillingIntervalSelector" data-state="${error ? 'invalid' : 'editing'}"><label for="${escapeHtml(id)}">${escapeHtml(asString(props.label) ?? 'Billing interval')}</label><select id="${escapeHtml(id)}"${typeof props.name === 'string' ? ` name="${escapeHtml(props.name)}"` : ''}${props.disabled ? ' disabled' : ''}${error ? ` aria-invalid="true" aria-describedby="${escapeHtml(id)}-error"` : ''}>${placeholder}${options}</select>${props.help ? `<p class="oods-field-help">${escapeHtml(String(props.help))}</p>` : ''}${error ? `<p id="${escapeHtml(id)}-error" role="alert">${escapeHtml(error)}</p>` : ''}</div>`;
}

function renderCycleProgressCard(node: UiElement): string {
  const props = node.props ?? {};
  const title = asString(props.title) ?? 'Billing cycle';
  const cycle = billingCycle({ progress: typeof props.progress === 'number' ? props.progress : undefined, periodStart: asString(props.periodStart), periodEnd: asString(props.periodEnd), interval: asString(props.interval), now: asString(props.now) });
  return `<section id="${escapeHtml(asString(props.id) ?? node.id)}" class="oods-billing-cycle" data-oods-component="CycleProgressCard" aria-label="${escapeHtml(title)}"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(cycle.announcement)}</p>${cycle.percent === undefined ? '' : `<progress max="100" value="${cycle.percent}" aria-label="${escapeHtml(cycle.announcement)}"></progress>`}${props.interval ? `<p class="oods-billing-muted">${escapeHtml(asString(props.interval) ?? '')}</p>` : ''}</section>`;
}

function renderBillingTimeline(node: UiElement, includeMethod: boolean): string {
  const props = node.props ?? {};
  const title = asString(props.title) ?? (includeMethod ? 'Payments' : 'Payment events');
  const values = { lastPayment: asString(props.lastPayment), nextPayment: asString(props.nextPayment), paymentStatus: asString(props.paymentStatus), paymentMethod: asString(props.paymentMethod), amount: typeof props.amount === 'number' ? props.amount : undefined, currency: asString(props.currency), minorUnits: typeof props.minorUnits === 'number' ? props.minorUnits : undefined };
  const rows = billingPaymentRows(values).map((row) => `<li data-payment-kind="${row.kind}"><strong>${row.label}</strong>${row.at ? `<time datetime="${escapeHtml(row.at)}">${escapeHtml(row.text)}</time>` : `<span>${escapeHtml(row.text)}</span>`}</li>`).join('');
  return `<section id="${escapeHtml(asString(props.id) ?? node.id)}" class="oods-payment-timeline" data-oods-component="${node.component}" role="log" aria-label="${escapeHtml(title)}"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(billingPaymentSummary(values))}</p>${includeMethod ? `<p class="oods-billing-muted">Payment method: ${escapeHtml(values.paymentMethod ?? 'Not provided')}</p>` : ''}<ol>${rows}</ol></section>`;
}
function renderPaymentTimeline(node: UiElement): string { return renderBillingTimeline(node, true); }
function renderPaymentEventTimeline(node: UiElement): string {
  const event = node.props?.event;
  if (!isRecord(event)) return renderBillingTimeline(node, false);
  return `<section id="${escapeHtml(node.id)}" data-oods-component="PaymentEventTimeline" aria-label="${escapeHtml(String(event.title ?? 'Payment event'))}"><strong>${escapeHtml(String(event.title ?? ''))}</strong><time datetime="${escapeHtml(String(event.at ?? ''))}">${escapeHtml(formatDateTime(String(event.at ?? '')))}</time><p>${escapeHtml(String(event.description ?? ''))}</p></section>`;
}
function renderBillingCardMeta(node: UiElement): string {
  const props = node.props ?? {};
  return `<span id="${escapeHtml(asString(props.id) ?? node.id)}" class="oods-billing-card-meta" data-oods-component="BillingCardMeta">${escapeHtml(billingSummary(typeof props.amount === 'number' ? props.amount : undefined, asString(props.currency), typeof props.minorUnits === 'number' ? props.minorUnits : undefined, asString(props.interval)))}</span>`;
}
function renderArchivedRowOverlay(node: UiElement, childrenHtml = ''): string {
  const props = node.props ?? {};
  const archived = props.isArchived === true;
  const tabLabel = asString(props.tabLabel) ?? 'Archived';
  const label = asString(props.label);
  return `<span id="${escapeHtml(asString(props.id) ?? node.id)}" class="oods-archived-row" data-oods-component="ArchivedRowOverlay"${archived ? ` data-archived="true" role="group" aria-hidden="false" aria-label="${escapeHtml(`${tabLabel}${label ? `: ${label}` : ''}`)}"` : ''}${props.separateTab !== false ? ` data-archive-tab="${escapeHtml(tabLabel)}"` : ''}>${childrenHtml}${archived && props.showBadge !== false ? `<span class="oods-archive-badge">${escapeHtml(tabLabel)}</span>` : ''}</span>`;
}

function renderInput(node: UiElement): string {
  const props = isRecord(node.props) ? node.props : {};
  const inputId = asString(props.id) ?? node.id;
  const help = asString(props.help);
  const validation = isRecord(props.validation) ? props.validation : undefined;
  const validationMessage = validation ? asString(validation.message) : undefined;
  const helpId = help ? `${inputId}-help` : undefined;
  const validationId = validationMessage ? `${inputId}-validation` : undefined;
  const describedBy = [asString(props['aria-describedby']), helpId, validationId]
    .filter((value): value is string => Boolean(value))
    .join(' ');
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: INPUT_HTML_ATTRS,
    consumedProps: new Set([
      'defaultValue',
      ...(props.type === 'datetime-local' ? ['value'] : []),
      'help',
      'label',
      'readOnly',
      'validation',
      'aria-describedby',
    ]),
    htmlOverrides: {
      type: asString(props.type) ?? 'text',
      ...(props.type === 'datetime-local' ? { value: dateTimeInputValue(props.value ?? props.defaultValue) } : {}),
      ...(props.type !== 'datetime-local' && props.value === undefined && props.defaultValue !== undefined
        ? { value: props.defaultValue }
        : {}),
      ...(props.readOnly !== undefined ? { readonly: props.readOnly } : {}),
      ...(validation?.state === 'error' ? { 'aria-invalid': 'true' } : {}),
      ...(describedBy ? { 'aria-describedby': describedBy } : {}),
    },
  });
  const label = asString(props.label);
  const labelHtml = label
    ? `<label class="oods-field-label" for="${escapeHtml(inputId)}">${escapeHtml(label)}</label>`
    : '';
  const helpHtml = helpId
    ? `<small class="oods-field-help" id="${escapeHtml(helpId)}">${escapeHtml(help!)}</small>`
    : '';
  const validationHtml = validationId
    ? `<p id="${escapeHtml(validationId)}" data-validation-state="${escapeHtml(String(validation?.state ?? ''))}">${escapeHtml(validationMessage!)}</p>`
    : '';
  return `<div class="oods-field">${labelHtml}<input${attrs} />${helpHtml}${validationHtml}</div>`;
}

function renderCheckbox(node: UiElement): string {
  const props = node.props ?? {};
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: CHECKBOX_HTML_ATTRS,
    htmlOverrides: { type: 'checkbox' },
  });
  const label = props.label ? `<span>${escapeHtml(String(props.label))}</span>` : '';
  const help = props.help ? `<p class="oods-field-help">${escapeHtml(String(props.help))}</p>` : '';
  return `<div class="oods-field">${label ? `<label class="oods-checkbox"><input${attrs} />${label}</label>` : `<input${attrs} />`}${help}</div>`;
}

const VALIDATION_TONES: Readonly<Record<string, string>> = { error: 'critical', warning: 'warning', success: 'success', info: 'info' };

/**
 * s223-m02 (#2527 ruling 13a): a Switch's behaviour on a static page, in the style of Tabs' runtime. A click on the switch
 * or its label, and Space or Enter while it has focus (a button activates on both, so no key handler is added), turns it
 * over: aria-checked flips, and the hidden input carrying a form field's value takes the new value and reports a change,
 * as a checkbox does.
 */
const SWITCH_RUNTIME = '<script data-oods-runtime="switch">(()=>{const root=document.currentScript&&document.currentScript.previousElementSibling;const control=root&&root.querySelector(\'[role="switch"]\');if(!control)return;const value=root.querySelector(\'input[type="hidden"]\');control.addEventListener(\'click\',()=>{const next=control.getAttribute(\'aria-checked\')!==\'true\';control.setAttribute(\'aria-checked\',String(next));if(value){value.value=String(next);value.dispatchEvent(new Event(\'change\',{bubbles:true}));}});})();</script>';

/**
 * s222-m02 (#2502 ruling 11): the one Switch markup React and Vue render: the state is checked, else defaultChecked, and
 * the button carries the id its label targets. s223-m02: SWITCH_RUNTIME follows it so it toggles; a Switch bound to a
 * form field (name) also carries that field's value in a hidden input, "true" or "false".
 */
function renderSwitch(node: UiElement): string {
  const props = isRecord(node.props) ? node.props : {};
  const id = escapeHtml(asString(props.id) ?? node.id);
  const checked = typeof props.checked === 'boolean' ? props.checked : props.defaultChecked === true;
  const size = props.size === 'sm' ? 'sm' : 'md';
  const label = firstSerialized(props, ['label']) ?? displayLabel(node) ?? 'Switch';
  const help = asString(props.help);
  const validation = isRecord(props.validation) ? props.validation : undefined;
  const state = validation ? asString(validation.state) : undefined;
  const message = validation ? asString(validation.message) : undefined;
  const tone = state ? VALIDATION_TONES[state] : undefined;
  const describedBy = [help ? `${id}-help` : undefined, message ? `${id}-validation` : undefined].filter(Boolean).join(' ');
  const rootAttrs = [
    ' class="oods-field oods-switch"',
    tone ? ` style="--cmp-input-message-border:var(--sys-status-${tone}-border);--cmp-input-message-text:var(--sys-status-${tone}-text)"` : '',
    ' data-oods-component="Switch"',
    ` data-oods-node-id="${escapeHtml(node.id)}"`,
    ` data-size="${size}"`,
    state ? ` data-validation-state="${escapeHtml(state)}"` : '',
  ].join('');
  const buttonAttrs = [
    ` id="${id}" type="button" role="switch" class="oods-switch__control" aria-checked="${checked}"`,
    ` aria-labelledby="${id}-label"`,
    describedBy ? ` aria-describedby="${describedBy}"` : '',
    props.required === true ? ' aria-required="true"' : '',
    state === 'error' ? ' aria-invalid="true"' : '',
    props.disabled === true ? ' disabled' : '',
  ].join('');
  const required = props.required === true ? '<span class="oods-field-required" aria-hidden="true">*</span>' : '';
  const name = asString(props.name);
  return `<div${rootAttrs}><div class="oods-switch__row"><button${buttonAttrs}><span class="oods-switch__thumb" aria-hidden="true"></span></button>`
    + `<label id="${id}-label" class="oods-field-label oods-switch__label" for="${id}">${escapeHtml(label)}${required}</label></div>`
    + `${name ? `<input type="hidden" name="${escapeHtml(name)}" value="${checked}">` : ''}`
    + `${help ? `<p id="${id}-help" class="oods-field-help">${escapeHtml(help)}</p>` : ''}`
    + `${message ? `<p id="${id}-validation" class="oods-field-error"${state === 'error' ? ' role="alert"' : ''}>${escapeHtml(message)}</p>` : ''}</div>${SWITCH_RUNTIME}`;
}

/**
 * s223-m02 (#2527 ruling 11): a Combobox's behaviour on a static page, in the style of Tabs' runtime: one constant script,
 * scoped to the combobox just before it, that marks it ready so a second run does nothing, keeps every name inside its
 * function, reads its options from the markup and adds no inline handler. It does what React and Vue do: typing filters
 * the options to those whose label contains the text, ignoring case (none: No matches); Down opens the list and moves, Up
 * moves (and opens the list at its end), Home and End go to the ends of an open list, Enter or a click picks, Escape
 * closes the list and then clears the field, and Tab or an outside click closes it without picking. Disabled options are
 * skipped. A pick or a clear updates the chosen option's aria-selected and reports a bubbling change event whose detail
 * is the value, from the hidden input carrying a named field's value (as a checkbox reports one) or else from the root;
 * the input's own change event, which typing raises, stays inside it.
 */
const COMBOBOX_RUNTIME = `<script data-oods-runtime="combobox">(()=>{
const root=document.currentScript&&document.currentScript.previousElementSibling;
if(!root||root.dataset.oodsComboboxReady)return;
const input=root.querySelector('[role="combobox"]'),popup=root.querySelector('.oods-combobox__popup'),list=root.querySelector('[role="listbox"]');
if(!input||!popup||!list)return;
root.dataset.oodsComboboxReady='true';
const empty=root.querySelector('.oods-combobox__empty'),field=root.querySelector('input[type="hidden"]');
const options=[...list.querySelectorAll('[role="option"]')];
const label=(option)=>option.querySelector('.oods-combobox__option-label').textContent;
const disabled=(option)=>option.getAttribute('aria-disabled')==='true';
const chosen=()=>options.find((option)=>option.getAttribute('aria-selected')==='true');
let query=null,active=-1;
const isOpen=()=>!popup.hidden;
const reachable=()=>options.flatMap((option,index)=>!option.hidden&&!disabled(option)?[index]:[]);
const setActive=(index)=>{active=index;options.forEach((option,at)=>{if(at===index)option.dataset.active='true';else delete option.dataset.active;});
 if(index<0){input.removeAttribute('aria-activedescendant');return;}
 input.setAttribute('aria-activedescendant',options[index].id);if(options[index].scrollIntoView)options[index].scrollIntoView({block:'nearest'});};
const filter=()=>{const needle=(query===null?'':query).trim().toLowerCase();let shown=0;
 options.forEach((option)=>{option.hidden=needle!==''&&!label(option).toLowerCase().includes(needle);if(!option.hidden)shown+=1;});
 if(empty)empty.textContent=isOpen()&&shown===0?'No matches':'';};
const show=()=>{if(input.disabled)return;popup.hidden=false;input.setAttribute('aria-expanded','true');filter();};
const close=()=>{popup.hidden=true;input.setAttribute('aria-expanded','false');setActive(-1);filter();};
const report=(value)=>{options.forEach((option)=>option.setAttribute('aria-selected',String(option.dataset.value===value)));
 if(field)field.value=value;(field||root).dispatchEvent(new CustomEvent('change',{bubbles:true,detail:{value}}));};
const pick=(index)=>{const option=options[index];if(!option||disabled(option))return;const before=chosen();
 query=null;input.value=label(option);close();if(before!==option)report(option.dataset.value);};
input.addEventListener('change',(event)=>event.stopPropagation());
input.addEventListener('input',()=>{query=input.value;show();setActive(-1);});
input.addEventListener('click',()=>{if(!isOpen())show();});
input.addEventListener('blur',()=>{query=null;const option=chosen();input.value=option?label(option):'';close();});
input.addEventListener('keydown',(event)=>{
 if(event.defaultPrevented||input.disabled||event.isComposing)return;
 const key=event.key,open=isOpen();
 if(key==='ArrowDown'||key==='ArrowUp'){event.preventDefault();show();const order=reachable(),at=order.indexOf(active);
  if(!order.length){setActive(-1);return;}
  if(key==='ArrowDown')setActive(!open||at===-1?order[0]:order[(at+1)%order.length]);
  else setActive(!open||at<=0?order[order.length-1]:order[at-1]);return;}
 if((key==='Home'||key==='End')&&open){event.preventDefault();const order=reachable();setActive(order.length?(key==='Home'?order[0]:order[order.length-1]):-1);return;}
 if(key==='Enter'&&open){event.preventDefault();if(active>=0)pick(active);return;}
 if(key==='Escape'){if(open){event.preventDefault();close();return;}
  const before=chosen();if(input.value===''&&!before)return;
  event.preventDefault();query=null;input.value='';filter();if(before)report('');return;}
 if(key==='Tab'&&open)close();});
popup.addEventListener('mousedown',(event)=>event.preventDefault());
options.forEach((option,index)=>{option.addEventListener('click',()=>pick(index));
 option.addEventListener('pointermove',()=>{if(!disabled(option)&&active!==index)setActive(index);});});
document.addEventListener('pointerdown',(event)=>{if(isOpen()&&!root.contains(event.target))close();});
})();</script>`;

const COMBOBOX_SIZES = new Set(['xs', 'sm', 'md', 'lg']);
// The shared marks (@oods/component-contracts) React's and Vue's combobox draw: the chevron and the chosen option's check.
const COMBOBOX_CHEVRON = statusIconMarkup('chevron-down');
const COMBOBOX_CHECK = statusIconMarkup('check');

/**
 * s223-m02 (#2527 ruling 11): the one Combobox markup React and Vue render, with the list closed: the input shows the
 * chosen option's label (value, else defaultValue), so a page without script still reads the current value. Options are
 * { value, label, disabled } records (a scalar is its own value, humanized as Select does); COMBOBOX_RUNTIME follows the
 * markup and gives it React's and Vue's behaviour. A named field also carries the chosen value in a hidden input.
 */
function renderCombobox(node: UiElement): string {
  const props = isRecord(node.props) ? node.props : {};
  const id = escapeHtml(asString(props.id) ?? node.id);
  const options = (Array.isArray(props.options) ? props.options : []).flatMap((entry) => {
    if (isRecord(entry)) {
      const value = entry.value !== undefined && entry.value !== null ? serializePropValue(entry.value) : '';
      const label = asString(entry.label) ?? formatReadOnlyValue(value, 'string', true);
      return value || label ? [{ value, label, disabled: entry.disabled === true }] : [];
    }
    const value = serializePropValue(entry);
    return value ? [{ value, label: formatReadOnlyValue(value, 'string', true), disabled: false }] : [];
  });
  // A value is matched as Select matches it: serialized, so a numeric value finds its option.
  const chosenValue = props.value !== undefined && props.value !== null ? serializePropValue(props.value)
    : props.defaultValue !== undefined && props.defaultValue !== null ? serializePropValue(props.defaultValue) : '';
  const chosen = options.find((option) => option.value === chosenValue);
  const size = typeof props.size === 'string' && COMBOBOX_SIZES.has(props.size) ? props.size : 'md';
  const label = firstSerialized(props, ['label']) ?? displayLabel(node) ?? 'Combobox';
  const placeholder = asString(props.placeholder);
  const name = asString(props.name);
  const help = asString(props.help);
  const validation = isRecord(props.validation) ? props.validation : undefined;
  const state = validation ? asString(validation.state) : undefined;
  const message = validation ? asString(validation.message) : undefined;
  const tone = state ? VALIDATION_TONES[state] : undefined;
  const describedBy = [help ? `${id}-help` : undefined, message ? `${id}-validation` : undefined].filter(Boolean).join(' ');
  // Authored data-* props (a bound change action, for one) stay on the root, as buildAttributes keeps them for other fields.
  const dataAttrs = Object.entries(props)
    .filter(([key, value]) => key.startsWith('data-') && !['data-oods-component', 'data-oods-node-id', 'data-size', 'data-validation-state'].includes(key) && value !== undefined && value !== null)
    .map(([key, value]) => renderAttribute(key, value)).join('');
  const rootAttrs = [
    ' class="oods-field oods-combobox"',
    tone ? ` style="--cmp-input-message-border:var(--sys-status-${tone}-border);--cmp-input-message-text:var(--sys-status-${tone}-text)"` : '',
    ' data-oods-component="Combobox"',
    ` data-oods-node-id="${escapeHtml(node.id)}"`,
    ` data-size="${size}"`,
    state ? ` data-validation-state="${escapeHtml(state)}"` : '',
    dataAttrs,
  ].join('');
  const inputAttrs = [
    ` id="${id}" type="text" role="combobox" class="oods-field-control oods-combobox__input"`,
    ` value="${escapeHtml(chosen?.label ?? '')}"`,
    placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : '',
    ` autocomplete="off" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-listbox"`,
    describedBy ? ` aria-describedby="${describedBy}"` : '',
    state === 'error' ? ' aria-invalid="true"' : '',
    props.required === true ? ' required' : '',
    props.disabled === true ? ' disabled' : '',
  ].join('');
  const optionsHtml = options.map((option, index) => `<li id="${id}-option-${index}" class="oods-combobox__option" role="option"`
    + ` aria-selected="${option.value === chosenValue}"${option.disabled ? ' aria-disabled="true"' : ''} data-value="${escapeHtml(option.value)}">`
    + `<span class="oods-combobox__option-label">${escapeHtml(option.label)}</span>`
    + `<span class="oods-combobox__check" aria-hidden="true">${COMBOBOX_CHECK}</span></li>`).join('');
  const required = props.required === true ? '<span class="oods-field-required" aria-hidden="true">*</span>' : '';
  return `<div${rootAttrs}><label id="${id}-label" class="oods-field-label" for="${id}">${escapeHtml(label)}${required}</label>`
    + `<div class="oods-combobox__control"><input${inputAttrs} />`
    + `<span class="oods-combobox__chevron" aria-hidden="true">${COMBOBOX_CHEVRON}</span>`
    + `<div class="oods-combobox__popup" hidden><ul id="${id}-listbox" class="oods-combobox__listbox" role="listbox" aria-labelledby="${id}-label">${optionsHtml}</ul>`
    + `<p class="oods-combobox__empty" role="status"></p></div></div>`
    + `${name ? `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(chosenValue)}">` : ''}`
    + `${help ? `<p id="${id}-help" class="oods-field-help">${escapeHtml(help)}</p>` : ''}`
    + `${message ? `<p id="${id}-validation" class="oods-field-error"${state === 'error' ? ' role="alert"' : ''}>${escapeHtml(message)}</p>` : ''}</div>${COMBOBOX_RUNTIME}`;
}

function renderDatePicker(node: UiElement): string {
  const props = node.props ?? {};
  const type = asString(props.type) ?? 'date';
  const value = type === 'date' && typeof props.value === 'string' ? props.value.slice(0, 10) : props.value;
  return renderInput({ ...node, props: { ...props, type, value } });
}

function normalizeSelectOptions(rawOptions: unknown, selectedValue: unknown): Array<{ value: string; label: string; selected: boolean }> {
  if (!Array.isArray(rawOptions)) return [];
  const selectedValues = new Set<string>();
  if (Array.isArray(selectedValue)) {
    for (const value of selectedValue) {
      selectedValues.add(serializePropValue(value));
    }
  } else if (selectedValue !== undefined && selectedValue !== null) {
    selectedValues.add(serializePropValue(selectedValue));
  }

  const options: Array<{ value: string; label: string; selected: boolean }> = [];
  for (const entry of rawOptions) {
    if (isRecord(entry)) {
      const value = entry.value !== undefined && entry.value !== null ? serializePropValue(entry.value) : asString(entry.id) ?? asString(entry.label) ?? '';
      const label = asString(entry.label) ?? asString(entry.name) ?? formatReadOnlyValue(value, 'string', true);
      if (!value && !label) continue;
      options.push({ value, label, selected: selectedValues.has(value) });
      continue;
    }
    const value = serializePropValue(entry);
    if (!value) continue;
    options.push({ value, label: formatReadOnlyValue(value, 'string', true), selected: selectedValues.has(value) });
  }
  return options;
}

function renderSelect(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: SELECT_HTML_ATTRS,
    consumedProps: new Set(['options', 'placeholder']),
  });

  const options = normalizeSelectOptions(props.options, props.value);
  const placeholder = asString(props.placeholder);
  const placeholderHtml = placeholder
    ? `<option value="" disabled${options.some((option) => option.selected) ? '' : ' selected'}>${escapeHtml(placeholder)}</option>`
    : '';
  const optionsHtml = options
    .map((option) => `<option value="${escapeHtml(option.value)}"${option.selected ? ' selected' : ''}>${escapeHtml(option.label)}</option>`)
    .join('');
  const label = asString(props.label);
  const help = asString(props.help);
  return `<div class="oods-field">${label ? `<label class="oods-field-label" for="${escapeHtml(asString(props.id) ?? node.id)}">${escapeHtml(label)}</label>` : ''}<select${attrs}>${placeholderHtml}${optionsHtml || childrenHtml}</select>${help ? `<small class="oods-field-help">${escapeHtml(help)}</small>` : ''}</div>`;
}

function renderTextarea(node: UiElement, childrenHtml = ''): string {
  const props = node.props ?? {};
  const id = asString(props.id) ?? node.id;
  const attrs = buildAttributes(node, { allowedHtmlAttrs: TEXTAREA_HTML_ATTRS, consumedProps: new Set(['value', 'text', 'label', 'help']) });
  const content = hasChildrenHtml(childrenHtml) ? childrenHtml : escapeHtml(asString(props.value) ?? asString(props.text) ?? '');
  return `<div class="oods-field">${props.label ? `<label class="oods-field-label" for="${escapeHtml(id)}">${escapeHtml(String(props.label))}</label>` : ''}<textarea${attrs}>${content}</textarea>${props.help ? `<small class="oods-field-help">${escapeHtml(String(props.help))}</small>` : ''}</div>`;
}

const SEGMENTED_CONTROL_SIZES = new Set(['xs', 'sm', 'md', 'lg']);

/**
 * s223-m02 (#2527 ruling 10): the one SegmentedControl markup React and Vue render: a radiogroup named by its visible
 * label, each option a native radio inside its own label. The radios carry the keyboard (the arrows move and check, Tab
 * enters at the checked option), so a static page needs no script. value, else defaultValue, checks an option; name
 * groups the radios and defaults to the id.
 */
function renderSegmentedControl(node: UiElement): string {
  const props = isRecord(node.props) ? node.props : {};
  const id = escapeHtml(asString(props.id) ?? node.id);
  const size = typeof props.size === 'string' && SEGMENTED_CONTROL_SIZES.has(props.size) ? props.size : 'md';
  const label = firstSerialized(props, ['label']) ?? displayLabel(node) ?? 'Segmented control';
  const name = escapeHtml(asString(props.name) ?? asString(props.id) ?? node.id);
  // As in React and Vue, a value (even an empty one) is the choice; defaultValue applies only without one.
  const checked = typeof props.value === 'string' ? props.value : asString(props.defaultValue);
  const options = (Array.isArray(props.options) ? props.options : []).filter(isRecord).map((option) => {
    const value = serializePropValue(option.value);
    const disabled = props.disabled === true || option.disabled === true;
    return `<label class="oods-segmented-control__option"><input type="radio" class="oods-segmented-control__input" name="${name}" value="${escapeHtml(value)}"${value === checked ? ' checked' : ''}${disabled ? ' disabled' : ''}>`
      + `<span class="oods-segmented-control__label">${escapeHtml(asString(option.label) ?? value)}</span></label>`;
  });
  return `<div class="oods-field oods-segmented-control" data-oods-component="SegmentedControl" data-oods-node-id="${escapeHtml(node.id)}" data-size="${size}">`
    + `<span id="${id}-label" class="oods-field-label">${escapeHtml(label)}</span>`
    + `<div id="${id}" role="radiogroup" aria-labelledby="${id}-label" class="oods-segmented-control__track">${options.join('')}</div></div>`;
}

/** A status's SVG mark in the badge or banner icon slot React and Vue render. */
function statusMarkHtml(iconName: string | undefined, part: 'badge' | 'banner'): string {
  const mark = resolveStatusIcon(iconName);
  return mark ? `<span class="oods-${part}__icon" aria-hidden="true">${statusIconMarkup(mark)}</span>` : '';
}

// s222-m02 (#2502 ruling 11): the Badge markup React and Vue render: the tone and emphasis the shared stylesheet paints, a
// status's SVG mark when the status names one, and the label span. A status reads its label and tone from the shared
// registry.
function renderBadge(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const status = asString(props.status);
  const domain = asString(props.domain) ?? 'subscription';
  const presentation = status ? getStatusPresentation(domain, status) : undefined;
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['content', 'label', 'text', 'status', 'domain', 'tone', 'emphasis', 'showIcon', 'icon', 'iconPosition']),
    htmlOverrides: { class: 'oods-badge', ...(presentation ? { title: presentation.description } : {}) },
    dataOverrides: {
      ...(status ? { 'data-status': status, 'data-domain': domain } : {}),
      'data-tone': asString(props.tone) ?? presentation?.tone ?? 'neutral',
      'data-emphasis': asString(props.emphasis) === 'solid' ? 'solid' : 'subtle',
    },
  });
  const label = firstSerialized(props, ['content', 'label', 'text']) ?? presentation?.label ?? displayLabel(node) ?? 'Badge';
  const content = hasChildrenHtml(childrenHtml) ? childrenHtml : escapeHtml(label);
  const mark = props.showIcon === false ? '' : statusMarkHtml(presentation?.iconName, 'badge');
  return `<span${attrs}>${mark}<span class="oods-badge__label">${content}</span></span>`;
}

// s222-m02 (#2502 ruling 11): the Banner markup React and Vue render: the tone and emphasis the shared stylesheet paints, a
// status's SVG mark, and the content column with the title, detail and body. A critical banner is an alert, as in React.
function renderBanner(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const status = asString(props.status);
  const domain = asString(props.domain) ?? 'subscription';
  const presentation = status ? getStatusPresentation(domain, status) : undefined;
  const tone = asString(props.tone) ?? presentation?.tone ?? 'neutral';
  const role = tone === 'critical' || tone === 'danger' ? 'alert' : 'status';
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: new Set(['role', 'title']),
    consumedProps: new Set(['content', 'detail', 'description', 'message', 'text', 'title', 'status', 'domain', 'tone', 'emphasis', 'dismissLabel', 'showIcon', 'icon']),
    htmlOverrides: { class: 'oods-banner', ...(props.role ? {} : { role, 'aria-live': role === 'alert' ? 'assertive' : 'polite' }) },
    dataOverrides: {
      ...(status ? { 'data-status': status, 'data-domain': domain } : {}),
      'data-tone': tone,
      'data-emphasis': asString(props.emphasis) === 'solid' ? 'solid' : 'subtle',
    },
  });
  const title = firstSerialized(props, ['title']) ?? presentation?.label ?? displayLabel(node);
  const detail = firstSerialized(props, ['detail', 'description']);
  const text = firstSerialized(props, ['content', 'message', 'text']) ?? '';
  const titleHtml = title ? `<strong class="oods-banner__title" data-banner-title="true">${escapeHtml(title)}</strong>` : '';
  const detailHtml = detail ? `<p class="oods-banner__detail" data-banner-detail="true">${escapeHtml(detail)}</p>` : '';
  const bodyHtml = hasChildrenHtml(childrenHtml) ? `<div class="oods-banner__body">${childrenHtml}</div>` : text ? `<p class="oods-banner__body">${escapeHtml(text)}</p>` : '';
  const mark = props.showIcon === false ? '' : statusMarkHtml(presentation?.iconName, 'banner');
  return `<section${attrs}>${mark}<div class="oods-banner__content">${titleHtml}${detailHtml}${bodyHtml}</div></section>`;
}

const DIALOG_SIZES = new Set(['sm', 'md', 'lg']);
// The shared status table's x mark (@oods/component-contracts), which React's and Vue's close control draw.
const DIALOG_CLOSE_ICON = statusIconMarkup('x');
/**
 * s223-m02 (#2527 ruling 13b): on a static page the close control closes the dialog, in the style of Tabs' runtime. A
 * script, not a form with method="dialog": the close control stays the type="button" header button React and Vue write,
 * where a form would add an element their markup does not have.
 */
const DIALOG_RUNTIME = '<script data-oods-runtime="dialog">(()=>{const dialog=document.currentScript&&document.currentScript.previousElementSibling;const close=dialog&&dialog.querySelector(\'.oods-dialog__close\');if(!close||typeof dialog.close!==\'function\')return;close.addEventListener(\'click\',()=>dialog.close());})();</script>';

/**
 * s222-m02 (#2502 ruling 11): the one Dialog markup React and Vue render. A static page has no showModal(), so an open
 * dialog is the open attribute and sits in place, as React and Vue render it on the server. The children are the body;
 * the actions prop (strings, or { label, intent } records) is the footer's buttons.
 */
function renderDialog(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const id = escapeHtml(asString(props.id) ?? node.id);
  const title = firstSerialized(props, ['title']) ?? displayLabel(node) ?? 'Dialog';
  const description = asString(props.description);
  const dismissLabel = asString(props.dismissLabel) ?? 'Close';
  const size = typeof props.size === 'string' && DIALOG_SIZES.has(props.size) ? props.size : 'md';
  const actions = (Array.isArray(props.actions) ? props.actions : []).flatMap((action) => {
    const label = isRecord(action) ? asString(action.label) : asString(action);
    const intent = isRecord(action) ? asString(action.intent) : undefined;
    return label ? [`<button type="button" class="oods-button" data-oods-component="Button" data-intent="${escapeHtml(intent ?? 'neutral')}" data-size="md">${escapeHtml(label)}</button>`] : [];
  });
  const attrs = [
    ` id="${id}" class="oods-dialog" data-oods-component="Dialog" data-oods-node-id="${escapeHtml(node.id)}" data-size="${size}"`,
    ` aria-labelledby="${id}-title"`,
    description ? ` aria-describedby="${id}-description"` : '',
    props.open === true ? ' open' : '',
  ].join('');
  return `<dialog${attrs}><div class="oods-dialog__header"><div class="oods-dialog__heading">`
    + `<h2 id="${id}-title" class="oods-dialog__title">${escapeHtml(title)}</h2>`
    + `${description ? `<p id="${id}-description" class="oods-dialog__description">${escapeHtml(description)}</p>` : ''}</div>`
    + `<button type="button" class="oods-dialog__close" aria-label="${escapeHtml(dismissLabel)}">${DIALOG_CLOSE_ICON}</button></div>`
    + `${hasChildrenHtml(childrenHtml) ? `<div class="oods-dialog__body">${childrenHtml}</div>` : ''}`
    + `${actions.length ? `<div class="oods-dialog__footer">${actions.join('')}</div>` : ''}</dialog>${DIALOG_RUNTIME}`;
}

type BadgePrimitiveOptions = {
  defaultLabel: string;
  labelKeys?: string[];
  statusKeys?: string[];
  variantKeys?: string[];
  colorKeys?: string[];
  defaultVariant?: string;
};

function renderBadgePrimitive(node: UiElement, childrenHtml: string, options: BadgePrimitiveOptions): string {
  const props = isRecord(node.props) ? node.props : {};
  const labelKeys = options.labelKeys ?? ['label', 'text', 'value', 'title', 'name'];
  const statusKeys = options.statusKeys ?? ['status', 'state', 'value'];
  const variantKeys = options.variantKeys ?? ['variant', 'tone', 'intent'];
  const colorKeys = options.colorKeys ?? ['color', 'hue', 'swatch', 'resolution', 'palette'];

  const status = firstSerialized(props, statusKeys);
  const variant = firstSerialized(props, variantKeys) ?? options.defaultVariant;
  const color = firstSerialized(props, colorKeys);
  const label = firstSerialized(props, labelKeys) ?? displayLabel(node) ?? options.defaultLabel;
  const dataOverrides: Record<string, unknown> = {};
  if (status) dataOverrides['data-badge-status'] = status;
  if (variant) dataOverrides['data-badge-variant'] = variant;
  if (color) dataOverrides['data-badge-color'] = color;

  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set([...labelKeys, ...statusKeys, ...variantKeys, ...colorKeys]),
    dataOverrides,
  });

  const content = hasChildrenHtml(childrenHtml) ? childrenHtml : escapeHtml(label);
  return `<span${attrs}>${content}</span>`;
}

function normalizeBadgeItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const items: string[] = [];
  for (const entry of value) {
    if (entry === undefined || entry === null) continue;
    if (isRecord(entry)) {
      const text = firstSerialized(entry, ['label', 'name', 'role', 'value', 'id']);
      if (text) items.push(text);
      continue;
    }
    items.push(serializePropValue(entry));
  }
  return items.filter((item) => item.length > 0);
}

// s222-m02 (#2502 ruling 11): the StatusBadge markup React and Vue render (a Badge with the status badge class), with the
// label, tone, description and SVG mark from the shared status registry. The earlier data-badge-* attributes stay.
function renderStatusBadge(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const status = firstSerialized(props, ['status', 'state', 'value']) ?? 'unknown';
  const domain = asString(props.domain) ?? 'subscription';
  const presentation = getStatusPresentation(domain, status);
  const authoredTone = asString(props.tone);
  const label = firstSerialized(props, ['label', 'text', 'content']) ?? presentation.label;
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['label', 'text', 'content', 'status', 'state', 'value', 'domain', 'tone', 'emphasis', 'variant', 'intent', 'color', 'showIcon', 'field', 'statusField', 'domainField', 'readOnly', 'compact']),
    htmlOverrides: { class: 'oods-badge oods-status-badge', title: presentation.description, 'aria-label': `Status: ${label}` },
    dataOverrides: {
      'data-badge-status': status,
      'data-badge-variant': firstSerialized(props, ['variant', 'tone', 'intent']) ?? 'status',
      ...(firstSerialized(props, ['color']) ? { 'data-badge-color': firstSerialized(props, ['color']) } : {}),
      'data-status': status,
      'data-domain': domain,
      'data-tone': authoredTone && authoredTone !== 'lifecycle' ? authoredTone : presentation.tone,
      'data-emphasis': asString(props.variant) === 'solid' || asString(props.emphasis) === 'solid' ? 'solid' : 'subtle',
    },
  });
  const content = hasChildrenHtml(childrenHtml) ? childrenHtml : escapeHtml(label);
  const mark = props.showIcon === false ? '' : statusMarkHtml(presentation.iconName, 'badge');
  return `<span${attrs}>${mark}<span class="oods-badge__label">${content}</span></span>`;
}

function renderCancellationBadge(node: UiElement, childrenHtml = ''): string {
  const props = node.props ?? {};
  const flag = props.cancelAtPeriodEnd ?? props.value;
  // s223-m01 (#2527 ruling 7): "No cancellation scheduled" only states the default, so a card asking to hide it shows nothing.
  if (props.hideWhenFalse === true && flag === false) return '';
  if (typeof flag === 'boolean' && firstSerialized(props, ['label', 'text', 'status', 'state']) === undefined) {
    node = { ...node, props: { ...props, label: flag ? 'Cancellation scheduled' : 'No cancellation scheduled' } };
  }
  return renderBadgePrimitive(node, childrenHtml, {
    defaultLabel: 'Cancellation',
    labelKeys: ['label', 'text', 'status', 'state', 'cancelAtPeriodEnd', 'value'],
    statusKeys: ['status', 'state', 'cancelAtPeriodEnd', 'isCancelled', 'value'],
    defaultVariant: 'cancellation',
  });
}

function renderArchivePill(node: UiElement, childrenHtml = ''): string {
  // s220-m01 (#2461): the flag reads in words, as the cancellation badge beside it does; its status stays literal.
  const props = node.props ?? {};
  const flag = props.isArchived ?? props.value;
  // s223-m01 (#2527 ruling 7): "Not archived" only states the default, so a card asking to hide it shows nothing.
  if (props.hideWhenFalse === true && flag === false) return '';
  if (typeof flag === 'boolean' && firstSerialized(props, ['label', 'text', 'status', 'state']) === undefined) {
    node = { ...node, props: { ...props, label: flag ? 'Archived' : 'Not archived' } };
  }
  return renderBadgePrimitive(node, childrenHtml, {
    defaultLabel: 'Archive',
    labelKeys: ['label', 'text', 'status', 'state', 'isArchived', 'value'],
    statusKeys: ['status', 'state', 'isArchived', 'value'],
    defaultVariant: 'archive',
  });
}

function renderColorizedBadge(node: UiElement, childrenHtml = ''): string {
  return renderBadgePrimitive(node, childrenHtml, {
    defaultLabel: 'Color',
    labelKeys: ['label', 'text', 'state', 'value'],
    statusKeys: ['status', 'state', 'value'],
    colorKeys: ['color', 'hue', 'swatch', 'state'],
    defaultVariant: 'colorized',
  });
}

function renderPreferenceSummaryBadge(node: UiElement, childrenHtml = ''): string {
  return renderBadgePrimitive(node, childrenHtml, {
    defaultLabel: 'Preferences',
    labelKeys: ['label', 'text', 'namespace', 'value'],
    statusKeys: ['status', 'state', 'version'],
    defaultVariant: 'preference',
  });
}

function renderClassificationBadge(node: UiElement, childrenHtml = ''): string {
  return renderBadgePrimitive(node, childrenHtml, {
    defaultLabel: 'Classification',
    labelKeys: ['label', 'text', 'category', 'value'],
    statusKeys: ['status', 'state', 'mode'],
    defaultVariant: 'classification',
  });
}

function renderOwnerBadge(node: UiElement, childrenHtml = ''): string {
  return renderBadgePrimitive(node, childrenHtml, {
    defaultLabel: 'Owner',
    labelKeys: ['label', 'text', 'owner', 'ownerType', 'value'],
    statusKeys: ['status', 'state'],
    defaultVariant: 'owner',
  });
}

function renderMessageStatusBadge(node: UiElement, childrenHtml = ''): string {
  return renderBadgePrimitive(node, childrenHtml, {
    defaultLabel: 'Message',
    labelKeys: ['label', 'text', 'status', 'delivery', 'value'],
    statusKeys: ['status', 'state', 'delivery', 'value'],
    defaultVariant: 'message',
  });
}

function renderGeoResolutionBadge(node: UiElement, childrenHtml = ''): string {
  return renderBadgePrimitive(node, childrenHtml, {
    defaultLabel: 'Geo',
    labelKeys: ['label', 'text', 'resolution', 'value'],
    statusKeys: ['status', 'state', 'resolution'],
    colorKeys: ['resolution', 'color', 'hue'],
    defaultVariant: 'geo',
  });
}

function renderAddressSummaryBadge(node: UiElement, childrenHtml = ''): string {
  return renderBadgePrimitive(node, childrenHtml, {
    defaultLabel: 'Address',
    labelKeys: ['label', 'text', 'role', 'value'],
    statusKeys: ['status', 'state', 'role'],
    defaultVariant: 'address',
  });
}

function renderPriceBadge(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const cents = asNumber(props.amountCents ?? props.unitAmountCents);
  const amount = asNumber(props.amount ?? props.unitAmount);
  const currency = firstSerialized(props, ['currency', 'currencyCode']);
  const normalizedAmount = cents !== undefined ? cents / currencyMinorUnits(currency, asNumber(props.minorUnits)) : amount;
  let derivedLabel = 'Price';
  if (normalizedAmount !== undefined) {
    try {
      derivedLabel = new Intl.NumberFormat(undefined, currency
        ? { style: 'currency', currency: currency.toUpperCase() }
        : { maximumFractionDigits: 2 }).format(normalizedAmount);
    } catch {
      derivedLabel = `${currency?.toUpperCase()} ${normalizedAmount.toFixed(2)}`;
    }
  }

  return renderBadgePrimitive(node, childrenHtml, {
    defaultLabel: derivedLabel,
    labelKeys: ['label', 'text', 'value'],
    statusKeys: ['status', 'state'],
    variantKeys: ['variant', 'tone'],
    defaultVariant: 'price',
  });
}

function renderRoleBadgeList(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const roles = normalizeBadgeItems(props.roles ?? props.badges ?? props.roleLabels ?? props.value);
  const variant = firstSerialized(props, ['variant', 'tone']) ?? 'roles';
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['roles', 'badges', 'roleLabels', 'value', 'variant', 'tone', 'label', 'text']),
    dataOverrides: { 'data-badge-variant': variant },
  });

  if (hasChildrenHtml(childrenHtml)) {
    return `<span${attrs}>${childrenHtml}</span>`;
  }

  const listHtml = roles
    .map((role) => `<span data-role-badge="true">${escapeHtml(role)}</span>`)
    .join('');
  const fallbackLabel = firstSerialized(props, ['label', 'text']) ?? displayLabel(node) ?? 'Roles';
  const content = listHtml || escapeHtml(fallbackLabel);
  return `<span${attrs}>${content}</span>`;
}

/** Supporting copy that merely repeats the heading is dropped: the reader learns nothing from it twice. */
function notEcho(supporting: string | undefined, heading: string | undefined): string | undefined {
  if (!supporting || !heading) return supporting;
  return supporting.trim() === heading.trim() ? undefined : supporting;
}

function renderCardHeader(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['title', 'label', 'text', 'supporting', 'supportingText', 'subtitle', 'description', 'level']),
  });
  if (hasChildrenHtml(childrenHtml)) {
    return `<header${attrs}>${childrenHtml}</header>`;
  }

  const title = firstString(props, ['title', 'label', 'text']) ?? displayLabel(node) ?? 'Card';
  const supporting = notEcho(firstString(props, ['supporting', 'supportingText', 'subtitle', 'description']), title);
  const titleTag = headingTag(props.level, 2);
  const supportingHtml = supporting ? `<span data-oods-supporting="true">${escapeHtml(supporting)}</span>` : '';
  return `<header${attrs}><${titleTag}>${escapeHtml(title)}</${titleTag}>${supportingHtml}</header>`;
}

function renderDetailHeader(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set([
      'title',
      'label',
      'text',
      'subtitle',
      'sublabel',
      'description',
      'metadata',
      'meta',
      'level',
    ]),
  });
  if (hasChildrenHtml(childrenHtml)) {
    return `<header${attrs}>${childrenHtml}</header>`;
  }

  const title = firstString(props, ['title', 'label', 'text']) ?? displayLabel(node) ?? 'Details';
  const subtitle = notEcho(firstString(props, ['subtitle', 'sublabel', 'description']), title);
  const metadata = firstString(props, ['metadata', 'meta']);
  const titleTag = headingTag(props.level, 2);
  const subtitleHtml = subtitle ? `<span data-oods-subtitle="true">${escapeHtml(subtitle)}</span>` : '';
  const metadataHtml = metadata ? `<span data-oods-metadata="true">${escapeHtml(metadata)}</span>` : '';

  return `<header${attrs}><${titleTag}>${escapeHtml(title)}</${titleTag}>${subtitleHtml}${metadataHtml}</header>`;
}

function renderFormLabelGroup(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const htmlFor = asString(props.htmlFor) ?? asString(props.for) ?? asString(props.inputId);
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: FORM_LABEL_HTML_ATTRS,
    consumedProps: new Set(['label', 'text', 'title', 'placeholder', 'hint', 'description', 'htmlFor', 'inputId']),
    htmlOverrides: htmlFor ? { for: htmlFor } : undefined,
  });

  const label = firstString(props, ['label', 'text', 'title']) ?? displayLabel(node) ?? 'Label';
  const hint = firstString(props, ['placeholder', 'hint', 'description']);
  const labelHtml = `<span data-oods-form-label="true">${escapeHtml(label)}</span>`;
  const hintHtml = hint ? `<span data-oods-form-hint="true">${escapeHtml(hint)}</span>` : '';
  const content = hasChildrenHtml(childrenHtml) ? `${labelHtml}${childrenHtml}${hintHtml}` : `${labelHtml}${hintHtml}`;
  return `<label${attrs}>${content}</label>`;
}

function renderInlineLabel(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['label', 'text', 'value', 'maxLength']),
  });
  const label = firstString(props, ['label', 'text', 'value']) ?? displayLabel(node) ?? '';
  const content = hasChildrenHtml(childrenHtml) ? childrenHtml : escapeHtml(truncateText(label, props.maxLength));
  return `<span${attrs}>${content}</span>`;
}

function renderLabelCell(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set([
      'label',
      'text',
      'value',
      'description',
      'subtitle',
      'sublabel',
      'supporting',
      'truncate',
      'maxLength',
    ]),
  });
  if (hasChildrenHtml(childrenHtml)) {
    return `<span${attrs}>${childrenHtml}</span>`;
  }

  const rawLabel = firstString(props, ['label', 'text', 'value']) ?? displayLabel(node) ?? '';
  // A description that only repeats the label prints the same words twice in a list row; see notEcho.
  const rawDescription = notEcho(firstString(props, ['description', 'subtitle', 'sublabel', 'supporting']), rawLabel);
  const maxLength = Boolean(props.truncate) ? props.maxLength ?? 40 : props.maxLength;
  const label = truncateText(rawLabel, maxLength);
  const description = rawDescription ? truncateText(rawDescription, maxLength) : undefined;
  const descriptionHtml = description
    ? `<span data-oods-label-cell-description="true">${escapeHtml(description)}</span>`
    : '';
  return `<span${attrs}><span data-oods-label-cell-primary="true">${escapeHtml(label)}</span>${descriptionHtml}</span>`;
}

type PanelOptions = {
  defaultTitle: string;
  panelType: string;
  titleKeys?: string[];
  subtitleKeys?: string[];
};

function renderPanelSection(node: UiElement, childrenHtml: string, options: PanelOptions): string {
  const props = isRecord(node.props) ? node.props : {};
  const titleKeys = options.titleKeys ?? ['title', 'label', 'heading', 'name'];
  const subtitleKeys = options.subtitleKeys ?? ['subtitle', 'description', 'metadata'];
  const title = firstSerialized(props, titleKeys) ?? options.defaultTitle;
  const subtitle = firstSerialized(props, subtitleKeys);
  const fallbackBody = firstSerialized(props, ['summary', 'text', 'body', 'emptyMessage']);
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set([...titleKeys, ...subtitleKeys, 'summary', 'text', 'body', 'emptyMessage']),
    dataOverrides: { 'data-panel-type': options.panelType },
  });

  const headerHtml = `<header data-panel-header="true"><h2>${escapeHtml(title)}</h2>${
    subtitle ? `<span data-panel-subtitle="true">${escapeHtml(subtitle)}</span>` : ''
  }</header>`;
  const contentHtml = hasChildrenHtml(childrenHtml)
    ? childrenHtml
    : fallbackBody
      ? `<span data-panel-summary="true">${escapeHtml(fallbackBody)}</span>`
      : '';
  return `<section${attrs}>${headerHtml}<div data-panel-content="true">${contentHtml}</div></section>`;
}

function renderAddressCollectionPanel(node: UiElement, childrenHtml = ''): string {
  return renderPanelSection(node, childrenHtml, {
    defaultTitle: 'Addresses',
    panelType: 'address',
  });
}

function renderClassificationPanel(node: UiElement, childrenHtml = ''): string {
  return renderPanelSection(node, childrenHtml, {
    defaultTitle: 'Classification',
    panelType: 'classification',
  });
}

function renderCommunicationDetailPanel(node: UiElement, childrenHtml = ''): string {
  if (hasChildrenHtml(childrenHtml)) return renderPanelSection(node, childrenHtml, { defaultTitle: 'Communication', panelType: 'communication' });
  const props = isRecord(node.props) ? node.props : {};
  const title = firstSerialized(props, ['title', 'label', 'heading', 'name']) ?? 'Communication';
  const rows = (key: string): unknown[] => Array.isArray(props[key]) ? props[key] as unknown[] : [];
  const attrs = buildAttributes({ ...node, props: { ...props, className: [props.className, 'oods-trait-recipe'].filter(Boolean).join(' ') } }, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['title', 'label', 'heading', 'name', 'channels', 'templates', 'policies', 'conversations']),
    htmlOverrides: { 'aria-label': title },
    dataOverrides: { 'data-panel-type': 'communication' },
  });
  const sections = [['Channels', 'channels'], ['Templates', 'templates'], ['Delivery policies', 'policies'], ['Conversations', 'conversations']]
    .map(([label, key]) => `<div><dt>${label}</dt><dd>${rows(key).length ? `<ul>${recipeItemLabels(rows(key)).map(text => `<li>${escapeHtml(text)}</li>`).join('')}</ul>` : 'None recorded'}</dd></div>`).join('');
  return `<section${attrs}><header data-panel-header="true"><h2>${escapeHtml(title)}</h2></header><div data-panel-content="true"><div role="status" aria-live="polite">${rows('conversations').length} conversations</div><dl>${sections}</dl></div></section>`;
}

function renderMembershipPanel(node: UiElement, childrenHtml = ''): string {
  return renderPanelSection(node, childrenHtml, {
    defaultTitle: 'Membership',
    panelType: 'membership',
  });
}

function renderPreferencePanel(node: UiElement, childrenHtml = ''): string {
  return renderPanelSection(node, childrenHtml, {
    defaultTitle: 'Preferences',
    panelType: 'preference',
  });
}

type FormContainerOptions = {
  tag: 'form' | 'fieldset';
  defaultTitle: string;
  formType: string;
};

function renderInputControl(
  label: string,
  name: string,
  value?: string,
  options: { type?: string; placeholder?: string } = {}
): string {
  const type = options.type ?? 'text';
  const valueAttr = value !== undefined ? ` value="${escapeHtml(value)}"` : '';
  const placeholderAttr = options.placeholder ? ` placeholder="${escapeHtml(options.placeholder)}"` : '';
  return `<label class="oods-field" data-form-control="input"><span class="oods-field-label">${escapeHtml(label)}</span><input class="oods-field-control" type="${escapeHtml(type)}" name="${escapeHtml(
    name
  )}"${valueAttr}${placeholderAttr} /></label>`;
}

function renderTextareaControl(label: string, name: string, value?: string): string {
  return `<label class="oods-field" data-form-control="textarea"><span class="oods-field-label">${escapeHtml(label)}</span><textarea class="oods-field-control" name="${escapeHtml(name)}">${
    value ? escapeHtml(value) : ''
  }</textarea></label>`;
}

function renderSelectControl(label: string, name: string, optionsSource: unknown, selectedValue?: unknown): string {
  const options = normalizeSelectOptions(optionsSource, selectedValue);
  const optionsHtml =
    options.length > 0
      ? options
        .map((option) => `<option value="${escapeHtml(option.value)}"${option.selected ? ' selected' : ''}>${escapeHtml(option.label)}</option>`)
        .join('')
      : '<option value="">Select...</option>';
  return `<label class="oods-field" data-form-control="select"><span class="oods-field-label">${escapeHtml(label)}</span><select class="oods-field-control" name="${escapeHtml(name)}">${optionsHtml}</select></label>`;
}

function renderFormContainer(node: UiElement, childrenHtml: string, generatedBody: string, options: FormContainerOptions): string {
  const props = isRecord(node.props) ? node.props : {};
  const titleKeys = ['title', 'label', 'heading', 'name'];
  const subtitleKeys = ['description', 'subtitle', 'hint'];
  const title = firstSerialized(props, titleKeys) ?? options.defaultTitle;
  const subtitle = firstSerialized(props, subtitleKeys);
  const content = hasChildrenHtml(childrenHtml) ? childrenHtml : generatedBody;
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: options.tag === 'form' ? FORM_HTML_ATTRS : FIELDSET_HTML_ATTRS,
    consumedProps: new Set([...titleKeys, ...subtitleKeys]),
    dataOverrides: { 'data-form-type': options.formType },
  });
  const heading =
    options.tag === 'form'
      ? `<header data-form-header="true"><h2>${escapeHtml(title)}</h2>${subtitle ? `<span data-form-subtitle="true">${escapeHtml(subtitle)}</span>` : ''}</header>`
      : `<legend>${escapeHtml(title)}</legend>${subtitle ? `<span data-form-subtitle="true">${escapeHtml(subtitle)}</span>` : ''}`;
  return `<${options.tag}${attrs}>${heading}<div data-form-content="true">${content}</div></${options.tag}>`;
}

function renderAddressEditor(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const body = [
    renderInputControl('Street', 'street', firstSerialized(props, ['street', 'line1', 'addressLine1'])),
    renderInputControl('City', 'city', firstSerialized(props, ['city'])),
    renderInputControl('Region', 'region', firstSerialized(props, ['region', 'state'])),
    renderInputControl('Postal Code', 'postalCode', firstSerialized(props, ['postalCode', 'zip'])),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'form',
    defaultTitle: 'Address Editor',
    formType: 'address-editor',
  });
}

function renderClassificationEditor(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const modeOptions = Array.isArray(props.modes) ? props.modes : ['strict', 'flexible'];
  const body = [
    renderInputControl('Category', 'category', firstSerialized(props, ['category', 'primaryCategory'])),
    renderInputControl('Tags', 'tags', firstSerialized(props, ['tags']), { placeholder: 'tag-1, tag-2' }),
    renderSelectControl('Mode', 'mode', modeOptions, props.mode ?? props.classificationMode),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'form',
    defaultTitle: 'Classification Editor',
    formType: 'classification-editor',
  });
}

function renderPreferenceEditor(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const namespaceOptions = Array.isArray(props.namespaces) ? props.namespaces : ['default'];
  const body = [
    renderSelectControl('Namespace', 'namespace', namespaceOptions, props.namespace),
    renderTextareaControl('Preference Document', 'preferenceDocument', firstSerialized(props, ['document', 'json', 'value'])),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'form',
    defaultTitle: 'Preference Editor',
    formType: 'preference-editor',
  });
}

function renderRoleAssignmentForm(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const roles = props.roles ?? props.availableRoles ?? [];
  const body = [
    renderSelectControl('Role', 'role', roles, props.role ?? props.defaultRoleId),
    renderInputControl('Assignee', 'assignee', firstSerialized(props, ['assignee', 'member'])),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'form',
    defaultTitle: 'Role Assignment',
    formType: 'role-assignment',
  });
}

function renderCancellationForm(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const reasons = normalizeSelectOptions(props.allowedReasons ?? ['no_longer_needed', 'budget', 'duplicate'], props.reasonCode);
  if (typeof props.reasonCode === 'string' && props.reasonCode && !reasons.some(reason => reason.value === props.reasonCode)) reasons.unshift({ value: props.reasonCode, label: formatReadOnlyValue(props.reasonCode, 'string', true), selected: true });
  const body = [
    Array.isArray(props.allowedReasons) && props.allowedReasons.length === 0
      ? renderInputControl('Reason Code', 'reasonCode', asString(props.reasonCode))
      : renderSelectControl('Reason Code', 'reasonCode', reasons, props.reasonCode),
    props.codeHelp ? `<p class="oods-field-help">${escapeHtml(String(props.codeHelp))}</p>` : '',
    renderTextareaControl('Reason', 'reason', firstSerialized(props, ['reason', 'cancellationReason'])),
    props.reasonHelp ? `<p class="oods-field-help">${escapeHtml(String(props.reasonHelp))}</p>` : '',
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: props.embedded ? 'fieldset' : 'form',
    defaultTitle: 'Cancellation Form',
    formType: 'cancellation',
  });
}

function renderTagInput(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const tags = normalizeBadgeItems(props.tags ?? props.value);
  const tagsHtml = tags.length
    ? `<div data-tag-list="true">${tags.map((tag) => `<span data-tag-item="true">${escapeHtml(tag)}</span>`).join('')}</div>`
    : '';
  const body = `${renderInputControl('Tag', 'tag', undefined, { placeholder: firstSerialized(props, ['placeholder']) })}${tagsHtml}`;
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'fieldset',
    defaultTitle: 'Tag Input',
    formType: 'tag-input',
  });
}

function renderTagManager(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const tags = normalizeBadgeItems(props.tags ?? props.value);
  const tagsHtml = tags.length
    ? `<div data-tag-list="true">${tags.map((tag) => `<span data-tag-item="true">${escapeHtml(tag)}</span>`).join('')}</div>`
    : '<div data-tag-list="true"></div>';
  const body = `${tagsHtml}${renderInputControl('Add Tag', 'newTag', undefined, { placeholder: 'Type a tag' })}`;
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'form',
    defaultTitle: 'Tag Manager',
    formType: 'tag-manager',
  });
}

function renderGeoFieldMappingForm(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const autoDetect = firstSerialized(props, ['autoDetect', 'autoDetectField']) === 'true' ? ' checked' : '';
  const body = [
    renderInputControl('Latitude Field', 'latitudeField', firstSerialized(props, ['latitudeField'])),
    renderInputControl('Longitude Field', 'longitudeField', firstSerialized(props, ['longitudeField'])),
    renderInputControl('Identifier Field', 'identifierField', firstSerialized(props, ['identifierField'])),
    `<label class="oods-field" data-form-control="checkbox"><input type="checkbox" name="autoDetect"${autoDetect} /><span>Auto detect fields</span></label>`,
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'form',
    defaultTitle: 'Geo Field Mapping',
    formType: 'geo-mapping',
  });
}

function renderColorStatePicker(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const colorStates = props.colorStates ?? props.options ?? ['default', 'success', 'warning', 'critical'];
  const body = renderSelectControl('Color State', 'colorState', colorStates, props.colorState ?? props.value);
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'fieldset',
    defaultTitle: 'Color State Picker',
    formType: 'color-state-picker',
  });
}

function renderTemplatePicker(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const templates = props.templates ?? props.options ?? [];
  const channels = props.channels ?? ['email', 'sms', 'in_app'];
  const body = [
    renderSelectControl('Template', 'template', templates, props.templateId ?? props.value),
    renderSelectControl('Channel', 'channel', channels, props.channel),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'fieldset',
    defaultTitle: 'Template Picker',
    formType: 'template-picker',
  });
}

type TimelineItem = {
  label: string;
  timestamp?: string;
  detail?: string;
  actor?: string;
  reason?: string;
};

type TimelineOptions = {
  defaultTitle: string;
  timelineType: string;
  eventKeys?: string[];
};

function normalizeTimelineItems(raw: unknown, lifecycle = false): TimelineItem[] {
  if (!Array.isArray(raw)) return [];
  const items: TimelineItem[] = [];
  for (const entry of raw) {
    if (entry === undefined || entry === null) continue;
    if (isRecord(entry)) {
      const from = firstSerialized(entry, ['from']), to = firstSerialized(entry, ['to']);
      const humanize = (value: string) => value.split(/[_-]/).filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
      const code = firstSerialized(entry, ['event', 'status', 'state']);
      const label = firstSerialized(entry, ['label', 'title']) ?? (code ? humanize(code) : undefined) ?? firstSerialized(entry, ['text', 'name']) ?? (lifecycle && to ? (from ? `${humanize(from)} → ${humanize(to)}` : humanize(to)) : 'Event');
      const timestamp = firstSerialized(entry, ['timestamp', 'datetime', 'time', 'at', 'createdAt', 'updatedAt']);
      const detail = lifecycle ? firstSerialized(entry, ['detail', 'description', 'message']) ?? (to ? (from ? `${humanize(from)} → ${humanize(to)}` : humanize(to)) : undefined) : firstSerialized(entry, ['detail', 'description', 'reason', 'message', 'from', 'to']);
      items.push({ label, timestamp, detail, ...(lifecycle ? { actor: firstSerialized(entry, ['actorId', 'actor_id', 'actor']), reason: firstSerialized(entry, ['reason']) } : {}) });
      continue;
    }
    items.push({ label: serializePropValue(entry) });
  }
  return items;
}

function renderTimelineContainer(node: UiElement, childrenHtml: string, options: TimelineOptions): string {
  const props = isRecord(node.props) ? node.props : {};
  const title = firstSerialized(props, ['title', 'label', 'heading', 'name']) ?? displayLabel(node) ?? options.defaultTitle;
  const keys = options.eventKeys ?? ['events', 'history', 'entries', 'items'];
  const rawEvents = keys.map((key) => props[key]).find((value) => Array.isArray(value));
  const lifecycle = ['status', 'audit'].includes(options.timelineType);
  const allEvents = normalizeTimelineItems(rawEvents, lifecycle);
  const events = lifecycle && typeof props.maxVisible === 'number' && Number.isFinite(props.maxVisible) ? allEvents.slice(0, Math.max(0, Math.floor(props.maxVisible))) : allEvents;
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['title', 'label', 'heading', 'name', ...keys]),
    dataOverrides: { 'data-timeline-type': options.timelineType },
    htmlOverrides: { role: 'log' },
  });

  const eventHtml = hasChildrenHtml(childrenHtml) && !events.length
    ? childrenHtml
    : events.length
      ? events
        .map((item) => {
          const timeHtml = item.timestamp
            ? `<time data-timeline-time="true" datetime="${escapeHtml(item.timestamp)}">${escapeHtml(formatDateTime(item.timestamp))}</time>`
            : '';
          const detailHtml = item.detail ? `<p data-timeline-detail="true">${escapeHtml(item.detail)}</p>` : '';
          const actorHtml = item.actor && props.showActorId !== false ? `<p>Actor: ${escapeHtml(item.actor)}</p>` : '';
          const reasonHtml = item.reason && props.showReason !== false ? `<p>Reason: ${escapeHtml(item.reason)}</p>` : '';
          return `<li><article data-timeline-event="true"><p data-timeline-label="true">${escapeHtml(item.label)}</p>${timeHtml}${detailHtml}${actorHtml}${reasonHtml}</article></li>`;
        })
        .join('')
      : '<li data-timeline-empty="true">No events</li>';

  const statusHtml = options.timelineType === 'status' && props.status ? `<p>Current status: ${escapeHtml(String(props.status).split(/[_-]/).filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' '))}</p>` : '';
  const transitionsHtml = lifecycle && Array.isArray(props.allowedTransitions) && props.allowedTransitions.length ? `<p>Allowed transitions: ${escapeHtml(props.allowedTransitions.join(', '))}</p>` : '';
  return `<div${attrs}><h2 data-timeline-title="true">${escapeHtml(title)}</h2>${statusHtml}${transitionsHtml}<ol data-timeline-events="true">${eventHtml}</ol></div>`;
}

type EventOptions = {
  defaultLabel: string;
  eventType: string;
};

function renderEventArticle(node: UiElement, childrenHtml: string, options: EventOptions): string {
  const props = isRecord(node.props) ? node.props : {};
  const label = firstSerialized(props, ['label', 'title', 'event', 'status', 'state', 'reason', 'text']) ?? displayLabel(node) ?? options.defaultLabel;
  const timestamp = firstSerialized(props, ['timestamp', 'datetime', 'time', 'at', 'createdAt', 'updatedAt']);
  const detail = firstSerialized(props, ['detail', 'description', 'reason', 'message', 'from', 'to', 'code']);
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['label', 'title', 'event', 'status', 'state', 'reason', 'text', 'timestamp', 'datetime', 'time', 'at', 'createdAt', 'updatedAt', 'detail', 'description', 'message', 'from', 'to', 'code']),
    dataOverrides: { 'data-event-type': options.eventType },
  });

  if (hasChildrenHtml(childrenHtml)) {
    return `<article${attrs}>${childrenHtml}</article>`;
  }

  const timeHtml = timestamp ? `<time data-event-time="true" datetime="${escapeHtml(timestamp)}">${escapeHtml(formatDateTime(timestamp))}</time>` : '';
  const detailHtml = detail ? `<p data-event-detail="true">${escapeHtml(detail)}</p>` : '';
  return `<article${attrs}>${timeHtml}<p data-event-label="true">${escapeHtml(label)}</p>${detailHtml}</article>`;
}

function renderAuditTimeline(node: UiElement, childrenHtml = ''): string {
  return renderTimelineContainer(node, childrenHtml, {
    defaultTitle: 'Audit Timeline',
    timelineType: 'audit',
    eventKeys: ['auditLog', 'events', 'history', 'entries', 'stateHistory'],
  });
}

function renderAddressValidationTimeline(node: UiElement, childrenHtml = ''): string {
  return renderTimelineContainer(node, childrenHtml, {
    defaultTitle: 'Address Validation Timeline',
    timelineType: 'address-validation',
    eventKeys: ['events', 'validations', 'history'],
  });
}

function renderMembershipAuditTimeline(node: UiElement, childrenHtml = ''): string {
  return renderTimelineContainer(node, childrenHtml, {
    defaultTitle: 'Membership Timeline',
    timelineType: 'membership',
    eventKeys: ['events', 'memberships', 'history'],
  });
}

function renderMessageEventTimeline(node: UiElement, childrenHtml = ''): string {
  return renderTimelineContainer(node, childrenHtml, {
    defaultTitle: 'Message Timeline',
    timelineType: 'message',
    eventKeys: ['events', 'messages', 'statuses'],
  });
}

function renderPreferenceTimeline(node: UiElement, childrenHtml = ''): string {
  return renderTimelineContainer(node, childrenHtml, {
    defaultTitle: 'Preference Timeline',
    timelineType: 'preference',
    eventKeys: ['events', 'changes', 'history'],
  });
}

function renderStatusTimeline(node: UiElement, childrenHtml = ''): string {
  return renderTimelineContainer(node, childrenHtml, {
    defaultTitle: 'Status Timeline',
    timelineType: 'status',
    eventKeys: ['events', 'history', 'entries', 'stateHistory'],
  });
}

function renderAuditSummaryCard(node: UiElement): string {
  const props = node.props ?? {};
  const title = asString(props.title) ?? 'Audit summary';
  const summary = auditSummary({ auditLog: Array.isArray(props.auditLog) ? props.auditLog : [], lastN: asNumber(props.lastN) });
  const attrs = buildAttributes(node, { allowedHtmlAttrs: GENERIC_HTML_ATTRS, consumedProps: new Set(['title', 'auditLog', 'auditLogField', 'lastN', 'showTransitionCount', 'showLastTransitionTime', 'showLastActor']), htmlOverrides: { class: 'oods-audit-summary', 'aria-label': title } });
  const count = props.showTransitionCount === false ? '' : `<dt>Transitions</dt><dd>${summary.count}</dd>`;
  const actor = props.showLastActor === false ? '' : `<dt>Last actor</dt><dd>${escapeHtml(summary.actor)}</dd>`;
  const time = props.showLastTransitionTime === false ? '' : `<dt>Last transition</dt><dd>${summary.at ? `<time datetime="${escapeHtml(summary.at)}">${escapeHtml(summary.timestamp)}</time>` : summary.timestamp}</dd>`;
  const recent = summary.recent.length ? `<ol aria-label="Recent transitions">${summary.recent.map(entry => `<li>${escapeHtml(String(entry.to_state ?? 'Transition'))}</li>`).join('')}</ol>` : '';
  return `<section${attrs}><h2>${escapeHtml(title)}</h2><dl>${count}${actor}${time}</dl>${recent}</section>`;
}

function renderSortIndicator(node: UiElement): string {
  const props = node.props ?? {};
  const state = initialSort({ sortField: asString(props.sortField), sortDirection: asString(props.sortDirection), sortActive: props.sortActive === true, defaultSortField: asString(props.defaultSortField), defaultSortDirection: asString(props.defaultSortDirection), sortableFields: Array.isArray(props.sortableFields) ? props.sortableFields.filter((field): field is string => typeof field === 'string') : undefined });
  const label = asString(props.label) ?? 'Sort';
  const attrs = buildAttributes(node, { allowedHtmlAttrs: GENERIC_HTML_ATTRS, consumedProps: new Set(['sortField', 'sortDirection', 'sortActive', 'sortableFields', 'triStateSort', 'defaultSortField', 'defaultSortDirection', 'label']), htmlOverrides: { class: 'oods-sort-indicator', 'aria-label': label } });
  return `<table${attrs}><thead><tr><th scope="col" aria-sort="${ariaSort(state)}"><button type="button" aria-label="${escapeHtml(`${label} ${state.field}`)}">${escapeHtml(`${state.field}: ${ariaSort(state)}`)}</button></th></tr></thead></table>`;
}

function renderTimelineEntryLabel(node: UiElement, childrenHtml = ''): string {
  const props = node.props ?? {};
  const { compact = true, ...rest } = props;
  return renderInlineLabel({ ...node, props: { ...rest, maxLength: props.maxLength ?? (compact ? 40 : undefined), 'data-timeline-label': 'true', 'data-compact': compact } }, childrenHtml);
}

function renderAuditEvent(node: UiElement, childrenHtml = ''): string {
  return renderEventArticle(node, childrenHtml, {
    defaultLabel: 'Audit Event',
    eventType: 'audit',
  });
}

function renderTraitEvent(node: UiElement, kind: TraitEventKind, defaultTitle: string): string {
  const props = node.props ?? {};
  const title = asString(props.title) ?? defaultTitle;
  const rows = traitEventRows(kind, props);
  // s223-m01 (#2527 ruling 7): a card with no events renders nothing, as in React and Vue.
  if (!rows.length) return '';
  const content = `<ol>${rows.map(row => `<li><strong>${escapeHtml(row.title)}</strong><p>${row.at ? `<time datetime="${escapeHtml(row.at)}">${escapeHtml(row.time)}</time>` : escapeHtml(row.time)}</p>${row.actor ? `<p>Actor: ${escapeHtml(row.actor)}</p>` : ''}${row.reason ? `<p>Reason: ${escapeHtml(row.reason)}</p>` : ''}${row.code ? `<p>Code: ${escapeHtml(row.code)}</p>` : ''}</li>`).join('')}</ol>`;
  return `<article id="${escapeHtml(node.id)}" class="oods-trait-recipe" data-oods-component="${node.component}" aria-label="${escapeHtml(title)}"><h2>${escapeHtml(title)}</h2>${content}</article>`;
}
function renderArchiveEvent(node: UiElement): string { return renderTraitEvent(node, 'archive', 'Archive events'); }
function renderCancellationEvent(node: UiElement): string { return renderTraitEvent(node, 'cancellation', 'Cancellation event'); }
function renderStateTransitionEvent(node: UiElement): string { return renderTraitEvent(node, 'transition', 'State transitions'); }

function renderRelativeTimestamp(node: UiElement): string {
  const props = isRecord(node.props) ? node.props : {};
  const datetime = firstSerialized(props, ['datetime', 'timestamp', 'value', 'updatedAt', 'createdAt']);
  if (props.hideWhenEmpty === true && (!datetime || Number.isNaN(Date.parse(datetime)))) return '';
  // An empty or unreadable value reads "Unknown time", as React and Vue show it (s222 ruling 16).
  const relative = firstSerialized(props, ['relative', 'label', 'text', 'value']) ?? (formatDateTime(datetime) || 'Unknown time');
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: new Set(['datetime', 'title']),
    consumedProps: new Set(['datetime', 'timestamp', 'value', 'updatedAt', 'createdAt', 'relative', 'label', 'text', 'hideWhenEmpty']),
    htmlOverrides: datetime ? { datetime } : undefined,
  });
  return `<time${attrs}>${escapeHtml(relative)}</time>`;
}

type SummaryField = {
  term: string;
  keys: string[];
  format?: (value: unknown) => string | undefined;
};

type SummaryOptions = {
  defaultTitle: string;
  summaryType: string;
  fields: SummaryField[];
};

function renderSummarySection(node: UiElement, childrenHtml: string, options: SummaryOptions): string {
  const props = isRecord(node.props) ? node.props : {};
  const title = firstSerialized(props, ['title', 'label', 'heading', 'name']) ?? displayLabel(node) ?? options.defaultTitle;
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['title', 'label', 'heading', 'name']),
    dataOverrides: { 'data-summary-type': options.summaryType },
  });

  if (hasChildrenHtml(childrenHtml)) {
    return `<section${attrs}><h2 data-summary-title="true">${escapeHtml(title)}</h2>${childrenHtml}</section>`;
  }

  const entries = options.fields
    .map((field) => {
      const rawValue = field.keys
        .filter((key) => !isBindingKey(key))
        .map((key) => props[key])
        .find((value) => value !== undefined && value !== null);
      const value = field.format
        ? field.format(rawValue)
        : summaryValue(rawValue);
      if (!value) {
        // A field bound by name with no value supplied renders the shared unbound placeholder,
        // never the binding key as if it were data (Sprint 200 ten-minute run, item 4).
        const binding = boundField(props, field.keys);
        return binding ? `<div data-summary-item="true"><dt>${escapeHtml(field.term)}</dt>${unboundPlaceholder(binding, 'dd')}</div>` : '';
      }
      return `<div data-summary-item="true"><dt>${escapeHtml(field.term)}</dt><dd>${escapeHtml(value)}</dd></div>`;
    })
    .filter((entry) => entry.length > 0)
    .join('');
  const fallback = firstSerialized(props, ['summary', 'text', 'description']);
  const body = entries ? `<dl>${entries}</dl>` : fallback ? `<p data-summary-fallback="true">${escapeHtml(fallback)}</p>` : '<dl></dl>';
  return `<section${attrs}><h2 data-summary-title="true">${escapeHtml(title)}</h2>${body}</section>`;
}

/** Placeholder convention for a field bound by name without a value: one mark, machine-readable. */
export const UNBOUND_PLACEHOLDER = '\u2014';
const isBindingKey = (key: string) => key.endsWith('Field');
function boundField(props: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    if (isBindingKey(key) && typeof props[key] === 'string' && (props[key] as string).length > 0) return props[key] as string;
  }
  return undefined;
}
function unboundPlaceholder(field: string, tag: 'dd' | 'span'): string {
  return `<${tag} data-oods-placeholder="unbound-field" data-field="${escapeHtml(field)}">${UNBOUND_PLACEHOLDER}</${tag}>`;
}

type MetaOptions = {
  defaultTitle: string;
  metaType: string;
  fields: SummaryField[];
};

function renderMetaInline(node: UiElement, childrenHtml: string, options: MetaOptions): string {
  const props = isRecord(node.props) ? node.props : {};
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    dataOverrides: { 'data-meta-type': options.metaType },
  });
  if (hasChildrenHtml(childrenHtml)) {
    return `<div${attrs}>${childrenHtml}</div>`;
  }

  const title = firstSerialized(props, ['title', 'label', 'heading', 'name']) ?? displayLabel(node) ?? options.defaultTitle;
  const values = options.fields
    .map((field) => {
      const value = firstSerialized(props, field.keys.filter((key) => !isBindingKey(key)));
      if (!value) {
        const binding = boundField(props, field.keys);
        return binding ? `<span data-meta-item="true"><strong>${escapeHtml(field.term)}:</strong> ${unboundPlaceholder(binding, 'span')}</span>` : '';
      }
      return `<span data-meta-item="true"><strong>${escapeHtml(field.term)}:</strong> ${escapeHtml((field.format ? field.format(value) : undefined) ?? value)}</span>`;
    })
    .filter((entry) => entry.length > 0)
    .join('');
  return `<div${attrs}><span data-meta-title="true">${escapeHtml(title)}</span>${values}</div>`;
}

// s224-m01 (#2542 ruling 6): a summary that would only state its default ("Archived: No", "Cancel at period end: No")
// renders nothing when a detail page asks (hideWhenDefault), as React's and Vue's do. A term with no value ("Not
// recorded" for an empty code, the placeholder for a bound field with none) is not content, so it keeps no card.
const summaryHasValue = (props: Record<string, unknown>, keys: string[]) => keys.some((key) => props[key] !== undefined && props[key] !== null && props[key] !== '');
function summaryStatesOnlyDefault(props: Record<string, unknown>, flagKeys: string[], valueKeys: string[], childrenHtml: string): boolean {
  const flag = flagKeys.map((key) => props[key]).find((value) => value !== undefined && value !== null);
  return props.hideWhenDefault === true && flag === false && !summaryHasValue(props, valueKeys) && !hasChildrenHtml(childrenHtml);
}

function renderArchiveSummary(node: UiElement, childrenHtml = ''): string {
  if (summaryStatesOnlyDefault(node.props ?? {}, ['isArchived', 'archived', 'status'], ['archivedAt', 'reason', 'archiveReason'], childrenHtml)) return '';
  return renderSummarySection(node, childrenHtml, {
    defaultTitle: 'Archive Summary',
    summaryType: 'archive',
    fields: [
      { term: 'Archived', keys: ['isArchived', 'archived', 'status'] },
      { term: 'Archived At', keys: ['archivedAt', 'archivedAtField'], format: value => typeof value === 'string' ? formatDateTime(value) : undefined },
      { term: 'Reason', keys: ['reason', 'archiveReason', 'reasonField'] },
    ],
  });
}

function renderCancellationSummary(node: UiElement, childrenHtml = ''): string {
  if (summaryStatesOnlyDefault(node.props ?? {}, ['cancelAtPeriodEnd'], ['requestedAt', 'reason', 'cancellationReason', 'code'], childrenHtml)) return '';
  return renderSummarySection(node, childrenHtml, {
    defaultTitle: 'Cancellation Summary',
    summaryType: 'cancellation',
    fields: [
      {
        term: 'Cancel at period end',
        keys: ['cancelAtPeriodEnd', 'cancelAtPeriodEndField'],
        format: (value) => typeof value === 'boolean'
          ? (value ? 'Yes' : 'No')
          : (value === undefined || value === null ? undefined : serializePropValue(value)),
      },
      { term: 'Requested at', keys: ['requestedAt', 'requestedAtField'], format: value => typeof value === 'string' ? formatDateTime(value) : undefined },
      { term: 'Reason', keys: ['reason', 'cancellationReason', 'reasonField'] },
      { term: 'Code', keys: ['code', 'codeField'], format: value => value == null ? undefined : formatReadOnlyValue(value, 'string', true) },
    ],
  });
}

function renderOwnershipSummary(node: UiElement, childrenHtml = ''): string {
  const props = node.props ?? {};
  return renderSummarySection(node, childrenHtml, {
    defaultTitle: 'Ownership Summary',
    summaryType: 'ownership',
    fields: [
      { term: 'Owner', keys: ['ownerId', 'owner_id', 'ownerIdField'], format: value => value === undefined && (props.ownerIdField || !['ownerId', 'owner_id', 'ownerLabel'].some(key => props[key] !== undefined)) ? undefined : formatReferenceLabel(value, props.ownerLabel, 'Owner') },
      { term: 'Owner Type', keys: ['ownerType', 'owner_type', 'ownerTypeField'] },
      { term: 'Role', keys: ['role', 'ownershipRole', 'roleField'] },
    ],
  });
}

function renderPriceSummary(node: UiElement, childrenHtml = ''): string {
  const props = node.props ?? {};
  return renderSummarySection(node, childrenHtml, {
    defaultTitle: 'Price Summary',
    summaryType: 'price',
    fields: [
      { term: 'Amount', keys: ['amount', 'amountCents', 'unitAmountCents', 'amountField'], format: value => value === undefined && (props.amountField || !['amount', 'amountCents', 'unitAmountCents', 'currency', 'currencyCode', 'model', 'pricingModel', 'interval', 'billingInterval'].some(key => props[key] !== undefined)) ? undefined : formatPriceAmount(value, firstSerialized(props, ['currency', 'currencyCode']), typeof props.minorUnits === 'number' ? props.minorUnits : undefined) },
      { term: 'Currency', keys: ['currency', 'currencyCode', 'currencyField'] },
      { term: 'Model', keys: ['model', 'pricingModel', 'modelField'], format: formatPriceCode },
      { term: 'Interval', keys: ['interval', 'billingInterval', 'intervalField'], format: formatPriceCode },
    ],
  });
}

function renderTagSummary(node: UiElement, childrenHtml = ''): string {
  return renderSummarySection(node, childrenHtml, {
    defaultTitle: 'Tag Summary',
    summaryType: 'tags',
    fields: [
      { term: 'Tag Count', keys: ['tagCount', 'count', 'countField'] },
      { term: 'Tags', keys: ['tags', 'field'] },
    ],
  });
}

function renderGeocodablePreview(node: UiElement, childrenHtml = ''): string {
  return renderSummarySection(node, childrenHtml, {
    defaultTitle: 'Geocodable Preview',
    summaryType: 'geocodable',
    fields: [
      { term: 'Resolution', keys: ['resolution', 'geoResolution', 'resolutionField'] },
      { term: 'Requires Lookup', keys: ['requiresLookup', 'requiresLookupField'] },
      { term: 'Detected Fields', keys: ['detectedFields', 'detectedFieldsField'] },
    ],
  });
}

function renderOwnershipMeta(node: UiElement, childrenHtml = ''): string {
  // s223-m01 (#2527 ruling 6): given the owner's label (a generated card binds it), one phrase, as React and Vue write it.
  const props = isRecord(node.props) ? node.props : {};
  if (!hasChildrenHtml(childrenHtml) && props.ownerLabel !== undefined) {
    const phrase = ownershipPhrase(props.ownerLabel, firstSerialized(props, ['ownerType', 'owner_type']), firstSerialized(props, ['role', 'ownershipRole']));
    if (phrase) {
      const attrs = buildAttributes(node, { allowedHtmlAttrs: GENERIC_HTML_ATTRS, dataOverrides: { 'data-meta-type': 'ownership' } });
      return `<div${attrs}><span data-meta-item="true">${escapeHtml(phrase)}</span></div>`;
    }
  }
  return renderMetaInline(node, childrenHtml, {
    defaultTitle: 'Ownership',
    metaType: 'ownership',
    fields: [
      { term: 'Owner Type', keys: ['ownerType', 'owner_type', 'ownerTypeField'] },
      { term: 'Role', keys: ['role', 'ownershipRole', 'roleField'] },
    ],
  });
}

function renderPriceCardMeta(node: UiElement, childrenHtml = ''): string {
  return renderMetaInline(node, childrenHtml, {
    defaultTitle: 'Price',
    metaType: 'price',
    // s220-m01: the terms read as PriceSummary's do; "Model: one_time" showed the raw code on a Transaction card.
    fields: [
      { term: 'Model', keys: ['model', 'pricingModel', 'modelField'], format: formatPriceCode },
      { term: 'Interval', keys: ['interval', 'billingInterval', 'intervalField'], format: formatPriceCode },
    ],
  });
}

function renderTagPills(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['tags', 'value', 'maxVisible', 'overflowLabel']),
    dataOverrides: { 'data-summary-type': 'tag-pills' },
  });
  if (hasChildrenHtml(childrenHtml)) {
    return `<div${attrs}>${childrenHtml}</div>`;
  }

  const tags = normalizeBadgeItems(props.tags ?? props.value);
  const maxVisible = asNumber(props.maxVisible) ?? tags.length;
  const visible = tags.slice(0, Math.max(0, maxVisible));
  const overflow = tags.length - visible.length;
  const overflowTemplate = firstSerialized(props, ['overflowLabel']);
  const overflowLabel = overflow > 0
    ? overflowTemplate
      ? overflowTemplate.replace('{{ tag_count }}', String(tags.length))
      : `+${overflow}`
    : '';
  const pillHtml = visible.map((tag) => `<span data-tag-pill="true">${escapeHtml(tag)}</span>`).join('');
  const overflowHtml = overflowLabel ? `<span data-tag-overflow="true">${escapeHtml(overflowLabel)}</span>` : '';
  return `<div${attrs}>${pillHtml}${overflowHtml}</div>`;
}

function renderStatusSelector(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['help', 'label', 'title', 'options', 'states', 'value', 'status']),
    dataOverrides: { 'data-summary-type': 'status-selector' },
  });
  const label = firstSerialized(props, ['label', 'title']) ?? displayLabel(node) ?? 'Status';
  const options = props.options ?? props.states ?? ['draft', 'active', 'inactive'];
  const selected = props.value ?? props.status;
  const control = renderSelectControl(label, 'status', options, selected);
  const content = hasChildrenHtml(childrenHtml) ? childrenHtml : control;
  return `<div${attrs}>${content}${props.help ? `<p class="oods-field-help">${escapeHtml(String(props.help))}</p>` : ''}</div>`;
}

function renderColorSwatch(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const color = firstSerialized(props, ['color', 'value', 'state']) ?? 'default';
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['color', 'value', 'state', 'label']),
    dataOverrides: { 'data-summary-type': 'color-swatch', 'data-swatch-color': color },
  });
  const label = firstSerialized(props, ['label']) ?? color;
  const content = hasChildrenHtml(childrenHtml) ? childrenHtml : escapeHtml(label);
  return `<span${attrs}>${content}</span>`;
}

function renderStatusColorLegend(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['entries', 'legend', 'colorStates']),
    dataOverrides: { 'data-summary-type': 'status-color-legend' },
  });
  if (hasChildrenHtml(childrenHtml)) {
    return `<section${attrs}>${childrenHtml}</section>`;
  }

  const rawEntries = props.entries ?? props.legend ?? props.colorStates;
  const entries = Array.isArray(rawEntries) ? rawEntries : [];
  const legendItems = entries
    .map((entry) => {
      if (!isRecord(entry)) return '';
      const label = firstSerialized(entry, ['label', 'state', 'name']) ?? 'State';
      const color = firstSerialized(entry, ['color', 'value']) ?? '';
      return `<div data-legend-item="true"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(color)}</dd></div>`;
    })
    .filter((entry) => entry.length > 0)
    .join('');
  return `<section${attrs}><h2 data-summary-title="true">${escapeHtml(displayLabel(node) ?? 'Status Color Legend')}</h2><dl>${legendItems}</dl></section>`;
}

function renderVizPreview(node: UiElement, childrenHtml: string, previewType: string, defaultLabel: string): string {
  const props = isRecord(node.props) ? node.props : {};
  const width = firstSerialized(props, ['width']) ?? '640';
  const height = firstSerialized(props, ['height']) ?? '360';
  const svg = typeof props.svg === 'string' ? assertStaticSvg(props.svg) : undefined;
  const svgNarrow = svg !== undefined && typeof props.svgNarrow === 'string' ? assertStaticSvg(props.svgNarrow) : undefined;
  const svgWide = svg !== undefined && typeof props.svgWide === 'string' ? assertStaticSvg(props.svgWide) : undefined;
  const title = typeof props.title === 'string' ? props.title : undefined;
  const description = typeof props.description === 'string' ? props.description : undefined;
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['width', 'height', 'svg', 'svgNarrow', 'svgWide', ...VIZ_THEME_SVG_PROPS, 'title', 'description']),
    htmlOverrides: svg !== undefined ? { role: 'img', 'aria-label': title ?? description ?? (previewType === 'area' ? 'Payment amounts' : `${defaultLabel} chart`), style: `--oods-viz-width:${width}px` } : {},
    dataOverrides: {
      'data-viz-preview-type': previewType,
      'data-viz-width': width,
      'data-viz-height': height,
      ...(svg !== undefined ? { 'data-viz-rendered': 'true' } : {}),
      ...(svgNarrow !== undefined ? { 'data-viz-narrow': 'true' } : {}),
      ...(svgWide !== undefined ? { 'data-viz-wide': 'true' } : {}),
    },
  });
  // s222-m02 (#2502 ruling 12, F7): the renders in the one layout React and Vue render too (vizPreviewLayers).
  const renders = (layer: VizPreviewLayer) => layer.renders.map(([attribute, markup]) => `<div ${attribute}="true">${markup}</div>`).join('');
  const layers = vizPreviewLayers(props).map(layer => layer.theme === undefined ? renders(layer)
    : `<div data-viz-theme="${layer.theme}"${layer.narrow ? ' data-viz-narrow="true"' : ''}${layer.wide ? ' data-viz-wide="true"' : ''}>${renders(layer)}</div>`).join('');
  if (svg !== undefined) return `<figure${attrs}>${title && !svgCarriesTitle(svg, title) ? `<figcaption>${escapeHtml(title)}</figcaption>` : ''}${layers}${description ? `<p data-viz-description="true">${escapeHtml(description)}</p>` : ''}</figure>`;
  const content = hasChildrenHtml(childrenHtml)
    ? childrenHtml
    : `<div data-viz-preview-placeholder="true">${escapeHtml(defaultLabel)} preview (${escapeHtml(width)} x ${escapeHtml(height)})</div>`;
  return `<div${attrs}>${content}</div>`;
}

function renderVizAreaControls(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const body = [
    renderSelectControl('Curve', 'curve', props.curves ?? ['linear', 'monotone', 'step'], props.curve),
    renderInputControl('Opacity', 'opacity', firstSerialized(props, ['opacity']), { type: 'number' }),
    renderInputControl('Baseline', 'baseline', firstSerialized(props, ['baseline'])),
    renderInputControl('Tension', 'tension', firstSerialized(props, ['tension']), { type: 'number' }),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'fieldset',
    defaultTitle: 'Viz Area Controls',
    formType: 'viz-area-controls',
  });
}

function renderVizAreaPreview(node: UiElement, childrenHtml = ''): string {
  return renderVizPreview(node, childrenHtml, 'area', 'Area');
}

function renderVizMarkControls(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const body = [
    renderSelectControl('Orientation', 'orientation', props.orientations ?? ['vertical', 'horizontal'], props.orientation),
    renderInputControl('Band Padding', 'bandPadding', firstSerialized(props, ['padding']), { type: 'number' }),
    renderSelectControl('Stacking', 'stacking', props.stackModes ?? ['none', 'stack'], props.stacking),
    renderInputControl('Corner Radius', 'cornerRadius', firstSerialized(props, ['cornerRadius']), { type: 'number' }),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'fieldset',
    defaultTitle: 'Viz Mark Controls',
    formType: 'viz-mark-controls',
  });
}

function renderVizMarkPreview(node: UiElement, childrenHtml = ''): string {
  return renderVizPreview(node, childrenHtml, 'mark', 'Mark');
}

function renderVizLineControls(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const body = [
    renderSelectControl('Curve', 'curve', props.curves ?? ['linear', 'monotone'], props.curve),
    renderInputControl('Stroke Width', 'strokeWidth', firstSerialized(props, ['strokeWidth']), { type: 'number' }),
    renderSelectControl('Line Join', 'lineJoin', props.joins ?? ['round', 'bevel', 'miter'], props.lineJoin),
    renderSelectControl('Markers', 'markers', props.markerModes ?? ['none', 'auto', 'all'], props.markers),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'fieldset',
    defaultTitle: 'Viz Line Controls',
    formType: 'viz-line-controls',
  });
}

function renderVizGraphPreview(node: UiElement, childrenHtml = ''): string {
  return renderVizPreview(node, childrenHtml, 'force_graph', 'Graph');
}

function renderVizLinePreview(node: UiElement, childrenHtml = ''): string {
  return renderVizPreview(node, childrenHtml, 'line', 'Line');
}

function renderVizPointControls(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const body = [
    renderSelectControl('Shape', 'shape', props.shapes ?? ['circle', 'square', 'diamond'], props.shape),
    renderInputControl('Size', 'size', firstSerialized(props, ['size']), { type: 'number' }),
    renderInputControl('Opacity', 'opacity', firstSerialized(props, ['opacity']), { type: 'number' }),
    renderInputControl('Stroke Width', 'strokeWidth', firstSerialized(props, ['strokeWidth']), { type: 'number' }),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'fieldset',
    defaultTitle: 'Viz Point Controls',
    formType: 'viz-point-controls',
  });
}

function renderVizPointPreview(node: UiElement, childrenHtml = ''): string {
  return renderVizPreview(node, childrenHtml, 'point', 'Point');
}

function renderVizScatterControls(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const body = [
    renderSelectControl('Shape', 'shape', props.shapes ?? ['circle', 'square', 'diamond', 'triangle'], props.shape),
    renderInputControl('Size', 'size', firstSerialized(props, ['size']), { type: 'number' }),
    renderInputControl('Opacity', 'opacity', firstSerialized(props, ['opacity']), { type: 'number' }),
    renderInputControl('Jitter', 'jitter', firstSerialized(props, ['jitter']), { type: 'number' }),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'fieldset',
    defaultTitle: 'Viz Scatter Controls',
    formType: 'viz-scatter-controls',
  });
}

function renderVizScatterPreview(node: UiElement, childrenHtml = ''): string {
  return renderVizPreview(node, childrenHtml, 'scatter', 'Scatter');
}

function renderVizHeatmapControls(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const body = [
    renderSelectControl('Color Scheme', 'scheme', props.schemes ?? ['viridis', 'inferno', 'plasma', 'blues'], props.scheme),
    renderInputControl('Cell Padding', 'cellPadding', firstSerialized(props, ['cellPadding']), { type: 'number' }),
    renderInputControl('Corner Radius', 'cornerRadius', firstSerialized(props, ['cornerRadius']), { type: 'number' }),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'fieldset',
    defaultTitle: 'Viz Heatmap Controls',
    formType: 'viz-heatmap-controls',
  });
}

function renderVizHeatmapPreview(node: UiElement, childrenHtml = ''): string {
  return renderVizPreview(node, childrenHtml, 'heatmap', 'Heatmap');
}

function renderVizOpacityControls(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const body = [
    renderInputControl('Min Opacity', 'minOpacity', firstSerialized(props, ['min']), { type: 'number' }),
    renderInputControl('Max Opacity', 'maxOpacity', firstSerialized(props, ['max']), { type: 'number' }),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'fieldset',
    defaultTitle: 'Viz Opacity Controls',
    formType: 'viz-opacity-controls',
  });
}

function renderVizOpacitySummary(node: UiElement, childrenHtml = ''): string {
  return renderSummarySection(node, childrenHtml, {
    defaultTitle: 'Viz Opacity Summary',
    summaryType: 'viz-opacity-summary',
    fields: [
      { term: 'Field', keys: ['opacityField', 'field'] },
      { term: 'Min', keys: ['min', 'minOpacity'] },
      { term: 'Max', keys: ['max', 'maxOpacity'] },
    ],
  });
}

function renderVizShapeControls(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const body = [
    renderSelectControl('Shape Set', 'shapeSet', props.shapeSets ?? ['default', 'filled', 'outlined'], props.shapeSet),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'fieldset',
    defaultTitle: 'Viz Shape Controls',
    formType: 'viz-shape-controls',
  });
}

function renderVizShapeLegend(node: UiElement, childrenHtml = ''): string {
  return renderSummarySection(node, childrenHtml, {
    defaultTitle: 'Viz Shape Legend',
    summaryType: 'viz-shape-legend',
    fields: [
      { term: 'Field', keys: ['shapeField', 'field'] },
      { term: 'Shape Set', keys: ['shapeSet'] },
    ],
  });
}

function renderVizColorControls(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const body = [
    renderSelectControl('Scheme', 'scheme', props.schemes ?? ['blues', 'greens', 'viridis'], props.scheme),
    renderSelectControl('Channel', 'channel', props.channels ?? ['fill', 'stroke'], props.channel),
    renderSelectControl('Redundancy', 'redundancy', props.redundancyModes ?? ['none', 'shape', 'label'], props.redundancy),
    renderInputControl('Min Contrast', 'minContrast', firstSerialized(props, ['minContrast']), { type: 'number' }),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'fieldset',
    defaultTitle: 'Viz Color Controls',
    formType: 'viz-color-controls',
  });
}

function renderVizColorLegendConfig(node: UiElement, childrenHtml = ''): string {
  return renderSummarySection(node, childrenHtml, {
    defaultTitle: 'Viz Color Legend',
    summaryType: 'viz-color-legend',
    fields: [
      { term: 'Field', keys: ['field', 'colorField'] },
      { term: 'Scheme', keys: ['scheme', 'colorScheme'] },
      { term: 'Redundancy', keys: ['redundancy', 'redundancyMode'] },
    ],
  });
}

function renderVizEncodingBadge(node: UiElement, childrenHtml = ''): string {
  return renderBadgePrimitive(node, childrenHtml, {
    defaultLabel: 'Encoding',
    labelKeys: ['label', 'axis', 'field', 'text', 'value'],
    statusKeys: ['axis', 'field', 'status'],
    defaultVariant: 'viz-encoding',
  });
}

function renderVizAxisControls(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const body = [
    renderInputControl('X Field', 'xField', firstSerialized(props, ['xField'])),
    renderInputControl('Y Field', 'yField', firstSerialized(props, ['yField'])),
    renderSelectControl('Scale', 'scale', props.scales ?? ['linear', 'band', 'temporal'], props.scale),
    renderInputControl('Axis Title', 'axisTitle', firstSerialized(props, ['axisTitle'])),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'fieldset',
    defaultTitle: 'Viz Axis Controls',
    formType: 'viz-axis-controls',
  });
}

function renderVizAxisSummary(node: UiElement, childrenHtml = ''): string {
  return renderSummarySection(node, childrenHtml, {
    defaultTitle: 'Viz Axis Summary',
    summaryType: 'viz-axis-summary',
    fields: [
      { term: 'Axis', keys: ['axis'] },
      { term: 'Title', keys: ['axisTitle', 'title'] },
      { term: 'Scale', keys: ['scale'] },
      { term: 'Zero', keys: ['zero', 'includeZero'] },
    ],
  });
}

function renderVizSizeControls(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const body = [
    renderSelectControl('Strategy', 'strategy', props.strategies ?? ['range', 'area'], props.strategy),
    renderInputControl('Min Size', 'minSize', firstSerialized(props, ['min']), { type: 'number' }),
    renderInputControl('Max Size', 'maxSize', firstSerialized(props, ['max']), { type: 'number' }),
    renderInputControl('Max Area', 'maxArea', firstSerialized(props, ['maxArea']), { type: 'number' }),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'fieldset',
    defaultTitle: 'Viz Size Controls',
    formType: 'viz-size-controls',
  });
}

function renderVizSizeSummary(node: UiElement, childrenHtml = ''): string {
  return renderSummarySection(node, childrenHtml, {
    defaultTitle: 'Viz Size Summary',
    summaryType: 'viz-size-summary',
    fields: [
      { term: 'Field', keys: ['field'] },
      { term: 'Strategy', keys: ['strategy'] },
      { term: 'Min', keys: ['min'] },
      { term: 'Max', keys: ['max'] },
    ],
  });
}

function renderVizScaleControls(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const body = [
    renderSelectControl('Scale Type', 'scaleType', props.types ?? ['linear', 'temporal'], props.type),
    renderInputControl('Domain Min', 'domainMin', firstSerialized(props, ['domainMin']), { type: 'number' }),
    renderInputControl('Domain Max', 'domainMax', firstSerialized(props, ['domainMax']), { type: 'number' }),
    renderInputControl('Range Min', 'rangeMin', firstSerialized(props, ['rangeMin']), { type: 'number' }),
    renderInputControl('Range Max', 'rangeMax', firstSerialized(props, ['rangeMax']), { type: 'number' }),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'fieldset',
    defaultTitle: 'Viz Scale Controls',
    formType: 'viz-scale-controls',
  });
}

function renderVizScaleSummary(node: UiElement, childrenHtml = ''): string {
  return renderSummarySection(node, childrenHtml, {
    defaultTitle: 'Viz Scale Summary',
    summaryType: 'viz-scale-summary',
    fields: [
      { term: 'Type', keys: ['type'] },
      { term: 'Domain Min', keys: ['domainMin'] },
      { term: 'Domain Max', keys: ['domainMax'] },
      { term: 'Mode', keys: ['mode'] },
      { term: 'Timezone', keys: ['timezone'] },
    ],
  });
}

function renderVizRoleBadge(node: UiElement, childrenHtml = ''): string {
  return renderBadgePrimitive(node, childrenHtml, {
    defaultLabel: 'Viz Role',
    labelKeys: ['label', 'role', 'markRole', 'text', 'value'],
    statusKeys: ['role', 'status'],
    defaultVariant: 'viz-role',
  });
}

function normalizeColumns(rawColumns: unknown, rows: unknown[]): TableColumn[] {
  if (Array.isArray(rawColumns) && rawColumns.length > 0) {
    return rawColumns
      .map((entry, index) => {
        if (isRecord(entry)) {
          const key = asString(entry.key) ?? asString(entry.id) ?? `col-${index + 1}`;
          const label = asString(entry.label) ?? key;
          return { key, label, numeric: entry.numeric === true };
        }
        const text = serializePropValue(entry);
        return { key: text || `col-${index + 1}`, label: text || `Column ${index + 1}` };
      })
      .filter((entry) => entry.key.length > 0);
  }

  const firstRow = rows.find((row) => isRecord(row) || Array.isArray(row));
  if (isRecord(firstRow)) {
    return Object.keys(firstRow).map((key) => ({ key, label: key }));
  }
  if (Array.isArray(firstRow)) {
    return firstRow.map((_, index) => ({ key: `col-${index + 1}`, label: `Column ${index + 1}` }));
  }
  return [];
}

function normalizeRows(rawRows: unknown): unknown[] {
  return Array.isArray(rawRows) ? rawRows : [];
}

// s222-m02 (#2502 ruling 11): the Table markup React and Vue render: the bordered container, the density, the caption
// (visually hidden when showCaption is false) and numeric cells aligned at the end.
function renderTable(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const rows = normalizeRows(props.rows);
  const columns = normalizeColumns(props.columns, rows);
  const density = asString(props.density) ?? 'comfortable';
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: TABLE_HTML_ATTRS,
    consumedProps: new Set(['columns', 'rows', 'caption', 'density', 'showCaption', 'selectable']),
    htmlOverrides: { class: 'oods-table' },
    dataOverrides: { 'data-density': density },
  });
  const caption = asString(props.caption);
  const captionHtml = caption
    ? `<caption class="oods-table__caption"${props.showCaption === false ? ' data-visually-hidden="true"' : ''}>${escapeHtml(caption)}</caption>`
    : '';
  const container = (table: string) => `<div class="oods-table__container" data-density="${escapeHtml(density)}">${table}</div>`;

  if (columns.length === 0 || rows.length === 0) {
    return container(`<table${attrs}>${captionHtml}${childrenHtml}</table>`);
  }

  const numeric = (column: TableColumn, part: 'header-cell' | 'cell') => column.numeric ? ` class="oods-table__${part} oods-table__${part}--numeric" data-numeric="true"` : ` class="oods-table__${part}"`;
  const thead = `<thead class="oods-table__header"><tr class="oods-table__row">${columns.map((column) => `<th scope="col"${numeric(column, 'header-cell')}>${escapeHtml(column.label)}</th>`).join('')}</tr></thead>`;
  const tbodyRows = rows
    .map((row) => {
      if (isRecord(row)) {
        const cells = columns.map((column) => `<td${numeric(column, 'cell')}>${escapeHtml(serializePropValue(row[column.key]))}</td>`).join('');
        return `<tr class="oods-table__row">${cells}</tr>`;
      }
      if (Array.isArray(row)) {
        const cells = columns
          .map((column, index) => `<td${numeric(column, 'cell')}>${escapeHtml(serializePropValue(row[index]))}</td>`)
          .join('');
        return `<tr class="oods-table__row">${cells}</tr>`;
      }
      return `<tr class="oods-table__row"><td class="oods-table__cell" colspan="${columns.length}">${escapeHtml(serializePropValue(row))}</td></tr>`;
    })
    .join('');

  return container(`<table${attrs}>${captionHtml}${thead}<tbody class="oods-table__body">${tbodyRows}</tbody></table>`);
}

function normalizeTabs(rawTabs: unknown, activeTab: unknown, nodeId: string): TabItem[] {
  if (!Array.isArray(rawTabs)) return [];
  const activeId = asString(activeTab);
  const tabs: TabItem[] = [];
  for (let index = 0; index < rawTabs.length; index += 1) {
    const entry = rawTabs[index];
    if (isRecord(entry)) {
      const id = asString(entry.id) ?? `${nodeId}-tab-${index + 1}`;
      const label = asString(entry.label) ?? asString(entry.title) ?? `Tab ${index + 1}`;
      const panel = asString(entry.panel) ?? asString(entry.content) ?? '';
      const disabled = entry.disabled === true || entry.isDisabled === true;
      const active = !disabled && (Boolean(entry.active) || (activeId ? activeId === id : index === 0));
      tabs.push({ id, label, panel, active, disabled });
      continue;
    }
    const label = serializePropValue(entry) || `Tab ${index + 1}`;
    const id = `${nodeId}-tab-${index + 1}`;
    tabs.push({
      id,
      label,
      panel: '',
      active: activeId ? activeId === id : index === 0,
      disabled: false,
    });
  }
  if (!tabs.some((tab) => tab.active)) {
    const firstEnabled = tabs.find((tab) => !tab.disabled);
    if (firstEnabled) firstEnabled.active = true;
  }
  return tabs;
}

function renderTabs(
  node: UiElement,
  childrenHtml = '',
  renderedChildren: readonly string[] = [],
): string {
  const props = isRecord(node.props) ? node.props : {};
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set([
      'activeTab',
      'aria-label',
      'defaultSelectedId',
      'items',
      'overflowLabel',
      'selectedId',
      'size',
      'tabs',
    ]),
    dataOverrides: {
      ...(props.size !== undefined ? { 'data-size': props.size } : {}),
      ...(props.overflowLabel !== undefined ? { 'data-overflow-label': props.overflowLabel } : {}),
    },
  });

  const tabs = normalizeTabs(
    props.items ?? props.tabs,
    props.selectedId ?? props.defaultSelectedId ?? props.activeTab,
    node.id,
  );
  if (tabs.length === 0) {
    return `<section${attrs}>${childrenHtml}</section>`;
  }

  const tabButtons = tabs
    .map((tab, index) => {
      const buttonId = `${node.id}-tab-button-${index + 1}`;
      const panelId = `${node.id}-tab-panel-${index + 1}`;
      return `<button class="oods-tab" role="tab" type="button" id="${escapeHtml(buttonId)}" aria-controls="${escapeHtml(panelId)}" aria-selected="${tab.active ? 'true' : 'false'}" tabindex="${tab.active ? '0' : '-1'}"${tab.disabled ? ' disabled' : ''}>${escapeHtml(tab.label)}</button>`;
    })
    .join('');

  const tabPanels = tabs
    .map((tab, index) => {
      const buttonId = `${node.id}-tab-button-${index + 1}`;
      const panelId = `${node.id}-tab-panel-${index + 1}`;
      const panelContent = renderedChildren[index] ?? escapeHtml(tab.panel);
      return `<div class="oods-tab-panel" role="tabpanel" id="${escapeHtml(panelId)}" aria-labelledby="${escapeHtml(buttonId)}"${tab.active ? '' : ' hidden'}>${panelContent}</div>`;
    })
    .join('');

  const ariaLabel = asString(props['aria-label']);
  const tabListLabel = ariaLabel ? ` aria-label="${escapeHtml(ariaLabel)}"` : '';
  const behavior = '<script data-oods-runtime="tabs">(()=>{const root=document.currentScript&&document.currentScript.previousElementSibling;if(!root)return;const tabs=[...root.querySelectorAll(\'[role="tab"]\')];const panels=[...root.querySelectorAll(\'[role="tabpanel"]\')];const select=(tab)=>{if(tab.disabled)return;tabs.forEach((item,index)=>{const active=item===tab;item.setAttribute(\'aria-selected\',String(active));item.tabIndex=active?0:-1;if(panels[index])panels[index].hidden=!active;});tab.focus();};tabs.forEach((tab)=>{tab.addEventListener(\'click\',()=>select(tab));tab.addEventListener(\'keydown\',(event)=>{const enabled=tabs.filter((item)=>!item.disabled);const index=enabled.indexOf(tab);let next;if(event.key===\'Home\')next=enabled[0];else if(event.key===\'End\')next=enabled[enabled.length-1];else if(event.key===\'ArrowRight\'||event.key===\'ArrowDown\')next=enabled[(index+1)%enabled.length];else if(event.key===\'ArrowLeft\'||event.key===\'ArrowUp\')next=enabled[(index-1+enabled.length)%enabled.length];if(next){event.preventDefault();select(next);}});});})();</script>';
  return `<section${attrs}><div class="oods-tab-list" role="tablist"${tabListLabel}>${tabButtons}</div>${tabPanels}</section>${behavior}`;
}

function renderFallback(node: UiElement, childrenHtml = ''): string {
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    dataOverrides: { 'data-oods-fallback': 'true' },
  });
  const label = escapeHtml(`Unknown component: ${node.component}`);
  return `<div${attrs}><span data-oods-fallback-label="true">${label}</span>${childrenHtml}</div>`;
}

function renderSearchInput(node: UiElement): string {
  const props = isRecord(node.props) ? node.props : {};
  const placeholder = asString(props.placeholder) ?? 'Search...';
  const label = asString(props.label) ?? 'Search';
  const inputId = `${node.id}-input`;
  const value = asString(props.value) ?? '';
  const clearable = props.clearable !== false;
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['label', 'placeholder', 'value', 'clearable', 'field', 'debounce', 'minQueryLength']),
    dataOverrides: { 'data-behavioral': 'search' },
  });
  const clearBtn = clearable && value
    ? ' <button type="button" data-search-clear="true" aria-label="Clear search">&times;</button>'
    : '';
  return `<div${attrs} role="search" aria-label="${escapeHtml(label)}"><label for="${escapeHtml(inputId)}">${escapeHtml(label)}</label><input id="${escapeHtml(inputId)}" type="search" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(value)}" />${clearBtn}</div>`;
}

function renderPaginationBar(node: UiElement): string {
  const props = isRecord(node.props) ? node.props : {};
  const page = asNumber(props.page) ?? 1;
  const pageSize = asNumber(props.pageSize) ?? 25;
  const totalItems = asNumber(props.totalItems) ?? 0;
  const totalPages = asNumber(props.totalPages) ?? (pageSize > 0 ? Math.ceil(totalItems / pageSize) : 0);
  const showItemRange = props.showItemRange !== false;
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['page', 'pageSize', 'totalItems', 'totalPages', 'showItemRange', 'showPageSizeSelector', 'showGotoPage', 'pageSizeOptions']),
    dataOverrides: { 'data-behavioral': 'pagination' },
  });
  const start = Math.min((page - 1) * pageSize + 1, totalItems);
  const end = Math.min(page * pageSize, totalItems);
  const rangeHtml = showItemRange && totalItems > 0
    ? `<span data-pagination-range="true">Showing ${start}\u2013${end} of ${totalItems}</span>`
    : '';
  const prevDisabled = page <= 1 ? ' disabled' : '';
  const nextDisabled = page >= totalPages ? ' disabled' : '';
  // s210-m01: one page needs no page controls; the range already says what is shown.
  const controls = totalPages > 1
    ? `<button type="button" data-pagination-prev="true"${prevDisabled} aria-label="Previous page">\u2039</button><span data-pagination-current="true" aria-current="page">${page}</span><span data-pagination-total="true"> / ${totalPages}</span><button type="button" data-pagination-next="true"${nextDisabled} aria-label="Next page">\u203A</button>`
    : '';
  return `<nav${attrs} aria-label="Pagination">${rangeHtml}${controls}</nav>`;
}

function renderFilterPanel(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const filters = Array.isArray(props.filters) ? props.filters : [];
  const activeFilters = Array.isArray(props.activeFilters) ? props.activeFilters : [];
  const mode = asString(props.mode) ?? 'immediate';
  const collapsible = props.collapsible !== false;
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['filters', 'activeFilters', 'mode', 'collapsible', 'maxActiveFilters', 'showFilterCount']),
    dataOverrides: { 'data-behavioral': 'filter', 'data-filter-mode': mode },
  });
  if (hasChildrenHtml(childrenHtml)) {
    return `<aside${attrs} role="region" aria-label="Filters">${childrenHtml}</aside>`;
  }
  const filterSections = filters.map((f) => {
    if (!isRecord(f)) return '';
    const label = asString(f.label as unknown) ?? asString(f.field as unknown) ?? 'Filter';
    const collapseAttr = collapsible ? ' data-collapsible="true"' : '';
    return `<fieldset data-filter-section="true"${collapseAttr}><legend>${escapeHtml(label)}</legend></fieldset>`;
  }).join('');
  const activeCount = activeFilters.length;
  const activeHtml = activeCount > 0
    ? `<div data-active-filters="true" aria-live="polite"><span data-filter-count="true">${activeCount} active</span><button type="button" data-filter-clear-all="true">Clear all</button></div>`
    : '';
  const applyBtn = mode === 'batch'
    ? '<button type="button" data-filter-apply="true">Apply</button>'
    : '';
  return `<aside${attrs} role="region" aria-label="Filters">${activeHtml}${filterSections}${applyBtn}</aside>`;
}

export const componentRenderers: Record<string, ComponentRenderer> = {
  AuditSummaryCard: renderAuditSummaryCard,
  SortIndicator: renderSortIndicator,
  TimelineEntryLabel: renderTimelineEntryLabel,
  Button: renderButton,
  Card: renderCard,
  CardHeader: renderCardHeader,
  AddressCollectionPanel: renderAddressCollectionPanel,
  ClassificationPanel: renderClassificationPanel,
  CommunicationDetailPanel: renderCommunicationDetailPanel,
  MembershipPanel: renderMembershipPanel,
  PreferencePanel: renderPreferencePanel,
  AddressEditor: renderAddressEditor,
  ClassificationEditor: renderClassificationEditor,
  PreferenceEditor: renderPreferenceEditor,
  RoleAssignmentForm: renderRoleAssignmentForm,
  CancellationForm: renderCancellationForm,
  TagInput: renderTagInput,
  TagManager: renderTagManager,
  GeoFieldMappingForm: renderGeoFieldMappingForm,
  ColorStatePicker: renderColorStatePicker,
  TemplatePicker: renderTemplatePicker,
  AuditTimeline: renderAuditTimeline,
  AddressValidationTimeline: renderAddressValidationTimeline,
  MembershipAuditTimeline: renderMembershipAuditTimeline,
  MessageEventTimeline: renderMessageEventTimeline,
  PreferenceTimeline: renderPreferenceTimeline,
  StatusTimeline: renderStatusTimeline,
  AuditEvent: renderAuditEvent,
  ArchiveEvent: renderArchiveEvent,
  CancellationEvent: renderCancellationEvent,
  StateTransitionEvent: renderStateTransitionEvent,
  RelativeTimestamp: renderRelativeTimestamp,
  ArchiveSummary: renderArchiveSummary,
  CancellationSummary: renderCancellationSummary,
  OwnershipMeta: renderOwnershipMeta,
  OwnershipSummary: renderOwnershipSummary,
  BillingSummaryBadge: renderBillingSummaryBadge,
  CycleProgressCard: renderCycleProgressCard,
  PaymentTimeline: renderPaymentTimeline,
  PaymentEventTimeline: renderPaymentEventTimeline,
  BillingCardMeta: renderBillingCardMeta,
  ArchivedRowOverlay: renderArchivedRowOverlay,
  BillingAmountInput: renderBillingAmountInput,
  BillingIntervalSelector: renderBillingIntervalSelector,
  PriceCardMeta: renderPriceCardMeta,
  PriceSummary: renderPriceSummary,
  TagPills: renderTagPills,
  TagSummary: renderTagSummary,
  StatusSelector: renderStatusSelector,
  ColorSwatch: renderColorSwatch,
  StatusColorLegend: renderStatusColorLegend,
  GeocodablePreview: renderGeocodablePreview,
  VizAreaControls: renderVizAreaControls,
  VizAreaPreview: renderVizAreaPreview,
  VizMarkControls: renderVizMarkControls,
  VizMarkPreview: renderVizMarkPreview,
  VizLineControls: renderVizLineControls,
  VizLinePreview: renderVizLinePreview,
  VizGraphPreview: renderVizGraphPreview,
  VizPointControls: renderVizPointControls,
  VizPointPreview: renderVizPointPreview,
  VizScatterControls: renderVizScatterControls,
  VizScatterPreview: renderVizScatterPreview,
  VizHeatmapControls: renderVizHeatmapControls,
  VizHeatmapPreview: renderVizHeatmapPreview,
  VizOpacityControls: renderVizOpacityControls,
  VizOpacitySummary: renderVizOpacitySummary,
  VizShapeControls: renderVizShapeControls,
  VizShapeLegend: renderVizShapeLegend,
  VizColorControls: renderVizColorControls,
  VizColorLegendConfig: renderVizColorLegendConfig,
  VizEncodingBadge: renderVizEncodingBadge,
  VizAxisControls: renderVizAxisControls,
  VizAxisSummary: renderVizAxisSummary,
  VizSizeControls: renderVizSizeControls,
  VizSizeSummary: renderVizSizeSummary,
  VizScaleControls: renderVizScaleControls,
  VizScaleSummary: renderVizScaleSummary,
  VizRoleBadge: renderVizRoleBadge,
  DetailHeader: renderDetailHeader,
  FormLabelGroup: renderFormLabelGroup,
  InlineLabel: renderInlineLabel,
  LabelCell: renderLabelCell,
  Stack: renderStack,
  Grid: renderGrid,
  Text: renderText,
  Input: renderInput,
  Checkbox: renderCheckbox,
  Switch: renderSwitch,
  DatePicker: renderDatePicker,
  Select: renderSelect,
  // s223-m02 (#2527 ruling 11).
  Combobox: renderCombobox,
  Textarea: renderTextarea,
  SegmentedControl: renderSegmentedControl,
  Badge: renderBadge,
  StatusBadge: renderStatusBadge,
  CancellationBadge: renderCancellationBadge,
  ArchivePill: renderArchivePill,
  ColorizedBadge: renderColorizedBadge,
  PreferenceSummaryBadge: renderPreferenceSummaryBadge,
  ClassificationBadge: renderClassificationBadge,
  OwnerBadge: renderOwnerBadge,
  MessageStatusBadge: renderMessageStatusBadge,
  GeoResolutionBadge: renderGeoResolutionBadge,
  AddressSummaryBadge: renderAddressSummaryBadge,
  PriceBadge: renderPriceBadge,
  RoleBadgeList: renderRoleBadgeList,
  Banner: renderBanner,
  Dialog: renderDialog,
  Table: renderTable,
  Tabs: renderTabs,
  SearchInput: renderSearchInput,
  PaginationBar: renderPaginationBar,
  FilterPanel: renderFilterPanel,
};

export function renderMappedComponent(
  node: UiElement,
  childrenHtml = '',
  renderedChildren: readonly string[] = [],
): string {
  const renderer = componentRenderers[node.component] ?? renderFallback;
  return renderer(node, childrenHtml, renderedChildren);
}

export function hasMappedRenderer(componentName: string): boolean {
  return Object.prototype.hasOwnProperty.call(componentRenderers, componentName);
}
