import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, it, vi } from 'vitest';
import { schemaNodes } from '../../src/codegen/preview-model.js';
import { clearObjectCache } from '../../src/objects/object-loader.js';
import { handle as compose } from '../../src/tools/design.compose.js';

it('keeps an optional join key in the model while its customer name remains the visible fact', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'detail-row-'));
  try {
    fs.writeFileSync(path.join(dir, 'AccountNote.object.yaml'), [
      'object: { name: AccountNote, version: 1.0.0, domain: test, description: A note about an account. }',
      'traits: []',
      'schema:',
      '  name: { type: string, required: true }',
      '  customer_name: { type: string, required: false }',
      '  organization_id: { type: string, required: false }',
      'semantics:',
      '  organization_id: { semantic_type: organization.id, token_mapping: tokenMap(organization.id.primary), ui_hints: { detailRow: false } }',
    ].join('\n'));
    vi.stubEnv('OODS_OBJECTS_DIR', dir);
    clearObjectCache();
    for (const layout of ['detail', 'dashboard'] as const) {
      const result = await compose({ object: 'AccountNote', context: 'detail', layout, options: { transient: true } });
      expect(result.status).toBe('ok');
      const schema = result.schema!;
      expect(schema.objectSchema?.organization_id).toMatchObject({ type: 'string', required: false });
      const bindings = schemaNodes(schema).map(node => node.props?.field);
      expect(bindings).toContain('customer_name');
      expect(bindings).not.toContain('organization_id');
      const payment = await compose({ object: 'Transaction', context: 'detail', layout, options: { transient: true } });
      expect(payment.schema?.objectSchema?.organization_id).toMatchObject({ type: 'uuid', displayLabelField: 'organization_name' });
      expect(schemaNodes(payment.schema!).map(node => node.props?.field)).toContain('organization_id');
    }
  } finally {
    vi.unstubAllEnvs();
    clearObjectCache();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
