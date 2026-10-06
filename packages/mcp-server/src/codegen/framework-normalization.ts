import type { UiElement, UiSchema } from '../schemas/generated.js';

type FrameworkTarget = 'react' | 'vue' | 'html';

const FIELD_COMPONENTS = new Set([
  'Checkbox',
  'DatePicker',
  'Input',
  'Select',
  // s223-m02: a Switch, a SegmentedControl and a Combobox require their label as Checkbox and Select do.
  'Switch',
  'SegmentedControl',
  'Combobox',
  'Textarea',
]);

const SCALAR_TAB_CHILD_PROPS = new Set([
  'active',
  'body',
  'children',
  'content',
  'disabled',
  'isDisabled',
  'label',
  'panel',
  'text',
  'title',
  'value',
]);

function humanize(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeTableRows(nodeId: string, rows: unknown): unknown {
  if (!Array.isArray(rows)) return rows;

  return rows.map((row, index) => {
    const fallbackId = `${nodeId}-row-${index + 1}`;
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      const record = row as Record<string, unknown>;
      const id = typeof record.id === 'string' && record.id.length > 0
        ? record.id
        : fallbackId;
      return { ...record, id };
    }
    return { id: fallbackId, value: row };
  });
}

function normalizeTabItem(nodeId: string, item: unknown, index: number): Record<string, unknown> {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return {
      id: `${nodeId}-tab-${index + 1}`,
      label: String(item ?? `Tab ${index + 1}`),
      panel: String(item ?? ''),
    };
  }

  const source = item as Record<string, unknown>;
  const id = typeof source.id === 'string' && source.id.length > 0
    ? source.id
    : `${nodeId}-tab-${index + 1}`;
  const label = source.label ?? humanize(id);
  const panel = source.panel ?? source.content ?? '';
  const normalized: Record<string, unknown> = { ...source, id, label, panel };
  delete normalized.content;
  delete normalized.active;
  return normalized;
}

function tabItemFromChild(nodeId: string, child: UiElement, index: number): Record<string, unknown> {
  const childProps = child.props && typeof child.props === 'object'
    ? child.props as Record<string, unknown>
    : {};
  const label = child.meta?.label
    ?? childProps.label
    ?? childProps.title
    ?? humanize(child.id || `${nodeId}-tab-${index + 1}`);
  const panel = childProps.panel
    ?? childProps.content
    ?? childProps.children
    ?? childProps.text
    ?? childProps.value
    ?? childProps.body
    ?? label;

  return {
    id: child.id || `${nodeId}-tab-${index + 1}`,
    label,
    panel,
    ...(childProps.disabled === true || childProps.isDisabled === true
      ? { disabled: true }
      : {}),
    ...(childProps.active === true ? { active: true } : {}),
  };
}

function tabPanelFromChild(child: UiElement): UiElement {
  const props = child.props && typeof child.props === 'object'
    ? { ...(child.props as Record<string, unknown>) }
    : undefined;

  if (props) {
    const labelComesFromProps = child.meta?.label === undefined && props.label !== undefined;
    const titleComesFromProps = child.meta?.label === undefined
      && props.label === undefined
      && props.title !== undefined;
    if (labelComesFromProps) delete props.label;
    if (titleComesFromProps) delete props.title;
    delete props.active;
    delete props.disabled;
    delete props.isDisabled;
  }

  return {
    ...child,
    ...(props && Object.keys(props).length > 0 ? { props } : { props: undefined }),
  };
}

function recordHasKeys(value: unknown, except: ReadonlySet<string> = new Set()): boolean {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.keys(value as Record<string, unknown>).some((key) => !except.has(key)),
  );
}

function tabChildNeedsPanelTree(child: UiElement): boolean {
  const props = child.props && typeof child.props === 'object'
    ? child.props as Record<string, unknown>
    : {};
  return Boolean(
    child.state !== undefined
    || child.children?.length
    || child.route !== undefined
    || recordHasKeys(child.layout)
    || recordHasKeys(child.style)
    || recordHasKeys(child.meta, new Set(['label']))
    || Object.keys(props).some((key) => !SCALAR_TAB_CHILD_PROPS.has(key))
    || recordHasKeys(child.bindings)
  );
}

