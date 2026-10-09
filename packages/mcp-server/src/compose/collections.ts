import type { FieldSchemaEntry, UiElement, UiSchema } from '../schemas/generated.js';
import { fieldLabel } from './label-generator.js';
import { enumOptionLabel } from './internal-fields.js';
import { recordNameField, recordSummaryField } from './record-label.js';

const walk = (nodes: UiElement[]): UiElement[] => nodes.flatMap(node => [node, ...walk(node.children ?? [])]);
const shortName = (name: string) => name.replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase());

/** Row recipes whose visible text is always a record value. */
const ROW_VALUE_COMPONENTS = new Set(['Text', 'LabelCell', 'StatusBadge', 'RelativeTimestamp', 'TagPills', 'PriceBadge', 'BillingSummaryBadge', 'ArchivePill', 'CancellationBadge', 'ArchivedRowOverlay', 'OwnerBadge', 'InlineLabel', 'ColorizedBadge']);
/** Summary badges print one of these props as their text; without one bound to a value-bearing field they print their own name. */
const ROW_TEXT_PROPS: Record<string, readonly string[]> = {
  AddressSummaryBadge: ['label', 'text', 'role', 'value'],
  MessageStatusBadge: ['label', 'text', 'status', 'delivery', 'value'],
  PreferenceSummaryBadge: ['label', 'text', 'namespace', 'value'],
  ClassificationBadge: ['label', 'text', 'category', 'value'],
  GeoResolutionBadge: ['resolution'],
  RoleBadgeList: ['roles', 'badges', 'roleLabels', 'value'],
};
const scalarType = (type: string) => /^(?:string|uuid|email|url|integer|number|boolean|date|datetime)\??$/.test(type);
const valueBearingField = (entry: FieldSchemaEntry | undefined): boolean => {
  if (!entry) return false;
  if (scalarType(entry.type)) return Boolean(entry.required || entry.examples?.length || entry.default !== undefined || entry.enum?.length);
  return Boolean(entry.examples?.length || (Array.isArray(entry.default) && entry.default.length));
};
/**
 * List rows show record values. A summary recipe that would print its own label (a literal
 * label, or no text prop bound to a field that carries a value) is a field-name chip and stays
 * off the row (Sprint 198 craft carry, `#2046`).
 */
export function rowShowsRecordValue(node: UiElement, fields: Record<string, FieldSchemaEntry>): boolean {
  if (ROW_VALUE_COMPONENTS.has(node.component)) return true;
  // s205-m02: an items slot no trait fills is placed as a bare Table, which renders "No rows available." inside every
  // row (the Stage1 objects carry no view extension for it). A table with no columns and no rows shows nothing.
  if (node.component === 'Table' && !node.children?.length && !Object.keys(node.props ?? {}).length) return false;
  const textProps = ROW_TEXT_PROPS[node.component];
  if (!textProps) return true;
  const props = node.props ?? {};
  if (typeof props.label === 'string' && !fields[props.label]) return false;
  return Object.entries(props).some(([key, value]) => {
    const prop = key === 'field' ? textProps[2] ?? textProps[0]! : key.endsWith('Field') ? key.slice(0, -'Field'.length) : key;
    return textProps.includes(prop) && typeof value === 'string' && valueBearingField(fields[value]);
  });
}

/** Standalone lists expose the same public state operand as workflow screens. */
export function populateListStates(schema: UiSchema): void {
  for (const screen of schema.screens) {
    // The rows collection's own empty banner carries the empty state; it does not mean the screen already owns its branches.
    if (!walk([screen]).some(node => node.collection?.source === 'rows') || walk([screen]).some(node => node.state && node.collectionControl !== 'empty')) continue;
    // The rows collection prints its own empty banner inside the list, so the screen carries no second one.
    screen.children = [
      ...(['loading', 'error'] as const).map(state => ({
        id: `${screen.id}-${state}`, component: 'Banner', state,
        props: {
          title: state === 'loading' ? 'Loading' : 'Unable to load records',
          message: state === 'error' ? 'Try again or choose another record.' : 'Loading your records.',
        },
      })),
      { id: `${screen.id}-success`, component: 'Stack', state: 'success', layout: screen.layout, children: screen.children },
    ];
  }
}

