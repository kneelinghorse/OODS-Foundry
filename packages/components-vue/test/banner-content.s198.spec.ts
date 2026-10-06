import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { Banner } from '../src/index.js';
describe('banner text parity', () => {
  it('announces plain empty-state copy as a paragraph and preserves block content in authored slots', () => {
    const plain = mount(Banner, { props: { content: 'No events yet.' } });
    // s221-m02 (#2482 ruling 2): one markup with React, BEM part classes.
    expect(plain.get('p.oods-banner__body').text()).toBe('No events yet.');
    plain.unmount();
    const authored = mount(Banner, { slots: { default: '<div><p>Authored body</p></div>' } });
    expect(authored.get('div.oods-banner__body > div > p').text()).toBe('Authored body');
    authored.unmount();
  });
});
