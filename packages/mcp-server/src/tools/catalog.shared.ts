import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withinAllowed } from '../lib/security.js';
import { ToolError } from '../errors/tool-error.js';
import { withLiveRegistry } from '../lib/live-registry.js';

type ManifestArtifact = {
  name?: string;
  path?: string;
  file?: string;
  etag?: string;
  sizeBytes?: number;
};

type ManifestDoc = {
  generatedAt?: string;
  version?: string;
  artifacts?: ManifestArtifact[];
};

export type ComponentsDatasetLike = {
  stats?: { componentCount?: number | null } | null;
  components?: unknown[] | null;
};

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const ARTIFACT_DIR = path.join(REPO_ROOT, 'artifacts', 'structured-data');
const MANIFEST_PATH = path.join(ARTIFACT_DIR, 'manifest.json');

function readJson<T = Record<string, unknown>>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function sanitizeManifestFile(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ToolError('OODS-S016', 'Manifest file entry is empty');
  }
  if (path.isAbsolute(trimmed) || trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new ToolError('OODS-S017', `Manifest file entry is not a safe filename: ${trimmed}`, { filename: trimmed });
  }
  return trimmed;
}

export function getLatestComponentsFile(): string {
  try {
    const manifest = readJson<ManifestDoc>(MANIFEST_PATH);
    const componentsArtifact = manifest.artifacts?.find((a) => a.name === 'components');

    if (!componentsArtifact?.file) {
      throw new ToolError('OODS-N007', 'Components artifact not found in manifest', { artifact: 'components' });
    }

    const filename = sanitizeManifestFile(componentsArtifact.file);
    const fullPath = path.join(ARTIFACT_DIR, filename);
    if (!withinAllowed(ARTIFACT_DIR, fullPath)) {
      throw new ToolError('OODS-S015', `Components artifact file resolves outside artifact dir: ${filename}`, { filename });
    }

    if (!fs.existsSync(fullPath)) {
      throw new ToolError('OODS-N007', `Components artifact file not found: ${filename}`, { artifact: 'components', filename });
    }

    return fullPath;
  } catch (error) {
    throw new ToolError('OODS-S005', `Failed to locate components file: ${(error as Error).message}`);
  }
}

export function readComponentsDataset<T = Record<string, unknown>>(): T {
  const componentsFilePath = getLatestComponentsFile();
  return withLiveRegistry(readJson(componentsFilePath)) as T;
}

export function resolveComponentCount(dataset: ComponentsDatasetLike): number {
  if (Array.isArray(dataset?.components)) {
    const componentIds = new Set<string>();
    for (const row of dataset.components) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
      const id = (row as { id?: unknown }).id;
      if (typeof id === 'string' && id.length > 0) {
        componentIds.add(id);
      }
    }
    return componentIds.size;
  }

  const count = dataset?.stats?.componentCount;
  if (typeof count === 'number' && Number.isFinite(count)) {
    return count;
  }
  return 0;
}
