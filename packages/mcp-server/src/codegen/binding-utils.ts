import { unitFieldLabel } from '../compose/unit-field-label.js';
/**
 * Shared codegen utilities for object schema type mapping, binding analysis,
 * and prop-value formatting.
 */
import type { UiElement, FieldSchemaEntry } from '../schemas/generated.js';
import { getContentStrategy, type ContentStrategy } from './content-strategy.js';
import { javascriptSingleQuotedString } from './emission-safety.js';
import { fieldLabel } from '../compose/label-generator.js';

// ---------------------------------------------------------------------------
// Field type mapping (object schema → TypeScript types)
// ---------------------------------------------------------------------------

const FIELD_TYPE_MAP: Record<string, string> = {
  string: 'string',
  integer: 'number',
  number: 'number',
  boolean: 'boolean',
  datetime: 'string',
  email: 'string',
  date: 'string',
  url: 'string',
  uuid: 'string',
  object: 'Record<string, unknown>',
  array: 'unknown[]',
};

export function mapFieldType(entry: FieldSchemaEntry): string {
  // Trait '?' markers mean nullable data, independently of property presence.
  // Match the existing object generator's convention without rewriting the schema.
  if (entry.type.endsWith('?')) {
    return `${mapFieldType({ ...entry, type: entry.type.slice(0, -1).trim() })} | null`;
  }
  if (entry.enum && entry.enum.length > 0) {
    return entry.enum.map(javascriptSingleQuotedString).join(' | ');
  }
  if (entry.type.endsWith('[]')) {
    const elementType = FIELD_TYPE_MAP[entry.type.slice(0, -2)] ?? 'unknown';
    return `${elementType}[]`;
  }
  return FIELD_TYPE_MAP[entry.type] ?? 'unknown';
}

/** Resolve only fields explicitly declared by the schema, never prototype members. */
export function ownFieldSchemaEntry(
  objectSchema: Record<string, FieldSchemaEntry> | undefined,
  fieldName: string,
): FieldSchemaEntry | undefined {
  return objectSchema && Object.hasOwn(objectSchema, fieldName)
    ? objectSchema[fieldName]
    : undefined;
}

