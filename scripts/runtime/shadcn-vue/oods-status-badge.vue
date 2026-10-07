<script lang="ts">
import { defineComponent, h } from 'vue';
import { StatusBadge as Contract } from '@oods/components-vue';
import { Badge } from '@/components/ui/badge';
import { getStatusPresentation, resolveStatusIcon, statusIconMarkup } from '@oods/component-contracts';

// Reuse the shipped Vue prop defaults and event vocabulary; the rendered parts belong to the team.
export default defineComponent({
  name: 'OodsStatusBadgeAdapter',
  inheritAttrs: false,
  props: Contract.props,
  emits: Array.isArray(Contract.emits) ? Contract.emits : Object.keys(Contract.emits ?? {}),
  setup(props: any, { attrs, slots }: any) {
    return () => {
      const status = props.status ?? props.value ?? 'unknown';
      const presentation = getStatusPresentation(props.domain, status);
      const tone = props.tone && props.tone !== 'lifecycle' ? props.tone : presentation.tone;
      const danger = tone === 'critical' || tone === 'danger';
      const icon = resolveStatusIcon(presentation.iconName);
      return h(Badge, { ...attrs, role: attrs.role ?? 'status', 'data-oods-component': undefined, variant: danger ? 'destructive' : props.emphasis === 'solid' || props.variant === 'solid' ? 'default' : 'secondary',
        class: [danger ? 'bg-destructive text-background dark:bg-destructive' : '', attrs.class],
        'data-oods-adapter': 'StatusBadge', 'data-status': status, 'data-tone': tone, 'data-domain': props.domain,
        title: attrs.title ?? presentation.description, 'aria-label': attrs['aria-label'] ?? props.label ?? `Status: ${presentation.label}`,
      }, { default: () => [slots.icon?.() ?? (props.showIcon && icon ? h('span', { 'aria-hidden': 'true', innerHTML: statusIconMarkup(icon) }) : null), slots.default?.() ?? props.content ?? presentation.label] });
    };
  },
});
</script>
