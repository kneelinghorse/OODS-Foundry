import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GOVERNED_SURFACES, isGovernedComponent, type GovernedLedgerRow } from '../src/index.js';

const ledger = JSON.parse(readFileSync(new URL('../registry/component-capability-ledger.v1.json', import.meta.url), 'utf8')) as { rows: GovernedLedgerRow[] };

describe('s213-m02: "governed component" is a checkable ledger state, not a word', () => {
  it('holds for every row that records all five surfaces, and is what the documents count', () => {
    // The README and how-forge-works say "114 governed components" (110 until s222-m02 added Switch and Dialog, #2502, and 112 until s223-m02 added SegmentedControl and Combobox, #2527;
    // ruling 11); that number is this predicate over the ledger.
    expect(ledger.rows.filter(isGovernedComponent)).toHaveLength(ledger.rows.length);
    expect(Object.keys(GOVERNED_SURFACES)).toEqual(['contract', 'react', 'vue', 'accessibility', 'theme']);
  });

  it.each(Object.keys(GOVERNED_SURFACES))('fails for a row whose %s surface is missing or weaker', surface => {
    const row = structuredClone(ledger.rows[0]);
    expect(isGovernedComponent(row)).toBe(true);
    row.surfaces[surface] = { state: 'unavailable' };
    expect(isGovernedComponent(row)).toBe(false);
    delete row.surfaces[surface];
    expect(isGovernedComponent(row)).toBe(false);
  });

  it('does not depend on placement in generated apps, which the runtime sweep measures separately', () => {
    const row = structuredClone(ledger.rows[0]);
    row.surfaces.generatedConsumer = { state: 'unavailable' };
    expect(isGovernedComponent(row)).toBe(true);
  });
});
