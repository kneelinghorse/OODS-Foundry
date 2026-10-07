import { addressCollectionSummary, formatDateTime, formatReadOnlyValue, formatRecordLabel, formatReferenceLabel } from '@oods/component-contracts';
import type { UiElement, UiSchema } from '../schemas/generated.js';
import type { CodegenOptions } from '../codegen/types.js';
import { isReferenceField, resolveFieldProps, resolveFrameworkChildContent, resolveFrameworkRecipeProps, snakeToCamel } from '../codegen/binding-utils.js';
import { fieldLabel } from '../compose/label-generator.js';
import { collectionSources } from '../codegen/collection-emitter.js';
import { withHtmlActions, HTML_INTERACTIONS } from './html-interactions.js';
import { seedPreviewModel } from '../codegen/preview-model.js';
import { collectUiStateBranches } from '../codegen/state-contract.js';
import { deriveConsumerModel } from '../codegen/preview-model.js';
import { executeCompositionDirectives } from '../codegen/composition-directives.js';
import { normalizeSchemaForFramework } from '../codegen/framework-normalization.js';
import { runPreEmit } from '../codegen/pre-emit.js';
import { referenceInspection } from '../codegen/reference-inspection.js';
import { compositionObject, screenShell, screenTitle } from '../codegen/screen-shell.js';
import { escapeHtml } from './escape-html.js';
import { renderTree } from './tree-renderer.js';

/** Resolve declared fields as data, never by evaluating the framework's expression strings. */
// s222-m03 (#2502 ruling 16): the title field of the collection whose rows are being bound, so each row is named by its
// record's title. Binding is synchronous, so the collection sets it around its own rows only.
let rowLabelField: string | undefined;

