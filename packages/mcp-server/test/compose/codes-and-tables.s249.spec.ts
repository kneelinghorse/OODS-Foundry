import { vi } from 'vitest';

// Decision #1833: generation work has an explicit serial execution budget.
vi.setConfig({ testTimeout: 300_000 });

/**
 * s249-m04 (next step 1877): a code written in capitals keeps them. A currency select's choices read "GBP", "USD" and
 * "EUR", where they read "Gbp", "Usd" and "Eur", as do "UTC" and the contrast levels "AA" and "AAA". A word written in
 * capitals, as an importer's "OWNER", still reads as a word ("Owner"): only two- and three-letter codes keep their case.
 *
 * And the rule a related row now shares with its object's own badge (compose/status-table.ts statusTableOf): a status
 * field typed billing.<domain>.status whose table the registry holds reads that table, every other one the lifecycle
 * table.
 */
import { describe, expect, it } from 'vitest';
import { enumOptionLabel } from '../../src/compose/internal-fields.js';
import { statusTableOf } from '../../src/compose/status-table.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';

describe('a code in capitals keeps them (1877)', () => {
  it('keeps two- and three-letter codes, and reads longer capitals as words', () => {
    expect(['GBP', 'USD', 'EUR', 'JPY', 'UTC', 'AA', 'AAA'].map(value => enumOptionLabel(value))).toEqual(['GBP', 'USD', 'EUR', 'JPY', 'UTC', 'AA', 'AAA']);
    expect(['OWNER', 'PAST_DUE', 'past_due', 'A'].map(value => enumOptionLabel(value))).toEqual(['Owner', 'Past due', 'Past due', 'A']);
  });

  it('offers a transaction\'s currencies by their codes in an HTML form', async () => {
    const composed = await compose({ object: 'Transaction', context: 'form', options: { transient: true } } as never) as { status: string; schema: unknown };
    expect(composed.status).toBe('ok');
    const generated = await generate({ schema: composed.schema, framework: 'html', profile: 'build', options: { brand: 'A', theme: 'light' } } as never) as { status: string; code: string };
    expect(generated.status).toBe('ok');
    const choices = [...generated.code.matchAll(/<option value="([A-Z]{3})"(?: selected)?>([^<]*)<\/option>/g)].map(match => [match[1], match[2]]);
    expect(choices).toEqual(expect.arrayContaining([['USD', 'USD'], ['EUR', 'EUR'], ['GBP', 'GBP']]));
    expect(generated.code).not.toMatch(/>(?:Usd|Eur|Gbp)</);
  });
});

describe('the status table a badge reads, for a record and for its rows on other pages', () => {
  it('names a billing table the registry holds, and the lifecycle table for everything else', () => {
    expect(statusTableOf('billing.subscription.status')).toBe('subscription');
    expect(statusTableOf('billing.invoice.status')).toBe('invoice');
    expect(statusTableOf('billing.refund.status')).toBe('lifecycle');
    expect(statusTableOf('lifecycle.status')).toBe('lifecycle');
    expect(statusTableOf(undefined)).toBe('lifecycle');
  });
});
