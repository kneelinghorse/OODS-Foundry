import type { SchemaMetadata } from '../../schema-store/types.js';
import { SchemaStore } from '../../schema-store/index.js';

export type SchemaListInput = {
  object?: string;
  context?: string;
  tags?: string[];
};

export type SchemaListOutput = SchemaMetadata[];

function normalizeTags(tags: string[] | undefined): string[] | undefined {
  if (!tags?.length) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    const clean = tag.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out.length ? out : undefined;
}

function getStore(): SchemaStore {
  const projectRoot = process.env.MCP_SCHEMA_STORE_ROOT;
  const storeDir = process.env.MCP_SCHEMA_STORE_DIR;
  return new SchemaStore({
    ...(projectRoot ? { projectRoot } : {}),
    ...(storeDir ? { storeDir } : {}),
  });
}

export async function handle(input: SchemaListInput): Promise<SchemaListOutput> {
  const store = getStore();
  return store.list({
    object: input.object?.trim() || undefined,
    context: input.context?.trim() || undefined,
    tags: normalizeTags(input.tags),
  });
}
