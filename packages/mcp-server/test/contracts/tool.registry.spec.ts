import { describe, expect, it } from 'vitest';
import { loadToolRegistry, resolveToolRegistry } from '../../src/tools/registry.js';

describe('tool registry', () => {
  it('does not include removed tools in registry lists', () => {
    const registry = loadToolRegistry();

    expect(registry.auto).not.toContain('design.generate');
    expect(registry.onDemand).not.toContain('design.generate');
  });

  it('treats removed tools as unknown extras', () => {
    const resolved = resolveToolRegistry({
      ...process.env,
      MCP_TOOLSET: 'default',
      MCP_EXTRA_TOOLS: 'design.generate',
    });

    expect(resolved.enabled).not.toContain('design.generate');
    expect(resolved.unknownExtras).toContain('design.generate');
  });

  it('does not enable removed tools even when toolset=all', () => {
    const resolved = resolveToolRegistry({
      ...process.env,
      MCP_TOOLSET: 'all',
      MCP_EXTRA_TOOLS: '',
    });

    expect(resolved.enabled).not.toContain('design.generate');
  });
});