export function bindRecordSchema(schema: UiSchema, model: Record<string, unknown>): UiSchema {
  const fields = schema.objectSchema ?? {};
  const raw = (field: unknown, row: Record<string, unknown>): unknown => typeof field === 'string' ? row[snakeToCamel(field)] ?? row[field] : undefined;
  const display = (field: string, row: Record<string, unknown>): unknown => {
    const entry = fields[field];
    const value = raw(field, row);
    const shown = String(value ?? '').trim() ? value : raw(entry?.displayFallbackField, row);
    return isReferenceField(entry) || isReferenceField(fields[entry?.displayFallbackField ?? '']) ? formatRecordLabel(shown, entry?.semanticType === 'text.label') : typeof shown === 'number' ? String(shown) : shown;
  };
  const walk = (source: UiElement, row: Record<string, unknown>, suffix = ''): UiElement[] => {
    if (source.state && source.state !== (row.uiState ?? 'success') && !(source.state === 'success' && row.uiState === 'empty' && collectionSources([source]).has('rows'))) return [];
    const node = structuredClone(source);
    node.id += suffix;
    const authored = source.props ?? {};
    node.props = { ...resolveFieldProps(source, fields), ...authored };
    const props = node.props;
    if (source.children?.some(child => child.collectionControl === 'search')) props['data-oods-collection-toolbar'] = true;
    const recipe = resolveFrameworkRecipeProps(source, fields);
    for (const key of recipe.consumedProps) delete props[key];
    for (const binding of recipe.bindings) {
      const field = authored[binding.sourceProp];
      let value = binding.literal ? authored[binding.sourceProp] : raw(field, row);
      if (binding.sourceProp === 'minorUnitsParameter' && binding.targetProp === 'minorUnits') value = fields[String(authored.amountField)]?.money?.minorUnits;
      if (binding.sourceProp === 'statesParameter') value = row.allowedTransitions;
      if (node.component === 'PreferenceEditor' && binding.sourceProp === 'documentField') value = JSON.stringify(value ?? {}, null, 2);
      if (typeof field === 'string' && ['titleField', 'labelField'].includes(binding.sourceProp)) value = display(field, row);
      if (typeof field === 'string' && binding.sourceProp === 'ownerIdField' && ['label', 'ownerLabel'].includes(binding.targetProp)) value = formatReferenceLabel(value, raw(fields[field]?.displayLabelField, row) ?? fields[field]?.referenceLabels?.[String(raw(field, row))], fieldLabel(field.replace(/_ids?$/, '')));
      // s223-m02 (#2527 ruling 13i): the address panel prints the record's addresses as React and Vue do.
      if (node.component === 'AddressCollectionPanel' && binding.targetProp === 'summary') value = addressCollectionSummary(value);
      props[binding.targetProp] = value;
    }
    const field = authored.field;
    if (typeof field === 'string' && fields[field] && !source.collectionControl) {
      const content = resolveFrameworkChildContent(source, fields);
      if (content) {
        let value = raw(field, row);
        if (node.component === 'RelativeTimestamp') value ??= raw(authored.fallbackField, row);
        if (content.isChildren || ['label', 'title'].includes(content.propName ?? '')) value = display(field, row);
        if (source.meta?.intent === 'read-only-field') value = isReferenceField(fields[field])
          ? formatReferenceLabel(raw(field, row), raw(fields[field]?.displayLabelField, row) ?? fields[field]?.referenceLabels?.[String(raw(field, row))], fieldLabel(field.replace(/_ids?$/, '')))
          : formatReadOnlyValue(raw(field, row), fields[field]!.type, Boolean(fields[field]!.enum), fields[field]!.format);
        else if (content.isChildren) {
          if (/date|time/.test(fields[field]!.type) && value) value = formatDateTime(String(value), { dateOnly: fields[field]!.type.replace(/\?$/, '') === 'date' });
          else if (typeof value === 'boolean') value = value ? 'Yes' : 'No';
          else if (Array.isArray(value)) value = value.join(', ');
        }
        if (!node.children?.length || !content.isChildren) props[content.isChildren ? (['CardHeader', 'DetailHeader'].includes(node.component) ? 'title' : 'text') : content.propName!] = value ?? '';
      }
      if (node.component === 'StatusTimeline') props.status = raw(field, row);
    }
    // s223-m02 (#2527 rulings 12 and 13a): a Switch carries its field's form value too, in the hidden input its script
    // keeps; a SegmentedControl's radios and a Combobox's hidden input take the field's name as Select does.
    if (typeof field === 'string' && ['Input', 'Checkbox', 'Switch', 'Select', 'SegmentedControl', 'Combobox', 'Textarea', 'DatePicker'].includes(node.component) && !source.collectionControl) props.name ??= field;
    delete props.field;
    delete props.fallbackField;
    if (node.component === 'StatusBadge' && props.status !== undefined) props.label = formatReadOnlyValue(props.status, 'string', true);
    if (source.collectionControl) props['data-oods-control'] = source.collectionControl;
    if (source.collectionControl === 'open') {
      props.className = [props.className, 'oods-collection-row'].filter(Boolean).join(' '); props['data-oods-action'] = 'handleRowClick';
      // s222-m03 (#2502 ruling 16): the row is named by the record's title, as in React and Vue.
      const name = rowLabelField ? display(rowLabelField, row) : undefined;
      props['aria-label'] = name ? String(name) : String(raw(authored.field, row) ?? '');
    }
    if (source.collectionControl === 'sort') props['data-oods-sort-field'] = authored.field;
    if (source.collectionControl === 'filter') props['data-oods-filter-field'] = authored.field;
    if (source.collectionControl === 'sort') props.value = 'asc';
    if (source.collectionControl === 'page' && row.collectionQuery && typeof row.collectionQuery === 'object') {
      const query = row.collectionQuery as Record<string, unknown>;
      Object.assign(props, { page: query.page, pageSize: query.pageSize, totalItems: query.total });
    }
    if (source.collection) {
      const values = row[source.collection.source];
      const records = Array.isArray(values) ? values : [];
      props['data-oods-collection'] = source.collection.source;
      const template = (source.children ?? []).filter(child => child.collectionControl !== 'empty');
      const outerLabelField = rowLabelField;
      rowLabelField = source.collection.source === 'rows' ? source.collection.labelField : undefined;
      // s222-m03 (#2502 ruling 13): the records are the list React and Vue write (an ordered list of items), so the list's
      // container, dividers and timeline rail are the same in every renderer.
      node.children = [{ id: `${node.id}-list`, component: 'Stack', props: { 'data-oods-collection-list': source.collection.source, ...(records.length ? {} : { hidden: true }) }, children: records.map((record, index): UiElement => ({ id: `${node.id}-row-${index + 1}`, component: 'Stack', props: { 'data-oods-row': JSON.stringify(record) }, children: template.flatMap(child => walk(child, { ...row, ...record, collectionEvent: record }, `${suffix}-row-${index + 1}`)) })) }];
      rowLabelField = outerLabelField;
      node.children.push({ id: `${node.id}-empty-container`, component: 'Stack', props: { 'data-oods-empty': true, ...(records.length ? { hidden: true } : {}) }, children: (source.children ?? []).filter(child => child.collectionControl === 'empty').flatMap(child => walk({ ...child, state: undefined }, row, suffix)) });
      delete node.collection;
    } else if (source.collectionControl === 'archive') {
      const items = Array.isArray(authored.items) ? authored.items as Array<{ id: string; label: string }> : [];
      node.children = items.map((item, index): UiElement => ({ id: `${node.id}-archive-${index}`, component: 'Stack', children: (source.children ?? []).flatMap(child => walk(child, { ...row, rows: item.id === 'archived' ? row.archivedRows ?? [] : row.rows ?? [] }, `${suffix}-archive-${index}`)) }));
    } else if (source.collectionControl === 'event' && row.collectionEvent && typeof row.collectionEvent === 'object') {
      const event = row.collectionEvent as Record<string, unknown>;
      const payment = source.children?.find(child => child.collectionControl === 'payment-event');
      node.children = event.kind === 'payment' && payment ? [{ ...payment, id: `${node.id}-payment`, props: { ...payment.props, event } }] : [
        { id: `${node.id}-title`, component: 'Text', props: { as: 'strong', text: event.title } },
        { id: `${node.id}-time`, component: 'RelativeTimestamp', props: { datetime: event.at } },
        { id: `${node.id}-description`, component: 'Text', props: { text: event.description } },
      ];
    } else node.children = source.children?.flatMap(child => walk(child, row, suffix));
    return [node];
  };
  return { ...schema, screens: schema.screens.flatMap(screen => walk(screen, model)) as UiSchema['screens'] };
}