export function snakeToCamel(name: string): string {
  return name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** A field-authored display fallback never changes its editor or stored value. */
export function displayFieldExpression(
  field: string,
  fields: Record<string, FieldSchemaEntry> | undefined,
  access: (name: string) => string = snakeToCamel,
): string {
  const primary = access(field);
  const fallback = ownFieldSchemaEntry(fields, field)?.displayFallbackField;
  if (!fallback || fallback === field || !ownFieldSchemaEntry(fields, fallback)) return primary;
  return `(String(${primary} ?? '').trim() ? ${primary} : ${access(fallback)})`;
}

/** Reference identity is declared by type or the shared ownership semantic, never guessed from its value. */
export function isReferenceField(entry: FieldSchemaEntry | undefined): boolean {
  return Boolean(entry && (/^uuid(?:\[\])?\??$/.test(entry.type) || entry.semanticType === 'ownership.owner.id'));
}

export function referenceFieldExpression(field: string, fields: Record<string, FieldSchemaEntry> | undefined): string {
  const label = ownFieldSchemaEntry(fields, field)?.displayLabelField;
  const resolved = label && ownFieldSchemaEntry(fields, label) ? snakeToCamel(label) : 'undefined';
  return `formatReferenceLabel(${snakeToCamel(field)}, ${resolved}, ${javascriptSingleQuotedString(field === 'id' ? 'Record' : fieldLabel(field.replace(/_ids?$/, '')))})`;
}

/** Naming displays preserve their authored fallback, while a raw UUID is available only in inspection. */
function namingFieldExpression(field: string, fields: Record<string, FieldSchemaEntry> | undefined): string {
  const expression = displayFieldExpression(field, fields);
  const entry = ownFieldSchemaEntry(fields, field);
  return isReferenceField(entry) || entry?.displayFallbackField && isReferenceField(ownFieldSchemaEntry(fields, entry.displayFallbackField))
    ? `formatRecordLabel(${expression})` : expression;
}

const NAMING_COMPONENTS = new Set(['Text', 'CardHeader', 'DetailHeader', 'InlineLabel', 'LabelCell', 'TimelineEntryLabel', 'ArchivedRowOverlay']);

// ---------------------------------------------------------------------------
// Binding collection (tree walk)
// ---------------------------------------------------------------------------

export type BindingKind = 'local' | 'domain';

export interface BindingParameter {
  readonly name: string;
  readonly type: string;
}

export interface BindingSemanticSignature {
  readonly parameters: readonly BindingParameter[];
}

export interface LocalBindingSymbols {
  readonly state: string;
  readonly setter: string;
}

export interface SupportedBindingDefinition {
  readonly id: string;
  readonly scope: 'component' | 'screen';
  /** Component name, or `$screen` for semantic bindings on a screen root. */
  readonly component: string;
  readonly event: string;
  readonly kind: BindingKind;
  readonly signature: BindingSemanticSignature;
}

interface BindingOccurrenceBase {
  readonly nodeId: string;
  readonly component: string;
  readonly event: string;
  readonly handlerName: string;
  readonly path: string;
}

export interface LocalBindingOccurrence extends BindingOccurrenceBase {
  readonly kind: 'local';
  readonly signature: BindingSemanticSignature;
  readonly definitionId: string;
  readonly scope: 'component' | 'screen';
  readonly localSymbols: LocalBindingSymbols;
}

export interface DomainBindingOccurrence extends BindingOccurrenceBase {
  readonly kind: 'domain';
  readonly signature: BindingSemanticSignature;
  readonly definitionId: string;
  readonly scope: 'component' | 'screen';
  readonly localSymbols: null;
}

export interface UnknownBindingOccurrence extends BindingOccurrenceBase {
  readonly kind: 'unknown';
  readonly signature: null;
  readonly definitionId: null;
  readonly scope: null;
  readonly localSymbols: null;
}

export type ResolvedBindingOccurrence = LocalBindingOccurrence | DomainBindingOccurrence;
export type BindingOccurrence = ResolvedBindingOccurrence | UnknownBindingOccurrence;

/** A display reads an existing field writer; it owns neither an event nor state. */
export interface ReadonlyFieldSubscription extends BindingOccurrenceBase {
  readonly component: 'DetailHeader' | 'Text' | 'Stack';
  readonly event: 'onChange';
  readonly field: string;
  readonly writer: LocalBindingOccurrence;
}

/**
 * A display's onChange naming a handler no writer declares. The display keeps
 * rendering its field; there is no state or event to bind, so the binding is
 * inert and reported as an advisory warning rather than discarded silently.
 */
export interface InertFieldSubscription extends BindingOccurrenceBase {
  readonly event: 'onChange';
  readonly field: string;
  readonly reason: string;
}

export interface ResolvedBindingHandler {
  readonly handlerName: string;
  readonly kind: BindingKind;
  readonly signature: BindingSemanticSignature;
  readonly occurrences: readonly ResolvedBindingOccurrence[];
  readonly localSymbols: LocalBindingSymbols | null;
}

export type BindingAnalysisIssueCode =
  | 'DUPLICATE_NODE_ID'
  | 'UNKNOWN_BINDING'
  | 'AMBIGUOUS_LOCAL_BINDING'
  | 'AMBIGUOUS_HANDLER'
  | 'INCOMPATIBLE_HANDLER'
  | 'LOCAL_SYMBOL_COLLISION'
  | 'INVALID_READONLY_FIELD_SUBSCRIPTION';

export interface BindingAnalysisIssue {
  readonly code: BindingAnalysisIssueCode;
  readonly message: string;
  readonly nodeId?: string;
  readonly component?: string;
  readonly event?: string;
  readonly handlerName?: string;
  readonly path?: string;
  readonly firstPath?: string;
  readonly occurrences?: readonly ResolvedBindingOccurrence[];
}

export interface BindingAnalysis {
  readonly ok: boolean;
  readonly occurrences: readonly BindingOccurrence[];
  /** Measured display bindings, with provenance to their local writer. */
  readonly readonlyFieldSubscriptions: readonly ReadonlyFieldSubscription[];
  /** Display bindings whose handler no writer declares; rendered as plain field reads. */
  readonly inertSubscriptions: readonly InertFieldSubscription[];
  /** Compatible bindings grouped by their generated handler identifier. */
  readonly handlers: readonly ResolvedBindingHandler[];
  readonly issues: readonly BindingAnalysisIssue[];
}

const NO_PARAMETERS: BindingSemanticSignature = { parameters: [] };
const STRING_VALUE: BindingSemanticSignature = {
  parameters: [{ name: 'value', type: 'string' }],
};
const BOOLEAN_CHECKED: BindingSemanticSignature = {
  parameters: [{ name: 'checked', type: 'boolean' }],
};
const SELECTED_ID: BindingSemanticSignature = {
  parameters: [{ name: 'selectedId', type: 'string' }],
};
const ROW_ID: BindingSemanticSignature = {
  parameters: [{ name: 'rowId', type: 'string' }],
};
const SORT_COLUMN: BindingSemanticSignature = {
  parameters: [{ name: 'column', type: 'string' }],
};
const PAGE_NUMBER: BindingSemanticSignature = {
  parameters: [{ name: 'page', type: 'number' }],
};
const FILTER_CRITERIA: BindingSemanticSignature = {
  parameters: [{ name: 'criteria', type: 'Record<string, unknown>' }],
};
const ADDRESS_RECORD: BindingSemanticSignature = {
  parameters: [{ name: 'address', type: 'Record<string, unknown>' }],
};

/**
 * The finite binding vocabulary code generation can normalize identically in
 * React and Vue. Component definitions take precedence over screen semantics,
 * so a root Input/onChange remains local while a layout root/onChange is a
 * domain callback.
 */
export const SUPPORTED_BINDING_DEFINITIONS: readonly SupportedBindingDefinition[] = [
  {"id": "component:VizAreaControls.onChange", "scope": "component", "component": "VizAreaControls", "event": "onChange", "kind": "domain", "signature": {"parameters": [{"name": "intent", "type": "import('@oods/component-contracts').VizIntentFragment"}]}},
  {"id": "component:VizAxisControls.onChange", "scope": "component", "component": "VizAxisControls", "event": "onChange", "kind": "domain", "signature": {"parameters": [{"name": "intent", "type": "import('@oods/component-contracts').VizIntentFragment"}]}},
  {"id": "component:VizColorControls.onChange", "scope": "component", "component": "VizColorControls", "event": "onChange", "kind": "domain", "signature": {"parameters": [{"name": "intent", "type": "import('@oods/component-contracts').VizIntentFragment"}]}},
  {"id": "component:VizHeatmapControls.onChange", "scope": "component", "component": "VizHeatmapControls", "event": "onChange", "kind": "domain", "signature": {"parameters": [{"name": "intent", "type": "import('@oods/component-contracts').VizIntentFragment"}]}},
  {"id": "component:VizLineControls.onChange", "scope": "component", "component": "VizLineControls", "event": "onChange", "kind": "domain", "signature": {"parameters": [{"name": "intent", "type": "import('@oods/component-contracts').VizIntentFragment"}]}},
  {"id": "component:VizMarkControls.onChange", "scope": "component", "component": "VizMarkControls", "event": "onChange", "kind": "domain", "signature": {"parameters": [{"name": "intent", "type": "import('@oods/component-contracts').VizIntentFragment"}]}},
  {"id": "component:VizOpacityControls.onChange", "scope": "component", "component": "VizOpacityControls", "event": "onChange", "kind": "domain", "signature": {"parameters": [{"name": "intent", "type": "import('@oods/component-contracts').VizIntentFragment"}]}},
  {"id": "component:VizPointControls.onChange", "scope": "component", "component": "VizPointControls", "event": "onChange", "kind": "domain", "signature": {"parameters": [{"name": "intent", "type": "import('@oods/component-contracts').VizIntentFragment"}]}},
  {"id": "component:VizScaleControls.onChange", "scope": "component", "component": "VizScaleControls", "event": "onChange", "kind": "domain", "signature": {"parameters": [{"name": "intent", "type": "import('@oods/component-contracts').VizIntentFragment"}]}},
  {"id": "component:VizScatterControls.onChange", "scope": "component", "component": "VizScatterControls", "event": "onChange", "kind": "domain", "signature": {"parameters": [{"name": "intent", "type": "import('@oods/component-contracts').VizIntentFragment"}]}},
  {"id": "component:VizShapeControls.onChange", "scope": "component", "component": "VizShapeControls", "event": "onChange", "kind": "domain", "signature": {"parameters": [{"name": "intent", "type": "import('@oods/component-contracts').VizIntentFragment"}]}},
  {"id": "component:VizSizeControls.onChange", "scope": "component", "component": "VizSizeControls", "event": "onChange", "kind": "domain", "signature": {"parameters": [{"name": "intent", "type": "import('@oods/component-contracts').VizIntentFragment"}]}},
  {"id": "component:VizColorLegendConfig.onChange", "scope": "component", "component": "VizColorLegendConfig", "event": "onChange", "kind": "domain", "signature": {"parameters": [{"name": "intent", "type": "import('@oods/component-contracts').VizIntentFragment"}]}},
  {"id": "component:VizShapeLegend.onChange", "scope": "component", "component": "VizShapeLegend", "event": "onChange", "kind": "domain", "signature": {"parameters": [{"name": "intent", "type": "import('@oods/component-contracts').VizIntentFragment"}]}},
  { id: 'component:ColorStatePicker.onChange', scope: 'component', component: 'ColorStatePicker', event: 'onChange', kind: 'local', signature: STRING_VALUE },
  {"id": "component:GeoFieldMappingForm.onChange", "scope": "component", "component": "GeoFieldMappingForm", "event": "onChange", "kind": "domain", "signature": {"parameters": [{"name": "mapping", "type": "{ latitude: string; longitude: string; identifier: string; autoDetect: boolean }"}]}},
  { id: 'component:SortIndicator.onChange', scope: 'component', component: 'SortIndicator', event: 'onChange', kind: 'domain', signature: { parameters: [{ name: 'sort', type: "{ field: string; direction: 'asc' | 'desc'; active: boolean }" }] } },
  { id: 'component:Banner.onDismiss', scope: 'component', component: 'Banner', event: 'onDismiss', kind: 'local', signature: NO_PARAMETERS },
  { id: 'component:Button.onActivate', scope: 'component', component: 'Button', event: 'onActivate', kind: 'domain', signature: NO_PARAMETERS },
  { id: 'component:Checkbox.onChange', scope: 'component', component: 'Checkbox', event: 'onChange', kind: 'local', signature: BOOLEAN_CHECKED },
  { id: 'component:Checkbox.onUpdate', scope: 'component', component: 'Checkbox', event: 'onUpdate', kind: 'local', signature: BOOLEAN_CHECKED },
  // s223-m02 (#2527 ruling 12): the two Select-like controls bind a field's value as Select does.
  { id: 'component:Combobox.onChange', scope: 'component', component: 'Combobox', event: 'onChange', kind: 'local', signature: STRING_VALUE },
  { id: 'component:Combobox.onUpdate', scope: 'component', component: 'Combobox', event: 'onUpdate', kind: 'local', signature: STRING_VALUE },
  { id: 'component:DatePicker.onChange', scope: 'component', component: 'DatePicker', event: 'onChange', kind: 'local', signature: STRING_VALUE },
  { id: 'component:DatePicker.onInput', scope: 'component', component: 'DatePicker', event: 'onInput', kind: 'local', signature: STRING_VALUE },
  { id: 'component:DatePicker.onUpdate', scope: 'component', component: 'DatePicker', event: 'onUpdate', kind: 'local', signature: STRING_VALUE },
  { id: 'component:Input.onChange', scope: 'component', component: 'Input', event: 'onChange', kind: 'local', signature: STRING_VALUE },
  { id: 'component:Input.onInput', scope: 'component', component: 'Input', event: 'onInput', kind: 'local', signature: STRING_VALUE },
  { id: 'component:Input.onUpdate', scope: 'component', component: 'Input', event: 'onUpdate', kind: 'local', signature: STRING_VALUE },
  { id: 'component:SearchInput.onUpdate', scope: 'component', component: 'SearchInput', event: 'onUpdate', kind: 'local', signature: STRING_VALUE },
  { id: 'component:SegmentedControl.onChange', scope: 'component', component: 'SegmentedControl', event: 'onChange', kind: 'local', signature: STRING_VALUE },
  { id: 'component:SegmentedControl.onUpdate', scope: 'component', component: 'SegmentedControl', event: 'onUpdate', kind: 'local', signature: STRING_VALUE },
  { id: 'component:Select.onChange', scope: 'component', component: 'Select', event: 'onChange', kind: 'local', signature: STRING_VALUE },
  { id: 'component:Select.onUpdate', scope: 'component', component: 'Select', event: 'onUpdate', kind: 'local', signature: STRING_VALUE },
  // s223-m02 (#2527 rulings 12 and 13a): a Switch a field asks for binds as Checkbox binds, to the record's boolean.
  { id: 'component:Switch.onChange', scope: 'component', component: 'Switch', event: 'onChange', kind: 'local', signature: BOOLEAN_CHECKED },
  { id: 'component:Switch.onUpdate', scope: 'component', component: 'Switch', event: 'onUpdate', kind: 'local', signature: BOOLEAN_CHECKED },
  { id: 'component:Table.onRowActivate', scope: 'component', component: 'Table', event: 'onRowActivate', kind: 'domain', signature: ROW_ID },
  { id: 'component:Tabs.onChange', scope: 'component', component: 'Tabs', event: 'onChange', kind: 'local', signature: SELECTED_ID },
  { id: 'component:Tabs.onUpdate', scope: 'component', component: 'Tabs', event: 'onUpdate', kind: 'local', signature: SELECTED_ID },
  { id: 'component:Textarea.onChange', scope: 'component', component: 'Textarea', event: 'onChange', kind: 'local', signature: STRING_VALUE },
  { id: 'component:Textarea.onInput', scope: 'component', component: 'Textarea', event: 'onInput', kind: 'local', signature: STRING_VALUE },
  { id: 'component:Textarea.onUpdate', scope: 'component', component: 'Textarea', event: 'onUpdate', kind: 'local', signature: STRING_VALUE },
  // Sprint 186 wave-2 form controls measured on user-form-showcase.
  { id: 'component:StatusSelector.onChange', scope: 'component', component: 'StatusSelector', event: 'onChange', kind: 'local', signature: STRING_VALUE },
  { id: 'component:TagInput.onChange', scope: 'component', component: 'TagInput', event: 'onChange', kind: 'local', signature: STRING_VALUE },
  // The editor hands the consumer the edited address record; the form owns no local state for it.
  { id: 'component:BillingAmountInput.onChange', scope: 'component', component: 'BillingAmountInput', event: 'onChange', kind: 'domain', signature: { parameters: [{ name: 'amount', type: 'number | undefined' }] } },
  { id: 'component:BillingIntervalSelector.onChange', scope: 'component', component: 'BillingIntervalSelector', event: 'onChange', kind: 'domain', signature: STRING_VALUE },
  { id: 'component:AddressEditor.onChange', scope: 'component', component: 'AddressEditor', event: 'onChange', kind: 'domain', signature: ADDRESS_RECORD },
  { id: 'screen:onCancel', scope: 'screen', component: '$screen', event: 'onCancel', kind: 'domain', signature: NO_PARAMETERS },
  { id: 'screen:onViewTimeline', scope: 'screen', component: '$screen', event: 'onViewTimeline', kind: 'domain', signature: NO_PARAMETERS },
  { id: 'screen:onChange', scope: 'screen', component: '$screen', event: 'onChange', kind: 'domain', signature: NO_PARAMETERS },
  { id: 'screen:onDelete', scope: 'screen', component: '$screen', event: 'onDelete', kind: 'domain', signature: NO_PARAMETERS },
  { id: 'screen:onEdit', scope: 'screen', component: '$screen', event: 'onEdit', kind: 'domain', signature: NO_PARAMETERS },
  { id: 'screen:onFilter', scope: 'screen', component: '$screen', event: 'onFilter', kind: 'domain', signature: FILTER_CRITERIA },
  { id: 'screen:onPageChange', scope: 'screen', component: '$screen', event: 'onPageChange', kind: 'domain', signature: PAGE_NUMBER },
  { id: 'screen:onRowClick', scope: 'screen', component: '$screen', event: 'onRowClick', kind: 'domain', signature: ROW_ID },
  { id: 'screen:onSort', scope: 'screen', component: '$screen', event: 'onSort', kind: 'domain', signature: SORT_COLUMN },
  { id: 'screen:onSubmit', scope: 'screen', component: '$screen', event: 'onSubmit', kind: 'domain', signature: NO_PARAMETERS },
];

function compareCodePoint(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Display components whose saved onChange subscribes to a same-field local writer. */
const READONLY_FIELD_SUBSCRIBERS: ReadonlySet<string> = new Set(['DetailHeader', 'Text']);

function isReadonlyFieldSubscriber(node: UiElement): boolean {
  if (READONLY_FIELD_SUBSCRIBERS.has(node.component)) return true;
  // A pattern-group Stack lowers into its pattern component; its onChange is the pattern's read.
  return node.component === 'Stack' && node.props?.patternComponent !== undefined;
}

/** Identifier reserved for state owned by a local binding handler. */
export function localStateSymbol(handlerName: string): string {
  return `${handlerName}State`;
}

/** Identifier reserved for the setter owned by a local binding handler. */
export function localSetterSymbol(handlerName: string): string {
  return `set${handlerName.charAt(0).toUpperCase()}${handlerName.slice(1)}State`;
}

function localSymbols(handlerName: string): LocalBindingSymbols {
  return {
    state: localStateSymbol(handlerName),
    setter: localSetterSymbol(handlerName),
  };
}

function findBindingDefinition(
  component: string,
  event: string,
  screenRoot: boolean,
): SupportedBindingDefinition | undefined {
  const componentDefinition = SUPPORTED_BINDING_DEFINITIONS.find((definition) => (
    definition.scope === 'component'
    && definition.component === component
    && definition.event === event
  ));
  if (componentDefinition) return componentDefinition;
  if (!screenRoot) return undefined;
  return SUPPORTED_BINDING_DEFINITIONS.find((definition) => (
    definition.scope === 'screen' && definition.event === event
  ));
}

function signaturesAreCallableTogether(
  left: BindingSemanticSignature,
  right: BindingSemanticSignature,
): boolean {
  return left.parameters.length === right.parameters.length
    && left.parameters.every((parameter, index) => {
      const other = right.parameters[index];
      return parameter.type === other?.type;
    });
}

/**
 * Resolve every binding occurrence without discarding provenance. Invalid or
 * ambiguous input is returned as typed issues; consumers can inspect the full
 * evidence while refusing emission whenever `ok` is false.
 */
export function analyzeBindings(screens: readonly UiElement[]): BindingAnalysis {
  const occurrences: BindingOccurrence[] = [];
  const issues: BindingAnalysisIssue[] = [];
  const firstPathByNodeId = new Map<string, string>();
  const nodesById = new Map<string, UiElement>();
  const readCandidates: Array<{ node: UiElement; handlerName: string; path: string }> = [];
  const invalidLocalHandlers = new Set<string>();

  const visit = (node: UiElement, path: string, screenRoot: boolean): void => {
    const firstPath = firstPathByNodeId.get(node.id);
    if (firstPath !== undefined) {
      issues.push({
        code: 'DUPLICATE_NODE_ID',
        message: `Node id ${JSON.stringify(node.id)} occurs at both ${firstPath} and ${path}.`,
        nodeId: node.id,
        path,
        firstPath,
      });
    } else {
      firstPathByNodeId.set(node.id, path);
      nodesById.set(node.id, node);
    }

    const nodeOccurrences: BindingOccurrence[] = [];
    for (const [event, handlerName] of Object.entries(node.bindings ?? {})
      .sort(([left], [right]) => compareCodePoint(left, right))) {
      // Saved forms bind display nodes (a heading, a Text, a pattern-group
      // Stack) to the same field/change handler as a writer. Resolve those
      // reads only after ordinary writer semantics have passed; a display
      // never acquires a fictitious change event.
      if (event === 'onChange' && isReadonlyFieldSubscriber(node)) {
        readCandidates.push({ node, handlerName, path });
        continue;
      }
      const definition = findBindingDefinition(node.component, event, screenRoot);
      if (!definition) {
        const occurrence: UnknownBindingOccurrence = {
          nodeId: node.id,
          component: node.component,
          event,
          handlerName,
          path,
          kind: 'unknown',
          signature: null,
          definitionId: null,
          scope: null,
          localSymbols: null,
        };
        occurrences.push(occurrence);
        nodeOccurrences.push(occurrence);
        issues.push({
          code: 'UNKNOWN_BINDING',
          message: `Binding ${node.component}.${event} is not in the supported generation vocabulary.`,
          nodeId: node.id,
          component: node.component,
          event,
          handlerName,
          path,
        });
        continue;
      }

      const occurrence: ResolvedBindingOccurrence = definition.kind === 'local'
        ? {
            nodeId: node.id,
            component: node.component,
            event,
            handlerName,
            path,
            kind: 'local',
            signature: definition.signature,
            definitionId: definition.id,
            scope: definition.scope,
            localSymbols: localSymbols(handlerName),
          }
        : {
            nodeId: node.id,
            component: node.component,
            event,
            handlerName,
            path,
            kind: 'domain',
            signature: definition.signature,
            definitionId: definition.id,
            scope: definition.scope,
            localSymbols: null,
          };
      occurrences.push(occurrence);
      nodeOccurrences.push(occurrence);
    }

    const localOccurrences = nodeOccurrences.filter(
      (occurrence): occurrence is LocalBindingOccurrence => occurrence.kind === 'local',
    );
    if (localOccurrences.length > 1) {
      for (const occurrence of localOccurrences) invalidLocalHandlers.add(occurrence.handlerName);
      issues.push({
        code: 'AMBIGUOUS_LOCAL_BINDING',
        message: `Node ${JSON.stringify(node.id)} declares multiple aliases for one local state transition.`,
        nodeId: node.id,
        component: node.component,
        path,
        occurrences: localOccurrences,
      });
    }

    for (const [index, child] of (node.children ?? []).entries()) {
      visit(child, `${path}/children/${index}`, false);
    }
  };

  for (const [index, screen] of screens.entries()) {
    visit(screen, `/screens/${index}`, true);
  }

  const resolvedByHandler = new Map<string, ResolvedBindingOccurrence[]>();
  for (const occurrence of occurrences) {
    if (occurrence.kind === 'unknown') continue;
    const grouped = resolvedByHandler.get(occurrence.handlerName);
    if (grouped) grouped.push(occurrence);
    else resolvedByHandler.set(occurrence.handlerName, [occurrence]);
  }

  const handlers: ResolvedBindingHandler[] = [];
  for (const handlerName of [...resolvedByHandler.keys()].sort(compareCodePoint)) {
    const grouped = resolvedByHandler.get(handlerName)!;
    const first = grouped[0]!;
    if (grouped.some((occurrence) => !signaturesAreCallableTogether(first.signature, occurrence.signature))) {
      issues.push({
        code: 'INCOMPATIBLE_HANDLER',
        message: `Handler ${JSON.stringify(handlerName)} is reused with incompatible semantic signatures.`,
        handlerName,
        occurrences: grouped,
      });
      continue;
    }

    // Several controls may write one local state when they all edit the same
    // field with the same signature (a TagInput beside a plain Input for tags);
    // owners of different or unstated fields stay ambiguous, as do handlers
    // shared across binding kinds or across unrelated definitions.
    const sharedField = first.kind === 'local' && grouped.every((occurrence) => {
      const field = nodesById.get(occurrence.nodeId)?.props?.field;
      return occurrence.kind === 'local'
        && typeof field === 'string' && field.trim().length > 0
        && field === nodesById.get(first.nodeId)?.props?.field;
    });
    if (!sharedField && grouped.some((occurrence) => (
      occurrence.kind !== first.kind || occurrence.definitionId !== first.definitionId
    ))) {
      issues.push({
        code: 'AMBIGUOUS_HANDLER',
        message: `Handler ${JSON.stringify(handlerName)} is reused for different binding semantics.`,
        handlerName,
        occurrences: grouped,
      });
      continue;
    }

    if (first.kind === 'local' && grouped.length > 1 && !sharedField) {
      issues.push({
        code: 'AMBIGUOUS_HANDLER',
        message: `Local handler ${JSON.stringify(handlerName)} is reused by multiple state owners.`,
        handlerName,
        occurrences: grouped,
      });
      continue;
    }

    if (invalidLocalHandlers.has(handlerName)) continue;

    handlers.push({
      handlerName,
      kind: first.kind,
      signature: first.signature,
      occurrences: grouped,
      localSymbols: first.localSymbols,
    });
  }

  const localSymbolOwners = new Map<string, ResolvedBindingHandler>();
  for (const handler of handlers.filter((candidate) => candidate.kind === 'local')) {
    const symbols = handler.localSymbols!;
    for (const symbol of [symbols.state, symbols.setter]) {
      const owner = localSymbolOwners.get(symbol);
      if (owner) {
        const occurrence = handler.occurrences[0]!;
        issues.push({
          code: 'LOCAL_SYMBOL_COLLISION',
          message: `Local handlers ${JSON.stringify(owner.handlerName)} and ${JSON.stringify(handler.handlerName)} generate the same identifier ${JSON.stringify(symbol)}.`,
          handlerName: handler.handlerName,
          nodeId: occurrence.nodeId,
          component: occurrence.component,
          event: occurrence.event,
          path: occurrence.path,
          occurrences: [...owner.occurrences, ...handler.occurrences],
        });
      } else {
        localSymbolOwners.set(symbol, handler);
      }
    }
  }

  const readonlyFieldSubscriptions: ReadonlyFieldSubscription[] = [];
  const inertSubscriptions: InertFieldSubscription[] = [];
  for (const { node, handlerName, path } of readCandidates) {
    const field = node.props?.field;
    const handler = handlers.find((candidate) => candidate.handlerName === handlerName);
    const writer = handler?.occurrences[0];
    // A pattern-group Stack's children are the pattern's own field nodes, not authored content.
    const patternGroup = node.component === 'Stack' && node.props?.patternComponent !== undefined;
    const validWriters = handler?.kind === 'local' && handler.occurrences.every((occurrence) => (
      occurrence.kind === 'local'
      && occurrence.signature.parameters.length === 1
      && occurrence.signature.parameters[0]?.type === 'string'
      && nodesById.get(occurrence.nodeId)?.props?.field === field
    ));
    let reason: string | undefined;
    if (typeof field !== 'string' || field.trim().length === 0) {
      reason = 'requires a non-empty field reference';
    } else if (!patternGroup && (node.children?.length || node.props?.children !== undefined)) {
      reason = 'cannot replace authored children with a field subscription';
    } else if (!occurrences.some((occurrence) => occurrence.handlerName === handlerName)) {
      // Only an absent declaration is inert; an unknown event still declares
      // an invalid writer and must not become a plain read by being unresolved.
      inertSubscriptions.push({
        nodeId: node.id,
        component: node.component,
        event: 'onChange',
        handlerName,
        path,
        field,
        reason: 'names no local writer; the display renders its field directly',
      });
      continue;
    } else if (handler?.kind !== 'local' || writer?.kind !== 'local' || !validWriters) {
      reason = handler?.occurrences.length === 1 && handler.kind === 'local' && writer?.kind === 'local'
        && nodesById.get(writer.nodeId)?.props?.field !== field
        ? 'requires its writer to reference the same field'
        : 'requires exactly one valid string local writer with the same handler';
    }

    if (reason) {
      issues.push({
        code: 'INVALID_READONLY_FIELD_SUBSCRIPTION',
        message: `Read-only binding ${node.component}.onChange ${reason}.`,
        nodeId: node.id,
        component: node.component,
        event: 'onChange',
        handlerName,
        path,
      });
      continue;
    }

    readonlyFieldSubscriptions.push({
      nodeId: node.id,
      component: node.component as ReadonlyFieldSubscription['component'],
      event: 'onChange',
      handlerName,
      path,
      field: field as string,
      writer: writer as LocalBindingOccurrence,
    });
  }

  return {
    ok: issues.length === 0,
    occurrences,
    readonlyFieldSubscriptions,
    inertSubscriptions,
    handlers,
    issues,
  };
}

/**
 * Collect all unique handler names from bindings across the element tree.
 * Returns a map of handler name → binding key for signature lookup.
 */
export function collectBindings(screens: UiElement[]): Map<string, string> {
  const handlers = new Map<string, string>();
  const stack = [...screens];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.bindings) {
      for (const [bindingKey, handlerName] of Object.entries(node.bindings)) {
        if (!handlers.has(handlerName)) {
          handlers.set(handlerName, bindingKey);
        }
      }
    }
    if (node.children) stack.push(...node.children);
  }
  return handlers;
}

