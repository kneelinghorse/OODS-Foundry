import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bridgeConfig } from '../../../mcp-bridge/src/config.js';
import { resolveBridgeToolSurface } from '../../../mcp-bridge/src/tool-surface.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../../');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('s90 registration audit', () => {
  const requiredMentions: Array<{ label: string; file: string; patterns: string[] }> = [
    // s107-m01b: the per-action tool names (map.apply, …) were consolidated into
    // grouped action-parameter tools and their standalone registrations removed.
    // Track the grouped `map` tool here; registry.snapshot stays as a standalone control.
    { label: 'registry.json', file: 'packages/mcp-server/src/tools/registry.json', patterns: ['"map"', '"registry.snapshot"'] },
    { label: 'registry.ts', file: 'packages/mcp-server/src/tools/registry.ts', patterns: ["'map'", "'registry.snapshot'"] },
    { label: 'policy.json', file: 'packages/mcp-server/src/security/policy.json', patterns: ['"tool": "map"', '"tool": "registry.snapshot"'] },
    { label: 'generated.ts', file: 'packages/mcp-server/src/schemas/generated.ts', patterns: ['// Source: map.input.json', '// Source: registry.snapshot.input.json'] },
    { label: 'tool-descriptions.json', file: 'packages/mcp-adapter/tool-descriptions.json', patterns: ['"map"', '"registry.snapshot"'] },
    { label: 'server index', file: 'packages/mcp-server/src/index.ts', patterns: ["'map': {", "'registry.snapshot': {"] },
    { label: 'error registry', file: 'packages/mcp-server/src/errors/registry.ts', patterns: ['OODS-V201', 'OODS-N014'] },
  ];

  for (const entry of requiredMentions) {
    it(`wires both tools into ${entry.label}`, () => {
      const source = read(entry.file);
      for (const pattern of entry.patterns) {
        expect(source).toContain(pattern);
      }
    });
  }
});

// sprint-109 m05: viz.render must be wired into EVERY registration + policy
// surface so the stdio adapter and the :4466 bridge expose/authorize it
// identically (the two-policy-layer convention, #622). A single-layer gap here
// is the exact failure this guard exists to catch.
describe('viz.render registration audit (sprint-109 m05)', () => {
  const vizRenderMentions: Array<{ label: string; file: string; pattern: string }> = [
    { label: 'server dispatch (index.ts)', file: 'packages/mcp-server/src/index.ts', pattern: "'viz.render': {" },
    { label: 'registry.json (enablement)', file: 'packages/mcp-server/src/tools/registry.json', pattern: '"viz.render"' },
    { label: 'registry.ts FALLBACK', file: 'packages/mcp-server/src/tools/registry.ts', pattern: "'viz.render'" },
    { label: 'server-layer policy.json', file: 'packages/mcp-server/src/security/policy.json', pattern: '"tool": "viz.render"' },
    { label: 'agent-layer configs/agent/policy.json', file: 'configs/agent/policy.json', pattern: '"name": "viz.render"' },
    { label: 'mcp-adapter tool-descriptions.json', file: 'packages/mcp-adapter/tool-descriptions.json', pattern: '"viz.render"' },
    { label: 'generated.ts (typed contract)', file: 'packages/mcp-server/src/schemas/generated.ts', pattern: '// Source: viz.render.input.json' },
  ];

  for (const entry of vizRenderMentions) {
    it(`registers viz.render in ${entry.label}`, () => {
      expect(read(entry.file)).toContain(entry.pattern);
    });
  }

  it('exposes viz.render on BOTH policy layers (two-layer convention #622)', () => {
    expect(read('packages/mcp-server/src/security/policy.json')).toContain('"tool": "viz.render"');
    expect(read('configs/agent/policy.json')).toContain('"name": "viz.render"');
  });
});

