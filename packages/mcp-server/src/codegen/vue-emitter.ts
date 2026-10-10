import { chartNodes } from './chart-declaration.js';
import { VIZ_SVG_PROPS } from '@oods/component-contracts';
import { referenceInspection } from './reference-inspection.js';
import { emitCollectionNode, collectionProps, collectionParameters, collectionSources, vueTimelineEvents, wiredCollectionAction } from './collection-emitter.js';
import { emitWorkflow } from './workflow-emitter.js';
import type { UiElement, UiLayout, UiSchema, UiStyle, FieldSchemaEntry } from '../schemas/generated.js';
import type { CodegenIssue, CodegenOptions, CodegenResult } from './types.js';
import type {
  BindingAnalysis,
  DomainBindingOccurrence,
  LocalBindingOccurrence,
  ResolvedBindingHandler,
} from './binding-utils.js';
import {
  buildTailwindStaticClasses,
  buildTailwindVariantExpression,
  responsiveLayoutClasses,
  type TailwindVariantDefinition,
} from './tailwind-codegen-utils.js';
import {
  mapFieldType,
  snakeToCamel,
  fieldValuePropTarget,
  resolveFrameworkChildContent,
  resolveFrameworkRecipeProps,
  ownFieldSchemaEntry,
  resolveFieldProps,
  isReferenceField,
  referenceFieldExpression,
  statusTimelineCondition,
  hasSlotBoundDates,
  isDateFieldEntry,
  slotDateHelperSource,
  SLOT_DATE_HELPER,
  hasHeadingExcerpts,
  slotExcerptHelperSource,
  SLOT_EXCERPT_HELPER,
} from './binding-utils.js';
import { artifactActionsFromBindings, bindingsForNode, nativeSubmitHandler } from './action-protocol.js';
import {
  generatedActionContractDigest,
  generatedActionSourceDigest,
} from './artifact-envelope.js';
import { runPreEmit, type PreEmitContext } from './pre-emit.js';
import { resolveSpacingLeaf } from '../render/spacing-leaf.js';
import { normalizeSchemaForFramework, takeEmittedId } from './framework-normalization.js';
import {
  escapeCssCustomPropertyValue,
  escapeDoubleQuotedAttribute,
  escapeVueScriptComment,
  javascriptSingleQuotedString,
  tokenOverrideVariableName,
} from './emission-safety.js';
import { executeCompositionDirectives } from './composition-directives.js';
import { collectUiStateBranches } from './state-contract.js';
import { CONTRACT_HELPER_IMPORTS, resolveContractHelperImports } from './contract-helper-imports.js';
import { pruneUnreadVueDeclarations } from './vue-unread-declarations.js';
import { compositionObject, orderScreenActions, placeAtAnchor, screenActionAnchor, screenActionCondition, screenActionGate, screenActionIntent, screenActionLabel, screenShell, stripAnchors } from './screen-shell.js';

// ---------------------------------------------------------------------------
// Token + layout helpers (shared logic with tree-renderer.ts / react-emitter.ts)
// ---------------------------------------------------------------------------

/** The module constant holding a chart render prop's default: svg -> defaultChartSvg, svgDarkNarrow -> defaultChartSvgDarkNarrow. */
const defaultChartConst = (prop: string): string => `defaultChart${prop[0]!.toUpperCase()}${prop.slice(1)}`;

function normalizeToken(token: string): string {
  return token.trim().replace(/[.\s_]+/g, '-');
}

function tokenVar(group: string, token: string): string {
  // sprint-125 m03: converge onto the canonical --ref-space-* prefix (was the dead
  // --ref-spacing-*, diverging from react-emitter) and resolve a bare t-shirt size
  // (sm/md/lg) to its scale-<size> leaf so the var actually resolves.
  if (group === 'spacing') {
    return `var(--ref-space-${normalizeToken(resolveSpacingLeaf(token))})`;
  }
  return `var(--ref-${group}-${normalizeToken(token)})`;
}

const ALIGN_MAP: Record<NonNullable<UiLayout['align']>, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  'space-between': 'space-between',
};

type CssDecl = Record<string, string>;

function resolveLayoutStyles(layout?: UiLayout): CssDecl {
  if (!layout?.type) return {};
  const s: CssDecl = {};

  switch (layout.type) {
    case 'stack':
      s.display = 'flex';
      s['flex-direction'] = 'column';
      break;
    case 'inline':
      s.display = 'flex';
      s['flex-direction'] = 'row';
      break;
    case 'grid':
      s.display = 'grid';
      s['grid-template-columns'] = 'repeat(auto-fit, minmax(0, 1fr))';
      break;
    case 'sidebar':
      s.display = 'grid';
      s['grid-template-columns'] = 'minmax(0, 1fr) minmax(16rem, 24rem)';
      s['align-items'] = 'start';
      break;
    case 'section':
      s.display = 'block';
      break;
  }

  if (layout.align) {
    const value = ALIGN_MAP[layout.align];
    // s221-m01: align-items has no space-between; a stack distributes along its axis, as the HTML renderer does.
    if (layout.type === 'stack' && layout.align !== 'space-between') {
      s['align-items'] = value;
    } else if (layout.type === 'inline') {
      s['justify-content'] = value;
    } else {
      s['justify-content'] = value;
    }
  }

  if (layout.gapToken) {
    s.gap = tokenVar('spacing', layout.gapToken);
  }

  return s;
}

function resolveStyleTokens(style?: UiStyle): CssDecl {
  if (!style) return {};
  const s: CssDecl = {};
  if (style.spacingToken) s.padding = tokenVar('spacing', style.spacingToken);
  if (style.radiusToken) s['border-radius'] = tokenVar('radius', style.radiusToken);
  if (style.shadowToken) s['box-shadow'] = tokenVar('shadow', style.shadowToken);
  if (style.colorToken) s.color = tokenVar('color', style.colorToken);
  if (style.typographyToken) s.font = tokenVar('typography', style.typographyToken);
  return s;
}

function mergeDecl(layout: CssDecl, tokens: CssDecl): CssDecl {
  return { ...layout, ...tokens };
}

function declToInlineStyle(decl: CssDecl): string {
  return Object.entries(decl)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([prop, val]) => `${prop}: ${val}`)
    .join('; ');
}

// ---------------------------------------------------------------------------
// Template helpers
// ---------------------------------------------------------------------------

function ind(code: string, depth: number): string {
  const pad = '  '.repeat(depth);
  return code
    .split('\n')
    .map((line) => (line.trim() ? `${pad}${line}` : ''))
    .join('\n');
}

function isReservedProp(key: string, omitClassProps = false): boolean {
  if (key === 'children' || key === 'style') return true;
  if (omitClassProps && key === 'class') return true;
  return false;
}

