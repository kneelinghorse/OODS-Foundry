import { once } from 'node:events';
import fs from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withStaticServer } from '../../../../scripts/product-reality/s184-m06-live-consumers.js';

const html = '<main>Actual consumer proof completed</main>';
let directory: string;
beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'oods-static-teardown-'));
  await fs.writeFile(path.join(directory, 'index.html'), html);
});
afterEach(async () => { await fs.rm(directory, { recursive: true, force: true }); });

function readPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    http.get(url, { agent: false }, response => {
      const chunks: Buffer[] = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks).toString()));
      response.on('error', reject);
    }).on('error', reject);
  });
}

async function withinShutdownDeadline<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Static server shutdown hung after callback completed')), 2_000);
    })]);
  } finally { clearTimeout(timer); }
}

describe('static proof server teardown (s195-m06)', () => {
  it.each(['connected', 'partial-request'] as const)('closes a retained %s socket only after callback work completes', async kind => {
    let retained: net.Socket | undefined;
    const result = { completed: true };
    const work = withStaticServer(directory, async url => {
      const address = new URL(url);
      retained = net.connect(Number(address.port), address.hostname);
      retained.on('error', () => {});
      await once(retained, 'connect');
      if (kind === 'partial-request') retained.write('GET / HTTP/1.1\r\nHost: localhost\r\nX-Pending: ');
      // A second complete request exercises the real server while the first
      // connection is held open, as a forwarded browser connection can be.
      expect(await readPage(url)).toBe(html);
      expect(retained.destroyed).toBe(false);
      return result;
    });
    try {
      expect(await withinShutdownDeadline(work)).toBe(result);
      if (!retained!.destroyed) await withinShutdownDeadline(once(retained!, 'close'));
      expect(retained!.destroyed).toBe(true);
    } finally {
      retained?.destroy();
      await work.catch(() => {});
    }
  });

  it('releases the partial connection and preserves the original callback failure', async () => {
    let retained: net.Socket | undefined;
    const failure = new Error('The actual browser proof failed');
    const work = withStaticServer(directory, async url => {
      const address = new URL(url);
      retained = net.connect(Number(address.port), address.hostname);
      retained.on('error', () => {});
      await once(retained, 'connect');
      retained.write('GET / HTTP/1.1\r\nHost: localhost\r\nX-Pending: ');
      expect(await readPage(url)).toBe(html);
      throw failure;
    });
    try {
      await expect(withinShutdownDeadline(work)).rejects.toBe(failure);
      if (!retained!.destroyed) await withinShutdownDeadline(once(retained!, 'close'));
      expect(retained!.destroyed).toBe(true);
    } finally {
      retained?.destroy();
      await work.catch(() => {});
    }
  });
});
