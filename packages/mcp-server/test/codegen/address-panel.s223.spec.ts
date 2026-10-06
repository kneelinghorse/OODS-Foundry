/**
 * s223-m02 (#2527 ruling 13i, #2521): a User detail on a single screen showed its address panel as a bare "Addresses"
 * heading. The panel's field bound only in generated workflows, and Sprint 222 m04 took the read rows Sprint 222 m03 had
 * given it back out, because in a workflow those rows replaced the panel's summary and a saved address never read back.
 *
 * Now the field lowers to the panel's summary on a single screen too, through the contract helper that prints the
 * workflow store's line, and the composer gives the panel an empty message instead of rows: a record with addresses lists
 * them, one with none says so, and the workflow keeps its own binding (test/product-reality/collections.s191.spec.ts saves
 * an address and reads it back).
 */
import { describe, expect, it } from 'vitest';
import { addressCollectionSummary } from '@oods/component-contracts';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { emit as htmlEmitter } from '../../src/codegen/html-emitter.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';

const nodes = (elements: readonly UiElement[]): UiElement[] => elements.flatMap(node => [node, ...nodes(node.children ?? [])]);
const ADDRESSES = [
  { role: 'home', address: { countryCode: 'US', addressLines: ['100 Main Street', 'Apt 4'], locality: 'Springfield', administrativeArea: 'IL', postalCode: '62701' }, isDefault: true },
  { role: 'work', address: { countryCode: 'US', addressLines: ['8 Lake Road'], locality: 'Madison', administrativeArea: 'WI', postalCode: '53703' } },
];
const LINE = 'home, 100 Main Street, Apt 4, Springfield, IL, 62701; work, 8 Lake Road, Madison, WI, 53703';

describe('an address panel on a single screen shows the record\'s addresses (s223-m02)', () => {
  it('composes the User detail\'s panel with its field, no read rows, and an empty message', async () => {
    const { schema } = await compose({ object: 'User', context: 'detail', options: { transient: true } } as never) as { schema: UiSchema };
    const panels = nodes(schema.screens).filter(node => node.component === 'AddressCollectionPanel');
    expect(panels).toHaveLength(1);
    expect(panels[0]!.props).toMatchObject({ field: 'addresses', emptyMessage: 'None recorded' });
    // Children would replace the bound summary in every renderer (#2521).
    expect(panels[0]!.children ?? []).toEqual([]);
  });

  it('binds the summary to the record in React and Vue, and prints it in HTML, or says none is recorded', async () => {
    const { schema } = await compose({ object: 'User', context: 'detail', options: { transient: true } } as never) as { schema: UiSchema };
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema, framework, profile: 'build' } as never) as { status: string; code: string; errors?: unknown };
      expect(result.status, JSON.stringify(result.errors)).toBe('ok');
      const panel = result.code.match(/<AddressCollectionPanel [^>]*\/>/)?.[0] ?? '';
      expect(panel).toContain(framework === 'react' ? 'summary={addressCollectionSummary(addresses)}' : ':summary="addressCollectionSummary(addresses)"');
      expect(panel).toContain('emptyMessage="None recorded"');
      expect(result.code).toContain('import { addressCollectionSummary } from \'@oods/component-contracts\';');
    }
    const options = { typescript: true, styling: 'tokens' as const };
    const listed = htmlEmitter(schema, { ...options, sampleModel: { name: 'Dana Whitfield', addresses: ADDRESSES } } as never);
    expect(listed.status).toBe('ok');
    expect(listed.code).toContain(`<span data-panel-summary="true">${LINE}</span>`);
    const none = htmlEmitter(schema, { ...options, sampleModel: { name: 'Dana Whitfield', addresses: [] } } as never);
    expect(none.code).toMatch(/data-oods-component="AddressCollectionPanel"[^>]*>.*?<h2>Addresses<\/h2>.*?<span data-panel-summary="true">None recorded<\/span>/s);
  });

  it('prints one line per address: role, street lines, city, region and postal code', () => {
    expect(addressCollectionSummary(ADDRESSES)).toBe(LINE);
    expect(addressCollectionSummary([])).toBe('');
    expect(addressCollectionSummary(undefined)).toBe('');
    // A missing part is left out rather than printed empty.
    expect(addressCollectionSummary([{ role: 'billing', address: { locality: 'Oslo' } }, { address: { addressLines: ['1 Quay'] } }])).toBe('billing, Oslo; 1 Quay');
  });

  it('leaves a workflow reading its own store: its detail binds collectionSummary, with the same empty message', async () => {
    const { schema } = await compose({ object: 'User', context: 'workflow', options: { transient: true } } as never) as { schema: UiSchema };
    const result = await generate({ schema, framework: 'react', profile: 'build' } as never) as { status: string; artifact?: { files: Array<{ path: string; contents: string }> }; errors?: unknown };
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    const detail = result.artifact!.files.find(file => file.path === 'src/screens/Detail.tsx')!.contents;
    const panel = detail.match(/<AddressCollectionPanel [^>]*\/>/)?.[0] ?? '';
    expect(panel).toContain('summary={collectionSummary(addresses)}');
    expect(panel).toContain('emptyMessage="None recorded"');
    expect(detail).toContain("import { collectionAddress, collectionSummary } from '../store';");
    expect(detail).not.toContain('addressCollectionSummary');
  });
});