function serializeVueBinding(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return javascriptSingleQuotedString(value);
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (Array.isArray(value)) {
    return `[${value.map((item) => serializeVueBinding(item ?? null)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([entryKey, item]) => `${javascriptSingleQuotedString(entryKey)}:${serializeVueBinding(item)}`);
    return `{${entries.join(',')}}`;
  }
  return 'undefined';
}

function propToVueAttr(key: string, value: unknown): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return `${key}="${escapeDoubleQuotedAttr(value)}"`;
  if (typeof value === 'boolean') return value ? key : `:${key}="false"`;
  if (typeof value === 'number') return `:${key}="${value}"`;
  // Arrays and objects use v-bind with JSON
  return `:${key}="${serializeVueBinding(value)}"`;
}

function propsToVueAttrs(props: Record<string, unknown>, omitClassProps = false): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(props).sort(([a], [b]) => a.localeCompare(b))) {
    if (isReservedProp(key, omitClassProps) || value === undefined) continue;
    const attr = propToVueAttr(key, value);
    if (attr) parts.push(attr);
  }
  return parts.join(' ');
}

function childValueToVue(value: unknown): string {
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;');
}

function vueEventName(component: string, eventKey: string): string {
  if (eventKey === 'onUpdate' || eventKey === 'onUpdateModelValue') {
    return component === 'Tabs' ? 'update:selectedId' : 'update:modelValue';
  }
  if (eventKey === 'onUpdateSelectedId') return 'update:selectedId';
  return eventKey.replace(/^on([A-Z])/, (_, letter: string) => letter.toLowerCase());
}

function escapeDoubleQuotedAttr(value: string): string {
  return escapeDoubleQuotedAttribute(value);
}

function buildVueClassAttr(staticClasses: string, variantExpression: string | null): string | null {
  const hasStatic = staticClasses.trim().length > 0;

  if (variantExpression && hasStatic) {
    const expression = `[${variantExpression}, ${javascriptSingleQuotedString(staticClasses)}]`;
    return `:class="${escapeDoubleQuotedAttr(expression)}"`;
  }
  if (variantExpression) {
    return `:class="${escapeDoubleQuotedAttr(variantExpression)}"`;
  }
  if (hasStatic) {
    return `class="${escapeDoubleQuotedAttr(staticClasses)}"`;
  }
  return null;
}

function localBindingForNode(
  analysis: BindingAnalysis,
  nodeId: string,
): LocalBindingOccurrence | undefined {
  return bindingsForNode(analysis, nodeId).find(
    (occurrence): occurrence is LocalBindingOccurrence => occurrence.kind === 'local',
  );
}

function vueControlledProp(occurrence: LocalBindingOccurrence): string | null {
  if (occurrence.component === 'ColorStatePicker') return 'value';
  // s223-m02 (#2527 ruling 13a): a Switch emits change and update:modelValue with its next checked value, as Checkbox does.
  if (occurrence.component === 'Checkbox' || occurrence.component === 'Switch') return 'modelValue';
  if (
    occurrence.component === 'DatePicker'
    || occurrence.component === 'Input'
    || occurrence.component === 'SearchInput'
    || occurrence.component === 'Select'
    // s223-m02 (#2527 ruling 12): both emit update:modelValue and change with the value chosen, as Select does.
    || occurrence.component === 'SegmentedControl'
    || occurrence.component === 'Combobox'
    || occurrence.component === 'Textarea'
    || occurrence.component === 'StatusSelector'
    || occurrence.component === 'TagInput'
  ) return 'modelValue';
  if (occurrence.component === 'Tabs') return 'selectedId';
  return null;
}

/** A field lowered to the node's own form value is carried by its local state; a data prop is not. */
function fieldRepresentedByState(propName: string | undefined, controlledProp: string | null): boolean {
  return controlledProp !== null
    && (propName === undefined || propName === 'value' || propName === 'checked' || propName === controlledProp);
}

function vueControlledUpdateEvent(controlledProp: string): string {
  return controlledProp === 'selectedId' ? 'update:selectedId' : 'update:modelValue';
}

function vueBindingAttrs(node: UiElement, analysis: BindingAnalysis): string[] {
  const occurrences = bindingsForNode(analysis, node.id);
  const local = occurrences.find(
    (occurrence): occurrence is LocalBindingOccurrence => occurrence.kind === 'local',
  );
  const attrs: string[] = [];
  if (local?.component === 'Banner') {
    attrs.push(`v-if="${local.localSymbols.state}"`);
  }
  const controlledProp = local ? vueControlledProp(local) : null;
  if (local && controlledProp) {
    attrs.push(`:${controlledProp}="${local.localSymbols.state}"`);
    const declaredEvent = vueEventName(node.component, local.event);
    const updateEvent = vueControlledUpdateEvent(controlledProp);
    if (controlledProp !== 'value' && declaredEvent !== updateEvent) {
      attrs.push(`@${updateEvent}="${local.localSymbols.setter}"`);
    }
  }
  // A component-scoped domain binding owns its action selector on the element
  // itself; screen-scoped actions own theirs on the generated action surface.
  const domain = occurrences.find((occurrence) => occurrence.scope !== 'screen' && occurrence.kind === 'domain');
  if (domain) attrs.push(`data-oods-action="${escapeDoubleQuotedAttr(domain.handlerName)}"`);
  for (const occurrence of occurrences) {
    if (occurrence.scope === 'screen') continue;
    const event = vueEventName(node.component, occurrence.event);
    attrs.push(`@${event}="${occurrence.handlerName}"`);
  }
  return attrs;
}

const SCREEN_ACTION_LABELS: Readonly<Record<string, string>> = {
  onViewTimeline: 'View timeline',
  onChange: 'Change',
  onDelete: 'Delete',
  onEdit: 'Edit',
  onFilter: 'Filter',
  onPageChange: 'Change page',
  onRowClick: 'Open row',
  onSort: 'Sort',
  onSubmit: 'Submit',
};

function hasSubmitControl(node: UiElement): boolean {
  return node.component === 'Button' && node.props?.type === 'submit' || Boolean(node.children?.some(hasSubmitControl));
}

function vueScreenActionSurface(
  node: UiElement,
  analysis: BindingAnalysis,
  objectSchema: Record<string, FieldSchemaEntry> | undefined,
  objectName: string | undefined,
  workflow: boolean,
): string {
  const occurrences = bindingsForNode(analysis, node.id).filter(
    (occurrence): occurrence is DomainBindingOccurrence => (
      occurrence.kind === 'domain' && occurrence.scope === 'screen' && !wiredCollectionAction(node, occurrence.event)
      && !(occurrence.event === 'onSubmit' && hasSubmitControl(node))
      && !screenActionGate(occurrence.event, objectSchema, workflow)?.never
    ),
  );
  if (occurrences.length === 0) return '';

  // s211-m02: the design system's Button in one action bar, Edit leading and a destructive Delete last.
  // s221-m01: an action the record's state governs renders only while that state allows it (screenActionGate).
  const buttons = orderScreenActions(occurrences).map((occurrence) => {
    const label = screenActionLabel(occurrence.event, objectName, workflow, SCREEN_ACTION_LABELS);
    const gate = screenActionGate(occurrence.event, objectSchema, workflow);
    const condition = gate ? ` v-if="${escapeDoubleQuotedAttr(screenActionCondition(gate))}"` : '';
    // s221-m01: as in React since s216-m05 (#2412), an action that needs a row id, a column or criteria from the
    // application renders disabled and says so; Vue had kept inventing those operands.
    const activation = occurrence.signature.parameters.length
      ? 'disabled title="This action needs input from your application."'
      : `@activate="${occurrence.handlerName}()"`;
    return `<Button intent="${screenActionIntent(occurrence.event)}" data-oods-action="${escapeDoubleQuotedAttr(occurrence.handlerName)}"${condition} ${activation}>${childValueToVue(label)}</Button>`;
  });
  return [
    `<div role="group" aria-label="Screen actions" class="oods-action-bar" data-oods-screen-actions="${escapeDoubleQuotedAttr(node.id)}">`,
    ...buttons.map((button) => ind(button, 1)),
    '</div>',
  ].join('\n');
}

/** Where the record summary or title ends; the screen root's action bar takes the first (screen-shell.ts). */
const VUE_ACTION_ANCHORS = {
  summary: '<!-- oods:screen-actions:summary -->',
  title: '<!-- oods:screen-actions:title -->',
} as const;

function vueFieldExpression(
  node: UiElement,
  fieldName: string,
  propName: string | undefined,
  isChildren: boolean,
  objectSchema?: Record<string, FieldSchemaEntry>,
): string {
  const sourceField = node.props?.field;
  const entry = typeof sourceField === 'string'
    ? ownFieldSchemaEntry(objectSchema, sourceField)
    : undefined;
  if (node.component === 'Select' && propName === 'value' && entry?.type === 'boolean') {
    return `String(${fieldName})`;
  }
  if (node.component === 'Text' && isChildren && entry && node.meta?.intent === 'read-only-field') {
    if (isReferenceField(entry)) return referenceFieldExpression(sourceField as string, objectSchema);
    if (entry.enum?.length) return fieldName;
    // A labelled identifier row keeps its ID; the join projection belongs to record titles.
    if (entry.titleReferences?.length) fieldName = snakeToCamel(sourceField as string);
    // The retained consumer library predates date-only formatting; lower through the existing local helper.
    if (entry.type.replace(/\?$/, '') === 'date') return `${fieldName} == null || ${fieldName} === '' ? 'Not recorded' : ${SLOT_DATE_HELPER}(${fieldName}, true) || 'Invalid date'`;
    const code = Boolean(entry.enum?.length || /(?:status|state|event\.type|collection_method|pricing_model|interval)$/.test(entry.semanticType ?? ''));
    // s223-m01 (#2527 ruling 4): a declared number format (percent, quantity) travels with the field.
    return `formatReadOnlyValue(${fieldName}, ${JSON.stringify(entry.type.replace(/\?$/, ''))}, ${code}${entry.format ? `, ${JSON.stringify(entry.format)}` : ''})`;
  }
  // A heading standing in for a record with no title shows the record's first line only.
  if (node.component === 'Text' && isChildren && node.meta?.headingExcerpt === true) {
    return `${SLOT_EXCERPT_HELPER}(${fieldName})`;
  }
  // A date bound through a slot reads as a date, not as its raw stored value. Lowered to a
  // module-local helper so the artifact's declared dependency surface does not move; the guard
  // `hasSlotBoundDates` tracks this condition exactly.
  if (node.component === 'Text' && isChildren && isDateFieldEntry(entry)) {
    return `${SLOT_DATE_HELPER}(${fieldName}${entry?.type.replace(/\?$/, '') === 'date' ? ', true' : ''})`;
  }
  if (node.component === 'Text' && isChildren && entry?.type === 'boolean') {
    return `${fieldName} == null ? '' : ${fieldName} ? 'Yes' : 'No'`;
  }
  if (
    node.component === 'Text'
    && isChildren
    && (entry?.type === 'array' || entry?.type.endsWith('[]'))
  ) {
    return `Array.isArray(${fieldName}) ? ${fieldName}.join(', ') : ''`;
  }
  return fieldName;
}

// ---------------------------------------------------------------------------
// Template tree emitter
// ---------------------------------------------------------------------------

function emitTemplateNode(
  node: UiElement,
  depth: number,
  warnings: CodegenIssue[],
  options: CodegenOptions,
  tailwindVariants: Map<string, TailwindVariantDefinition>,
  bindingAnalysis: BindingAnalysis,
  objectSchema?: Record<string, FieldSchemaEntry>,
  formMode = false,
): string {
  const nodeBody = emitTemplateNodeBody(
    node,
    depth,
    warnings,
    options,
    tailwindVariants,
    bindingAnalysis,
    objectSchema,
    formMode,
  );
  const anchor = screenActionAnchor(node);
  const body = anchor ? `${nodeBody}\n${VUE_ACTION_ANCHORS[anchor]}` : nodeBody;
  const actionSurface = vueScreenActionSurface(node, bindingAnalysis, objectSchema, options.objectName, Boolean(options.workflowCollections));
  const surface = actionSurface ? placeAtAnchor(body, VUE_ACTION_ANCHORS, actionSurface) ?? `${body}\n${actionSurface}` : body;
  const timelineCondition = statusTimelineCondition(node, objectSchema);
  const code = timelineCondition ? `<template v-if="${escapeDoubleQuotedAttr(timelineCondition)}">${surface}</template>` : surface;
  if (node.state === undefined) return code;
  const condition = escapeDoubleQuotedAttr(
    `uiState === ${javascriptSingleQuotedString(node.state)}${node.state === 'success' && collectionSources([node]).has('rows') ? " || uiState === 'empty'" : ''}`,
  );
  return `<template v-if="${condition}">\n${ind(code, 1)}\n</template>`;
}

function emitTemplateNodeBody(
  node: UiElement,
  depth: number,
  warnings: CodegenIssue[],
  options: CodegenOptions,
  tailwindVariants: Map<string, TailwindVariantDefinition>,
  bindingAnalysis: BindingAnalysis,
  objectSchema?: Record<string, FieldSchemaEntry>,
  /** Form-mode fields are writable refs; list/display fields are read-only props. */
  formMode = false,
): string {
  const collectionCode = emitCollectionNode(node, 'vue', objectSchema ?? {}, child => emitTemplateNode(child, depth, warnings, options, tailwindVariants, bindingAnalysis, objectSchema, formMode));
  if (collectionCode !== undefined) return collectionCode;
  const tag = node.component;
  const children = Array.isArray(node.children) ? node.children : [];
  const computedStyle = mergeDecl(
    resolveLayoutStyles(node.layout),
    resolveStyleTokens(node.style),
  );
  let propsObject = node.props && typeof node.props === 'object'
    ? { ...(node.props as Record<string, unknown>) }
    : null;
  const tailwindVariant = tailwindVariants.get(tag);
  const localBinding = localBindingForNode(bindingAnalysis, node.id);
  const readonlyField = bindingAnalysis.readonlyFieldSubscriptions.find((subscription) => subscription.nodeId === node.id);
  const controlledProp = localBinding ? vueControlledProp(localBinding) : null;
  const recipeProps = resolveFrameworkRecipeProps(node, objectSchema, options.workflowCollections);
  if (localBinding?.component === 'Banner' && propsObject?.dismissLabel === undefined) {
    propsObject = { ...(propsObject ?? {}), dismissLabel: 'Dismiss notification' };
  }

  // Enrich props from objectSchema metadata (labels, placeholders, required, options, type)
  const enriched = resolveFieldProps(node, objectSchema);
  if (enriched) {
    if (!propsObject) propsObject = {};
    for (const [key, value] of Object.entries(enriched)) {
      if (key === 'label' && (tag === 'Badge' || tag === 'Button')) continue;
      if (propsObject[key] === undefined) propsObject[key] = value;
    }
  }

  const emittedId = propsObject ? takeEmittedId(node, propsObject) : node.id;
  const staticChild = propsObject?.children;
  const fieldDirective = typeof propsObject?.field === 'string'
    ? propsObject.field
    : undefined;
  const hasExplicitControlledValue = tag === 'Checkbox' || tag === 'Switch'
    ? propsObject?.checked !== undefined || propsObject?.modelValue !== undefined
    : propsObject?.value !== undefined || propsObject?.modelValue !== undefined;
  const boundFieldName = fieldDirective
    && ownFieldSchemaEntry(objectSchema, fieldDirective)
    && !hasExplicitControlledValue
    && !controlledProp
    ? snakeToCamel(fieldDirective)
    : undefined;
  const boundFieldEntry = fieldDirective
    ? ownFieldSchemaEntry(objectSchema, fieldDirective)
    : undefined;
  const coercedSelectField = tag === 'Select'
    && boundFieldName
    && boundFieldEntry?.type === 'boolean'
    ? `String(${boundFieldName})`
    : undefined;
  if (propsObject) {
    delete propsObject.children;
    // `field` drives generated bindings but is not a public component prop.
    delete propsObject.field;
    for (const sourceProp of recipeProps.consumedProps) delete propsObject[sourceProp];
    if (controlledProp === 'modelValue') {
      delete propsObject.modelValue;
      delete propsObject.value;
      delete propsObject.defaultValue;
      delete propsObject.checked;
      delete propsObject.defaultChecked;
    } else if (controlledProp === 'selectedId') {
      delete propsObject.selectedId;
      delete propsObject.defaultSelectedId;
    }
  }

  // Build attributes
  const attrParts: string[] = [];
  attrParts.push(`id="${escapeDoubleQuotedAttr(emittedId)}"`);
  attrParts.push(`data-oods-component="${tag}"`);
  if (node.children?.some(child => child.collectionControl === 'search')) attrParts.push('data-oods-collection-toolbar="true"');
  if (node.state !== undefined) {
    attrParts.push(node.state === 'success' && collectionSources([node]).has('rows') ? `:data-oods-state="uiState === 'success' ? 'success' : undefined"` : `data-oods-state="${escapeDoubleQuotedAttr(node.state)}"`);
  }

  if (node.layout?.type) {
    attrParts.push(`data-layout="${node.layout.type}"`);
  }

  // A placed chart's renders (s222-m02 F7: the dark and hc ones too) come from the record, defaulting to the first's.
  for (const prop of VIZ_SVG_PROPS) {
    if (node.chart && typeof propsObject?.[prop] === 'string') {
      attrParts.push(`:${prop}="${prop} ?? ${defaultChartConst(prop)}"`);
      delete propsObject[prop];
    }
  }
  if (propsObject) {
    const propsStr = propsToVueAttrs(propsObject, options.styling === 'tailwind');
    if (propsStr) attrParts.push(propsStr);
  }

  attrParts.push(...recipeProps.bindings.map(({ targetProp, expression }) => (
    `:${targetProp}="${expression}"`
  )));

  // A field-bound form input with no local writer reads its generated prop
  // one-way, mirroring React's value={field}; v-model on a prop is invalid Vue.
  if (FORM_INPUT_COMPONENTS.has(tag) && boundFieldName) {
    attrParts.push(coercedSelectField
      ? `:modelValue="${coercedSelectField}"`
      : (formMode ? `v-model="${boundFieldName}"` : `:modelValue="${boundFieldName}"`));
  }

  attrParts.push(...vueBindingAttrs(node, bindingAnalysis));
  // A form's Save submits through its own handler when nothing hosts the screen; a host form, or a host marked
  // data-oods-submit-host (the generated workflow), owns submission instead. Invalid fields block it either way.
  const submit = nativeSubmitHandler(node, bindingAnalysis);
  if (submit) attrParts.push(options.typescript
    ? `@click="(event: MouseEvent) => { const button = event.currentTarget as HTMLElement; if (!button.closest('form, [data-oods-submit-host]') && !button.closest('[data-oods-shell]')?.querySelector(':invalid')) ${submit}(); }"`
    : `@click="(event) => { const button = event.currentTarget; if (!button.closest('form, [data-oods-submit-host]') && !button.closest('[data-oods-shell]')?.querySelector(':invalid')) ${submit}(); }"`);

  if (options.styling === 'tailwind') {
    const variantExpression = buildTailwindVariantExpression(node, tailwindVariant);
    const baseClasses = buildTailwindStaticClasses(node, computedStyle, {
      includeVariantFallback: !tailwindVariant,
    });
    const responsive = responsiveLayoutClasses(node.layout);
    const staticClasses = responsive ? `${baseClasses} ${responsive}`.trim() : baseClasses;
    const classAttr = buildVueClassAttr(staticClasses, variantExpression);
    if (classAttr) attrParts.push(classAttr);
  } else {
    const inlineStyle = declToInlineStyle(computedStyle);
    if (inlineStyle) {
      attrParts.push(`style="${escapeDoubleQuotedAttr(inlineStyle)}"`);
    }
  }

  const attrs = attrParts.length > 0 ? ` ${attrParts.join(' ')}` : '';

  const richTabItems = tag === 'Tabs'
    && children.length > 0
    && Array.isArray(propsObject?.items)
    && propsObject.items.length === children.length
    ? propsObject.items as Record<string, unknown>[]
    : undefined;
  if (richTabItems) {
    const panels = richTabItems.map((item, index) => {
      const itemId = String(item.id);
      const condition = escapeDoubleQuotedAttr(
        `item.id === ${javascriptSingleQuotedString(itemId)}`,
      );
      const panel = emitTemplateNode(
        children[index]!,
        0,
        warnings,
        options,
        tailwindVariants,
        bindingAnalysis,
        objectSchema,
        formMode,
      );
      return [
        `<template v-if="${condition}">`,
        ind(panel, 1),
        '</template>',
      ].join('\n');
    }).join('\n');
    const panelSlot = [
      '<template #panel="{ item }">',
      ind(panels, 1),
      '</template>',
    ].join('\n');
    return `<${tag}${attrs}>\n${ind(panelSlot, depth + 1)}\n${'  '.repeat(depth)}</${tag}>`;
  }

  // Sidebar layout
  if (node.layout?.type === 'sidebar' && children.length > 0) {
    const [mainChild, ...asideChildren] = children;
    const mainTemplate = mainChild ? emitTemplateNode(mainChild, depth + 2, warnings, options, tailwindVariants, bindingAnalysis, objectSchema, formMode) : '';
    const asideTemplates = asideChildren
      .map((c) => emitTemplateNode(c, depth + 2, warnings, options, tailwindVariants, bindingAnalysis, objectSchema, formMode));

    // s213-m01: the sidebar column is layout, not a landmark: an <aside> inside the screen's <main> was a nested
    // complementary landmark (axe landmark-complementary-is-top-level on Evidence, Document and Article).
    const inner = [
      `<div data-sidebar-main>`,
      mainTemplate ? ind(mainTemplate, 1) : '',
      `</div>`,
      `<div data-sidebar-aside>`,
      ...asideTemplates.map((t) => ind(t, 1)),
      `</div>`,
    ]
      .filter(Boolean)
      .join('\n');

    return `<${tag}${attrs}>\n${ind(inner, depth + 1)}\n${'  '.repeat(depth)}</${tag}>`;
  }

  // Section layout
  if (node.layout?.type === 'section') {
    let sectionClassOrStyle = '';
    if (options.styling === 'tailwind') {
      const sectionClasses = buildTailwindStaticClasses(node, computedStyle, {
        includeUserClass: false,
        includeInteractiveStates: false,
        includeVariantFallback: false,
      });
      sectionClassOrStyle = sectionClasses ? ` class="${escapeDoubleQuotedAttr(sectionClasses)}"` : '';
    } else {
      const inlineStyle = declToInlineStyle(computedStyle);
      sectionClassOrStyle = inlineStyle
        ? ` style="${escapeDoubleQuotedAttr(inlineStyle)}"`
        : '';
    }
    const innerChildren = children
      .map((c) => emitTemplateNode(c, depth + 2, warnings, options, tailwindVariants, bindingAnalysis, objectSchema, formMode))
      .join('\n');
    const sectionFieldContent = children.length === 0
      ? resolveFrameworkChildContent(node, objectSchema)
      : null;
    const sectionUsesFieldBinding = FORM_INPUT_COMPONENTS.has(tag) && Boolean(boundFieldName);
    if (
      sectionFieldContent?.propName
      && !sectionUsesFieldBinding
      && propsObject?.[sectionFieldContent.propName] !== undefined
    ) {
      delete propsObject[sectionFieldContent.propName];
    }

    const innerAttrParts: string[] = [`id="${escapeDoubleQuotedAttr(emittedId)}"`, `data-oods-component="${tag}"`];
    if (node.state !== undefined) {
      innerAttrParts.push(`data-oods-state="${escapeDoubleQuotedAttr(node.state)}"`);
    }
    if (propsObject) {
      const propsStr = propsToVueAttrs(propsObject, options.styling === 'tailwind');
      if (propsStr) innerAttrParts.push(propsStr);
    }
    innerAttrParts.push(...recipeProps.bindings.map(({ targetProp, expression }) => (
      `:${targetProp}="${expression}"`
    )));
    if (sectionUsesFieldBinding) {
      innerAttrParts.push(coercedSelectField
        ? `:modelValue="${coercedSelectField}"`
        : (formMode ? `v-model="${boundFieldName}"` : `:modelValue="${boundFieldName}"`));
    }
    // Event bindings belong on the component, not the section wrapper
    innerAttrParts.push(...vueBindingAttrs(node, bindingAnalysis));
    if (options.styling === 'tailwind') {
      const variantExpression = buildTailwindVariantExpression(node, tailwindVariant);
      const staticClasses = buildTailwindStaticClasses(node, {}, {
        includeVariantFallback: !tailwindVariant,
      });
      const classAttr = buildVueClassAttr(staticClasses, variantExpression);
      if (classAttr) innerAttrParts.push(classAttr);
    }
    if (
      sectionFieldContent?.propName
      && !sectionFieldContent.isChildren
      && !sectionUsesFieldBinding
      && !fieldRepresentedByState(sectionFieldContent.propName, controlledProp)
    ) {
      const fieldExpression = vueFieldExpression(
        node,
        sectionFieldContent.fieldName,
        sectionFieldContent.propName,
        sectionFieldContent.isChildren,
        objectSchema,
      );
      innerAttrParts.push(`:${sectionFieldContent.propName}="${fieldExpression}"`);
    }
    const innerAttrs = ` ${innerAttrParts.join(' ')}`;

    if (children.length === 0 && sectionFieldContent?.isChildren) {
      const fieldExpression = readonlyField?.writer.localSymbols.state ?? vueFieldExpression(
        node,
        sectionFieldContent.fieldName,
        sectionFieldContent.propName,
        sectionFieldContent.isChildren,
        objectSchema,
      );
      return [
        `<section data-layout="section" data-layout-node-id="${escapeDoubleQuotedAttr(node.id)}"${sectionClassOrStyle}>`,
        ind(`<${tag}${innerAttrs}>{{ ${fieldExpression} }}</${tag}>`, depth + 1),
        `${'  '.repeat(depth)}</section>`,
      ].join('\n');
    }

    if (children.length === 0 && staticChild !== undefined) {
      return [
        `<section data-layout="section" data-layout-node-id="${escapeDoubleQuotedAttr(node.id)}"${sectionClassOrStyle}>`,
        ind(`<${tag}${innerAttrs}>${childValueToVue(staticChild)}</${tag}>`, depth + 1),
        `${'  '.repeat(depth)}</section>`,
      ].join('\n');
    }

    if (children.length === 0) {
      return `<section data-layout="section" data-layout-node-id="${escapeDoubleQuotedAttr(node.id)}"${sectionClassOrStyle}>\n${ind(`<${tag}${innerAttrs} />`, depth + 1)}\n${'  '.repeat(depth)}</section>`;
    }

    return [
      `<section data-layout="section" data-layout-node-id="${escapeDoubleQuotedAttr(node.id)}"${sectionClassOrStyle}>`,
      ind(`<${tag}${innerAttrs}>`, depth + 1),
      ind(innerChildren, 0),
      ind(`</${tag}>`, depth + 1),
      `${'  '.repeat(depth)}</section>`,
    ].join('\n');
  }

  // Self-closing — but inject field content if bound
  if (children.length === 0) {
    const fieldContent = resolveFrameworkChildContent(node, objectSchema);
    if (fieldContent) {
      if (fieldContent.isChildren) {
        const fieldExpression = readonlyField?.writer.localSymbols.state ?? vueFieldExpression(
          node,
          fieldContent.fieldName,
          fieldContent.propName,
          fieldContent.isChildren,
          objectSchema,
        );
        return `<${tag}${attrs}>{{ ${fieldExpression} }}</${tag}>`;
      }
      // Rebuild attrs without the conflicting static prop
      // to avoid emitting both prop="static" and :prop="dynamic"
      if (FORM_INPUT_COMPONENTS.has(tag) && boundFieldName) {
        return `<${tag}${attrs} />`;
      }
      if (fieldRepresentedByState(fieldContent.propName, controlledProp)) {
        return `<${tag}${attrs} />`;
      }
      let cleanAttrs = attrs;
      if (fieldContent.propName && propsObject?.[fieldContent.propName] !== undefined) {
        delete propsObject[fieldContent.propName];
        const rebuiltAttrParts: string[] = [];
        rebuiltAttrParts.push(`id="${escapeDoubleQuotedAttr(emittedId)}"`);
        rebuiltAttrParts.push(`data-oods-component="${tag}"`);
        if (node.state !== undefined) {
          rebuiltAttrParts.push(`data-oods-state="${escapeDoubleQuotedAttr(node.state)}"`);
        }
        if (node.layout?.type) rebuiltAttrParts.push(`data-layout="${node.layout.type}"`);
        if (propsObject) {
          const propsStr = propsToVueAttrs(propsObject, options.styling === 'tailwind');
          if (propsStr) rebuiltAttrParts.push(propsStr);
        }
        rebuiltAttrParts.push(...recipeProps.bindings.map(({ targetProp, expression }) => (
          `:${targetProp}="${expression}"`
        )));
        if (FORM_INPUT_COMPONENTS.has(tag) && boundFieldName) {
          rebuiltAttrParts.push(coercedSelectField
            ? `:modelValue="${coercedSelectField}"`
            : (formMode ? `v-model="${boundFieldName}"` : `:modelValue="${boundFieldName}"`));
        }
        rebuiltAttrParts.push(...vueBindingAttrs(node, bindingAnalysis));
        if (options.styling === 'tailwind') {
          const variantExpression = buildTailwindVariantExpression(node, tailwindVariant);
          const baseClasses = buildTailwindStaticClasses(node, computedStyle, { includeVariantFallback: !tailwindVariant });
          const responsive = responsiveLayoutClasses(node.layout);
          const staticClasses = responsive ? `${baseClasses} ${responsive}`.trim() : baseClasses;
          const classAttr = buildVueClassAttr(staticClasses, variantExpression);
          if (classAttr) rebuiltAttrParts.push(classAttr);
        } else {
          const inlineStyle = declToInlineStyle(computedStyle);
          if (inlineStyle) {
            rebuiltAttrParts.push(`style="${escapeDoubleQuotedAttr(inlineStyle)}"`);
          }
        }
        cleanAttrs = rebuiltAttrParts.length > 0 ? ` ${rebuiltAttrParts.join(' ')}` : '';
      }
      const fieldExpression = vueFieldExpression(
        node,
        fieldContent.fieldName,
        fieldContent.propName,
        fieldContent.isChildren,
        objectSchema,
      );
      const propAttr = `:${fieldContent.propName}="${fieldExpression}"`;
      return `<${tag}${cleanAttrs} ${propAttr} />`;
    }
    if (staticChild !== undefined) {
      return `<${tag}${attrs}>${childValueToVue(staticChild)}</${tag}>`;
    }
    return `<${tag}${attrs} />`;
  }

  const childrenTemplate = children
    .map((c) => emitTemplateNode(c, depth + 1, warnings, options, tailwindVariants, bindingAnalysis, objectSchema, formMode))
    .join('\n');
  return `<${tag}${attrs}>\n${ind(childrenTemplate, depth + 1)}\n${'  '.repeat(depth)}</${tag}>`;
}

// ---------------------------------------------------------------------------
// Vue reactivity helpers
// ---------------------------------------------------------------------------

const FORM_INPUT_COMPONENTS = new Set(['Input', 'Select', 'SegmentedControl', 'Combobox', 'Textarea', 'TagInput', 'DatePicker', 'Toggle', 'Checkbox', 'Switch']);

const LIST_CONTEXT_BINDINGS = new Set(['onRowClick', 'onSort', 'onFilter', 'onPageChange']);

function isFormSchema(screens: UiElement[]): boolean {
  // List/table contexts use props even when they contain filter inputs
  for (const screen of screens) {
    if (screen.bindings) {
      const hasListBinding = Object.keys(screen.bindings).some(k => LIST_CONTEXT_BINDINGS.has(k));
      if (hasListBinding) return false;
    }
  }
  const stack = [...screens];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (FORM_INPUT_COMPONENTS.has(node.component)) return true;
    if (node.children) stack.push(...node.children);
  }
  return false;
}

function shouldImportVueRuntime(
  objectSchema: Record<string, FieldSchemaEntry> | undefined,
  screens: UiElement[],
  analysis?: BindingAnalysis,
): boolean {
  return Boolean(
    (objectSchema && Object.keys(objectSchema).length > 0 && isFormSchema(screens))
    || analysis?.handlers.some((handler) => handler.kind === 'local'),
  );
}

/** Map field type to a sensible ref() default value. */
function fieldRefDefault(entry: FieldSchemaEntry): string {
  if (entry.type.endsWith('?')) return 'null';
  if (entry.enum && entry.enum.length > 0) return javascriptSingleQuotedString(entry.enum[0]);
  if (entry.type.endsWith('[]')) return '[]';
  switch (entry.type) {
    case 'boolean': return 'false';
    case 'integer': case 'number': return '0';
    case 'array': return '[]';
    case 'object': return '{}';
    default: return "''";
  }
}

function nodesById(screens: readonly UiElement[]): Map<string, UiElement> {
  const nodes = new Map<string, UiElement>();
  const stack = [...screens].reverse();
  while (stack.length > 0) {
    const node = stack.pop()!;
    nodes.set(node.id, node);
    if (node.children) stack.push(...node.children.slice().reverse());
  }
  return nodes;
}

function semanticParameters(
  handler: ResolvedBindingHandler,
  typescript: boolean,
): string {
  return handler.signature.parameters
    .map((parameter) => (
      typescript ? `${parameter.name}: ${parameter.type}` : parameter.name
    ))
    .join(', ');
}

function generateVueActionTypes(
  analysis: BindingAnalysis,
  typescript: boolean,
): string {
  const domainHandlers = analysis.handlers.filter((handler) => handler.kind === 'domain');
  if (domainHandlers.length === 0) return '';
  const actionsByName = new Map(
    artifactActionsFromBindings(analysis).map((action) => [action.name, action]),
  );
  const markerLines = (handler: ResolvedBindingHandler): string[] => {
    const action = actionsByName.get(handler.handlerName)!;
    return [
      `/* @oods-domain-action ${action.name} ${generatedActionContractDigest(action)} */`,
      ...action.sources.map((source) => (
        `/* @oods-domain-source ${generatedActionSourceDigest(action.name, source)} */`
      )),
    ];
  };
  if (typescript) {
    const lines = ['interface GeneratedUIActions {'];
    for (const handler of domainHandlers) {
      lines.push(...markerLines(handler).map((line) => `  ${line}`));
      lines.push(`  ${handler.handlerName}: (${semanticParameters(handler, true)}) => void;`);
    }
    lines.push('}');
    return lines.join('\n');
  }
  const properties = domainHandlers
    .map((handler) => `${handler.handlerName}: (${semanticParameters(handler, true)}) => void`)
    .join(', ');
  return [
    ...domainHandlers.flatMap(markerLines),
    `/** @typedef {{ ${properties} }} GeneratedUIActions */`,
  ].join('\n');
}

function generateVueStateTypes(states: readonly string[], typescript: boolean): string {
  if (states.length === 0) return '';
  const union = states.map(javascriptSingleQuotedString).join(' | ');
  return typescript
    ? `type GeneratedUIState = ${union};`
    : `/** @typedef {${union}} GeneratedUIState */`;
}

function explicitInitialValue(
  node: UiElement,
  occurrence: LocalBindingOccurrence,
): unknown {
  const props = (node.props ?? {}) as Record<string, unknown>;
  if (occurrence.component === 'Checkbox' || occurrence.component === 'Switch') {
    return props.modelValue ?? props.checked ?? props.defaultChecked;
  }
  if (occurrence.component === 'Tabs') {
    const explicit = props.selectedId ?? props.defaultSelectedId;
    if (explicit !== undefined) return explicit;
    const items = Array.isArray(props.items) ? props.items : [];
    const first = items.find((item) => (
      typeof item === 'object'
      && item !== null
      && (item as Record<string, unknown>).disabled !== true
      && (item as Record<string, unknown>).isDisabled !== true
      && typeof (item as Record<string, unknown>).id === 'string'
    ));
    return first ? (first as Record<string, unknown>).id : undefined;
  }
  return props.modelValue ?? props.value ?? props.defaultValue;
}

function vueLocalInitialExpression(
  node: UiElement,
  occurrence: LocalBindingOccurrence,
  objectSchema: Record<string, FieldSchemaEntry> | undefined,
  formMode: boolean,
): string {
  if (occurrence.component === 'Banner') return 'true';
  const explicit = explicitInitialValue(node, occurrence);
  if (explicit !== undefined) {
    if (occurrence.signature.parameters[0]?.type === 'boolean') {
      return explicit === true ? 'true' : 'false';
    }
    return javascriptSingleQuotedString(String(explicit));
  }
  const field = node.props?.field;
  // A field lowered to a data prop (TagInput's tags) is not the control's own text.
  if (typeof field === 'string' && ownFieldSchemaEntry(objectSchema, field) && fieldValuePropTarget(occurrence.component) === undefined) {
    const fallback = occurrence.signature.parameters[0]?.type === 'boolean' ? 'false' : "''";
    const source = formMode ? `${snakeToCamel(field)}.value` : snakeToCamel(field);
    return occurrence.signature.parameters[0]?.type === 'boolean'
      ? `${source} ?? ${fallback}`
      : `String(${source} ?? ${fallback})`;
  }
  return occurrence.signature.parameters[0]?.type === 'boolean' ? 'false' : "''";
}

function generateVueBindingProtocol(
  analysis: BindingAnalysis,
  screens: readonly UiElement[],
  options: CodegenOptions,
  objectSchema: Record<string, FieldSchemaEntry> | undefined,
  formMode: boolean,
): string {
  const lines: string[] = [];
  const nodes = nodesById(screens);
  for (const handler of analysis.handlers) {
    if (handler.kind === 'local') {
      const occurrence = handler.occurrences[0] as LocalBindingOccurrence;
      const node = nodes.get(occurrence.nodeId);
      if (!node) continue;
      const type = occurrence.component === 'Banner'
        ? 'boolean'
        : occurrence.signature.parameters[0]?.type ?? 'unknown';
      const typeArgument = options.typescript ? `<${type}>` : '';
      const initial = vueLocalInitialExpression(node, occurrence, objectSchema, formMode);
      lines.push(`const ${occurrence.localSymbols.state} = ref${typeArgument}(${initial});`);
      if (occurrence.component === 'Banner') {
        lines.push(
          `/* @oods-local-binding ${handler.handlerName} */ const ${handler.handlerName} = () => { ${occurrence.localSymbols.state}.value = false; };`,
        );
      } else {
        const parameter = occurrence.signature.parameters[0]!;
        const params = options.typescript
          ? `(${parameter.name}: ${parameter.type})`
          : `(${parameter.name})`;
        if (!options.typescript) {
          lines.push(`/** @param {${parameter.type}} ${parameter.name} */`);
        }
        lines.push(
          `const ${occurrence.localSymbols.setter} = ${params} => { ${occurrence.localSymbols.state}.value = ${parameter.name}; };`,
        );
        if (!options.typescript) {
          lines.push(`/** @param {${parameter.type}} ${parameter.name} */`);
        }
        lines.push(
          `/* @oods-local-binding ${handler.handlerName} */ const ${handler.handlerName} = ${params} => { ${occurrence.localSymbols.setter}(${parameter.name}); };`,
        );
      }
      continue;
    }
    const params = semanticParameters(handler, options.typescript);
    const args = handler.signature.parameters.map((parameter) => parameter.name).join(', ');
    if (!options.typescript && handler.signature.parameters.length > 0) {
      lines.push(...handler.signature.parameters.map(
        (parameter) => `/** @param {${parameter.type}} ${parameter.name} */`,
      ));
    }
    lines.push(
      `/* @oods-domain-binding ${handler.handlerName} */ const ${handler.handlerName} = (${params}) => { actions.${handler.handlerName}(${args}); };`,
    );
  }
  return lines.join('\n');
}

function generateVueActionGuards(analysis: BindingAnalysis): string {
  return analysis.handlers
    .filter((handler) => handler.kind === 'domain')
    .map((handler) => (
      `if (!actions || !Object.prototype.hasOwnProperty.call(actions, ${javascriptSingleQuotedString(handler.handlerName)}) `
      + `|| typeof actions.${handler.handlerName} !== 'function') { `
      + `throw new Error(${javascriptSingleQuotedString(`GeneratedUI requires actions.${handler.handlerName}.`)}); }`
    ))
    .join('\n');
}

/** Detect derivable computed properties from field names. */
function detectComputedProperties(
  objectSchema: Record<string, FieldSchemaEntry>,
): Array<{ name: string; expression: string; deps: string[] }> {
  const fields = Object.keys(objectSchema);
  const computed: Array<{ name: string; expression: string; deps: string[] }> = [];

  // firstName + lastName → fullName
  const hasFirst = fields.some(f => /^first.?name$/i.test(f));
  const hasLast = fields.some(f => /^last.?name$/i.test(f));
  if (hasFirst && hasLast) {
    const firstName = fields.find(f => /^first.?name$/i.test(f))!;
    const lastName = fields.find(f => /^last.?name$/i.test(f))!;
    const firstCamel = snakeToCamel(firstName);
    const lastCamel = snakeToCamel(lastName);
    computed.push({
      name: 'fullName',
      expression: `\`\${${firstCamel}.value} \${${lastCamel}.value}\`.trim()`,
      deps: [firstCamel, lastCamel],
    });
  }

  // street + city → fullAddress
  const hasStreet = fields.some(f => /^(?:street|address)$/i.test(f));
  const hasCity = fields.some(f => /^city$/i.test(f));
  if (hasStreet && hasCity) {
    const street = fields.find(f => /^(?:street|address)$/i.test(f))!;
    const city = fields.find(f => /^city$/i.test(f))!;
    const streetCamel = snakeToCamel(street);
    const cityCamel = snakeToCamel(city);
    const stateField = fields.find(f => /^state$/i.test(f));
    if (stateField) {
      const stateCamel = snakeToCamel(stateField);
      computed.push({
        name: 'fullAddress',
        expression: `[${streetCamel}.value, ${cityCamel}.value, ${stateCamel}.value].filter(Boolean).join(', ')`,
        deps: [streetCamel, cityCamel, stateCamel],
      });
    } else {
      computed.push({
        name: 'fullAddress',
        expression: `[${streetCamel}.value, ${cityCamel}.value].filter(Boolean).join(', ')`,
        deps: [streetCamel, cityCamel],
      });
    }
  }

  return computed;
}

