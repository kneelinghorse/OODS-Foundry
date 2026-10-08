import { describe, expect, it } from 'vitest';
import { handle } from '../../src/tools/registry.snapshot.js';
import { getAjv } from '../../src/lib/ajv.js';
import outputSchema from '../../src/schemas/registry.snapshot.output.json' with { type: 'json' };

// With no arguments registry_snapshot returned about 410,000 characters: every trait's schema, view extensions and
// tokens. Anthropic documents ~150,000 characters as a connector's largest tool result, and Claude Code saves results
// over 50,000 characters to a file. The default is a summary that fits; full detail is one argument away.

const size = (value: unknown) => JSON.stringify(value, null, 2).length;
const validate = getAjv().compile(outputSchema);

describe('registry_snapshot sizes its reply for the client', () => {
  it('answers with a summary by default, under 50,000 characters, without schemas or view extensions', async () => {
    const summary = await handle({});
    expect(validate(summary), JSON.stringify(validate.errors)).toBe(true);
    expect(summary.detail).toBe('summary');
    expect(size(summary)).toBeLessThan(50_000);
    expect(Object.keys(summary.traits).length).toBeGreaterThan(40);
    for (const trait of Object.values(summary.traits)) {
      expect(trait).not.toHaveProperty('schema');
      expect(trait).not.toHaveProperty('viewExtensions');
      expect(trait.description.length).toBeLessThanOrEqual(240);
    }
    expect(summary.objects.Subscription?.fields?.length).toBeGreaterThan(0);
  });

  it('returns complete definitions with detail full, and only the named ones when names are given', async () => {
    const full = await handle({ detail: 'full' });
    expect(full.detail).toBe('full');
    expect(full.traits.Stateful?.schema).toBeTruthy();
    const named = await handle({ detail: 'full', names: ['Subscription', 'Stateful', 'NotARealName'] });
    expect(validate(named), JSON.stringify(validate.errors)).toBe(true);
    expect(Object.keys(named.traits)).toEqual(['Stateful']);
    expect(Object.keys(named.objects)).toEqual(['Subscription']);
    expect(named.notFound).toEqual(['NotARealName']);
    expect(named.traits.Stateful).toEqual(full.traits.Stateful);
  });
});