/** Collection data belongs to the screen; objectSchema still describes one record. */
export function populateCollections(schema: UiSchema, context: string, objectName: string, searchPlaceholder?: string, listColumns?: Array<{ field: string; label?: string }>, semantics?: Record<string, { ui_hints?: Record<string, unknown> }>): void {
  if (!schema.objectSchema || !['list', 'timeline', 'inline'].includes(context)) return;
  const fields = schema.objectSchema;
  const keyField = Object.keys(fields).find(name => name === 'id')
    ?? Object.keys(fields).find(name => name === `${objectName.toLowerCase()}_id`)
    ?? Object.keys(fields).find(name => name.endsWith('_id'))
    ?? Object.keys(fields)[0]!;
  // s206-m01: a row names the record with the field its object declares (recordNameField), not a trait's generic label.
  const labelField = recordNameField(objectName, fields) ?? keyField;
  // s210-m01: the record's one-line summary (the field marked text.summary) reads under its name on every row.
  const summaryField = recordSummaryField(objectName, fields);
  for (const screen of schema.screens) {
    const nodes = walk([screen]);
    if (context === 'inline') {
      const items = nodes.find(node => node.id.startsWith('list-items-'));
      if (!items) continue;
      const content = walk(items.children ?? []).filter(node => node.component !== 'Stack');
      // An inline projection names one record. Trait status/price facts can accompany it, but a
      // trait's generic label must not displace the object's authored name.
      items.children = [
        { id: `${items.id}-title`, component: 'InlineLabel', props: { field: labelField } },
        ...content.filter(node => rowShowsRecordValue(node, fields)
          && !['InlineLabel', 'LabelCell', 'Input', 'Select', 'Textarea', 'Button'].includes(node.component)
          && node.props?.field !== labelField),
      ];
      for (const node of items.children) if (['StatusBadge', 'RelativeTimestamp'].includes(node.component) && node.props) delete node.props.label;
    } else if (context === 'list') {
      const items = nodes.find(node => node.id.startsWith('list-items-'));
      const toolbar = nodes.find(node => node.id.startsWith('list-toolbar-'));
      if (!items || !toolbar) continue;
      const rowContent = (nodes: UiElement[]): UiElement[] => nodes.flatMap(node => node.component === 'Stack' ? rowContent(node.children ?? []) : [node]);
      const toolbarRecipes = rowContent(toolbar.children ?? []).flatMap(node => node.meta?.intent === 'slot:search' ? rowContent(node.children ?? []) : [node]).filter(node => !['SearchInput', 'PaginationBar'].includes(node.component) && node.meta?.intent !== 'slot:filters' && !['Input', 'Select', 'Button'].includes(node.component));
      const sortIndicator = nodes.find(node => node.component === 'SortIndicator');
      const rowNodes = [...rowContent(items.children ?? []), ...toolbarRecipes].filter(node => node !== sortIndicator);
      const overlay = rowNodes.find(node => node.component === 'ArchivedRowOverlay');
      const billing = nodes.find(node => node.component === 'BillingSummaryBadge');
      const content: UiElement[] = [
        ...(rowNodes.some(node => node.component === 'LabelCell' && node.props?.field === labelField) ? []
          : summaryField && summaryField !== labelField
            ? [{ id: `${items.id}-title-group`, component: 'Stack', children: [{ id: `${items.id}-title`, component: 'Text', props: { field: labelField } }, { id: `${items.id}-summary`, component: 'Text', props: { field: summaryField, size: 'sm' } }] }]
            : [{ id: `${items.id}-title`, component: 'Text', props: { field: labelField } }]),
        // `label` is content/Labelled's display projection of the record's title, so a row that already
        // shows the title field itself prints the same words twice — "Anika Bhatt Anika Bhatt" on the
        // Person list, and the same on Sprint, Session and five of the research objects. Where `label`
        // IS the title (an object with no name or title of its own, such as Organization or Cluster)
        // it is the one that stays: this drops the projection, never the record's own field.
        ...rowNodes.filter(node => node !== overlay && rowShowsRecordValue(node, fields)
          && !(labelField !== 'label' && node.props?.field === 'label')),
        ...(billing && !rowNodes.includes(billing) ? [billing] : []),
      ];
      if (listColumns?.length) {
        const columns = listColumns.filter(column => fields[column.field]);
        if (columns.length) content.splice(0, content.length, ...columns.map((column, index): UiElement => ({
          id: `${items.id}-column-${index}`, component: 'Stack', children: [
            { id: `${items.id}-column-${index}-label`, component: 'Text', props: { text: column.label ?? semantics?.[column.field]?.ui_hints?.label ?? fieldLabel(column.field), size: 'sm' } },
            fields[column.field]?.money?.currencyField ? { id: `${items.id}-column-${index}-value`, component: fields[column.field].money?.minorUnits ? 'BillingSummaryBadge' : 'PriceBadge', props: { amountField: column.field, currencyField: fields[column.field].money?.currencyField, ...(fields[column.field].money?.minorUnits ? { minorUnits: fields[column.field].money?.minorUnits, showInterval: false } : {}) } } : { id: `${items.id}-column-${index}-value`, component: 'Text', props: { field: column.field } },
          ],
        })));
      }
      for (const node of content) {
        if (['RelativeTimestamp', 'StatusBadge'].includes(node.component) && node.props) delete node.props.label;
        if (node.component === 'StatusBadge' && typeof node.props?.field === 'string') { node.props.statusField = node.props.field; delete node.props.field; }
      }
      // s222-m03 (#2502 ruling 13): a row shows the record's status. An object whose status no trait's row recipe shows (an
      // invoice's, a plan's, a usage meter's) gets the badge for the status field it declares, beside its title.
      if (fields.status?.enum?.length && !content.some(node => node.props?.statusField === 'status' || node.props?.field === 'status')) {
        content.splice(1, 0, { id: `${items.id}-status`, component: 'StatusBadge', props: { statusField: 'status', tone: 'lifecycle' } });
      }
      const row: UiElement = { id: `${items.id}-row`, component: 'Button', collectionControl: 'open', props: { field: keyField }, layout: { type: 'inline', gapToken: 'cluster-default' }, children: content };
      if (overlay) { overlay.children = [row]; overlay.props = { ...overlay.props, labelField }; }
      items.collection = { source: 'rows', keyField, labelField };
      // The collection's own banner is the screen's empty branch: it renders inside the list, under the toolbar, when the store has no rows.
      items.children = [overlay ?? row, { id: `${items.id}-empty`, component: 'Banner', state: 'empty', props: { message: 'No records found.' }, collectionControl: 'empty' }];
      const searchSlot = toolbar.children?.find(node => node.meta?.intent === 'slot:search');
      const search = (searchSlot ? walk([searchSlot]).find(node => node.component === 'SearchInput') : undefined)
        ?? { id: `${toolbar.id}-search`, component: 'SearchInput' };
      const filter = toolbar.children?.find(node => node.meta?.intent === 'slot:filters');
      const enums = Object.keys(fields).filter(name => new Set(fields[name]!.examples?.length ? fields[name]!.examples!.slice(0, 10) : fields[name]!.enum?.slice(0, 10)).size > 1 && fields[name]!.enum?.length);
      // Classifiable may project a domain enum into primary_category_id. Keep the
      // domain field as the filter when it declares the same vocabulary.
      const classification = enums.find(name => name !== 'primary_category_id' && fields.primary_category_id?.enum?.length && JSON.stringify(fields[name]!.enum) === JSON.stringify(fields.primary_category_id.enum))
        ?? (enums.includes('primary_category_id') ? 'primary_category_id' : undefined);
      const filterField = classification ?? (enums.includes('status') ? 'status' : enums[0]);
      // s211-m02: the placeholder an object declares on its Searchable trait ("Search signals") is the one it shows.
      if (search) { search.bindings = undefined; search.collectionControl = 'search'; search.props = { label: 'Search', placeholder: searchPlaceholder?.trim() || 'Search records', clearable: true }; }
      if (filter && filterField) {
        filter.component = 'Select'; filter.children = undefined; filter.bindings = undefined; filter.collectionControl = 'filter';
        filter.props = { ...(filterField !== 'status' ? { field: filterField } : {}), label: shortName(filterField), options: [{ value: '', label: /(?:^|_)(?:status|state)$/.test(filterField) ? 'All states' : 'All' }, ...(fields[filterField]!.enum ?? []).map(value => ({ value: String(value), label: enumOptionLabel(String(value)) }))] };
      }
      if (sortIndicator) {
        sortIndicator.bindings = { ...sortIndicator.bindings, onChange: 'handleSortChange' };
        if (screen.bindings) delete screen.bindings.onSort;
      }
      const numericLabel = /^(integer|number)\??$/.test(fields[labelField]?.type ?? '');
      toolbar.children = [
        ...(search ? [search] : []), ...(filter && filterField ? [filter] : []), ...(sortIndicator ? [sortIndicator] : []),
        ...(sortIndicator ? [] : [{ id: `${toolbar.id}-sort`, component: 'Select', collectionControl: 'sort' as const, props: { field: labelField, label: 'Sort', options: [{ value: 'asc', label: numericLabel ? 'Number ascending' : 'Name A–Z' }, { value: 'desc', label: numericLabel ? 'Number descending' : 'Name Z–A' }] } }]),
      ];
      if (overlay?.props?.separateTab) screen.children!.splice(screen.children!.indexOf(items), 1, {
        id: `${items.id}-archive-tabs`, component: 'Tabs', collectionControl: 'archive',
        children: [items],
        props: { ariaLabel: 'Archive views', items: [{ id: 'active', label: 'Active', panel: '' }, { id: 'archived', label: String(overlay.props.tabLabel ?? 'Archived'), panel: '' }] },
      });
      const paginationSlot = nodes.find(node => node.meta?.intent === 'slot:pagination');
      const pagination = paginationSlot ? walk([paginationSlot]).find(node => node.component === 'PaginationBar') ?? paginationSlot : undefined;
      if (pagination) { pagination.component = 'PaginationBar'; pagination.children = undefined; pagination.bindings = undefined; pagination.collectionControl = 'page'; pagination.props = { showItemRange: true }; }
      screen.bindings = { ...screen.bindings, onPageChange: 'handlePageChange' };
    } else {
      const header = nodes.find(node => node.id.startsWith('timeline-header-'));
      const entries = nodes.find(node => node.id.startsWith('timeline-entries-'));
      if (!header || !entries) continue;
      const payment = nodes.find(node => node.component === 'PaymentEventTimeline');
      const label = nodes.find(node => node.component === 'TimelineEntryLabel');
      const traitEvents = nodes.filter(node => ['ArchiveEvent', 'CancellationEvent', 'StateTransitionEvent'].includes(node.component));
      // Preserve the declared identity recipe once, outside the repeated event rows.
      if (label) { label.props = { ...label.props, field: labelField }; delete label.props.label; }
      header.children = [label ?? { id: `${header.id}-title`, component: 'Text', props: { field: labelField } }];
      // The record's amount beside its title, in the units its semantics declare (s213-m03, finding 7).
      const money = fields.amount?.money;
      if (money?.currencyField) header.children.push(money.minorUnits
        ? { id: `${header.id}-billing`, component: 'BillingSummaryBadge', props: { amountField: 'amount', currencyField: money.currencyField, intervalField: 'billing_interval', minorUnits: money.minorUnits } }
        : { id: `${header.id}-billing`, component: 'PriceBadge', props: { amountField: 'amount', currencyField: money.currencyField } });
      entries.collection = { source: 'events', keyField: 'id', labelField: 'title', historyField: fields.state_history ? 'state_history' : undefined };
      if (payment) payment.collectionControl = 'payment-event';
      entries.children = [
        { id: `${entries.id}-entry`, component: 'Card', collectionControl: 'event', children: [...(payment ? [payment] : [])] },
        { id: `${entries.id}-empty`, component: 'Banner', props: { message: 'No events yet.' }, collectionControl: 'empty' },
      ];
      // These recipes read the selected object's fields/history, not one generic
      // collection event. Preserve them once outside the repeated collection.
      if (traitEvents.length) screen.children!.push({ id: `${entries.id}-trait-events`, component: 'Stack', children: traitEvents });
    }
  }
}
