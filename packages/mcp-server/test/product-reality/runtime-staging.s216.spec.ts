import { describe, expect, it } from 'vitest';
import { assertRuntimeWorkDirectory } from '../../../../scripts/runtime/assemble.mjs';

describe('runtime assembly can obey the in-repository build charter without staging into source', () => {
  it('admits ignored .tmp staging and still refuses source, root and similarly-prefixed directories', () => {
    expect(() => assertRuntimeWorkDirectory('/repo', '/repo/.tmp/s216')).not.toThrow();
    for (const directory of ['/repo', '/repo/src/build', '/repo/.tmp-other', '/repo/.tmp/../src']) {
      expect(() => assertRuntimeWorkDirectory('/repo', directory)).toThrow();
    }
    expect(() => assertRuntimeWorkDirectory('/repo', '/external-build')).not.toThrow();
  });
});
