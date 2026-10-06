import fs from 'node:fs';
import path from 'node:path';

type ToolRegistry = {
  auto: string[];
  onDemand: string[];
};

export type BridgeToolSurface = {
  auto: string[];
  onDemand: string[];
  enabled: string[];
  extraTools: string[];
  unknownExtras: string[];
  toolsetMode: 'default' | 'all';
  registrySource: string;
};

function parseList(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function loadServerToolRegistry(serverCwd: string): { registry: ToolRegistry; source: string } {
  const candidates = [
    path.join(serverCwd, 'dist', 'tools', 'registry.json'),
    path.join(serverCwd, 'src', 'tools', 'registry.json'),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const raw = fs.readFileSync(candidate, 'utf8');
    const parsed = JSON.parse(raw) as ToolRegistry;
    return {
      registry: {
        auto: Array.isArray(parsed.auto) ? parsed.auto : [],
        onDemand: Array.isArray(parsed.onDemand) ? parsed.onDemand : [],
      },
      source: candidate,
    };
  }

  return {
    registry: { auto: [], onDemand: [] },
    source: candidates[0],
  };
}

export function resolveBridgeToolSurface(
  serverCwd: string,
  policyAllowed: Iterable<string>,
  env: NodeJS.ProcessEnv = process.env,
): BridgeToolSurface {
  const { registry, source } = loadServerToolRegistry(serverCwd);
  const toolsetMode = (env.MCP_TOOLSET || 'default').toLowerCase() === 'all' ? 'all' : 'default';
  const extraTools = parseList(env.MCP_EXTRA_TOOLS);

  const auto = new Set(registry.auto);
  const onDemand = new Set(registry.onDemand);
  const enabled = new Set(auto);

  if (toolsetMode === 'all') {
    for (const name of onDemand) {
      enabled.add(name);
    }
  }

  const unknownExtras: string[] = [];
  for (const name of extraTools) {
    if (auto.has(name) || onDemand.has(name)) {
      enabled.add(name);
    } else {
      unknownExtras.push(name);
    }
  }

  const allowed = new Set(policyAllowed);

  return {
    auto: Array.from(auto).sort(),
    onDemand: Array.from(onDemand).sort(),
    enabled: Array.from(enabled).filter((name) => allowed.has(name)).sort(),
    extraTools,
    unknownExtras,
    toolsetMode,
    registrySource: source,
  };
}
