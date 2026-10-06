import { afterEach, describe, expect, it, vi } from 'vitest';
import { handle as health } from '../../src/tools/health.js';
import { liveComponentNames } from '../../src/lib/live-registry.js';
import * as objects from '../../src/objects/object-loader.js';
import * as traits from '../../src/objects/trait-loader.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
describe('health reports the active registry even without an export', () => {
  it('counts component contracts live rather than claiming a historical census is current', async () => {
    const result = await health();
    expect(result.registry.countsFrom.components).toBe('live');
    expect(result.registry.components).toBe(liveComponentNames().length);
  });
  it('still reads live counts when the structured-data directory is unavailable', async () => {
    vi.stubEnv('MCP_STRUCTURED_DATA_DIR', '/unavailable-s216-fixture');
    const result = await health();
    expect(result.registry.countsFrom).toEqual({ components: 'live', objects: 'live', traits: 'live' });
    expect(result.registry.components).toBe(liveComponentNames().length);
    expect(result.registry.objects).toBe(objects.listObjects().length);
    expect(result.warnings).toContainEqual(expect.stringContaining('registry'));
  });
  it.each([['objects', objects, 'listObjects'], ['traits', traits, 'listTraits']] as const)('reports the %s loader failure instead of silently using old data', async (name, module, method) => {
    vi.spyOn(module as any, method).mockImplementation(() => { throw new Error('fixture loader failed'); });
    const result = await health();
    expect(result.registry.countsFrom[name]).not.toBe('live');
    expect(result.warnings).toContainEqual(expect.stringMatching(new RegExp(`${name}.*fixture loader failed`)));
  });
});
