import { describe, expect, it } from 'vitest';

import {
  getTemplateByKey,
  listTemplates,
} from '@/traits/addressable/format-templates.ts';
import type { TemplateComponentToken } from '@/traits/addressable/template-parser.ts';

describe('UPU S42 template registry', () => {
  it('exposes 10+ country templates with normalized metadata', () => {
    const templates = listTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(10);

    const us = getTemplateByKey('US');
    expect(us.countryCode).toBe('US');
    expect(us.lines[2]?.tokens.length).toBeGreaterThan(0);

    const aliasLookup = getTemplateByKey('usa');
    expect(aliasLookup.key).toBe('US');
  });

  it('parses component options such as prefix/suffix modifiers', () => {
    const es = getTemplateByKey('ES');
    const localityToken = es.lines[2]?.tokens[1] as TemplateComponentToken;
    const adminToken = es.lines[2]?.tokens[2] as TemplateComponentToken;

    expect(localityToken.component).toBe('locality');
    expect(localityToken.options.prefix).toBe(' ');
    expect(adminToken.component).toBe('administrativeArea');
    expect(adminToken.options.prefix).toBe(' (');
    expect(adminToken.options.suffix).toBe(')');
  });

  it('throws when requesting an unknown template key', () => {
    expect(() => getTemplateByKey('ZZZ')).toThrow(/No format template/);
  });

  it('resolves Netherlands templates by key or alias', () => {
    const nl = getTemplateByKey('NL');
    expect(nl.countryCode).toBe('NL');
    expect(nl.lines[2]?.tokens[0]?.component).toBe('postalCode');

    const alias = getTemplateByKey('nld');
    expect(alias.key).toBe('NL');
  });
});
