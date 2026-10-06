import type { SchemaRecord } from '../../schema-store/types.js';
import { SchemaStore } from '../../schema-store/index.js';
import { ToolError } from '../../errors/tool-error.js';

export type SchemaLoadInput = {
  name: string;
};

export type SchemaLoadOutput = {
  schemaRef: string;
  name: string;
  version: number;
  object?: string;
  context?: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
};

const NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

function getStore(): SchemaStore {
  const projectRoot = process.env.MCP_SCHEMA_STORE_ROOT;
  const storeDir = process.env.MCP_SCHEMA_STORE_DIR;
  return new SchemaStore({
    ...(projectRoot ? { projectRoot } : {}),
    ...(storeDir ? { storeDir } : {}),
  });
}

function toOutput(record: SchemaRecord): SchemaLoadOutput {
  return {
    schemaRef: record.schemaRef,
    name: record.name,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    tags: record.tags,
    ...(record.object ? { object: record.object } : {}),
    ...(record.context ? { context: record.context } : {}),
    ...(record.author ? { author: record.author } : {}),
  };
}

/** Simple Levenshtein distance for typo suggestions. */
function levenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  const dp: number[][] = Array.from({ length: la + 1 }, () => Array(lb + 1).fill(0));
  for (let i = 0; i <= la; i += 1) dp[i][0] = i;
  for (let j = 0; j <= lb; j += 1) dp[0][j] = j;
  for (let i = 1; i <= la; i += 1) {
    for (let j = 1; j <= lb; j += 1) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[la][lb];
}

async function closestSchemaName(store: SchemaStore, name: string): Promise<string | undefined> {
  const all = await store.list();
  if (!all.length) return undefined;

  const lower = name.toLowerCase();
  const scored = all.map((entry) => ({
    name: entry.name,
    distance: levenshtein(lower, entry.name.toLowerCase()),
  }));
  scored.sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name));

  const best = scored[0];
  if (!best) return undefined;
  const threshold = Math.max(2, Math.floor(name.length / 3));
  return best.distance <= threshold ? best.name : undefined;
}

export async function handle(input: SchemaLoadInput): Promise<SchemaLoadOutput> {
  if (!input.name?.trim()) {
    throw new ToolError('OODS-V003', 'name is required.', { field: 'name' });
  }
  if (!NAME_PATTERN.test(input.name)) {
    throw new ToolError('OODS-V004', 'name must use slug format: letters, numbers, hyphens, and underscores only.', { field: 'name', value: input.name });
  }

  const store = getStore();
  try {
    const loaded = await store.load(input.name);
    return toOutput(loaded);
  } catch (error) {
    const message = String((error as Error)?.message ?? error);
    if (/not found/i.test(message)) {
      const suggestion = await closestSchemaName(store, input.name);
      if (suggestion) {
        throw new ToolError('OODS-N002', `Schema "${input.name}" not found. Did you mean "${suggestion}"?`, { name: input.name, suggestion });
      }
      throw new ToolError('OODS-N002', `Schema "${input.name}" not found. Use schema_list to see available schema names.`, { name: input.name });
    }
    throw error;
  }
}
