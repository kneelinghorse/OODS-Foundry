import { defineComponent, h, type PropType } from 'vue';

import type { TableColumn, TableRecord } from './types.js';

export const TableCaption = defineComponent({
  name: 'OodsTableCaption',
  setup(_props, { slots }) {
    return () => h('caption', { class: 'oods-table__caption' }, slots.default?.());
  },
});

export const TableHead = defineComponent({
  name: 'OodsTableHead',
  setup(_props, { slots }) {
    return () => h('thead', { class: 'oods-table__header' }, slots.default?.());
  },
});

export const TableBody = defineComponent({
  name: 'OodsTableBody',
  setup(_props, { slots }) {
    return () => h('tbody', { class: 'oods-table__body' }, slots.default?.());
  },
});

export const TableRow = defineComponent({
  name: 'OodsTableRow',
  setup(_props, { slots }) {
    return () => h('tr', { class: 'oods-table__row' }, slots.default?.());
  },
});

export const TableHeaderCell = defineComponent({
  name: 'OodsTableHeaderCell',
  props: {
    scope: { type: String as PropType<'col' | 'row'>, default: 'col' },
  },
  setup(props, { slots }) {
    return () => h('th', { class: 'oods-table__header-cell', scope: props.scope }, slots.default?.());
  },
});

export const TableCell = defineComponent({
  name: 'OodsTableCell',
  setup(_props, { slots }) {
    return () => h('td', { class: 'oods-table__cell' }, slots.default?.());
  },
});

// s221-m02 (#2482 ruling 2): one markup with React: the table sits in its container, carries the consumer's attributes
// itself, and names its parts; a caption renders only with content.
export const Table = defineComponent({
  name: 'OodsTable',
  inheritAttrs: false,
  props: {
    caption: { type: String, default: '' },
    // s222-m02 (#2502 ruling 11): false keeps the caption as the table's accessible name but hides it visually.
    showCaption: { type: Boolean, default: true },
    columns: { type: Array as PropType<readonly TableColumn[]>, default: () => [] },
    rows: { type: Array as PropType<readonly TableRecord[]>, default: () => [] },
    density: { type: String as PropType<'default' | 'compact'>, default: 'default' },
    selectable: Boolean,
  },
  emits: {
    rowActivate: (_rowId: string) => true,
  },
  setup(props, { attrs, emit, slots }) {
    const activate = (row: TableRecord) => emit('rowActivate', row.id);
    return () => h('div', { class: 'oods-table__container', 'data-density': props.density }, [h('table', {
      ...attrs,
      class: ['oods-table', attrs.class],
      'data-oods-component': 'Table',
      'data-density': props.density,
    }, [
      slots.caption || props.caption ? h(TableCaption, { 'data-visually-hidden': props.showCaption ? undefined : 'true' }, {
        default: () => slots.caption?.() ?? props.caption,
      }) : null,
      h(TableHead, {}, {
        default: () => slots.head?.() ?? h(TableRow, {}, {
          default: () => props.columns.map((column) => h(TableHeaderCell, { key: column.key }, {
            default: () => slots.headerCell?.({ column }) ?? column.label,
          })),
        }),
      }),
      h(TableBody, {}, {
        default: () => slots.body?.() ?? (
          props.rows.length === 0
            ? h(TableRow, {}, {
                default: () => h(TableCell, {
                  colspan: Math.max(props.columns.length, 1),
                }, {
                  default: () => 'No rows available.',
                }),
              })
            : props.rows.map((row, rowIndex) => (
                slots.row?.({ row, rowIndex, activate: () => activate(row) })
                ?? h(TableRow, { key: row.id, 'data-selectable': props.selectable ? 'true' : undefined }, {
                  default: () => props.columns.map((column, columnIndex) => {
                    const content = slots.cell?.({ row, column, value: row[column.key] })
                      ?? String(row[column.key] ?? '');
                    return h(TableCell, { key: column.key }, {
                      default: () => props.selectable && columnIndex === 0
                        ? h('button', {
                            type: 'button',
                            class: 'oods-table-row-action',
                            onClick: () => activate(row),
                          }, content)
                        : content,
                    });
                  }),
                })
              ))
        ),
      }),
    ])]);
  },
});
