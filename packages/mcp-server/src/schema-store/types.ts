import type { UiSchema } from '../schemas/generated.js';

export const DEFAULT_SCHEMA_STORE_DIR = '.oods/schemas';
export const SCHEMA_STORE_INDEX_FILE = '_index.json';

export type SchemaRecord = {
  name: string;
  schemaRef: string;
  schema: UiSchema;
  object?: string;
  context?: string;
  version: number;
  author?: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
};

export type SchemaMetadata = Omit<SchemaRecord, 'schema'>;

export type SchemaStoreIndex = {
  version: 1;
  updatedAt: string;
  schemas: SchemaMetadata[];
};

export type SchemaSaveInput = {
  name: string;
  schemaRef?: string;
  schema?: UiSchema;
  object?: string;
  context?: string;
  author?: string;
  tags?: string[];
};

export type SchemaListFilters = {
  object?: string;
  context?: string;
  tags?: string[];
};

export type SchemaStoreOptions = {
  projectRoot?: string;
  storeDir?: string;
};
