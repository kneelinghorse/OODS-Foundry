import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleAssignmentForm, TemplatePicker } from '../src/breadth.js';

describe('catalog names are labels, identifiers are values', () => {
  it('shows canonical role names and honors explicit labels', () => {
    const html = renderToStaticMarkup(<RoleAssignmentForm availableRoles={[{ id: 'role-001', name: 'Owner' }, { id: 'role-002', name: 'Editor', label: 'Content editor' }]} role="role-001" />);
    const host = document.createElement('div'); host.innerHTML = html;
    expect([...host.querySelectorAll('option')].map(node => [node.value, node.textContent])).toEqual([['role-001', 'Owner'], ['role-002', 'Content editor']]);
    expect(host.querySelector('select')!.value).toBe('role-001');
  });
  it('shows template and channel names without replacing stored IDs', () => {
    const html = renderToStaticMarkup(<TemplatePicker templates={[{ id: 'template-001', name: 'Welcome Email' }]} channels={[{ id: 'channel-001', name: 'Primary Email' }]} />);
    const host = document.createElement('div'); host.innerHTML = html;
    expect([...host.querySelectorAll('option')].map(node => [node.value, node.textContent])).toEqual([['template-001', 'Welcome Email'], ['channel-001', 'Primary Email']]);
  });
});
