import { describe, expect, it } from 'vitest';
import { publicEvidenceReference, withPublicEvidence } from '../../src/lib/public-evidence.js';
import { handle as health } from '../../src/tools/health.js';
import { handle as catalog } from '../../src/tools/catalog.list.js';

// The website audit (PROD-22) found health_check and catalog_list citing artifacts/product-reality receipts that exist
// in neither the npm package nor the public repository. Output names them by file and keeps hashes and versions; a
// shipped path (the runtime's own registry files) is left as it is.

describe('tool output cites only evidence a reader can open', () => {
  it('renames unshipped receipts by file, keeping the fragment, and leaves shipped paths alone', () => {
    expect(publicEvidenceReference('artifacts/product-reality/sprint-193/m05/react-measured.json#AddressCollectionPanel'))
      .toBe('build record (not shipped): react-measured.json#AddressCollectionPanel');
    expect(publicEvidenceReference('artifacts/product-reality/sprint-235/m04/fidelity-proof.json'))
      .toBe('build record (not shipped): fidelity-proof.json');
    expect(publicEvidenceReference('packages/mcp-server/registry/runtime-cells.v1.json#/rows/90'))
      .toBe('packages/mcp-server/registry/runtime-cells.v1.json#/rows/90');
    expect(publicEvidenceReference('artifacts/product-reality/sprint-193/m05/react-theme/report.json'))
      .toBe('build record (not shipped): react-theme/report.json');
    expect(withPublicEvidence({ a: ['artifacts/product-reality/x/y.json', 'artifacts/product-reality/z/y.json'], n: 3, b: null }))
      .toEqual({ a: ['build record (not shipped): y.json'], n: 3, b: null });
  });

  it('health_check and catalog_list at full detail carry no artifacts/product-reality path', async () => {
    expect(JSON.stringify((await health({} as never)).productReality)).not.toContain('artifacts/product-reality');
    expect(JSON.stringify(await catalog({ detail: 'full', pageSize: 5 } as never))).not.toContain('artifacts/product-reality');
  });
});
