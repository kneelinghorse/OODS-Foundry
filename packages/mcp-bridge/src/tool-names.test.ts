import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildToolNameMaps, legacyToolWarning, resolveInternalToolName, toExternalName } from './tool-names.js';

const surface = JSON.parse(fs.readFileSync(new URL('../../mcp-adapter/tool-surface.json', import.meta.url), 'utf8'));

describe('advertised tool names', () => {
  it('lists the shared public table without promoting compatibility aliases', () => {
    const maps = buildToolNameMaps(Object.keys(surface));
    expect([...maps.allowedExternalTools]).toEqual(Object.values(surface).map((tool: any) => tool.name));
    for (const [internal, entry] of Object.entries<any>(surface)) {
      const legacy = internal.replaceAll('.', '_');
      expect(toExternalName(internal)).toBe(entry.name);
      for (const name of [entry.name, internal, legacy]) expect(resolveInternalToolName(name, maps.externalToInternal)).toBe(internal);
      if (legacy !== entry.name) {
        expect(maps.allowedExternalTools.has(legacy)).toBe(false);
        expect(legacyToolWarning(legacy, internal)).toContain(`use ${entry.name}`);
      } else expect(legacyToolWarning(legacy, internal)).toBeUndefined();
      expect(legacyToolWarning(entry.name, internal)).toBeUndefined();
    }
  });

  it('never admits a disabled tool through its legacy or internal name', () => {
    const maps = buildToolNameMaps(['health']);
    for (const name of ['map', 'component_map', 'structuredData.fetch', 'structuredData_fetch', 'structured_data_fetch']) {
      expect(resolveInternalToolName(name, maps.externalToInternal)).toBeUndefined();
    }
  });
});
