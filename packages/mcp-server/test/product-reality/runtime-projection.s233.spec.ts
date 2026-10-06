import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { componentPlacement } from '../../../../scripts/product-reality/s193-tool-truth.mjs';

describe('component claims follow the retained public population (s233-m02)', () => {
  it('counts only generation receipts bound by passing current cells, even when private receipts remain beside them', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-public-projection-'));
    const put = (file: string, data: unknown) => {
      const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, JSON.stringify(data));
    };
    const generation = (name: string) => ({ files: [{ contents: `import { ${name} } from '@oods/components-react';` }] });
    try {
      put('runtime.json', { receiptRoot: 'receipts', rows: [
        { status: 'pass', report: 'cells/User/detail/react/receipt.json', gates: [{ name: 'generation', detail: {} }] },
        { status: 'pass', report: 'cells/User/workflow/react/receipt.json', gates: [{ name: 'generation', detail: { response: 'workflows/User/react-generation.json' } }] },
        { status: 'fail', report: 'cells/Run/detail/react/receipt.json', gates: [{ name: 'generation', detail: {} }] },
      ] });
      put('receipts/cells/User/detail/react/generation.json', generation('Text'));
      put('receipts/workflows/User/react-generation.json', generation('Tabs'));
      put('receipts/cells/Evidence/detail/react/generation.json', generation('PrivateOnly'));
      put('receipts/cells/Run/detail/react/generation.json', generation('FailedOnly'));
      put('packages/component-contracts/registry/component-capability-ledger.v1.json', { rows: ['Text', 'Tabs', 'PrivateOnly'].map(id => ({ id, surfaces: { generatedConsumer: { state: 'implemented-evidence-complete' } } })) });
      const result = componentPlacement(root, 'runtime.json');
      expect([...result.placed].sort()).toEqual(['Tabs', 'Text']);
      expect(result.labelledNotPlaced).toEqual(['PrivateOnly']);
      expect(result.placedNotLabelled).toEqual([]);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