// ---------------------------------------------------------------------------
// Prop default value formatting
// ---------------------------------------------------------------------------

/**
 * Format a prop value for type-safe JSX/Vue attribute output.
 * Uses objectSchema field metadata to pick the right literal format:
 *  - enum string → string literal (quoted)
 *  - number/integer → bare numeric
 *  - boolean → bare boolean
 *  - string → quoted string
 * Falls back to JSON.stringify for complex types.
 */
export function formatPropValue(
  value: unknown,
  fieldName: string,
  objectSchema?: Record<string, FieldSchemaEntry>,
): { formatted: string; isExpression: boolean } {
  if (value === null || value === undefined) {
    return { formatted: 'undefined', isExpression: true };
  }

  const entry = ownFieldSchemaEntry(objectSchema, fieldName);
  const fieldType = entry?.type;

  if (typeof value === 'boolean') {
    return { formatted: String(value), isExpression: true };
  }
  if (typeof value === 'number') {
    return { formatted: String(value), isExpression: true };
  }
  if (typeof value === 'string') {
    // If the field is an enum, still emit as a quoted string — the type system
    // handles enforcement via the union type in the Props interface.
    return { formatted: value, isExpression: false };
  }
  if (fieldType === 'object' || fieldType === 'array' || typeof value === 'object') {
    return { formatted: JSON.stringify(value), isExpression: true };
  }

  return { formatted: String(value), isExpression: false };
}

