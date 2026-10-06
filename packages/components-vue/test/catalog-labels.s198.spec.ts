import { describe, expect, it } from 'vitest';
import { h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { mount } from '@vue/test-utils';
import { PreferenceEditor, RoleAssignmentForm, TemplatePicker } from '../src/breadth.js';

describe('catalog names are labels, identifiers are values', () => {
  it('mounts the first real catalog choice when the optional selection is omitted, matching native React selects', () => {
    const wrappers = [mount(PreferenceEditor, { props: { namespaces: ['theme', 'privacy'] } }), mount(RoleAssignmentForm, { props: { availableRoles: [{ id: 'owner', name: 'Owner' }] } }), mount(TemplatePicker, { props: { templates: [{ id: 'welcome', name: 'Welcome' }], channels: [{ id: 'email', name: 'Email' }] } })];
    try { expect(wrappers.flatMap(wrapper => wrapper.findAll('select').map(node => node.element.value))).toEqual(['theme', 'owner', 'welcome', 'email']); }
    finally { wrappers.forEach(wrapper => wrapper.unmount()); }
  });
  it('shows canonical role names and honors explicit labels', async () => {
    const html = await renderToString(h(RoleAssignmentForm, { availableRoles: [{ id: 'role-001', name: 'Owner' }, { id: 'role-002', name: 'Editor', label: 'Content editor' }], role: 'role-001' }));
    const host = document.createElement('div'); host.innerHTML = html;
    expect([...host.querySelectorAll('option')].map(node => [node.value, node.textContent])).toEqual([['role-001', 'Owner'], ['role-002', 'Content editor']]);
    expect(host.querySelector('select')!.value).toBe('role-001');
  });
  it('shows template and channel names without replacing stored IDs', async () => {
    const html = await renderToString(h(TemplatePicker, { templates: [{ id: 'template-001', name: 'Welcome Email' }], channels: [{ id: 'channel-001', name: 'Primary Email' }] }));
    const host = document.createElement('div'); host.innerHTML = html;
    expect([...host.querySelectorAll('option')].map(node => [node.value, node.textContent])).toEqual([['template-001', 'Welcome Email'], ['channel-001', 'Primary Email']]);
  });
});
