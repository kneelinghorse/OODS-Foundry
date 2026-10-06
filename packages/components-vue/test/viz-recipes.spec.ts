import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import userEvent from '@testing-library/user-event';
import { VizAxisControls, VizColorControls, VizLinePreview, VizOpacityControls } from '../src/viz-recipes.js';
const value = { encodings: { color: { field: 'category', range: ['#123456', '#654321'] }, x: { field: 'period' } } };
describe('Viz recipe consumer boundaries', () => {
  it('an unbound axis title stays local until its data field exists', async () => {
    const wrapper = mount(VizAxisControls);
    try {
      await wrapper.get('input[name="x.title"]').setValue('Revenue');
      expect(wrapper.emitted('change')).toBeUndefined(); expect(wrapper.get('[role="alert"]').text()).toContain('field');
      await wrapper.get('input[name="x.field"]').setValue('period');
      await wrapper.get('input[name="x.title"]').setValue('Revenue by month');
      expect(wrapper.emitted('change')?.at(-1)).toEqual([{ encodings: { x: { field: 'period', title: 'Revenue by month' } } }]);
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    } finally { wrapper.unmount(); }
  });

  it('invalid colors are announced without emitting and a valid edit preserves other bindings', async () => {
    const wrapper = mount(VizColorControls, { props: { value } });
    try {
      await wrapper.get('input[name="color.range"]').setValue('#bad');
      expect(wrapper.emitted('change')).toBeUndefined(); expect(wrapper.get('[role="alert"]').text()).toContain('at least two');
      await wrapper.get('input[name="color.range"]').setValue('#abcdef, #fedcba');
      expect(wrapper.emitted('change')).toEqual([[{ encodings: { color: { field: 'category', range: ['#abcdef', '#fedcba'] }, x: { field: 'period' } } }]]);
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    } finally { wrapper.unmount(); }
  });
  it('consumer prop updates replace editor state without emitting a change', async () => {
    const wrapper = mount(VizColorControls, { props: { value } });
    try { await wrapper.setProps({ value: { encodings: { color: { field: 'region', range: ['#000', '#fff'] } } } }); expect((wrapper.get('input[name="color.field"]').element as HTMLInputElement).value).toBe('region'); expect(wrapper.emitted('change')).toBeUndefined(); }
    finally { wrapper.unmount(); }
  });
  it('disabled controls reject keyboard editing', async () => {
    const change = vi.fn(); const wrapper = mount(VizColorControls, { attachTo: document.body, props: { value, disabled: true, onChange: change } });
    try { await userEvent.setup().type(wrapper.get('input').element, 'x'); expect(change).not.toHaveBeenCalled(); }
    finally { wrapper.unmount(); }
  });
  it('a zero-opacity selection is numeric and an absent preview contains no chart pixels', async () => {
    const wrapper = mount(VizOpacityControls, { props: { value: { opacity: 0.8 } } });
    const preview = mount(VizLinePreview);
    try { await wrapper.get('select').setValue('0'); expect(wrapper.emitted('change')).toEqual([[{ opacity: 0 }]]); expect(preview.find('svg').exists()).toBe(false); expect(preview.text()).toContain('No rendered chart supplied'); }
    finally { wrapper.unmount(); preview.unmount(); }
  });
});