// ---------------------------------------------------------------------------
// Script setup block
// ---------------------------------------------------------------------------

function buildScriptSetup(
  ctx: PreEmitContext,
): string {
  const {
    bindingAnalysis,
    components,
    options,
    tailwindVariants,
    objectSchema,
    tree: screens,
  } = ctx;
  const nucleus = Array.from(components).sort();
  const lines: string[] = [];
  const hasObjectSchema = objectSchema && Object.keys(objectSchema).length > 0;
  const hasDomainActions = bindingAnalysis.handlers.some((handler) => handler.kind === 'domain');
  // A rows collection keeps its controls mounted through the empty state, so the union names it even without an empty branch.
  const stateNames = Array.from(new Set([
    ...collectUiStateBranches(screens).map(({ state }) => state),
    ...(collectionSources(screens).has('rows') && collectUiStateBranches(screens).length ? ['empty'] : []),
  ]));
  const hasStateBranches = stateNames.length > 0;
  const includeCva = tailwindVariants.size > 0;
  const formMode = Boolean(hasObjectSchema && isFormSchema(screens));

  if (options.typescript) {
    lines.push(`<script setup lang="ts">`);
  } else {
    lines.push(`<script setup>`);
  }

  lines.push(CONTRACT_HELPER_IMPORTS);
  // Defined, never imported: lowering the formatter keeps this artifact's declared dependency
  // surface exactly where it was before dates were formatted at all.
  if (hasSlotBoundDates(screens, objectSchema)) lines.push(slotDateHelperSource(Boolean(options.typescript)));
  if (hasHeadingExcerpts(screens)) lines.push(slotExcerptHelperSource(Boolean(options.typescript)));

  // Vue reactivity imports
  if (shouldImportVueRuntime(objectSchema, screens, bindingAnalysis)) {
    const computedProps = hasObjectSchema ? detectComputedProperties(objectSchema!) : [];
    const vueImports = ['ref'];
    if (computedProps.length > 0) vueImports.push('computed');
    lines.push(`import { ${vueImports.sort().join(', ')} } from 'vue';`);
  }

  if (nucleus.length > 0) {
    lines.push(`import { ${nucleus.join(', ')} } from '@oods/components-vue';`);
  }
  if (nucleus.length > 0) lines.push(`import '@oods/component-styles/css';`);
  if (options.brandStylesheet) lines.push(`import './${options.brandStylesheet}';`);
  const chart = chartNodes(screens)[0];
  for (const prop of VIZ_SVG_PROPS) {
    if (typeof chart?.props?.[prop] === 'string') lines.push(`const ${defaultChartConst(prop)} = ${JSON.stringify(chart.props[prop])};`);
  }
  if (includeCva) {
    lines.push(`import { cva } from 'class-variance-authority';`);
  }

  if (includeCva) {
    lines.push('');
    const definitions = Array.from(tailwindVariants.values())
      .sort((a, b) => a.variableName.localeCompare(b.variableName));
    for (const { definition } of definitions) {
      lines.push(definition);
    }
  }

  const stateTypes = generateVueStateTypes(stateNames, options.typescript);
  if (stateTypes) lines.push('', stateTypes);

  const actionTypes = generateVueActionTypes(bindingAnalysis, options.typescript);
  if (actionTypes) lines.push('', actionTypes);

  if (formMode && hasObjectSchema) {
    // Optional initial form values preserve existing empty-form callers while
    // allowing typed records (including zero and false) to seed local editors.
    lines.push('');
    const sortedFields = Object.entries(objectSchema!).sort(([a], [b]) => a.localeCompare(b));
    if (options.typescript) {
      lines.push('interface Props {');
      if (hasDomainActions) lines.push('  actions: GeneratedUIActions;');
      if (hasStateBranches) lines.push('  uiState: GeneratedUIState;');
      for (const [fieldName, entry] of sortedFields) {
        lines.push(`  ${snakeToCamel(fieldName)}?: ${mapFieldType(entry)};`);
      }
      lines.push('}', 'const generatedProps = defineProps<Props>();');
    } else {
      const runtimeProps = [
        ...sortedFields.map(([fieldName]) => `${snakeToCamel(fieldName)}: { default: undefined }`),
        ...(hasDomainActions ? ['actions: { type: Object, required: true }'] : []),
        ...(hasStateBranches ? ['uiState: { type: String, required: true }'] : []),
      ];
      lines.push(`const generatedProps = defineProps({ ${runtimeProps.join(', ')} });`);
    }
    if (hasDomainActions) lines.push(options.typescript ? 'const actions = generatedProps.actions;'
      : 'const actions = /** @type {GeneratedUIActions} */ (generatedProps.actions);');
    if (hasStateBranches) lines.push(options.typescript ? 'const uiState = generatedProps.uiState;'
      : 'const uiState = /** @type {GeneratedUIState} */ (generatedProps.uiState);');
    for (const [fieldName, entry] of sortedFields) {
      const camelName = snakeToCamel(fieldName);
      const defaultValue = fieldRefDefault(entry);
      const tsType = options.typescript ? mapFieldType(entry) : null;

      if (entry.description) {
        lines.push(`/** ${escapeVueScriptComment(entry.description)} */`);
      }
      if (tsType) {
        lines.push(`const ${camelName} = ref<${tsType}>(generatedProps.${camelName} ?? ${defaultValue});`);
      } else {
        lines.push(`const ${camelName} = ref(generatedProps.${camelName} ?? ${defaultValue});`);
      }
    }

    // computed() for derived values
    const computedProps = detectComputedProperties(objectSchema!);
    if (computedProps.length > 0) {
      lines.push('');
      for (const cp of computedProps) {
        lines.push(`const ${cp.name} = computed(() => ${cp.expression});`);
      }
    }
  } else if (options.typescript && hasObjectSchema) {
    // Non-form: use defineProps for display components
    lines.push('');
    lines.push('interface Props {', ...collectionProps(screens, objectSchema ?? {}).map(field => '  ' + field));
    if (chartNodes(screens).length) lines.push(...VIZ_SVG_PROPS.map(prop => `  ${prop}?: string;`));
    if (hasDomainActions) lines.push('  actions: GeneratedUIActions;');
    if (hasStateBranches) lines.push('  uiState: GeneratedUIState;');
    for (const [fieldName, entry] of Object.entries(objectSchema!).sort(([a], [b]) => a.localeCompare(b))) {
      const tsType = mapFieldType(entry);
      const optional = entry.required ? '' : '?';
      const camelName = snakeToCamel(fieldName);
      if (entry.description) {
        lines.push(`  /** ${escapeVueScriptComment(entry.description)} */`);
      }
      lines.push(`  ${camelName}${optional}: ${tsType};`);
    }
    lines.push('}');
    lines.push('');
    const fieldNames = Object.keys(objectSchema!)
      .map(snakeToCamel)
      .sort();
    const propNames = [
      ...(hasDomainActions ? ['actions'] : []),
      ...(hasStateBranches ? ['uiState'] : []),
      ...fieldNames,
      ...collectionParameters(screens, objectSchema ?? {}, 'vue'),
      ...(chartNodes(screens).length ? VIZ_SVG_PROPS : []),
    ];
    lines.push(`const { ${propNames.join(', ')} } = defineProps<Props>();`);
    const timelineEvents = vueTimelineEvents(screens, objectSchema ?? {});
    if (timelineEvents) lines.push(timelineEvents);
  } else if (options.typescript) {
    if (hasStateBranches) {
      lines.push('');
      const propNames = [
        ...(hasDomainActions ? ['actions'] : []),
        'uiState',
      ];
      lines.push(`const { ${propNames.join(', ')} } = defineProps<{`);
      if (hasDomainActions) lines.push('  actions: GeneratedUIActions;');
      lines.push('  uiState: GeneratedUIState;');
      lines.push('}>();');
    } else {
      lines.push('');
      lines.push(`defineProps<{`);
      if (hasDomainActions) lines.push('  actions: GeneratedUIActions;');
      else lines.push(`  // Props can be extended here`);
      lines.push(`}>();`);
      if (hasDomainActions) {
        lines.splice(lines.length - 3, 3,
          `const { actions } = defineProps<{`,
          '  actions: GeneratedUIActions;',
          '}>();');
      }
    }
  } else if (hasObjectSchema && (collectionSources(screens).size > 0 || chartNodes(screens).length > 0)) {
    const names = [...(hasDomainActions ? ['actions'] : []), ...(hasStateBranches ? ['uiState'] : []), ...Object.keys(objectSchema!).map(snakeToCamel), ...collectionParameters(screens, objectSchema ?? {}, 'vue'), ...(chartNodes(screens).length ? VIZ_SVG_PROPS : [])];
    const keys = names.map(name => javascriptSingleQuotedString(name.split('=')[0]!.trim()));
    lines.push(`const { ${names.join(', ')} } = defineProps([${keys.join(', ')}]);`);
    const timelineEvents = vueTimelineEvents(screens, objectSchema ?? {});
    if (timelineEvents) lines.push(timelineEvents);
  } else if (hasDomainActions || hasStateBranches) {
    lines.push('');
    const runtimeProps = [
      ...(hasDomainActions ? ['actions: { type: Object, required: true }'] : []),
      ...(hasStateBranches ? ['uiState: { type: String, required: true }'] : []),
    ];
    lines.push(`const generatedProps = defineProps({ ${runtimeProps.join(', ')} });`);
    if (hasDomainActions) {
      lines.push('const actions = /** @type {GeneratedUIActions} */ (generatedProps.actions);');
    }
    if (hasStateBranches) {
      lines.push('const uiState = /** @type {GeneratedUIState} */ (generatedProps.uiState);');
    }
  }

  const actionGuards = generateVueActionGuards(bindingAnalysis);
  if (actionGuards) lines.push('', actionGuards);

  const bindingProtocol = generateVueBindingProtocol(
    bindingAnalysis,
    screens,
    options,
    objectSchema,
    formMode,
  );
  if (bindingProtocol) {
    lines.push('', bindingProtocol);
  }

  // Prop default declarations — skip names already declared as ref() or defineProps
  if (hasObjectSchema) {
    const declaredNames = new Set(Object.keys(objectSchema!).map(snakeToCamel));
    const propDefaults = ctx.propDefaults;
    if (propDefaults.size > 0) {
      let emittedAny = false;
      for (const [propName, { formatted, isExpression }] of propDefaults) {
        if (declaredNames.has(propName)) continue;
        if (!emittedAny) { lines.push(''); emittedAny = true; }
        const rhs = isExpression ? formatted : JSON.stringify(formatted);
        lines.push(`const ${propName} = ${rhs};`);
      }
    }
  }

  lines.push(`</script>`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Scoped style block (token CSS variables)
// ---------------------------------------------------------------------------

function collectTokenStyles(screens: UiElement[]): CssDecl[] {
  const styles: CssDecl[] = [];
  const stack = [...screens];
  while (stack.length > 0) {
    const node = stack.pop()!;
    const decl = mergeDecl(resolveLayoutStyles(node.layout), resolveStyleTokens(node.style));
    if (Object.keys(decl).length > 0) {
      styles.push(decl);
    }
    if (node.children) stack.push(...node.children);
  }
  return styles;
}

function buildScopedStyle(screens: UiElement[], options: CodegenOptions): string | null {
  if (options.styling !== 'tokens') return null;

  const allStyles = collectTokenStyles(screens);
  // Only include a style block if there are token references
  const hasTokenRefs = allStyles.some((decl) =>
    Object.values(decl).some((v) => v.includes('var(--ref-')),
  );

  if (!hasTokenRefs) return null;

  const lines = [
    `<style scoped>`,
    `/* Token CSS variables are consumed via inline styles. */`,
    `/* Add component-scoped overrides here as needed. */`,
    `</style>`,
  ];
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Top-level assembly
// ---------------------------------------------------------------------------

/**
 * Vue 3 SFC emitter — generates a Vue Single File Component from a UiSchema.
 */
export function emit(schema: UiSchema, options: CodegenOptions): CodegenResult {
  if (schema.workflow) return emitWorkflow(schema, options, 'vue', emit);
  const warnings: CodegenIssue[] = [];
  const expandedSchema = executeCompositionDirectives(schema);
  const normalizedSchema = normalizeSchemaForFramework(expandedSchema, 'vue');
  const ctx = runPreEmit(normalizedSchema, { options });
  const tailwindVariants = ctx.tailwindVariants;

  // Form-mode fields are writable refs (v-model); list/display fields are props (:modelValue).
  const formMode = Boolean(ctx.objectSchema && Object.keys(ctx.objectSchema).length > 0 && isFormSchema(ctx.tree));

  // Build template block
  const objectOptions = { ...options, objectName: options.objectName ?? compositionObject(schema) };
  const screenTemplates = stripAnchors(ctx.tree
    .map((screen) => emitTemplateNode(
      screen,
      1,
      warnings,
      objectOptions,
      tailwindVariants,
      ctx.bindingAnalysis,
      ctx.objectSchema,
      formMode,
    ))
    .join('\n'), VUE_ACTION_ANCHORS);
  // The action bar is written outside the tree, so its Button is imported here.
  if (screenTemplates.includes('data-oods-screen-actions=')) ctx.components.add('Button');

  // A standalone screen is a page: one main landmark and one level-one heading (the composer's record title, else the screen label).
  const shell = screenShell(normalizedSchema, options);
  const templateBlock = (shell ? [
    `<template>`,
    `  <main data-oods-shell="${escapeDoubleQuotedAttr(shell.screenId)}">`,
    ...(shell.heading ? [`    <h1 data-oods-shell-heading="true">${childValueToVue(shell.heading)}</h1>`] : []),
    ind(screenTemplates, 2),
    ind(referenceInspection(normalizedSchema, 'vue'), 2),
    `  </main>`,
    `</template>`,
  ] : [
    `<template>`,
    ind(screenTemplates, 1),
    ind(referenceInspection(normalizedSchema, 'vue'), 1),
    `</template>`,
  ]).join('\n');

  // Build script setup block; it declares only what the finished screen reads (s213-m01, finding 6).
  const scriptBlock = pruneUnreadVueDeclarations(templateBlock, buildScriptSetup(ctx));

  // Build optional scoped style block
  const styleBlock = buildScopedStyle(ctx.tree, options);

  // Inject token overrides as CSS custom properties
  let tokenStyle = '';
  if (normalizedSchema.tokenOverrides && Object.keys(normalizedSchema.tokenOverrides).length > 0) {
    const declarations = Object.entries(normalizedSchema.tokenOverrides)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => (
        `  ${tokenOverrideVariableName(key)}: ${escapeCssCustomPropertyValue(value)};`
      ))
      .join('\n');
    tokenStyle = `<style>\n:root {\n${declarations}\n}\n</style>`;
  }

  // Assemble SFC
  const blocks = [templateBlock, '', scriptBlock];
  if (styleBlock) {
    blocks.push('', styleBlock);
  }
  if (tokenStyle) {
    blocks.push('', tokenStyle);
  }
  blocks.push('');

  // The contract helpers imported are the ones the finished file calls (s213-m01, finding 6).
  const { code, imported } = resolveContractHelperImports(blocks.join('\n'), Boolean(options.typescript));
  const imports = [
    ...(imported ? ['@oods/component-contracts'] : []),
    ...(/^import \{[^}]*\} from 'vue';$/m.test(code) ? ['vue'] : []),
    ...(ctx.components.size > 0 ? ['@oods/components-vue', '@oods/component-styles/css'] : []),
    ...(tailwindVariants.size > 0 ? ['class-variance-authority'] : []),
  ];

  return {
    status: 'ok',
    framework: 'vue',
    code,
    fileExtension: '.vue',
    imports,
    warnings,
    actions: artifactActionsFromBindings(ctx.bindingAnalysis),
  };
}