/** The one body pipeline used by code.generate and repl documents. */
export function renderRecordBody(schema: UiSchema, options: CodegenOptions): string {
  const expanded = executeCompositionDirectives(schema);
  const prepared = withHtmlActions(runPreEmit(expanded, { options }).schema, options.objectName ?? compositionObject(expanded));
  const hasStates = collectUiStateBranches(schema.screens).length > 0;
  const states = hasStates ? ['success', 'loading', 'error', 'empty'] : ['success'];
  const contexts = schema.workflow?.screens ?? [{ id: schema.screens[0]!.id, context: '', route: '' }];
  const views: string[] = [];
  for (const context of contexts) {
    const single = schema.workflow ? { ...prepared, screens: prepared.screens.filter(screen => screen.id === context.id) as UiSchema['screens'] } : prepared;
    if (schema.workflow) single.screens = single.screens.map(screen => ({ ...screen, meta: { ...screen.meta, label: screenTitle(schema.workflow!.object, context.context) } })) as UiSchema['screens'];
    const base = schema.workflow ? seedPreviewModel({ schema: single, context: context.context, object: schema.workflow.object, workflowSchema: schema }) : options.sampleModel ?? deriveConsumerModel(schema);
    for (const state of states) {
      const archivedRows = (options.sampleRecords ?? []).filter(record => record.is_archived).map(record => Object.fromEntries(Object.entries(record).map(([key, value]) => [snakeToCamel(key), value])));
      const model = { ...base, archivedRows, uiState: state, ...(state === 'empty' ? { rows: [], events: [], archivedRows: [] } : {}) };
      const bound = bindRecordSchema(single, model);
      if (hasStates) {
        const suffix = (node: UiElement): void => { node.id += `-${state}`; node.children?.forEach(suffix); };
        bound.screens.forEach(suffix);
      }
      const normalized = normalizeSchemaForFramework(bound, 'html');
      const shell = screenShell(normalized, options);
      const content = `${shell?.heading ? `<h1>${escapeHtml(shell.heading)}</h1>` : ''}${renderTree(normalized)}${state === 'success' ? referenceInspection(single, 'html', model) : ''}`;
      views.push(hasStates ? `<section data-oods-view-screen="${escapeHtml(context.id)}" data-oods-view-state="${state}"${state === 'success' && context === contexts[0] ? '' : ' hidden'}>${content}</section>` : content);
    }
  }
  const select = (attribute: string, label: string, entries: Array<{ value: string; label: string }>) => `<label class="oods-field">${label}<select class="oods-field-control" ${attribute}>${entries.map(entry => `<option value="${escapeHtml(entry.value)}">${escapeHtml(entry.label)}</option>`).join('')}</select></label>`;
  const controls = `${schema.workflow ? select('data-oods-sample-screen', 'Sample screen', contexts.map(entry => ({ value: entry.id, label: fieldLabel(entry.context) }))) : ''}${hasStates ? select('data-oods-sample-state', 'Sample state', states.map(value => ({ value, label: fieldLabel(value) }))) : ''}`;
  return `<div data-oods-html-page><p class="sample-notice">Sample data · Connect actions to your application.</p>${controls ? `<div class="oods-action-bar">${controls}</div>` : ''}${views.join('')}<p role="status" data-oods-action-notice></p></div>${HTML_INTERACTIONS}`;
}
