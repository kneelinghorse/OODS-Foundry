import { recordKeyField } from '../objects/record-identity.js';
import { loadObject } from '../objects/object-loader.js';
import type { UiElement, UiSchema } from '../schemas/generated.js';
import type { ComposedObject } from '../objects/trait-composer.js';
import { fieldLabel, fieldHelp } from './label-generator.js';
import { enumOptionLabel, isInternalField, isUnavailableField } from './internal-fields.js';
import { recordTitleField } from './record-label.js';
import { VIZ_CONTROL_IDS, componentContracts } from '@oods/component-contracts';
import { resolveTraitRecipeProps } from './trait-recipes.js';
import { isLevelOneHeading, RECORD_SUMMARY_INTENT } from '../codegen/screen-shell.js';

/** s213-m03: marks a trait component the status-timeline pattern group kept beside its own fields (design.compose). */
export const KEPT_BESIDE_PATTERN = 'kept-beside-pattern';

const controls = new Set(['Input', 'Select', 'SegmentedControl', 'Combobox', 'Textarea', 'DatePicker', 'Checkbox', 'Switch', 'Toggle', 'StatusSelector', 'CancellationForm', 'BillingAmountInput', 'BillingIntervalSelector']);
/** The plain field editors a requested control may stand in for; composite editors (a status selector) keep their place. */
const fieldControls = new Set(['Input', 'Select', 'SegmentedControl', 'Combobox', 'Textarea', 'DatePicker', 'Checkbox', 'Switch', 'Toggle']);
/**
 * s223-m02 (#2527 ruling 12): the control a field's semantics ask for (`ui_hints.component`) edits it in a form when it can
 * edit that field. A Switch edits a boolean, and codegen binds it as Checkbox binds. A SegmentedControl (two to five
 * options) and a Combobox edit an enum, bound to its value with its options as Select binds. Any other name, or a field
 * the named control cannot edit, keeps the composer's default: Checkbox for a boolean, Select for an enum.
 */
const requestedControls: Readonly<Record<string, (type: string, entry: { enum?: readonly unknown[] }) => boolean>> = {
  Switch: type => type === 'boolean',
  SegmentedControl: (_, entry) => (entry.enum?.length ?? 0) >= 2 && (entry.enum?.length ?? 0) <= 5,
  Combobox: (_, entry) => Boolean(entry.enum?.length),
};
/** Whether a governed component's contract has a prop; a name outside the contracts (Toggle) keeps what it is given. */
const contractHas = (component: string, prop: string): boolean => {
  const contract = (componentContracts as Readonly<Record<string, { props: readonly string[] } | undefined>>)[component];
  return !contract || contract.props.includes(prop);
};
const owners: Record<string, string[]> = {
  ColorStatePicker: ['field'],
  GeoFieldMappingForm: ['latitudeField', 'longitudeField', 'identifierField', 'autoDetectField'],
  BillingAmountInput: ['amountField'], BillingIntervalSelector: ['intervalField'],
  CancellationForm: ['reasonField', 'codeField'], StatusSelector: ['field'],
};
const walk = (node: UiElement, visit: (node: UiElement) => void): void => { visit(node); node.children?.forEach(child => walk(child, visit)); };
const findNode = (node: UiElement, match: (node: UiElement) => boolean): UiElement | undefined => {
  if (match(node)) return node;
  for (const child of node.children ?? []) { const found = findNode(child, match); if (found) return found; }
  return undefined;
};
/** The record fields a node binds through `field` and its `*Field` props. */
const boundFields = (props: Record<string, unknown> | undefined): string[] => Object.entries(props ?? {}).flatMap(([key, value]) => (key === 'field' || key.endsWith('Field')) && typeof value === 'string' ? [value] : []);

/**
 * Reconcile the public form/detail trees after trait placement and field wiring. `readTab` names the tab of the record's
 * own read-only fields (an object's metadata.detailTab; "Details" when it declares none).
 */
