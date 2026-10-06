import type { SchemaMetadata } from '../../schema-store/types.js';
import { SchemaStore } from '../../schema-store/index.js';
import { ToolError } from '../../errors/tool-error.js';

export type SchemaDeleteInput = {
  name: string;
};

export type SchemaDeleteOutput = {
  deleted: true;
  schema: SchemaMetadata;
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

export async function handle(input: SchemaDeleteInput): Promise<SchemaDeleteOutput> {
  if (!input.name?.trim()) {
    throw new ToolError('OODS-V003', 'name is required.', { field: 'name' });
  }
  if (!NAME_PATTERN.test(input.name)) {
    throw new ToolError('OODS-V004', 'name must use slug format: letters, numbers, hyphens, and underscores only.', { field: 'name', value: input.name });
  }

  const store = getStore();
  try {
    const deleted = await store.delete(input.name);
    return {
      deleted: true,
      schema: deleted,
    };
  } catch (error) {
    const message = String((error as Error)?.message ?? error);
    if (/not found/i.test(message)) {
      throw new ToolError('OODS-N002', `Schema "${input.name}" not found. Use schema_list to see available schema names.`, { name: input.name });
    }
    throw error;
  }
}