/**
 * Well-known UI prop names that should NOT be treated as schema field defaults.
 * These are generic component props (label text, placeholder text, etc.) that
 * may coincidentally share names with schema fields.
 */
const UI_PROP_NAMES = new Set([
  'label', 'placeholder', 'title', 'description', 'name', 'type', 'value',
  'disabled', 'required', 'options', 'variant', 'size', 'icon', 'status',
]);

/**
 * Collect prop default values from UiElements that have an explicit `props.field`
 * binding to an objectSchema field. Only the field's own value props are captured,
 * not generic UI props that coincidentally share names with schema fields.
 * Returns a map of camelCase prop name → formatted value.
 */
export function collectPropDefaults(
  screens: UiElement[],
  objectSchema: Record<string, FieldSchemaEntry>,
): Map<string, { formatted: string; isExpression: boolean }> {
  const defaults = new Map<string, { formatted: string; isExpression: boolean }>();
  const schemaFields = new Set(Object.keys(objectSchema));

  const stack = [...screens];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.props && typeof node.props === 'object') {
      const props = node.props as Record<string, unknown>;
      for (const [key, value] of Object.entries(props)) {
        // Skip well-known UI props — these are component display props, not field defaults
        if (UI_PROP_NAMES.has(key)) continue;
        // Skip 'field' itself — it's a binding reference, not a value
        if (key === 'field') continue;
        if (schemaFields.has(key) && value !== undefined && !defaults.has(snakeToCamel(key))) {
          defaults.set(snakeToCamel(key), formatPropValue(value, key, objectSchema));
        }
      }
    }
    if (node.children) stack.push(...node.children);
  }

  return defaults;
}