function normalizeNode(node: UiElement, framework: FrameworkTarget): UiElement {
  let children = node.children?.map((child) => normalizeNode(child, framework));
  const props: Record<string, unknown> = node.props && typeof node.props === 'object'
    ? { ...(node.props as Record<string, unknown>) }
    : {};

  if (props.readOnly === undefined && props.readonly !== undefined) {
    props.readOnly = props.readonly;
  }
  delete props.readonly;

  if (
    (framework === 'html' || node.component !== 'Tabs')
    && props['aria-label'] === undefined
    && props.ariaLabel !== undefined
  ) {
    props['aria-label'] = props.ariaLabel;
    delete props.ariaLabel;
  }

  if (node.component === 'Badge' || node.component === 'Button') {
    if (props.content === undefined && props.label !== undefined) props.content = props.label;
    delete props.label;
  }

  if (node.component === 'Banner') {
    if (props.content === undefined && props.message !== undefined) props.content = props.message;
    delete props.message;
  }

  if (node.component === 'Text') {
    if (props.content === undefined) props.content = props.text ?? props.value;
    delete props.text;
    delete props.value;
  }

  if (node.component === 'Card' && props.body !== undefined) {
    if ((!children || children.length === 0) && props.children === undefined) {
      props.children = props.body;
    }
    delete props.body;
  }

  if (FIELD_COMPONENTS.has(node.component) && props.label === undefined) {
    const labelSource = node.meta?.label
      ?? (typeof props.name === 'string' ? props.name : undefined)
      ?? (typeof props.field === 'string' ? props.field : undefined)
      ?? node.id;
    props.label = humanize(labelSource);
  }

  if (node.component === 'Table' && props.rows !== undefined) {
    props.rows = normalizeTableRows(node.id, props.rows);
  }

  if (node.component === 'Tabs') {
    const legacyItems = Array.isArray(props.tabs) ? props.tabs : undefined;
    const suppliedItems = Array.isArray(props.items) ? props.items : legacyItems;
    const childItems = children?.map((child, index) => tabItemFromChild(node.id, child, index));
    const sourceItems = suppliedItems ?? childItems;
    const preservePanelTrees = !suppliedItems
      && Boolean(children?.some(tabChildNeedsPanelTree));

    if (sourceItems) {
      const activeIndex = sourceItems.findIndex((item) => (
        !!item && typeof item === 'object' && !Array.isArray(item)
        && (item as Record<string, unknown>).active === true
      ));
      const items = sourceItems.map((item, index) => {
        const normalized = normalizeTabItem(node.id, item, index);
        if (preservePanelTrees) normalized.panel = '';
        return normalized;
      });
      props.items = items;

      if (props.defaultSelectedId === undefined) {
        const activeId = activeIndex >= 0 ? items[activeIndex]?.id : undefined;
        const directActiveId = typeof props.active === 'string' ? props.active : undefined;
        const legacyActiveId = typeof props.activeTab === 'string' ? props.activeTab : undefined;
        props.defaultSelectedId = directActiveId
          ?? legacyActiveId
          ?? (typeof activeId === 'string' ? activeId : undefined);
      }
    }

    delete props.tabs;
    delete props.active;
    delete props.activeTab;
    children = node.collectionControl === 'archive' ? children : preservePanelTrees
      ? children?.map(tabPanelFromChild)
      : undefined;
  }

  // Keep the target parameter explicit so contract checks and emitters operate
  // on the same normalized shape for every public generation target.
  void framework;

  return {
    ...node,
    ...(Object.keys(props).length > 0 ? { props } : { props: undefined }),
    ...(children && children.length > 0 ? { children } : { children: undefined }),
  };
}

export function normalizeSchemaForFramework(
  schema: UiSchema,
  framework: FrameworkTarget,
): UiSchema {
  return {
    ...schema,
    screens: schema.screens.map((screen) => normalizeNode(screen, framework)) as UiSchema['screens'],
  };
}

export function takeEmittedId(node: UiElement, props: Record<string, unknown>): string {
  const explicit = typeof props.id === 'string' && props.id.length > 0 ? props.id : undefined;
  delete props.id;
  return explicit ?? node.id;
}
