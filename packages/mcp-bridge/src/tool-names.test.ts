import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildToolNameMaps, resolveInternalToolName, toExternalName } from './tool-names.js';

const surface = JSON.parse(fs.readFileSync(new URL('../../mcp-adapter/tool-surface.json', import.meta.url), 'utf8'));

describe('advertised tool names', () => {
  it('lists the shared public table without promoting compatibility aliases', () => {
    const maps = buildToolNameMaps(Object.keys(surface));
    expect([...maps.allowedExternalTools]).toEqual(Object.values(surface).map((tool: any) => tool.name));
    for (const [internal, entry] of Object.entries<any>(surface)) {
      const legacy = internal.replaceAll('.', '_');
      expect(toExternalName(internal)).toBe(entry.name);
      expect(resolveInternalToolName(entry.name, maps.externalToInternal)).toBe(internal);
      for (const removed of [internal, legacy].filter(name => name !== entry.name)) {
        expect(resolveInternalToolName(removed, maps.externalToInternal)).toBeUndefined();
        expect(maps.allowedExternalTools.has(removed)).toBe(false);
      }
    }
  });

  it('never admits a disabled tool through its legacy or internal name', () => {
    const maps = buildToolNameMaps(['health']);
    for (const name of ['map', 'component_map', 'structuredData.fetch', 'structuredData_fetch', 'structured_data_fetch']) {
      expect(resolveInternalToolName(name, maps.externalToInternal)).toBeUndefined();
    }
  });
});
