<script lang="ts">
import { defineComponent, h, useId } from 'vue';
import { TagInput as Contract } from '@oods/components-vue';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

// Reuse the shipped Vue prop defaults and event vocabulary; the rendered parts belong to the team.
export default defineComponent({
  name: 'OodsTagInputAdapter',
  inheritAttrs: false,
  props: Contract.props,
  emits: Array.isArray(Contract.emits) ? Contract.emits : Object.keys(Contract.emits ?? {}),
  setup(props: any, { attrs, slots, emit }: any) {
    const id = `oods-tag-${useId()}`;
    return () => { const title = [props.title, props.label, props.heading, props.name].find(value => typeof value === 'string' && value.trim()) ?? 'Tag Input'; const subtitle = [props.description, props.subtitle, props.hint].find(value => typeof value === 'string' && value.trim());
      return h('fieldset', { ...attrs, 'data-oods-component': undefined, class: ['grid gap-2', attrs.class], 'data-oods-adapter': 'TagInput' }, [h('legend', title), subtitle ? h('p', subtitle) : null,
        ...(slots.default?.() ?? [h('label', { for: id }, 'Tag'), h(Input, { id, name: 'tag', modelValue: props.modelValue ?? props.value, placeholder: props.placeholder,
          'onUpdate:modelValue': (value: string | number) => { emit('update:modelValue', String(value)); emit('input', String(value)); }, onChange: (event: Event) => emit('change', (event.target as HTMLInputElement).value),
        }), h('div', { class: 'flex flex-wrap gap-2', 'data-tag-list': 'true' }, (props.tags ?? []).map((tag: any) => h(Badge, { variant: 'secondary', 'data-tag-item': 'true' }, { default: () => typeof tag === 'object' ? tag.label ?? tag.name ?? tag.role ?? tag.value ?? tag.id ?? '' : String(tag) }))) ]),
      ]); };

  },
});
</script>
