import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bridgeConfig } from './config.js';
import { resolveBridgeToolSurface } from './tool-surface.js';

const serverCwd = fileURLToPath(new URL('../../mcp-server/', import.meta.url));

describe('resolveBridgeToolSurface', () => {
  it('uses only auto tools for the default toolset', () => {
    const surface = resolveBridgeToolSurface(
      serverCwd,
      bridgeConfig.tools.allowed,
      { MCP_TOOLSET: 'default', MCP_EXTRA_TOOLS: '' } as NodeJS.ProcessEnv,
    );

    expect(surface.toolsetMode).toBe('default');
    expect(surface.enabled).toContain('design.compose');
    // a11y.scan is an on-demand tool, so it must NOT appear on the default surface.
    expect(surface.enabled).not.toContain('a11y.scan');
  });

  it('exposes viz.render on the default bridge surface (bridge<->direct parity)', () => {
    const surface = resolveBridgeToolSurface(
      serverCwd,
      bridgeConfig.tools.allowed,
      { MCP_TOOLSET: 'default', MCP_EXTRA_TOOLS: '' } as NodeJS.ProcessEnv,
    );
    // viz.render is an auto tool in the server registry AND allow-listed on the
    // bridge, so the bridge-resolved surface must include it — matching the
    // direct server surface (no exposure drift between the two serving paths).
    expect(surface.enabled).toContain('viz.render');
    expect(bridgeConfig.tools.allowed).toContain('viz.render');
  });

  it('exposes dashboard.render on the default bridge surface (bridge<->direct parity)', () => {
    const surface = resolveBridgeToolSurface(
      serverCwd,
      bridgeConfig.tools.allowed,
      { MCP_TOOLSET: 'default', MCP_EXTRA_TOOLS: '' } as NodeJS.ProcessEnv,
    );
    // dashboard.render is an auto tool in the server registry AND allow-listed on
    // the bridge (sprint-113 m05), so the bridge-resolved surface must include it.
    expect(surface.enabled).toContain('dashboard.render');
    expect(bridgeConfig.tools.allowed).toContain('dashboard.render');
  });

  it('includes on-demand tools when MCP_TOOLSET=all', () => {
    const surface = resolveBridgeToolSurface(
      serverCwd,
      bridgeConfig.tools.allowed,
      { MCP_TOOLSET: 'all', MCP_EXTRA_TOOLS: '' } as NodeJS.ProcessEnv,
    );

    expect(surface.toolsetMode).toBe('all');
    expect(surface.enabled).toContain('a11y.scan');
  });

  it('adds explicit extras and reports unknown extras', () => {
    const surface = resolveBridgeToolSurface(
      serverCwd,
      bridgeConfig.tools.allowed,
      {
        MCP_TOOLSET: 'default',
        MCP_EXTRA_TOOLS: 'a11y.scan,unknown.tool',
      } as NodeJS.ProcessEnv,
    );

    expect(surface.enabled).toContain('a11y.scan');
    expect(surface.unknownExtras).toEqual(['unknown.tool']);
    expect(surface.registrySource).toMatch(/tools\/registry\.json$/);
  });

  it('accepts the listed name a11y_scan, the one the README and clients show', () => {
    const surface = resolveBridgeToolSurface(
      serverCwd,
      bridgeConfig.tools.allowed,
      { MCP_TOOLSET: 'default', MCP_EXTRA_TOOLS: 'a11y_scan' } as NodeJS.ProcessEnv,
    );

    expect(surface.enabled).toContain('a11y.scan');
    expect(surface.unknownExtras).toEqual([]);
  });
});
