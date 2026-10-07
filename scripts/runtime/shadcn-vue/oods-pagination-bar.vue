<script lang="ts">
import { defineComponent, h, ref, useId } from 'vue';
import { PaginationBar as Contract } from '@oods/components-vue';
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext, PaginationEllipsis } from '@/components/ui/pagination';

// Reuse the shipped Vue prop defaults and event vocabulary; the rendered parts belong to the team.
export default defineComponent({
  name: 'OodsPaginationBarAdapter',
  inheritAttrs: false,
  props: Contract.props,
  emits: Array.isArray(Contract.emits) ? Contract.emits : Object.keys(Contract.emits ?? {}),
  setup(props: any, { attrs, emit }: any) {
    const id = `oods-page-${useId()}`, goto = ref('');
    return () => {
      const size = Number.isFinite(props.pageSize) && props.pageSize > 0 ? Math.floor(props.pageSize) : 25;
      const count = Math.max(0, Math.floor(props.totalPages ?? Math.ceil(props.totalItems / size)));
      const page = count ? Math.max(1, Math.min(Math.floor(props.page), count)) : 1;
      const go = (value: number) => { const next = Math.max(1, Math.min(Math.floor(value), count)); if (!count || !Number.isFinite(next) || next === page) return; emit('update:page', next); emit('pageChange', next); emit('change', next); emit('update', next); };
      return h(Pagination, { ...attrs, 'data-oods-component': undefined, page, itemsPerPage: size, total: count * size, 'onUpdate:page': go, class: ['flex flex-wrap items-center gap-3', attrs.class], 'aria-label': attrs['aria-label'] ?? 'Pagination', 'data-oods-adapter': 'PaginationBar' }, { default: () => [
        props.showItemRange ? h('span', `${props.totalItems} ${props.totalItems === 1 ? 'record' : 'records'}`) : null,
        props.showItemRange && props.totalItems > 0 && count > 1 ? h('span', `Showing ${(page - 1) * size + 1}–${Math.min(page * size, props.totalItems)} of ${props.totalItems}`) : null,
        count > 1 ? h(PaginationContent, {}, { default: ({ items }: any) => [h(PaginationPrevious, { 'aria-label': 'Previous page' }), ...items.map((item: any, index: number) => item.type === 'page' ? h(PaginationItem, { key: index, value: item.value, isActive: item.value === page, 'aria-label': `Page ${item.value}` }, { default: () => item.value }) : h(PaginationEllipsis, { key: index })), h(PaginationNext, { 'aria-label': 'Next page' })] }) : null,
        count > 1 ? h('span', `Page ${page} of ${count}`) : null,
        props.showPageSizeSelector ? h('label', ['Items per page', h('select', { value: size, onChange: (event: Event) => emit('pageSizeChange', Number((event.target as HTMLSelectElement).value)) }, props.pageSizeOptions.map((value: number) => h('option', { value }, String(value))))]) : null,
        props.showGotoPage ? h('form', { onSubmit: (event: Event) => { event.preventDefault(); go(Number(goto.value)); } }, [h('label', { for: id }, 'Go to page'), h('input', { id, type: 'number', min: 1, max: Math.max(1, count), value: goto.value, onInput: (event: Event) => { goto.value = (event.target as HTMLInputElement).value; } }), h('button', { type: 'submit' }, 'Go')]) : null,
      ] });
    };
  },
});
</script>
