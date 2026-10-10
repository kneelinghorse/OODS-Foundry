import { expect, it } from 'vitest';
import { handle as fetchData } from '../../src/tools/structuredData.fetch.js';
import { handle as catalog } from '../../src/tools/catalog.list.js';
import { getAjv } from '../../src/lib/ajv.js';
import outputSchema from '../../src/schemas/structuredData.fetch.output.json';
import catalogSchema from '../../src/schemas/catalog.list.output.json';

it.each(['components', 'tokens', 'manifest'] as const)('pages %s completely, within the client limit, without losing container types or values', async dataset => {
  const full = await fetchData({ dataset, payloadMode: 'inline' });
  const summary = await fetchData({ dataset, detail: 'summary' });
  expect(JSON.stringify(summary, null, 2).length).toBeLessThan(100_000);
  expect(summary.meta?.next).toMatchObject({ dataset, page: 1 });
  expect(summary.meta?.full).toMatchObject({ dataset, payloadMode: 'file' });
  const rebuilt: Record<string, unknown> = {};
  let request: any = { dataset, page: 1, pageSize: 100 };
  let previousEtag: string | undefined;
  do {
    const page = await fetchData({ ...request, ifNoneMatch: previousEtag }, { sizedReply: true });
    expect(getAjv().compile(outputSchema)(page)).toBe(true);
    expect(page.matched).toBe(false);
    expect(page.payloadFile).toBeUndefined();
    expect(JSON.stringify(page, null, 2).length).toBeLessThan(100_000);
    for (const entry of page.payload!.entries as Array<{ path: string; value: unknown }>) {
      const parts = entry.path.slice(1).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'));
      const key = parts.pop()!;
      const parent = parts.reduce((value: any, part) => value[part], rebuilt) as any;
      Object.defineProperty(parent, key, { value: structuredClone(entry.value), enumerable: true, writable: true, configurable: true });
    }
    previousEtag = page.etag;
    request = page.meta?.next;
  } while (request);
  expect(rebuilt).toEqual(full.payload);
  const same = await fetchData({ dataset, detail: 'summary', ifNoneMatch: summary.etag });
  expect(same.matched).toBe(true);
  expect(same.payload).toBeUndefined();
});

it('pages filtered full catalog replies, with total and a directly callable next page', async () => {
  const first = await catalog({ context: 'detail' });
  expect(first.detail).toBe('full');
  expect(first.returnedCount).toBeLessThanOrEqual(10);
  expect(first.totalCount).toBeGreaterThan(first.returnedCount);
  expect(first.nextPage).toEqual({ context: 'detail', page: 2, pageSize: 10 });
  expect(getAjv().compile(catalogSchema)(first)).toBe(true);
  const second = await catalog(first.nextPage!);
  expect(new Set([...first.components, ...second.components].map(item => item.name)).size).toBe(first.returnedCount + second.returnedCount);
  const explicit = await catalog({ context: 'detail', detail: 'full' });
  expect(explicit.returnedCount).toBe(explicit.totalCount);
});

it('refuses unsupported paging shapes instead of silently treating them as full reads', async () => {
  await expect(fetchData({ dataset: 'components', pageSize: 101 })).rejects.toThrow('1–100');
  await expect(fetchData({ dataset: 'tokens', detail: 'summary', page: 1 })).rejects.toThrow('summary is one reply');
  await expect(fetchData({ kind: 'run_manifest', runPath: '.', page: 1 })).rejects.toThrow('dataset reads only');
});
