import { sharedScenarios } from '@oods/component-contracts';
import { renderToString } from '@vue/server-renderer';
import { mount } from '@vue/test-utils';
import { Fragment, createCommentVNode, createSSRApp, defineComponent, h, nextTick, ref, type Component } from 'vue';
import { describe, expect, it, vi } from 'vitest';

import { Badge, CardHeader, ColorSwatch, ColorizedBadge, DetailHeader, VizAreaPreview } from '../src/index.js';

const implementations: Readonly<Record<string, Component>> = {
  CardHeader, ColorSwatch, ColorizedBadge, DetailHeader, VizAreaPreview,
};

describe('Sprint 185 Vue component breadth', () => {
  for (const [component, fallback, label] of [[DetailHeader, 'h2', 'Details'], [CardHeader, 'h2', 'Card']] as const) {
    it(`${label} defaults to a real heading and applies as before bounded level`, async () => {
      const wrapper = mount(component);
      try {
        expect(wrapper.element.tagName).toBe('HEADER');
        expect(wrapper.get(fallback).text()).toBe(label);
        await wrapper.setProps({ level: 4, label: 'Primary title' });
        expect(wrapper.get('h4').text()).toBe('Primary title');
        await wrapper.setProps({ as: 'h1', level: 5 });
        expect(wrapper.get('h1').text()).toBe('Primary title');
        await wrapper.setProps({ as: undefined, level: 9 as never });
        expect(wrapper.get('h6').text()).toBe('Primary title');
        await wrapper.setProps({ level: 2.5 as never });
        expect(wrapper.get('h2').text()).toBe('Primary title');
        await wrapper.setProps({ level: Number.NaN as never });
        expect(wrapper.get(fallback).text()).toBe('Primary title');
      } finally { wrapper.unmount(); }
    });

    it(`${label} renders reactive scalar bound content as the heading instead of the static alias`, async () => {
      const title = ref<string | number>('Current plan');
      const wrapper = mount(defineComponent({
        setup: () => () => h(component, { label: 'Static label', as: 'h1' }, { default: () => title.value }),
      }));
      try {
        expect(wrapper.get('h1').text()).toBe('Current plan');
        title.value = 'Enterprise plan';
        await nextTick();
        expect(wrapper.get('h1').text()).toBe('Enterprise plan');
        expect(wrapper.text()).not.toContain('Static label');
        title.value = 0;
        await nextTick();
        expect(wrapper.get('h1').text()).toBe('0');
      } finally { wrapper.unmount(); }
    });

    it(`${label} preserves authored heading structure and native attributes`, () => {
      const wrapper = mount(component, {
        props: { title: 'Generated title', subtitle: 'Generated subtitle' },
        attrs: { id: 'authored-heading', class: 'consumer-header', 'aria-label': 'Authored header' },
        slots: { default: () => h(Fragment, [h('h5', 'Authored title'), h('p', 'Authored supporting text')]) },
      });
      try {
        expect(wrapper.findAll('h1,h2,h3,h4,h5,h6')).toHaveLength(1);
        expect(wrapper.get('h5').text()).toBe('Authored title');
        expect(wrapper.get('p').text()).toBe('Authored supporting text');
        expect(wrapper.text()).not.toContain('Generated');
        expect(wrapper.attributes()).toMatchObject({ id: 'authored-heading', 'aria-label': 'Authored header' });
        expect(wrapper.classes()).toContain('consumer-header');
      } finally { wrapper.unmount(); }
    });

    it(`${label} treats blank text, comments and empty fragments as absent content`, () => {
      const wrapper = mount(component, {
        slots: { default: () => [' ', createCommentVNode('v-if'), h(Fragment, [])] },
      });
      try { expect(wrapper.get(fallback).text()).toBe(label); }
      finally { wrapper.unmount(); }
    });

    it(`${label} preserves scalar separators inside the generated heading`, () => {
      const wrapper = mount(component, {
        slots: { default: () => ['Alpha', ' ', 'Beta'] },
      });
      try { expect(wrapper.get(fallback).element.textContent).toBe('Alpha Beta'); }
      finally { wrapper.unmount(); }
    });

    it.each(['text', 'fragment'] as const)(`${label} preserves authored element separators supplied as %s`, (separator) => {
      const wrapper = mount(component, {
        props: { title: 'Generated title' },
        slots: { default: () => [h('span', 'Alpha'), separator === 'text' ? ' ' : h(Fragment, [' ']), h('span', 'Beta')] },
      });
      try {
        expect(wrapper.element.textContent).toBe('Alpha Beta');
        expect(wrapper.findAll('span')).toHaveLength(2);
        expect(wrapper.find('h1,h2,h3,h4,h5,h6').exists()).toBe(false);
      } finally { wrapper.unmount(); }
    });
  }

  it('honors the measured DetailHeader aliases without leaking content props as HTML attributes', () => {
    const wrapper = mount(DetailHeader, {
      props: { title: ' ', label: 'Plan', text: 'Last title', subtitle: '', sublabel: 'Billing', description: 'Last subtitle', metadata: '', meta: 'Monthly' },
    });
    try {
      expect(wrapper.get('h2').text()).toBe('Plan');
      expect(wrapper.get('[data-oods-subtitle]').text()).toBe('Billing');
      expect(wrapper.get('[data-oods-metadata]').text()).toBe('Monthly');
      expect(wrapper.attributes('label')).toBeUndefined();
      expect(wrapper.attributes('sublabel')).toBeUndefined();
      expect(wrapper.attributes('metadata')).toBeUndefined();
    } finally { wrapper.unmount(); }
  });

  it('honors CardHeader title and supporting aliases in their declared order', async () => {
    const wrapper = mount(CardHeader, {
      props: { text: 'Card text', supporting: ' ', supportingText: 'Supporting text', subtitle: 'Subtitle', description: 'Description' },
    });
    try {
      expect(wrapper.get('h2').text()).toBe('Card text');
      expect(wrapper.get('[data-oods-supporting]').text()).toBe('Supporting text');
      await wrapper.setProps({ supportingText: undefined });
      expect(wrapper.get('[data-oods-supporting]').text()).toBe('Subtitle');
      await wrapper.setProps({ subtitle: undefined });
      expect(wrapper.get('[data-oods-supporting]').text()).toBe('Description');
    } finally { wrapper.unmount(); }
  });

  it('ColorSwatch keeps a text label alongside its decorative chip through color and label changes', async () => {
    const wrapper = mount(ColorSwatch, { props: { value: 'red' } });
    try {
      expect(wrapper.get('[data-oods-swatch-label]').text()).toBe('red');
      expect(wrapper.get('[data-oods-swatch-chip]').attributes('aria-hidden')).toBe('true');
      expect(wrapper.attributes('style')).toContain('--oods-swatch-color: red');
      await wrapper.setProps({ color: '#2563eb', label: 'Ocean blue' });
      expect(wrapper.get('[data-oods-swatch-label]').text()).toBe('Ocean blue');
      expect(wrapper.attributes('data-swatch-color')).toBe('#2563eb');
      expect(wrapper.attributes('style')).toContain('--oods-swatch-color: #2563eb');
      await wrapper.setProps({ color: undefined, value: undefined, label: undefined, state: 'default' });
      expect(wrapper.get('[data-oods-swatch-label]').text()).toBe('default');
      expect(wrapper.attributes('style') ?? '').not.toContain('--oods-swatch-color: default');
    } finally { wrapper.unmount(); }
  });

  it('ColorizedBadge composes Badge status presentation independently of its explicit variant', async () => {
    const wrapper = mount(ColorizedBadge, { props: { state: 'active', hue: 'green', tone: 'success' } });
    try {
      expect(wrapper.findComponent(Badge).exists()).toBe(true);
      expect(wrapper.attributes()).toMatchObject({
        'data-oods-component': 'ColorizedBadge', 'data-badge-status': 'active',
        'data-badge-color': 'green', 'data-badge-variant': 'colorized', 'data-tone': 'success',
      });
      expect(wrapper.get('[data-oods-badge-label]').text()).toBe('active');
      expect(wrapper.get('[data-oods-badge-marker]').attributes('aria-hidden')).toBe('true');
      expect(wrapper.find('button,a,input').exists()).toBe(false);
      await wrapper.setProps({ label: 'Approved', color: 'blue', variant: 'category', emphasis: 'solid' });
      expect(wrapper.attributes('data-badge-variant')).toBe('category');
      expect(wrapper.attributes('data-emphasis')).toBe('solid');
      expect(wrapper.get('[data-oods-badge-label]').text()).toBe('Approved');
      expect(wrapper.attributes('style')).toContain('--oods-badge-color: blue');
    } finally { wrapper.unmount(); }
  });

  for (const [component, labelSelector] of [[ColorSwatch, '[data-oods-swatch-label]'], [ColorizedBadge, '[data-oods-badge-label]']] as const) {
    it(`${component.name} supports scalar labels while retaining a fallback label beside authored elements`, () => {
      const scalar = mount(component, { props: { label: 'Fallback' }, slots: { default: () => 'Authored label' } });
      const authored = mount(component, { props: { label: 'Fallback' }, slots: { default: () => h('strong', 'Extra content') } });
      try {
        expect(scalar.get(labelSelector).text()).toBe('Authored label');
        expect(authored.get(labelSelector).text()).toBe('Fallback');
        expect(authored.get('strong').text()).toBe('Extra content');
        expect(authored.get(labelSelector).attributes('aria-hidden')).toBeUndefined();
      } finally { scalar.unmount(); authored.unmount(); }
    });
  }

  it('VizAreaPreview exposes dimensions and swaps the placeholder with reactive authored content', async () => {
    const visible = ref(false);
    const wrapper = mount(defineComponent({
      setup: () => () => h(VizAreaPreview, { width: 320, height: 180 }, {
        default: () => visible.value ? h('p', 'Authored content') : [createCommentVNode('empty'), h(Fragment, []), ' '],
      }),
    }));
    try {
      expect(wrapper.attributes()).toMatchObject({ 'data-viz-preview-type': 'area', 'data-viz-width': '320', 'data-viz-height': '180' });
      expect(wrapper.attributes('style')).toContain('--oods-viz-width: 320px');
      expect(wrapper.attributes('style')).toContain('--oods-viz-height: 180px');
      expect(wrapper.get('[data-viz-preview-placeholder]').text()).toBe('Area preview (320 x 180)');
      visible.value = true;
      await nextTick();
      expect(wrapper.find('[data-viz-preview-placeholder]').exists()).toBe(false);
      expect(wrapper.get('p').text()).toBe('Authored content');
      visible.value = false;
      await nextTick();
      expect(wrapper.get('[data-viz-preview-placeholder]').text()).toBe('Area preview (320 x 180)');
      expect(wrapper.find('svg,canvas').exists()).toBe(false);
    } finally { wrapper.unmount(); }
  });

  for (const scenario of sharedScenarios.filter(({ oodsComponentId }) => oodsComponentId in implementations)) {
    it(`${scenario.oodsComponentId} hydrates its shared SSR scenario without changing heading or label semantics`, async () => {
      const slots = Object.fromEntries(Object.entries(scenario.slots).map(([name, value]) => [name, () => String(value)]));
      const component = { render: () => h(implementations[scenario.oodsComponentId], scenario.props, slots) };
      const element = document.createElement('div');
      const html = await renderToString(createSSRApp(component));
      element.innerHTML = html;
      document.body.append(element);
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const app = createSSRApp(component);
      try {
        const before = element.textContent;
        app.mount(element);
        await nextTick();
        expect(element.querySelector(`[data-oods-component="${scenario.oodsComponentId}"]`)).not.toBeNull();
        expect(element.textContent).toBe(before);
        expect(element.querySelector('h1,h2,h3,h4,h5,h6')?.textContent ?? null)
          .toBe(new DOMParser().parseFromString(html, 'text/html').querySelector('h1,h2,h3,h4,h5,h6')?.textContent ?? null);
        expect(error).not.toHaveBeenCalled();
        expect(warn).not.toHaveBeenCalled();
      } finally { app.unmount(); element.remove(); error.mockRestore(); warn.mockRestore(); }
    });
  }
});
