<script lang="ts">
import { defineComponent, h } from 'vue';
import { Banner as Contract } from '@oods/components-vue';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getStatusPresentation } from '@oods/component-contracts';

// Reuse the shipped Vue prop defaults and event vocabulary; the rendered parts belong to the team.
export default defineComponent({
  name: 'OodsBannerAdapter',
  inheritAttrs: false,
  props: Contract.props,
  emits: Array.isArray(Contract.emits) ? Contract.emits : Object.keys(Contract.emits ?? {}),
  setup(props: any, { attrs, slots, emit }: any) {
    return () => { const presentation = getStatusPresentation(props.domain, props.status ?? 'unknown'); const tone = props.tone ?? presentation.tone; const danger = tone === 'critical' || tone === 'danger';
      return h(Alert, { ...attrs, 'data-oods-component': undefined, variant: danger ? 'destructive' : 'default', role: danger ? 'alert' : 'status', 'aria-live': danger ? 'assertive' : 'polite',
        class: [danger ? 'bg-destructive text-background dark:bg-destructive [&_*]:text-inherit' : '', attrs.class], 'data-oods-adapter': 'Banner', 'data-tone': tone,
      }, { default: () => [props.title || props.status || slots.title ? h(AlertTitle, {}, { default: () => slots.title?.() ?? (props.title || presentation.label) }) : null,
        h(AlertDescription, {}, { default: () => [props.detail ? h('p', props.detail) : null, slots.default?.() ?? props.content, slots.actions?.()] }),
        props.dismissLabel ? h(Button, { type: 'button', variant: 'ghost', 'aria-label': props.dismissLabel, onClick: () => emit('dismiss') }, { default: () => '×' }) : null,
      ] }); };

  },
});
</script>
