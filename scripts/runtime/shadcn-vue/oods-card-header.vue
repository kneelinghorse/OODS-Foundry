<script lang="ts">
import { defineComponent, h, Fragment, Text } from 'vue';
import { CardHeader as Contract } from '@oods/components-vue';
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// Reuse the shipped Vue prop defaults and event vocabulary; the rendered parts belong to the team.
export default defineComponent({
  name: 'OodsCardHeaderAdapter',
  inheritAttrs: false,
  props: Contract.props,
  emits: Array.isArray(Contract.emits) ? Contract.emits : Object.keys(Contract.emits ?? {}),
  setup(props: any, { attrs, slots }: any) {
    const first = (...values: any[]) => values.find(value => typeof value === 'string' && value.trim());
    const flatten = (nodes: any[]): any[] => nodes.flatMap(node => node.type === Fragment ? flatten(node.children ?? []) : [node]);
    return () => {
      const content = flatten(slots.default?.() ?? []);
      const scalar = content.every(node => node.type === Text) ? content.map(node => node.children).join('') : undefined;
      const title = first(scalar, props.title, props.label, props.text) ?? 'Card';
      const details = first(props.supporting, props.supportingText, props.subtitle, props.description);
      const heading = /^h[1-6]$/.test(props.as ?? '') ? props.as : `h${Number.isFinite(props.level) ? Math.max(1, Math.min(6, Math.trunc(props.level))) : 2}`;
      return h('header', { ...attrs, 'data-oods-component': undefined, 'data-oods-adapter': 'CardHeader' }, [h(CardHeader, {}, { default: () => content.length && scalar === undefined ? content : [
        h(CardTitle, {}, { default: () => h(heading, title) }), details && details.trim() !== title.trim() ? h(CardDescription, {}, { default: () => details }) : null,
      ] })]);
    };
  },
});
</script>