export function reconcileFormDetail(schema: UiSchema, context: string, composed: ComposedObject, tabLabels?: string[], readTab = 'Details', viewState: ReadonlySet<string> = new Set()): void {
  if (context === 'form') {
    const fields = schema.objectSchema ?? {};
    let relationships: NonNullable<ReturnType<typeof loadObject>['relationships']> = [];
    try { relationships = loadObject(composed.object.name).relationships ?? []; } catch { /* Inline composition has no registry entry. */ }
    const owned = new Set<string>();
    const fieldEditors = new Set<string>();
    // Keep the authored classification editor beside the scalar editor; repairing
    // the slot must not remove the trait's category/tag controls from the form.
    for (const screen of schema.screens) walk(screen, parent => {
      parent.children = parent.children?.flatMap(node => {
        const field = node.props?.field;
        // A fallback header with no record binding says only Details. Let the shell name this form.
        if (/^form-title-/.test(node.id) && node.meta?.intent === 'slot:title' && node.component === 'DetailHeader'
          && !node.props?.titleField && !node.props?.title && !node.children?.length
          && !(typeof field === 'string' && fields[field])) return [];
        // An unfilled Text title can acquire an arbitrary scalar during field wiring (Plan's heading became "0").
        // Let the screen shell name the form; keep authored headings and real editors intact.
        if (/^form-title-/.test(node.id) && node.meta?.intent === 'slot:title' && node.component === 'Text'
          && isLevelOneHeading(node) && typeof field === 'string' && !node.children?.length
          && node.props?.content === undefined && node.props?.text === undefined) return [];
        const entry = typeof field === 'string' ? fields[field] : undefined;
        if (node.component !== 'ClassificationEditor' || !entry
          || !/^(?:string|uuid|email|url|integer|number|boolean|date|datetime)\??$/.test(entry.type)) return [node];
        const classification: UiElement = { ...node, id: `${node.id}-classification`, meta: undefined, props: { ...node.props } };
        delete classification.props!.field;
        delete classification.props!.label;
        const type = entry.type.replace(/\?$/, '');
        node.component = entry.enum?.length ? 'Select' : type === 'boolean' ? 'Checkbox'
          : type === 'string' && /description|reason|notes|body|content|instructions/.test(String(field)) ? 'Textarea' : 'Input';
        node.props = { field, ...(entry.enum?.length ? { options: entry.enum.map(value => ({ value, label: enumOptionLabel(value) })) } : {}),
          ...(['number', 'integer'].includes(type) ? { type: 'number' } : ['email', 'url', 'date'].includes(type) ? { type } : {}) };
        node.bindings = { onChange: `handleChange_${field}` };
        return [node, classification];
      });
    });
    for (const screen of schema.screens) walk(screen, node => {
      if (controls.has(node.component) && typeof node.props?.field === 'string') fieldEditors.add(node.props.field);
      for (const directive of owners[node.component] ?? []) {
        const field = node.props?.[directive];
        if (typeof field === 'string') owned.add(field);
      }
    });
    // The slot budget limits optional suggestions, never the data needed to save a record.
    // Reconcile after trait ownership is known so composite editors are not duplicated.
    const edited = new Set([...fieldEditors, ...owned]);
    for (const screen of schema.screens) walk(screen, node => {
      if (controls.has(node.component) || /(?:Editor|Form|Picker|Selector)$/.test(node.component)) {
        for (const field of boundFields(node.props)) edited.add(field);
      }
    });
    const missing = Object.entries(fields).filter(([name, entry]) => entry.required && !edited.has(name) && !viewState.has(name)
      && /^(?:string|uuid|email|url|integer|number|boolean|date|datetime)\??$/.test(entry.type)
      && !isInternalField(name, fields) && !isUnavailableField(name, fields));
    const fieldStack = schema.screens.map(screen => findNode(screen, node => /^form-fields-/.test(node.id))).find(Boolean);
    if (fieldStack) for (const [name, entry] of missing) {
      fieldEditors.add(name);
      const type = entry.type.replace(/\?$/, '');
      const component = entry.enum?.length ? 'Select' : type === 'boolean' ? 'Checkbox' : 'Input';
      fieldStack.children ??= [];
      fieldStack.children.push({ id: `${fieldStack.id}-required-${name}`, component,
        props: { field: name, ...(entry.enum?.length ? { options: entry.enum.map(value => ({ value, label: enumOptionLabel(value) })) } : {}) },
        bindings: { onChange: `handleChange_${name}` } });
    }
    for (const screen of schema.screens) walk(screen, node => {
      // Keep the declared field editor when the title slot points at that same value.
      node.children = node.children?.filter(child => !(child.component === 'DetailHeader' && fieldEditors.has(String(child.props?.field))));
      // A field wired into a title slot is still editable data, not the form heading.
      const titleField = node.props?.field;
      if (node.component === 'DetailHeader' && typeof titleField === 'string' && fields[titleField]) {
        node.component = 'Input';
        node.props = { field: titleField };
        // s205-m06: the binding pass skipped this node while it was a display header, so the Input it becomes has no
        // change handler and React renders it as a value that snaps back — uneditable, and it passed required
        // validation empty. The runtime sweep caught it on the first objects whose title slot no trait fills.
        node.bindings = { ...node.bindings, onChange: node.bindings?.onChange ?? `handleChange_${titleField}` };
      }
      node.children = node.children?.filter(child => !(controls.has(child.component) && !owners[child.component] && owned.has(String(child.props?.field))));
      // Internal fields (derived counts, version counters, hint copy) are not edited by hand.
      node.children = node.children?.filter(child => !(controls.has(child.component) && typeof child.props?.field === 'string' && (isInternalField(child.props.field, fields) || isUnavailableField(child.props.field, fields))));
      // The object's own scalar role field is the role editor; a membership Role Assignment beside it is a duplicate Role field.
      node.children = node.children?.filter(child => !(child.component === 'RoleAssignmentForm' && fieldEditors.has('role')));
      // The Labelled heading group only echoes the label input above the same form.
      node.children = node.children?.filter(child => !(child.component === 'FormLabelGroup' && !child.children?.length && fields[String(child.props?.labelField ?? 'label')]));
      const field = node.props?.field;
      const entry = typeof field === 'string' ? schema.objectSchema?.[field] : undefined;
      if (entry && controls.has(node.component)) {
        const type = entry.type.replace(/\?$/, '');
        // Selector heuristics must not turn names/status codes into paragraphs,
        // or a timezone/period label into a native date input.
        if (node.component === 'Textarea' && !/description|reason|notes|body|content|instructions/.test(String(field))) node.component = 'Input';
        if (node.component === 'DatePicker' && !['date', 'datetime'].includes(type)) node.component = 'Input';
        if (entry.enum?.length && ['Input', 'Textarea'].includes(node.component)) { node.component = 'Select'; node.props = { field }; }
        const requested = composed.semantics?.[field as string]?.ui_hints?.component;
        if (typeof requested === 'string' && Object.hasOwn(requestedControls, requested) && fieldControls.has(node.component) && requestedControls[requested]!(type, entry)) node.component = requested;
        // A Labelled object's `label` is its display name; the form calls it that.
        const declaredLabel = composed.semantics?.[field as string]?.ui_hints?.label;
        const defaultLabel = typeof declaredLabel === 'string' ? declaredLabel : field === 'label' && !fields.name && !fields.title && !fields.display_name ? 'Name' : fieldLabel(field as string);
        // s223-m02: the description is help only where the control's contract has help (a SegmentedControl has none).
        node.props = { ...node.props, label: node.props?.label === entry.description || !node.props?.label || node.props.label === field || node.props.label === fieldLabel(field as string) ? defaultLabel : node.props.label, ...(entry.description && contractHas(node.component, 'help') ? { help: fieldHelp(field as string, entry.description) } : {}) };
        const relationship = relationships.find(edge => edge.via === field);
        if (relationship && !type.endsWith('[]')) {
          const target = loadObject(relationship.target);
          const keys = Object.keys(target.schema);
          const id = recordKeyField(target)!;
          const title = keys.find(key => target.semantics[key]?.semantic_type === 'text.label') ?? keys.find(key => /^(name|title|label)$/.test(key)) ?? id;
          const options = (target.samples ?? []).filter(row => row[id] !== undefined).map(row => ({ value: String(row[id]), label: String(row[title] ?? row[id]) }));
          node.component = 'Select';
          node.props = { field, label: typeof declaredLabel === 'string' ? declaredLabel : relationship.label && relationship.label !== field ? fieldLabel(relationship.label) : defaultLabel, options, ...(entry.description ? { help: entry.description } : {}) };
          node.bindings = { onChange: `handleChange_${field}` };
        }
        if (entry.type.replace(/\?$/, '') === 'datetime' && ['Input', 'DatePicker'].includes(node.component)) {
          node.component = 'Input'; node.props.type = 'datetime-local';
        }
      }
      if (owners[node.component] && !['ColorStatePicker', 'GeoFieldMappingForm'].includes(node.component)) {
        const fields = owners[node.component];
        node.props = { ...node.props };
        for (const directive of fields) {
          const name = node.props[directive];
          const description = typeof name === 'string' ? schema.objectSchema?.[name]?.description : undefined;
          if (description) node.props[node.component === 'CancellationForm' ? directive === 'codeField' ? 'codeHelp' : 'reasonHelp' : 'help'] = fieldHelp(String(name), description);
        }
      }
      if (node.component === 'BillingAmountInput') {
        // A record-bound currency can change after composition. A USD fallback contradicted the EUR control.
        const currency = typeof node.props?.currencyField === 'string' ? undefined : node.props?.currency;
        node.props = { ...node.props, help: currency ? `Amount in ${String(currency).toUpperCase()}` : 'Amount in the selected currency' };
      }
      if (node.component === 'CancellationForm') node.props = { ...node.props, embedded: true, allowedReasons: composed.traits.find(trait => trait.ref.name.split('/').pop() === 'Cancellable')?.ref.parameters?.allowedReasons ?? [] };
      if (node.component === 'GeoFieldMappingForm') {
        node.props = { ...node.props, embedded: true };
        node.bindings = { ...node.bindings, onChange: 'handleGeoMappingChange' };
      }
      if ((VIZ_CONTROL_IDS as readonly string[]).includes(node.component)) {
        node.bindings = { ...node.bindings, onChange: `handle${node.component}Change` };
      }
    });
    // The native Save owns submit; field controls own edits. Cancellation belongs to detail.
    for (const screen of schema.screens) if (screen.bindings) {
      delete screen.bindings.onChange; delete screen.bindings.onCancel;
    }
  }
  if (context !== 'detail' && context !== 'dashboard') return;
  const fields = schema.objectSchema ?? {};
  const groupOf = (field: string): string | undefined => { const group = composed.semantics?.[field]?.ui_hints?.detail_group; return typeof group === 'string' && group.trim() ? group : undefined; };
  const listBadges = composed.traits.flatMap(trait => (trait.definition.view_extensions?.list ?? []).map(extension => ({ component: extension.component, sourceTrait: trait.ref.name, props: resolveTraitRecipeProps(trait, extension) })));
  const statefulStatus = listBadges.filter(entry => entry.component === 'StatusBadge' && entry.sourceTrait.startsWith('lifecycle/Stateful'));
  const headerStatusFields = new Set(['status', ...statefulStatus.flatMap(entry => boundFields(entry.props))]);
  const isControl = (node: UiElement) => controls.has(node.component) || (VIZ_CONTROL_IDS as readonly string[]).includes(node.component) || /(?:Editor|Form|Picker|Selector)$/.test(node.component);
  const traitFields = new Set(composed.traits.flatMap(trait => Object.keys(trait.definition.schema ?? {})));
  const summaryField = (name: string) => !traitFields.has(name) || ['created_at', 'updated_at', 'last_event', 'last_event_at'].includes(name) || /(?:_minor|_id|_code)$/.test(name);
  const isScalar = (name: string) => /^(?:string|uuid|email|url|integer|number|boolean|date|datetime)\??$/.test(fields[name]?.type ?? '');
  // s206-m01: the heading names the record with the field its object declares (recordTitleField). A record named only
  // by its prose (a CMOS decision has no title) keeps the identifier as its heading; the prose renders in full below.
  const identifier = [`${composed.object?.name?.toLowerCase()}_id`, 'id'].find(name => fields[name]);
  const labelField: string | undefined = recordTitleField(composed.object?.name, fields, identifier ?? '') || undefined;
  const fieldRow = (name: string, id: string): UiElement => {
    // s213-m03 (finding 7): an amount is money, and in minor units, only as its semantics declare (populateObjectSchema);
    // a declared major-unit amount shows through PriceBadge, which formats major units, never divided by 100.
    const money = fields[name]?.money?.currencyField && /^(?:integer|number)\??$/.test(fields[name]?.type ?? '') ? fields[name]!.money! : undefined;
    const value: UiElement = !money ? { id: `${id}-value`, meta: { intent: 'read-only-field' }, component: 'Text', props: { field: name } }
      : money.minorUnits ? { id: `${id}-value`, meta: { intent: 'read-only-field' }, component: 'BillingSummaryBadge', props: { amountField: name, currencyField: money.currencyField, minorUnits: money.minorUnits, showInterval: false } }
        : { id: `${id}-value`, meta: { intent: 'read-only-field' }, component: 'PriceBadge', props: { amountField: name, currencyField: money.currencyField } };
    return { id: `${id}-read-field`, component: 'Stack', children: [
      { id: `${id}-label`, component: 'Text', props: { as: 'strong', content: composed.semantics[name]?.ui_hints?.label ?? fieldLabel(name.replace(/_minor$/, '').replace(/_id$/, '')) } },
      value,
    ] };
  };
  const categories = new Map<string, string>();
  for (const trait of composed.traits) for (const extension of trait.definition.view_extensions?.detail ?? []) {
    const category = trait.definition.trait.category ?? trait.ref.name.split('/')[0];
    categories.set(extension.component, category === 'financial' ? 'Billing' : category === 'lifecycle' ? 'Status & History' : category === 'content' ? 'Content' : readTab);
  }
  for (const screen of schema.screens) {
    // The record's own identifiers are available in Reference details, not presented as unresolved relationships.
    const covered = new Set([identifier, 'id'].filter((name): name is string => Boolean(name && fields[name]?.type === 'uuid')));
    for (const [name, field] of Object.entries(fields)) if (field.semanticType === 'identifier.primary' && /^uuid\??$/.test(field.type)) covered.add(name);
    // A resolved reference already displays its declared name; do not repeat the name as a second field.
    for (const field of Object.values(fields)) if (field.displayLabelField) covered.add(field.displayLabelField);
    walk(screen, node => {
      if (node.component === 'DetailHeader' && labelField) { covered.add(labelField); if (fields.description) covered.add('description'); return; }
      // The classification recipe owns these displayed fields even before its summary rows are materialized.
      if (node.component === 'ClassificationPanel') for (const name of ['primary_category_id', node.props?.tagsField]) if (typeof name === 'string' && fields[name]) covered.add(name);
      if (isControl(node) || ['Stack', 'Text', 'StatusBadge'].includes(node.component)) return;
      for (const [key, value] of Object.entries(node.props ?? {})) if ((key === 'field' || key.endsWith('Field')) && typeof value === 'string' && fields[value]) covered.add(value);
    });
    const prune = (node: UiElement): UiElement | undefined => {
      if (node.id.endsWith('-read-field')) {
        walk(node, child => { for (const key of ['field', 'amountField']) { const field = child.props?.[key]; if (typeof field === 'string') covered.add(field); } });
        return node;
      }
      if (isControl(node) || ['SearchInput', 'FilterPanel'].includes(node.component)) return undefined;
      if (node.component === 'StatusBadge' && node.meta?.intent?.startsWith('slot:') && !node.props && !node.children?.length) return undefined;
      // s225-m01: every trait-bound detail status reads as a labelled field, including a trait composed without Stateful.
      // Grouped fields still become Text rows below, and the lifecycle/header status keeps its summary placement.
      const keptStatus = node.component === 'StatusBadge' ? node.props?.statusField : undefined;
      if (typeof keptStatus === 'string' && fields[keptStatus] && (context === 'detail'
        ? !groupOf(keptStatus) && !headerStatusFields.has(keptStatus)
        : node.meta?.intent === KEPT_BESIDE_PATTERN)) {
        if (covered.has(keptStatus) || isUnavailableField(keptStatus, fields)) return undefined;
        covered.add(keptStatus);
        return { id: `${node.id}-read-field`, component: 'Stack', children: [
          { id: `${node.id}-label`, component: 'Text', props: { as: 'strong', content: fieldLabel(keptStatus) } },
          { ...node, meta: { intent: 'read-only-field' } },
        ] };
      }
      // These panel contracts render authored children, not their saved-schema directives.
      // Bind a bounded read summary rather than leave a titled empty shell.
      if (!node.children?.length && ['MembershipPanel', 'PreferencePanel', 'ClassificationPanel'].includes(node.component) && !['summary', 'text', 'body', 'emptyMessage'].some(key => node.props?.[key])) {
        const names = node.component === 'MembershipPanel' ? [node.props?.membershipsField] : node.component === 'ClassificationPanel' ? ['primary_category_id', node.props?.tagsField] : [node.props?.namespaceField, 'preference_version'];
        node.children = names.filter((name): name is string => typeof name === 'string' && Boolean(fields[name])).map(name => fieldRow(name, `${node.id}-${name}`));
      }
      // s223-m02 (#2527 ruling 13i, #2521): an address panel shows the record's addresses through its bound summary (codegen),
      // on a single screen as in a workflow. Read rows here would replace that summary, so a saved address would never read
      // back; with no address recorded the panel says so instead of leaving a lone heading.
      if (!node.children?.length && node.component === 'AddressCollectionPanel' && !['summary', 'text', 'body', 'emptyMessage'].some(key => node.props?.[key])) node.props = { ...node.props, emptyMessage: 'None recorded' };

      if (node.component === 'AuditTimeline' && !(typeof node.props?.auditLogField === 'string' && fields[node.props.auditLogField])) return undefined;
      // A pattern's scalar children are values, not an additional history log.
      if (node.component === 'Stack' && node.props?.patternComponent === 'StatusTimeline') node.props = undefined;
      if (node.component === 'DetailHeader' && labelField) node.props = { titleField: labelField, ...(fields.description ? { subtitleField: 'description' } : {}), headingLevel: 1 };
      const field = node.props?.field;
      if (['Text', 'StatusBadge'].includes(node.component) && typeof field === 'string' && fields[field]) {
        if (covered.has(field) || isUnavailableField(field, fields)) return undefined;
        covered.add(field);
        return fieldRow(field, node.id);
      }
      node.children = node.children?.map(prune).filter((child): child is UiElement => Boolean(child));
      if (['Stack', 'Card', 'Tabs'].includes(node.component) && !node.children?.length) return undefined;
      if (node.component === 'Card' && node.layout?.type === 'sidebar' && node.children?.length === 1) node.layout = { ...node.layout, type: 'stack' };
      return node;
    };
    screen.children = screen.children?.map(prune).filter((child): child is UiElement => Boolean(child));
    let header: UiElement | undefined;
    let tabs: UiElement | undefined;
    walk(screen, node => { if (node.id.includes('detail-header')) header = node; if (node.component === 'Tabs') tabs = node; });
    if (header) header.layout = { ...header.layout, type: 'stack', gapToken: 'stack-default' };
    if (header && labelField && !header.children?.some(child => child.component === 'DetailHeader' || child.children?.some(item => item.component === 'DetailHeader'))) {
      header.children = [{ id: `${header.id}-record-title`, component: 'DetailHeader', props: { titleField: labelField, headingLevel: 1 } }, ...(header.children ?? [])];
    }
    if (labelField) {
      covered.add(labelField);
      // s211-m02: a layout places its title slot anywhere in the tree (the dashboard's sits in its own header row), so
      // only a screen with no DetailHeader at all gets the record title; checking the top level alone gave two.
      let titled = false;
      walk(screen, node => { if (node.component === 'DetailHeader') titled = true; });
      if (!header && !titled) screen.children = [{ id: `${screen.id}-record-title`, component: 'DetailHeader', props: { titleField: labelField, headingLevel: 1 } }, ...(screen.children ?? [])];
    }
    // s211-m02: under the record's title, its lifecycle status and its price, the badges its list row shows, before the
    // charts and panels below; the screen's actions follow them (screen-shell.ts). Move compact price
    // duplicates here too, so a dashboard metric does not leave a bare price behind.
    const title = findNode(screen, node => node.component === 'DetailHeader' && node.props?.titleField === labelField && isLevelOneHeading(node));
    if (title) {
      const financialFields = listBadges.filter(entry => entry.sourceTrait.startsWith('financial/') && /Badge$/.test(entry.component)).flatMap(entry => boundFields(entry.props));
      const removePrice = (node: UiElement): void => {
        node.children = node.children?.filter(child => !['BillingSummaryBadge', 'BillingCardMeta', 'PriceBadge', 'PriceCardMeta'].includes(child.component) || !boundFields(child.props).some(field => financialFields.includes(field)));
        node.children?.forEach(removePrice);
      };
      removePrice(screen);
    }
    // s222-m03 (#2502 ruling 13): the header also carries the record's own status when no Stateful recipe does (an
    // invoice's, a plan's), and the amount a billing domain trait's row recipe shows, as a financial trait's does.
    const summary = [
      ...statefulStatus,
      ...(!statefulStatus.length && fields.status?.enum?.length ? [{ component: 'StatusBadge', sourceTrait: '', props: { field: 'status', tone: 'lifecycle' } as Record<string, unknown> }] : []),
      ...listBadges.filter(entry => /Badge$/.test(entry.component) && (entry.sourceTrait.startsWith('financial/') || boundFields(entry.props).some(field => fields[field]?.money))),
    ]
      // A read-only row showing the same value does not keep it out of the header; the row goes instead (below).
      .filter(entry => !findNode(screen, node => node.meta?.intent !== 'read-only-field' && node.component === entry.component && boundFields(node.props).some(field => boundFields(entry.props).includes(field))))
      .map((entry, index): UiElement => {
        const props: Record<string, unknown> = { ...entry.props };
        if (entry.component === 'StatusBadge' && typeof props.field === 'string') { props.statusField = props.field; delete props.field; }
        return { id: `${screen.id}-record-summary-${index + 1}`, component: entry.component, props };
      });
    const parent = title ? findNode(screen, node => Boolean(node.children?.includes(title))) : undefined;
    // The title's region stacks the title, its summary and the actions: a row of them does not wrap at phone width.
    if (parent?.layout?.type === 'inline') parent.layout = { ...parent.layout, type: 'stack', gapToken: 'stack-default' };
    if (title && parent && summary.length) {
      parent.children!.splice(parent.children!.indexOf(title) + 1, 0, { id: `${screen.id}-record-summary`, component: 'Stack', layout: { type: 'inline', gapToken: 'cluster-tight' }, meta: { intent: RECORD_SUMMARY_INTENT }, children: summary });
      for (const node of summary) for (const field of boundFields(node.props)) covered.add(field);
      // s222-m03: a plan's price is a row in its details tab and now in its header; the header's copy is the one that stays.
      const shown = new Set(summary.flatMap(node => [node.props?.statusField ?? node.props?.amountField].filter((field): field is string => typeof field === 'string')));
      const dropShown = (node: UiElement): void => {
        node.children = node.children?.filter(child => !(child.id.endsWith('-read-field') && child.children?.some(item => item.meta?.intent === 'read-only-field' && [item.props?.field, item.props?.statusField, item.props?.amountField].some(field => typeof field === 'string' && shown.has(field)))));
        node.children?.forEach(dropShown);
      };
      for (const child of screen.children ?? []) if (child !== parent) dropShown(child);
    }
    const remaining = Object.keys(fields).filter(name => isScalar(name) && summaryField(name) && !covered.has(name) && !isInternalField(name, fields) && !isUnavailableField(name, fields));
    if (remaining.length && !tabs) {
      tabs = { id: `${screen.id}-record-tabs`, component: 'Tabs', children: [] };
      screen.children = [...(screen.children ?? []), { id: `${screen.id}-record-body`, component: 'Card', children: [tabs] }];
    }
    if (remaining.length && tabs) {
      // The trait panels (Billing, Status & History) are the record's own content and come first; the generic read-only summary follows them.
      tabs.children = [...(tabs.children ?? []), { id: `${tabs.id}-read-fields`, component: 'Stack', props: { label: readTab }, children: remaining.map(name => fieldRow(name, `${tabs!.id}-${name}`)) }];
    }
    if (!tabs?.children) continue;
    tabs.props = { ...tabs.props, ariaLabel: tabs.props?.ariaLabel ?? 'Record details' };
    const groups = new Map<string, UiElement>();
    for (const [index, panel] of tabs.children.entries()) {
      let label = readTab;
      walk(panel, child => { if (categories.has(child.component)) label = categories.get(child.component)!; });
      label = tabLabels?.[index] ?? label;
      const existing = groups.get(label);
      if (existing) existing.children = [...(existing.children ?? []), ...(panel.children ?? [])];
      else { panel.props = { ...panel.props, label }; if (panel.meta) delete panel.meta.label; groups.set(label, panel); }
    }
    tabs.children = [...groups.values()];
    // s210-m01: a field's `ui_hints.detail_group` names the tab its read-only row belongs on. A Stage1 comparison's
    // identifiers, digests, paths and provenance leave the first tab this way, so a person reads what was compared and
    // the result first and the identity on request (objects/capture/Comparison*.object.yaml). Rows a trait placed move
    // the same way; a panel emptied by the move is dropped.
    const grouped = new Map<string, UiElement[]>();
    const extract = (node: UiElement): void => {
      node.children = node.children?.filter(child => {
        if (child.id.endsWith('-read-field')) {
          const field = child.children?.find(item => item.meta?.intent === 'read-only-field')?.props?.field;
          const group = typeof field === 'string' ? groupOf(field) : undefined;
          if (group) { grouped.set(group, [...(grouped.get(group) ?? []), child]); return false; }
          return true;
        }
        // s211-m02: a trait's status chip for a field the object assigns to a tab becomes a labelled row at the end of that
        // tab. A comparison's recorded state alone above its result read as a verdict on it (#2292).
        const statusField = child.component === 'StatusBadge' ? child.props?.statusField : undefined;
        const statusGroup = typeof statusField === 'string' ? groupOf(statusField) : undefined;
        if (statusGroup) { grouped.set(statusGroup, [...(grouped.get(statusGroup) ?? []), fieldRow(statusField as string, child.id)]); return false; }
        extract(child);
        return true;
      });
    };
    for (const panel of tabs.children) extract(panel);
    for (const [label, rows] of grouped) {
      const existing = tabs.children.find(panel => panel.props?.label === label);
      if (existing) existing.children = [...(existing.children ?? []), ...rows];
      else tabs.children.push({ id: `${tabs.id}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, component: 'Stack', props: { label }, children: rows });
    }
    tabs.children = tabs.children.filter(panel => panel.children?.length);
    for (const panel of tabs.children) orderRecordRows(panel);
  }

  // s221-m02 (#2482 ruling 7; the website's Warehouse, message dfc707d1): a panel of read-only rows opens with the fields
  // the object declares, in the order its team wrote them, so a Warehouse reads Code first, not "Updated at". The fields
  // its traits add follow, and the record's times (lifecycle/Timestampable) come last. A panel whose content is rows
  // alone, some inside a layout slot's container, becomes one list, so the order holds across the panel.
  function orderRecordRows(panel: UiElement): void {
    const rows: UiElement[] = [];
    const onlyRows = (node: UiElement): boolean => (node.children ?? []).every(child => {
      if (child.id.endsWith('-read-field')) { rows.push(child); return true; }
      return child.component === 'Stack' && !child.props && Boolean(child.children?.length) && onlyRows(child);
    });
    if (!onlyRows(panel) || rows.length < 2) return;
    const own = Object.keys(fields).filter(name => !traitFields.has(name));
    const recordTimes = composed.traits.filter(trait => (trait.definition.trait?.name ?? trait.ref.name.split('/').pop()) === 'Timestampable')
      .flatMap(trait => Object.keys(trait.definition.schema ?? {}));
    const fieldOf = (row: UiElement): string | undefined => {
      let bound: string | undefined;
      walk(row, node => { for (const key of ['field', 'amountField', 'statusField']) { const value = node.props?.[key]; if (!bound && typeof value === 'string' && fields[value]) bound = value; } });
      return bound;
    };
    const rank = (row: UiElement, index: number): [number, number] => {
      const field = fieldOf(row);
      if (field && recordTimes.includes(field)) return [2, recordTimes.indexOf(field)];
      if (field && own.includes(field)) return [0, own.indexOf(field)];
      return [1, index];
    };
    const ranked = rows.map((row, index) => ({ row, key: rank(row, index) }));
    ranked.sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1]);
    panel.children = ranked.map(entry => entry.row);
  }
}
