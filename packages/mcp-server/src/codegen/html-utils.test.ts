import { describe, expect, it } from 'vitest';

import { attr, dataAttr, escapeHtml } from './html-utils.js';

describe('escapeHtml', () => {
  it('escapes the five XML-required entities', () => {
    expect(escapeHtml('&')).toBe('&amp;');
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('>')).toBe('&gt;');
    expect(escapeHtml('"')).toBe('&quot;');
    expect(escapeHtml("'")).toBe('&#39;');
  });

  it('escapes & first so other entities are not double-escaped', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
    expect(escapeHtml('<&>')).toBe('&lt;&amp;&gt;');
  });

  it('returns the empty string unchanged', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('leaves safe text untouched', () => {
    expect(escapeHtml('plain text 1.0.0 / no-special-chars')).toBe(
      'plain text 1.0.0 / no-special-chars',
    );
  });

  it('escapes quotes commonly used in attribute injection attempts', () => {
    expect(escapeHtml('" onclick="alert(1)"')).toBe(
      '&quot; onclick=&quot;alert(1)&quot;',
    );
  });
});

describe('attr', () => {
  it('emits a leading space + name="value" pair with escaped content', () => {
    expect(attr('class', 'card')).toBe(' class="card"');
    expect(attr('data-x', '<>')).toBe(' data-x="&lt;&gt;"');
  });

  it('returns the empty string for undefined / null / empty values', () => {
    expect(attr('class', undefined)).toBe('');
    expect(attr('class', null)).toBe('');
    expect(attr('class', '')).toBe('');
  });

  it('renders numeric values via String() coercion', () => {
    expect(attr('data-count', 0)).toBe(' data-count="0"');
    expect(attr('data-count', 42)).toBe(' data-count="42"');
  });

  it('escapes quotes in attribute values', () => {
    expect(attr('title', `say "hi"`)).toBe(' title="say &quot;hi&quot;"');
  });
});

describe('dataAttr', () => {
  it('prepends data- to the attribute name', () => {
    expect(dataAttr('entity-urn', 'urn:proto:semantic:x@1')).toBe(
      ' data-entity-urn="urn:proto:semantic:x@1"',
    );
    expect(dataAttr('slot-count', 3)).toBe(' data-slot-count="3"');
  });

  it('drops the attribute entirely when value is empty/null/undefined', () => {
    expect(dataAttr('slot-name', undefined)).toBe('');
    expect(dataAttr('slot-name', null)).toBe('');
    expect(dataAttr('slot-name', '')).toBe('');
  });

  it('escapes attribute values', () => {
    expect(dataAttr('label', '<script>')).toBe(' data-label="&lt;script&gt;"');
  });
});
