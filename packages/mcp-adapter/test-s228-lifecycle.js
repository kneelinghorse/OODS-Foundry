import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { probeLauncher } from '../../scripts/product-reality/s228-orphan-probe.mjs';

const adapter = fileURLToPath(new URL('./index.js', import.meta.url));
for (const preview of [false, true]) {
  test(`SIGKILL fires the SDK close and leaves no ${preview ? 'native or preview' : 'native'} child`, async () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 's228-orphan-'));
    try {
      const receipt = await probeLauncher({ launcher: adapter, work, preview });
      if (process.env.S228_M01_RECEIPTS) {
        fs.mkdirSync(process.env.S228_M01_RECEIPTS, { recursive: true });
        fs.writeFileSync(path.join(process.env.S228_M01_RECEIPTS, `source-orphan-${preview ? 'preview' : 'health'}.json`), JSON.stringify(receipt, null, 2) + '\n');
      }
      assert.equal(receipt.passed, true, JSON.stringify(receipt));
    } finally { fs.rmSync(work, { recursive: true, force: true }); }
  });
}