// ---------------------------------------------------------------------------
// Field → prop enrichment from objectSchema metadata
// ---------------------------------------------------------------------------

const SEMANTIC_TYPE_TO_INPUT: Record<string, string> = {
  email: 'email',
  url: 'url',
  date: 'date',
  datetime: 'datetime-local',
  integer: 'number',
  number: 'number',
};

function humanizeFieldName(fieldName: string): string {
  const unitLabel = unitFieldLabel(fieldName);
  if (unitLabel) return unitLabel;
  return fieldName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanizeEnumValue(value: string): string {
  return value
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface FieldPropEnrichment {
  label?: string;
  placeholder?: string;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
  type?: string;
}

/**
 * Derive additional props from objectSchema metadata for a field-bound component.
 * Returns null if the node has no field binding or no enrichments are needed.
 * Does not override props that are already explicitly set on the node.
 */
export function resolveFieldProps(
  node: UiElement,
  objectSchema?: Record<string, FieldSchemaEntry>,
): FieldPropEnrichment | null {
  const fieldProp = node.props?.field;
  if (typeof fieldProp !== 'string' || !fieldProp) return null;
  const entry = ownFieldSchemaEntry(objectSchema, fieldProp);
  if (!entry) return null;
  const strategy = getContentStrategy(node.component);
  // A DatePicker binds its value through form state (content strategy none) but still takes required (#2442).
  if (strategy === 'none' && node.component !== 'DatePicker') return null;

  const existing = (node.props as Record<string, unknown>) ?? {};
  const props: FieldPropEnrichment = {};

  // Label: humanize field name for label-prop and status-prop components
  if (
    !existing.label
    && (strategy === 'label-prop' || strategy === 'status-prop')
    && !['StatusTimeline', 'ArchivePill', 'CancellationBadge'].includes(node.component)
  ) {
    props.label = humanizeFieldName(fieldProp);
  }

  // Only canonical Input accepts all three of these native-input props. Other
  // value-prop components (including Select) must not receive props outside
  // their public target contract after preflight has run.
  if (node.component === 'Input') {
    if (!existing.placeholder && entry.description) {
      props.placeholder = entry.description;
    }
    if (entry.required && existing.required === undefined) {
      props.required = true;
    }
    if (!existing.type) {
      const inputType = SEMANTIC_TYPE_TO_INPUT[entry.type];
      if (inputType) props.type = inputType;
    }
  } else if (node.component === 'Select' || node.component === 'DatePicker' || node.component === 'Combobox') {
    // s219-m01 (#2442): a declared-required date gets the browser's native enforcement, like Input and Select. The
    // DatePicker contract and all three renderers already carried required; this function never passed it.
    if (entry.required && existing.required === undefined) {
      props.required = true;
    }
  }

  // Enum options for Select-like components (s223-m02: SegmentedControl and Combobox take Select's options)
  if (
    entry.enum && entry.enum.length > 0 &&
    !existing.options &&
    ['Select', 'StatusSelector', 'SegmentedControl', 'Combobox'].includes(node.component)
  ) {
    props.options = entry.enum.map((v) => ({ label: humanizeEnumValue(v), value: v }));
  }

  return Object.keys(props).length > 0 ? props : null;
}

// ---------------------------------------------------------------------------
// Field → component content resolution for codegen prop binding
// ---------------------------------------------------------------------------

/**
 * Components whose generic `field` directive lowers to a named data prop
 * rather than to content or a form value. FilterPanel's HTML renderer reads
 * `filters`, so the bound field becomes that prop on every target.
 */
/**
 * Pattern-group Stack directives that lowering drops before the pattern
 * component sees them; historyField and showReason travel with the lowering
 * because the StatusTimeline contract governs them.
 */
export const PATTERN_GROUP_DROPPED_DIRECTIVES: readonly string[] = [
  'channelsField', 'templatesField', 'policiesField', 'conversationsField', 'labelField', 'showActor',
];

const FIELD_VALUE_PROP_TARGETS: Readonly<Record<string, string>> = {
  ArchivePill: 'isArchived',
  CancellationBadge: 'cancelAtPeriodEnd',
  AddressSummaryBadge: 'role',
  AddressValidationTimeline: 'events',
  MembershipAuditTimeline: 'events',
  FilterPanel: 'filters',
  TagInput: 'tags',
  TagManager: 'tags',
  TagPills: 'tags',
  TagSummary: 'tags',
};

/** The data prop a component's generic field lowers to, when it is not its content or form value. */
export function fieldValuePropTarget(component: string): string | undefined {
  return Object.hasOwn(FIELD_VALUE_PROP_TARGETS, component) ? FIELD_VALUE_PROP_TARGETS[component] : undefined;
}

/**
 * Components whose generic field names the collection they present or edit
 * while no renderer reads it as data: the field must exist, and the directive
 * is consumed without a binding on every target.
 */
export const FIELD_CONSUMED_UNBOUND: ReadonlySet<string> = new Set(['AddressCollectionPanel', 'AddressEditor', 'VizAreaControls', 'VizAxisControls', 'VizColorControls', 'VizHeatmapControls', 'VizLineControls', 'VizMarkControls', 'VizOpacityControls', 'VizPointControls', 'VizScaleControls', 'VizScatterControls', 'VizShapeControls', 'VizSizeControls', 'VizColorLegendConfig', 'VizShapeLegend', 'VizAxisSummary', 'VizOpacitySummary', 'VizScaleSummary', 'VizSizeSummary', 'VizEncodingBadge', 'VizRoleBadge', 'VizHeatmapPreview', 'VizGraphPreview', 'VizLinePreview', 'VizMarkPreview', 'VizPointPreview', 'VizScatterPreview']);

export type FieldContentResolution = {
  /** The content strategy used */
  strategy: ContentStrategy;
  /** The camelCase field name for code injection */
  fieldName: string;
  /** The prop name to inject on (for value-prop, label-prop, status-prop) */
  propName?: string;
  /** Whether this field should be injected as children content */
  isChildren: boolean;
};

/**
 * Resolve how a field should be injected into a component's codegen output.
 * Returns null if the component has no field binding or uses strategy 'none'.
 */
export function resolveChildContent(
  node: UiElement,
  objectSchema?: Record<string, FieldSchemaEntry>,
): FieldContentResolution | null {
  const fieldProp = node.props?.field;
  if (typeof fieldProp !== 'string' || !fieldProp) return null;
  if (!ownFieldSchemaEntry(objectSchema, fieldProp)) return null;

  const fieldName = NAMING_COMPONENTS.has(node.component) ? displayFieldExpression(fieldProp, objectSchema) : snakeToCamel(fieldProp);
  const existing = (node.props as Record<string, unknown>) ?? {};
  if (Object.hasOwn(FIELD_VALUE_PROP_TARGETS, node.component)) {
    const propName = FIELD_VALUE_PROP_TARGETS[node.component]!;
    // Don't override an explicitly set data prop
    if (existing[propName] !== undefined) return null;
    return { strategy: 'value-prop', fieldName, propName, isChildren: false };
  }

  const strategy = getContentStrategy(node.component);
  if (strategy === 'none') return null;

  switch (strategy) {
    case 'children':
      return { strategy, fieldName, isChildren: true };
    case 'value-prop':
      // Don't override an explicitly set value prop
      if (existing.value !== undefined) return null;
      return { strategy, fieldName, propName: 'value', isChildren: false };
    case 'label-prop':
      // Don't override an explicitly set label prop
      // PriceBadge recipes use label as accessible authoring guidance while
      // `field` remains the value that must be rendered. The generated runtime
      // binding therefore replaces that static authoring label.
      if (existing.label !== undefined && node.component !== 'PriceBadge') return null;
      return { strategy, fieldName, propName: 'label', isChildren: false };
    case 'status-prop':
      // Don't override an explicitly set status prop
      if (existing.status !== undefined) return null;
      return { strategy, fieldName, propName: 'status', isChildren: false };
    default:
      return null;
  }
}

/**
 * Resolve field content for the real React/Vue package contracts.
 * Their Badge and Button APIs expose `content`, while the legacy HTML
 * strategy continues to use `label`.
 */
export function resolveFrameworkChildContent(
  node: UiElement,
  objectSchema?: Record<string, FieldSchemaEntry>,
): FieldContentResolution | null {
  if (FIELD_CONSUMED_UNBOUND.has(node.component)) return null;
  const sourceField = node.props?.field;
  if (
    node.component === 'RelativeTimestamp'
    && typeof sourceField === 'string'
    && ownFieldSchemaEntry(objectSchema, sourceField)
  ) {
    const fallbackField = node.props?.fallbackField;
    const fallback = typeof fallbackField === 'string'
      && ownFieldSchemaEntry(objectSchema, fallbackField)
      ? ` ?? ${snakeToCamel(fallbackField)}`
      : '';
    return {
      strategy: 'value-prop',
      fieldName: `${snakeToCamel(sourceField)}${fallback}`,
      propName: 'datetime',
      isChildren: false,
    };
  }
  if (
    node.component === 'CancellationSummary'
    && typeof sourceField === 'string'
    && ownFieldSchemaEntry(objectSchema, sourceField)
  ) {
    return {
      strategy: 'value-prop',
      fieldName: snakeToCamel(sourceField),
      propName: 'cancelAtPeriodEnd',
      isChildren: false,
    };
  }

  if (node.component === 'ClassificationEditor'
    && typeof sourceField === 'string' && ownFieldSchemaEntry(objectSchema, sourceField)) {
    // This presentational form exposes supporting text, not a generic value editor.
    return { strategy: 'value-prop', fieldName: snakeToCamel(sourceField), propName: 'description', isChildren: false };
  }

  if (['LabelCell', 'InlineLabel', 'TimelineEntryLabel'].includes(node.component)
    && typeof sourceField === 'string' && ownFieldSchemaEntry(objectSchema, sourceField)) {
    // Bound labels use the real value prop; authored children keep their HTML
    // override semantics and are not confused with text that needs truncation.
    return { strategy: 'label-prop', fieldName: namingFieldExpression(sourceField, objectSchema), propName: 'label', isChildren: false };
  }

  const resolution = resolveChildContent(node, objectSchema);
  if (!resolution) {
    const field = node.props?.field;
    if (typeof field !== 'string' || !ownFieldSchemaEntry(objectSchema, field)) return null;

    const fieldName = snakeToCamel(field);
    const existing = (node.props as Record<string, unknown>) ?? {};
    if (node.component === 'Checkbox' || node.component === 'Switch') {
      if (existing.checked !== undefined) return null;
      return {
        strategy: 'value-prop',
        fieldName,
        propName: 'checked',
        isChildren: false,
      };
    }
    if (node.component === 'DatePicker' || node.component === 'Textarea') {
      if (existing.value !== undefined) return null;
      return {
        strategy: 'value-prop',
        fieldName,
        propName: 'value',
        isChildren: false,
      };
    }
    return null;
  }
  if (
    resolution.strategy !== 'label-prop'
    || (node.component !== 'Badge' && node.component !== 'Button')
  ) {
    return NAMING_COMPONENTS.has(node.component) && typeof sourceField === 'string'
      ? { ...resolution, fieldName: namingFieldExpression(sourceField, objectSchema) } : resolution;
  }

  const existing = (node.props as Record<string, unknown>) ?? {};
  if (existing.content !== undefined) return null;
  return { ...resolution, propName: 'content' };
}

export type FrameworkRecipePropBinding = {
  /** Authoring-only directive removed from generated component props. */
  sourceProp: string;
  /** Runtime component prop receiving the object field expression. */
  targetProp: string;
  /** Camel-cased object field expression used by both JSX and Vue templates. */
  expression: string;
  /** True when the expression is an authored literal rather than an object field. */
  literal?: boolean;
};

export type FrameworkRecipePropResolution = {
  bindings: FrameworkRecipePropBinding[];
  consumedProps: string[];
};

const RECIPE_FIELD_TARGETS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  ArchiveEvent: {"archivedAtField": "archivedAt", "restoredAtField": "restoredAt", "reasonField": "reason", "archivedByField": "archivedBy"},
  CancellationEvent: {"timestampField": "timestamp", "labelField": "reason", "codeField": "code"},
  StateTransitionEvent: {"historyField": "history", "labelField": "status"},
  CommunicationDetailPanel: {"channelsField": "channels", "templatesField": "templates", "policiesField": "policies", "conversationsField": "conversations"},
  ColorStatePicker: {},
  StatusColorLegend: {"badgeField": "value"},
  GeoFieldMappingForm: {"latitudeField": "latitude", "longitudeField": "longitude", "identifierField": "identifier", "autoDetectField": "autoDetect"},
  GeoResolutionBadge: {"resolutionField": "resolution"},
  GeocodablePreview: {"resolutionField": "resolution", "requiresLookupField": "requiresLookup", "detectedFieldsField": "detectedFields"},
  AuditSummaryCard: { auditLogField: 'auditLog' },
  SortIndicator: { sortFieldProp: 'sortField', sortDirectionProp: 'sortDirection' },
  BillingSummaryBadge: { amountField: 'amount', currencyField: 'currency', intervalField: 'interval' },
  BillingCardMeta: { amountField: 'amount', currencyField: 'currency', intervalField: 'interval' },
  CycleProgressCard: { progressField: 'progress', periodStartField: 'periodStart', periodEndField: 'periodEnd', intervalField: 'interval' },
  PaymentTimeline: { lastPaymentField: 'lastPayment', nextPaymentField: 'nextPayment', paymentStatusField: 'paymentStatus', paymentMethodField: 'paymentMethod', amountField: 'amount', currencyField: 'currency' },
  PaymentEventTimeline: { lastPaymentField: 'lastPayment', nextPaymentField: 'nextPayment', paymentStatusField: 'paymentStatus', amountField: 'amount', currencyField: 'currency' },
  ArchivedRowOverlay: { archivedField: 'isArchived', labelField: 'label' },
  BillingAmountInput: { amountField: 'amount', currencyField: 'currency' },
  BillingIntervalSelector: { intervalField: 'interval' },
  ArchiveSummary: { archivedField: 'isArchived', archivedAtField: 'archivedAt', reasonField: 'reason' },
  CancellationForm: { reasonField: 'reason', codeField: 'reasonCode' },
  PriceCardMeta: { modelField: 'model', intervalField: 'interval' },
  OwnerBadge: { ownerIdField: 'owner', ownerTypeField: 'ownerType' },
  OwnershipSummary: { ownerIdField: 'ownerId', ownerTypeField: 'ownerType', roleField: 'role' },
  OwnershipMeta: { ownerTypeField: 'ownerType', roleField: 'role' },
  TagSummary: { countField: 'tagCount' },
  LabelCell: { descriptionField: 'description' },
  FormLabelGroup: { labelField: 'label', descriptionField: 'description', placeholderField: 'placeholder' },
  ClassificationBadge: { primaryCategoryField: 'category' },
  AuditEvent: {
    typeField: 'event',
    timestampField: 'timestamp',
  },
  AuditTimeline: {
    auditLogField: 'auditLog',
  },
  CancellationSummary: {
    cancelAtPeriodEndField: 'cancelAtPeriodEnd',
    requestedAtField: 'requestedAt',
    reasonField: 'reason',
    codeField: 'code',
  },
  CardHeader: {
    titleField: 'title',
    supportingField: 'supporting',
  },
  DetailHeader: {
    titleField: 'title',
    subtitleField: 'subtitle',
  },
  FilterPanel: {
    activeField: 'activeFilters',
  },
  PaginationBar: {
    pageField: 'page',
    pageSizeField: 'pageSize',
    totalItemsField: 'totalItems',
    totalPagesField: 'totalPages',
  },
  PriceBadge: {
    amountField: 'amount',
    currencyField: 'currency',
    intervalField: 'data-interval',
  },
  MessageEventTimeline: {
    messagesField: 'messages',
    statusesField: 'statuses',
  },
  PreferenceEditor: {
    namespacesField: 'namespaces',
    documentField: 'document',
  },
  PreferenceSummaryBadge: {
    versionField: 'version',
  },
  RoleAssignmentForm: {
    availableRolesField: 'availableRoles',
  },
  TemplatePicker: {
    templatesField: 'templates',
    channelsField: 'channels',
  },
  PriceSummary: {
    amountField: 'amount',
    currencyField: 'currency',
    modelField: 'model',
    intervalField: 'interval',
  },
  RoleBadgeList: {
    rolesField: 'roles',
  },
  StatusBadge: {
    statusField: 'status',
    domainField: 'domain',
  },
  StatusTimeline: {
    historyField: 'history',
  },
};

const RECIPE_PARAMETER_PROPS = new Set([
  'sortableFieldsParameter', 'triStateSortParameter', 'defaultSortFieldParameter', 'defaultSortDirectionParameter',
  'intervalsParameter',
  'allowCustomParameter',
  'allowDynamicParameter',
  'allowListParameter',
  'clearableParameter',
  'collapsibleParameter',
  'debounceParameter',
  'defaultRoleParameter',
  'eventOptionsParameter',
  'fallbackRoleParameter',
  'initialParameter',
  'minorUnitsParameter',
  'allowTransferParameter',
  'retainHistoryParameter',
  'restoreWindowParameter',
  'allowPartialRestoreParameter',
  'allowedReasonsParameter',
  'windowParameter',
  'maxActiveParameter',
  'maxLengthParameter',
  'maxLabelLengthParameter',
  'maxDescriptionLengthParameter',
  'requireDescriptionParameter',
  'tagPolicyParameter',
  'maxTagsParameter',
  'minLengthParameter',
  'minQueryLengthParameter',
  'modeParameter',
  'moderationParameter',
  'optionsParameter',
  'pageSizeOptionsParameter',
  'placeholderParameter',
  'registryNamespaceParameter',
  'requireReasonParameter',
  'roleParameter',
  'showGotoPageParameter',
  'showItemRangeParameter',
  'showPageSizeSelectorParameter',
  'statesParameter',
  'synonymParameter',
  'timezoneParameter',
]);

/**
 * Recipe field directives consumed without a runtime binding. The HTML
 * renderer reads none of their targets as component data, so lowering them
 * would invent a prop; each is named in the component's contract record.
 */
export const RECIPE_UNBOUND_DIRECTIVES: Readonly<Record<string, readonly string[]>> = {
  VizAreaPreview: ['svgParameter', 'baselineField', 'curveField', 'opacityField'],
  VizAreaControls: ["baselineField", "curveField", "opacityField", "tensionField", "intentParameter"],
  VizAxisControls: ["aggregateField", "axis", "fieldField", "kindField", "scaleField", "sortField", "titleField", "zeroField", "intentParameter"],
  VizAxisSummary: ["axis", "scaleField", "titleField", "zeroField", "intentParameter"],
  VizColorControls: ["channelField", "contrastField", "redundancyField", "schemeField", "intentParameter"],
  VizColorLegendConfig: ["field", "redundancyField", "schemeField", "intentParameter"],
  VizEncodingBadge: ["axis", "fieldField", "intentParameter"],
  VizHeatmapControls: ["intentParameter"],
  VizHeatmapPreview: ["svgParameter"],
  VizLineControls: ["curveField", "joinField", "markersField", "strokeField", "intentParameter"],
  VizLinePreview: ["curveField", "markersField", "strokeWidthField", "svgParameter"],
  VizGraphPreview: ["svgParameter"],
  VizMarkControls: ["cornerRadiusField", "orientationField", "paddingField", "stackingField", "intentParameter"],
  VizMarkPreview: ["orientationField", "stackingField", "typeField", "svgParameter"],
  VizOpacityControls: ["intentParameter"],
  VizOpacitySummary: ["intentParameter"],
  VizPointControls: ["opacityField", "shapeField", "sizeField", "strokeField", "intentParameter"],
  VizPointPreview: ["fillField", "shapeField", "sizeField", "svgParameter"],
  VizRoleBadge: ["labelField", "intentParameter"],
  VizScaleControls: ["domainMaxField", "domainMinField", "formatField", "modeField", "niceField", "rangeMaxField", "rangeMinField", "type", "zeroField", "intentParameter"],
  VizScaleSummary: ["domainMaxField", "domainMinField", "modeField", "niceField", "type", "zeroField", "intentParameter"],
  VizScatterControls: ["intentParameter"],
  VizScatterPreview: ["svgParameter"],
  VizShapeControls: ["intentParameter"],
  VizShapeLegend: ["intentParameter"],
  VizSizeControls: ["maxAreaField", "maxField", "minAreaField", "minField", "strategyField", "intentParameter"],
  VizSizeSummary: ["field", "maxField", "minField", "strategyField", "intentParameter"],
  ArchiveEvent: ['metadataField', 'restorationMetadataField'],
  ColorStatePicker: ['parameter'],
  StatusColorLegend: ['parameter'],
  ArchivedRowOverlay: ['style'],
  ArchiveSummary: ['restoredAtField', 'archivedByField', 'metadataField'],
  ArchivePill: ['archivedAtField'],
  PriceCardMeta: ['amountField', 'currencyField'],
  OwnershipSummary: ['transferredAtField'],
  // s223-m01: the card's ownership line names the owner; the ID itself is not shown, only its label (bound below).
  OwnershipMeta: ['ownerIdField'],
  AddressCollectionPanel: ['roleField', 'defaultRoleField'],
  AddressEditor: ['defaultRoleField'],
  ClassificationBadge: ['tagPreviewField'],
  ClassificationPanel: ['categoriesField', 'tagsField', 'metadataField'],
  MembershipPanel: ['membershipsField', 'hierarchyField', 'roleField', 'permissionField'],
  MessageStatusBadge: ['statusesField'],
  PreferencePanel: ['preferencesField', 'metadataField', 'namespaceField'],
  PreferenceSummaryBadge: ['namespacesField'],
  RoleAssignmentForm: ['membershipField'],
  StatusSelector: ['allowedTransitionsField'],
  PreferenceTimeline: ['metadataField'],
  PriceSummary: ['taxBehaviorField'],
  // The composer's field description lands on TagPills as label; renderTagPills never reads it.
  TagPills: ['label'],
  // A layout container reads no data; the composer still writes trait directives onto pattern-group Stacks.
  // `as` reaches a Stack when the form composer expands a heading title slot into several components.
  Stack: ['as', 'channelsField', 'templatesField', 'policiesField', 'conversationsField', 'historyField', 'labelField', 'showActor', 'showReason'],
};

/**
 * Convert object recipe metadata (`amountField`, `historyField`, etc.) into
 * executable runtime prop bindings. Directive names never leak into generated
 * framework components: they describe how to bind data, not public runtime
 * values themselves.
 */
export function resolveFrameworkRecipeProps(
  node: UiElement,
  objectSchema?: Record<string, FieldSchemaEntry>,
  workflowCollections = false,
): FrameworkRecipePropResolution {
  const props = (node.props ?? {}) as Record<string, unknown>;
  const mappings = RECIPE_FIELD_TARGETS[node.component] ?? {};
  const bindings: FrameworkRecipePropBinding[] = [];
  const consumedProps = new Set<string>();
  const boundTargets = new Set<string>();
  // Workflows own the collection record and read it through their store's helpers.
  const collectionField = props.field;
  if (workflowCollections && typeof collectionField === 'string' && ownFieldSchemaEntry(objectSchema, collectionField)?.type === 'AddressableEntry[]') {
    const source = snakeToCamel(collectionField);
    const roleField = props.defaultRoleField;
    const role = typeof roleField === 'string' && ownFieldSchemaEntry(objectSchema, roleField) ? snakeToCamel(roleField) : 'undefined';
    const targets = node.component === 'AddressEditor' ? ['street', 'city', 'region', 'postalCode'] : node.component === 'AddressCollectionPanel' ? ['summary'] : [];
    for (const targetProp of targets) {
      if (props[targetProp] !== undefined) continue;
      bindings.push({ sourceProp: 'field', targetProp, expression: targetProp === 'summary' ? `collectionSummary(${source})` : `collectionAddress(${source}, ${role}).${targetProp}` });
      boundTargets.add(targetProp);
    }
  } else if (node.component === 'AddressCollectionPanel' && typeof collectionField === 'string' && ownFieldSchemaEntry(objectSchema, collectionField)?.type === 'AddressableEntry[]' && props.summary === undefined) {
    // s223-m02 (#2527 ruling 13i, #2521): a single screen's address panel reads the record's addresses too, through the
    // contract helper that prints the workflow store's line; the editor stays unbound there (its domain action owns edits).
    bindings.push({ sourceProp: 'field', targetProp: 'summary', expression: `addressCollectionSummary(${snakeToCamel(collectionField)})` });
    boundTargets.add('summary');
  }

  for (const [sourceProp, defaultTarget] of Object.entries(mappings)) {
    if (!Object.hasOwn(props, sourceProp)) continue;
    consumedProps.add(sourceProp);
    const sourceField = props[sourceProp];
    if (typeof sourceField !== 'string' || !ownFieldSchemaEntry(objectSchema, sourceField)) continue;

    const targetProp = node.component === 'PriceBadge'
      && sourceProp === 'amountField'
      && (typeof props.minorUnitsParameter === 'string' || ownFieldSchemaEntry(objectSchema, sourceField)?.money?.minorUnits !== undefined)
      ? 'amountCents'
      : defaultTarget;
    if (props[targetProp] !== undefined || boundTargets.has(targetProp)) continue;
    bindings.push({
      sourceProp,
      targetProp,
      expression: node.component === 'PreferenceEditor' && sourceProp === 'documentField' ? `JSON.stringify(${snakeToCamel(sourceField)} ?? {}, null, 2)` : NAMING_COMPONENTS.has(node.component) && ['titleField', 'labelField'].includes(sourceProp) ? namingFieldExpression(sourceField, objectSchema) : snakeToCamel(sourceField),
    });
    boundTargets.add(targetProp);
  }

  const amountField = props.amountField;
  const minorUnits = typeof amountField === 'string' ? ownFieldSchemaEntry(objectSchema, amountField)?.money?.minorUnits : undefined;
  if (node.component === 'PriceBadge' && props.minorUnits === undefined && minorUnits !== undefined) {
    bindings.push({ sourceProp: 'minorUnitsParameter', targetProp: 'minorUnits', expression: JSON.stringify(minorUnits) });
  }

  // An owner name is display metadata; the owner prop/ID and action payload remain untouched. s223-m01: the card's
  // OwnershipMeta takes the same label, so it reads "Owned by Pricing and packaging · team".
  const ownerField = props.ownerIdField;
  if (['OwnerBadge', 'OwnershipSummary', 'OwnershipMeta'].includes(node.component) && typeof ownerField === 'string' && isReferenceField(ownFieldSchemaEntry(objectSchema, ownerField))) {
    const targetProp = node.component === 'OwnerBadge' ? 'label' : 'ownerLabel';
    if (props[targetProp] === undefined && !boundTargets.has(targetProp)) {
      bindings.push({ sourceProp: 'ownerIdField', targetProp, expression: referenceFieldExpression(ownerField, objectSchema) });
      boundTargets.add(targetProp);
    }
  }

  for (const parameterProp of RECIPE_PARAMETER_PROPS) {
    if (Object.hasOwn(props, parameterProp)) consumedProps.add(parameterProp);
  }
  const unboundDirectives = Object.hasOwn(RECIPE_UNBOUND_DIRECTIVES, node.component)
    ? RECIPE_UNBOUND_DIRECTIVES[node.component]!
    : [];
  for (const directive of unboundDirectives) {
    if (Object.hasOwn(props, directive)) consumedProps.add(directive);
  }

  // The historical recipe calls the source `states`, while the materialized
  // object field is the semantically narrower list of valid next transitions.
  if (
    node.component === 'StatusTimeline'
    && Object.hasOwn(props, 'statesParameter')
    && props.allowedTransitions === undefined
    && ownFieldSchemaEntry(objectSchema, 'allowed_transitions')
  ) {
    bindings.push({
      sourceProp: 'statesParameter',
      targetProp: 'allowedTransitions',
      expression: 'allowedTransitions',
    });
  }

  // Saved detail headers author their heading level as `headingLevel`; the
  // runtime prop is `level`. Only an in-range integer lowers; anything else is
  // left for the build-profile prop check to reject.
  if (node.component === 'DetailHeader' && Object.hasOwn(props, 'headingLevel')) {
    consumedProps.add('headingLevel');
    const level = props.headingLevel;
    if (
      typeof level === 'number' && Number.isInteger(level) && level >= 1 && level <= 6
      && props.level === undefined && !boundTargets.has('level')
    ) {
      bindings.push({ sourceProp: 'headingLevel', targetProp: 'level', expression: String(level), literal: true });
      boundTargets.add('level');
    }
  }

  // RelativeTimestamp's fallback participates in its primary `datetime`
  // expression and must not survive as an unsupported string-valued prop.
  if (node.component === 'RelativeTimestamp' && Object.hasOwn(props, 'fallbackField')) {
    consumedProps.add('fallbackField');
  }

  return {
    bindings,
    consumedProps: [...consumedProps].sort(compareCodePoint),
  };
}

/* ------------------------------------------------------------------ */
/*  Slot-bound dates (s204-m02)                                        */
/* ------------------------------------------------------------------ */

/** A trailing `?` marks the type optional and says nothing about what it holds. */
export function isDateFieldEntry(entry: FieldSchemaEntry | undefined): boolean {
  if (!entry) return false;
  const type = entry.type.replace(/\?$/, '');
  return type === 'date' || type === 'datetime';
}

/** The module-local date formatter's name. Not imported from anywhere; see below. */
export const SLOT_DATE_HELPER = 'formatSlotDate';

/**
 * A date bound through a slot printed its raw stored value — a Decision card read
 * `2026-09-01T12:00:00.000Z` where its own detail read `Sep 1, 2026, 12:00 PM` (s203-m04). The
 * emitters format a date only under the `read-only-field` intent, because that branch calls
 * `formatReadOnlyValue` and so forces an `@oods/component-contracts` import; widening the branch
 * would put that dependency into artifacts that declare none, which the s203 review refused to do
 * (#2180) and instead asked for the formatted value to be lowered at generate time.
 *
 * This is that lowering: a module-LOCAL function, emitted into the artifact, so nothing is imported
 * and the declared dependency surface does not move. It is deliberately the same computation as
 * `formatDateTime` in @oods/component-contracts — same locale, same date and time styles, and the
 * same UTC pin that keeps output identical across host time zones — and
 * `slot-date-lowering.s204.spec.ts` holds the two in agreement over a corpus so this copy cannot
 * drift from the contract it mirrors.
 *
 * Absent reads as empty rather than as `Not recorded`, matching the boolean and array branches beside
 * it: this is slot-bound text, not a labelled read-only field row.
 */
export function slotDateHelperSource(typescript: boolean): string {
  const valueType = typescript ? ': unknown' : '';
  const returns = typescript ? ': string' : '';
  const cast = typescript ? ' as string | number | Date' : '';
  return [
    `function ${SLOT_DATE_HELPER}(value${valueType})${returns} {`,
    "  if (value == null || value === '') return '';",
    `  const date = new Date(value${cast});`,
    "  if (!Number.isFinite(date.getTime())) return '';",
    "  return new Intl.DateTimeFormat('en-US', {",
    "    dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',",
    '  }).format(date);',
    '}',
  ].join('\n');
}

/**
 * Whether the emitted module will call `formatSlotDate`, and therefore has to define it.
 *
 * This has to track the emitters' date branch EXACTLY. When a guard and its branch disagree, a module
 * calls what it never defined: a Sprint 203 m04 attempt to widen the read-only formatting branch without
 * widening its import guard had a Decision card render blank. (Contract helper imports are now derived
 * from the finished file instead, s213-m01; this local definition still follows its guard.) `Text` is the only component this branch fires for and its content strategy is `children`,
 * so the two conditions below are the whole of it.
 */
export function hasSlotBoundDates(
  nodes: readonly UiElement[],
  objectSchema: Record<string, FieldSchemaEntry> | undefined,
): boolean {
  return nodes.some(node => {
    const field = node.props?.field;
    const bound = node.component === 'Text'
      && node.meta?.intent !== 'read-only-field'
      && typeof field === 'string'
      && isDateFieldEntry(ownFieldSchemaEntry(objectSchema, field));
    return bound || hasSlotBoundDates(node.children ?? [], objectSchema);
  });
}

/** The module-local heading-excerpt formatter's name. Not imported from anywhere. */
export const SLOT_EXCERPT_HELPER = 'formatHeadingExcerpt';

/** How much of a record's prose a card heading shows before it is cut. */
export const HEADING_EXCERPT_LIMIT = 120;

/**
 * A card heading standing in for a record with no title shows the record's FIRST LINE, not all of it.
 *
 * Emitted into the artifact rather than imported, for the same reason as `slotDateHelperSource`: the
 * declared dependency surface must not move. The cut is by line first and then by length, so a
 * decision whose first line is already a sentence keeps that sentence whole, and the 8,418-character
 * one does not paint a wall of text into a card header. An ellipsis marks that something was cut, so
 * the heading never reads as the whole value.
 *
 * The full value still renders on the detail; only the heading is cut.
 */
export function slotExcerptHelperSource(typescript: boolean): string {
  const valueType = typescript ? ': unknown' : '';
  const returns = typescript ? ': string' : '';
  return [
    `function ${SLOT_EXCERPT_HELPER}(value${valueType})${returns} {`,
    "  if (value == null) return '';",
    '  const text = String(value).trim();',
    "  const firstLine = text.split(/\\r?\\n/)[0] ?? '';",
    `  if (firstLine.length <= ${HEADING_EXCERPT_LIMIT}) return firstLine === text ? firstLine : firstLine + '\\u2026';`,
    `  return firstLine.slice(0, ${HEADING_EXCERPT_LIMIT}).trimEnd() + '\\u2026';`,
    '}',
  ].join('\n');
}

/**
 * Whether the emitted module will call `formatHeadingExcerpt`, and therefore has to define it.
 * Tracks the emitters' excerpt branch exactly; see the note on `hasSlotBoundDates`.
 */
export function hasHeadingExcerpts(nodes: readonly UiElement[]): boolean {
  return nodes.some(node =>
    (node.component === 'Text' && node.meta?.headingExcerpt === true && typeof node.props?.field === 'string')
    || hasHeadingExcerpts(node.children ?? []));
}
