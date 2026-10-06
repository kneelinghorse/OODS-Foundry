import { expect, it } from 'vitest';
import { handle as catalog } from '../../src/tools/catalog.list.js';
import { wire, retain } from '../helpers/wire-boundary.js';

// s222-m02 (#2502 ruling 11): Switch and Dialog join the 110.
it('paginates the live 114-component catalog and reports framework evidence independently of legacy status', async () => {
  const call = async (input: any) => wire('catalog.list', 'output', await catalog(wire('catalog.list', 'input', input)));
  const first = await call({ pageSize: 114, detail: 'full' });
  expect(first.totalCount).toBe(114); expect(first.returnedCount).toBe(114);
  expect(first.hasMore).toBe(false);
  expect(first.obligationScope?.approvedRuntimeCensus).toBeNull();
  expect(first.components.every(item => item.productReality?.surfaces?.react)).toBe(true);
  const page = await call({ pageSize: 2, page: 2, detail: 'full' });
  expect(page.components.map(item => item.name)).toEqual(first.components.slice(2, 4).map(item => item.name));
  const category = first.components[0].categories[0];
  const filtered = await call({ category, pageSize: 114, detail: 'full' });
  expect(filtered.components.length).toBeGreaterThan(0);
  expect(filtered.components.every(item => item.categories.includes(category))).toBe(true);
  retain('catalog.list', { first, page, filtered });
});
