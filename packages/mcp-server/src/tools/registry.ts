import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type ToolRegistry = {
  auto: string[];
  onDemand: string[];
};

export type ResolvedToolRegistry = {
  auto: string[];
  onDemand: string[];
  enabled: string[];
  unknownExtras: string[];
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = path.join(__dirname, 'registry.json');

const FALLBACK_REGISTRY: ToolRegistry = {
  auto: [
    'tokens.build',
    'structuredData.fetch',
    'brand.apply',
    'brand.intake',
    'catalog.list',
    'code.generate',
    'design.compose',
    'design.preview',
    'pipeline',
    'health',
    'registry.snapshot',
    'viz.render',
    'dashboard.render',
    'artifact.certify',
    'fidelity.preview',
    'map',
    'schema',
    'object',
    'object.import',
    'repl',
  ],
  onDemand: [
    'a11y.scan',
  ],
};

function parseList(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function loadToolRegistry(): ToolRegistry {
  try {
    const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
    const parsed = JSON.parse(raw) as ToolRegistry;
    return {
      auto: Array.isArray(parsed.auto) ? parsed.auto : [],
      onDemand: Array.isArray(parsed.onDemand) ? parsed.onDemand : [],
    };
  } catch {
    return FALLBACK_REGISTRY;
  }
}

export function resolveToolRegistry(env: NodeJS.ProcessEnv = process.env): ResolvedToolRegistry {
  const registry = loadToolRegistry();
  const toolset = (env.MCP_TOOLSET || 'default').toLowerCase();
  const extra = parseList(env.MCP_EXTRA_TOOLS);

  const auto = new Set(registry.auto);
  const onDemand = new Set(registry.onDemand);
  const enabled = new Set(auto);

  if (toolset === 'all') {
    for (const name of onDemand) {
      enabled.add(name);
    }
  }

  const unknownExtras: string[] = [];
  for (const name of extra) {
    if (auto.has(name) || onDemand.has(name)) {
      enabled.add(name);
    } else {
      unknownExtras.push(name);
    }
  }

  return {
    auto: Array.from(auto).sort(),
    onDemand: Array.from(onDemand).sort(),
    enabled: Array.from(enabled).sort(),
    unknownExtras,
  };
}