// sprint-113 m05: dashboard.render must be wired into the same surfaces as
// viz.render (Option C composes it on top), or the stdio adapter and the :4466
// bridge would expose/authorize it inconsistently. generated.ts is the typed site
// (regenerated via @oods/schemas-tools, never hand-edited).
describe('dashboard.render registration audit (sprint-113 m05)', () => {
  const dashboardRenderMentions: Array<{ label: string; file: string; pattern: string }> = [
    { label: 'server dispatch (index.ts)', file: 'packages/mcp-server/src/index.ts', pattern: "'dashboard.render': {" },
    { label: 'registry.json (enablement)', file: 'packages/mcp-server/src/tools/registry.json', pattern: '"dashboard.render"' },
    { label: 'registry.ts FALLBACK', file: 'packages/mcp-server/src/tools/registry.ts', pattern: "'dashboard.render'" },
    { label: 'server-layer policy.json', file: 'packages/mcp-server/src/security/policy.json', pattern: '"tool": "dashboard.render"' },
    { label: 'agent-layer configs/agent/policy.json', file: 'configs/agent/policy.json', pattern: '"name": "dashboard.render"' },
    { label: 'mcp-adapter tool-descriptions.json', file: 'packages/mcp-adapter/tool-descriptions.json', pattern: '"dashboard.render"' },
    { label: 'generated.ts (typed contract)', file: 'packages/mcp-server/src/schemas/generated.ts', pattern: '// Source: dashboard.render.input.json' },
  ];

  for (const entry of dashboardRenderMentions) {
    it(`registers dashboard.render in ${entry.label}`, () => {
      expect(read(entry.file)).toContain(entry.pattern);
    });
  }

  it('exposes dashboard.render on BOTH policy layers (two-layer convention #622)', () => {
    expect(read('packages/mcp-server/src/security/policy.json')).toContain('"tool": "dashboard.render"');
    expect(read('configs/agent/policy.json')).toContain('"name": "dashboard.render"');
  });
});

// sprint-181 m02: brand.intake must be wired into the same surfaces as the
// s113 dashboard.render registration guard. Keeping them in one audit
// prevents a new advertised tool from landing on only one policy/adapter layer.
describe('brand.intake registration audit (s181 m02)', () => {
  const brandIntakeMentions: Array<{ label: string; file: string; pattern: string }> = [
    { label: 'server dispatch (index.ts)', file: 'packages/mcp-server/src/index.ts', pattern: "'brand.intake': {" },
    { label: 'registry.json (enablement)', file: 'packages/mcp-server/src/tools/registry.json', pattern: '"brand.intake"' },
    { label: 'registry.ts FALLBACK', file: 'packages/mcp-server/src/tools/registry.ts', pattern: "'brand.intake'" },
    { label: 'server-layer policy.json', file: 'packages/mcp-server/src/security/policy.json', pattern: '"tool": "brand.intake"' },
    { label: 'agent-layer configs/agent/policy.json', file: 'configs/agent/policy.json', pattern: '"name": "brand.intake"' },
    { label: 'mcp-adapter tool-descriptions.json', file: 'packages/mcp-adapter/tool-descriptions.json', pattern: '"brand.intake"' },
    { label: 'generated.ts (typed contract)', file: 'packages/mcp-server/src/schemas/generated.ts', pattern: '// Source: brand.intake.input.json' },
  ];

  for (const entry of brandIntakeMentions) {
    it(`registers brand.intake in ${entry.label}`, () => {
      expect(read(entry.file)).toContain(entry.pattern);
    });
  }

  it('exposes brand.intake on BOTH policy layers (two-layer convention #622)', () => {
    expect(read('packages/mcp-server/src/security/policy.json')).toContain('"tool": "brand.intake"');
    expect(read('configs/agent/policy.json')).toContain('"name": "brand.intake"');
  });
});

// s196: bridge names now derive only from the required agent policy and server
// registry. Exercise that intersection instead of retaining a second literal roster.
it('exposes the audited tools through the required bridge policy and live registry', () => {
  const surface = resolveBridgeToolSurface(path.join(ROOT, 'packages/mcp-server'), bridgeConfig.tools.allowed, { MCP_TOOLSET: 'default', MCP_EXTRA_TOOLS: '' });
  expect(surface.enabled).toEqual(expect.arrayContaining(['map', 'registry.snapshot', 'viz.render', 'dashboard.render', 'brand.intake']));
  expect(read('packages/mcp-bridge/src/config.ts')).not.toContain('FALLBACK_POLICY');
});
