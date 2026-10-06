/**
 * OodsClient — typed wrapper around MCP tool calls.
 *
 * Constructor accepts optional transport config. Defaults to auto-detection
 * (stdio if MCP-capable, HTTP if OODS_BRIDGE_URL is set).
 */

import { createTransport, type Transport, type TransportOptions } from './transport.js';
import type {
  DesignComposeInput,
  DesignComposeOutput,
  PipelineInput,
  PipelineOutput,
  CodeGenerateInput,
  CodeGenerateOutput,
  CatalogListInput,
  CatalogListOutput,
  ObjectListInput,
  ObjectListOutput,
  ObjectShowInput,
  ObjectShowOutput,
  SchemaListInput,
  SchemaListOutput,
  SchemaLoadInput,
  SchemaLoadOutput,
  SchemaSaveInput,
  SchemaSaveOutput,
  SchemaDeleteInput,
  SchemaDeleteOutput,
  MapCreateInput,
  MapCreateOutput,
  MapListInput,
  MapListOutput,
  MapResolveInput,
  MapResolveOutput,
  MapUpdateInput,
  MapUpdateOutput,
  MapDeleteInput,
  MapDeleteOutput,
  StructuredDataFetchInput,
  StructuredDataFetchOutput,
  TokensBuildInput,
  GenericOutput,
  BrandApplyInput,
} from './types.js';

export interface OodsClientOptions {
  transport?: TransportOptions;
}

export class OodsClient {
  private transport: Transport;

  readonly schema: SchemaNamespace;
  readonly objects: ObjectsNamespace;
  readonly maps: MapsNamespace;

  constructor(options?: OodsClientOptions) {
    this.transport = createTransport(options?.transport);
    this.schema = new SchemaNamespace(this);
    this.objects = new ObjectsNamespace(this);
    this.maps = new MapsNamespace(this);
  }

  /** Low-level tool call. */
  async call<T = unknown>(tool: string, input: Record<string, unknown> = {}): Promise<T> {
    return this.transport.call<T>(tool, input);
  }

  /** Health check. */
  async health(): Promise<{ status: string }> {
    return this.call<{ status: string }>('health', {});
  }

  /** Compose a UI schema from intent, object, and layout preferences. */
  async compose(input: DesignComposeInput): Promise<DesignComposeOutput> {
    return this.call<DesignComposeOutput>('design.compose', input as Record<string, unknown>);
  }

  /** Run the full pipeline: compose -> validate -> render -> codegen -> save. */
  async pipeline(input: PipelineInput): Promise<PipelineOutput> {
    return this.call<PipelineOutput>('pipeline', input as Record<string, unknown>);
  }

  /** Generate code from a UI schema. */
  async codegen(input: CodeGenerateInput): Promise<CodeGenerateOutput> {
    return this.call<CodeGenerateOutput>('code.generate', input as Record<string, unknown>);
  }

  /** List components in the catalog. */
  async catalogList(input: CatalogListInput = {}): Promise<CatalogListOutput> {
    return this.call<CatalogListOutput>('catalog.list', input as Record<string, unknown>);
  }

  /** Fetch structured data (components, tokens, manifest). */
  async structuredData(input: StructuredDataFetchInput): Promise<StructuredDataFetchOutput> {
    return this.call<StructuredDataFetchOutput>('structuredData.fetch', input as Record<string, unknown>);
  }

  /** Build tokens. */
  async tokensBuild(input: TokensBuildInput = {}): Promise<GenericOutput> {
    return this.call<GenericOutput>('tokens.build', input as Record<string, unknown>);
  }

  /** Apply brand overlays. */
  async brandApply(input: BrandApplyInput): Promise<GenericOutput> {
    return this.call<GenericOutput>('brand.apply', input as Record<string, unknown>);
  }

  /** Close the transport (if it supports cleanup). */
  async close(): Promise<void> {
    await this.transport.close?.();
  }
}

class SchemaNamespace {
  constructor(private client: OodsClient) {}

  async save(input: SchemaSaveInput): Promise<SchemaSaveOutput> {
    return this.client.call<SchemaSaveOutput>('schema', { action: 'save', ...(input as Record<string, unknown>) });
  }

  async load(input: SchemaLoadInput): Promise<SchemaLoadOutput> {
    return this.client.call<SchemaLoadOutput>('schema', { action: 'load', ...(input as Record<string, unknown>) });
  }

  async list(input: SchemaListInput = {}): Promise<SchemaListOutput> {
    return this.client.call<SchemaListOutput>('schema', { action: 'list', ...(input as Record<string, unknown>) });
  }

  async delete(input: SchemaDeleteInput): Promise<SchemaDeleteOutput> {
    return this.client.call<SchemaDeleteOutput>('schema', { action: 'delete', ...(input as Record<string, unknown>) });
  }
}

class ObjectsNamespace {
  constructor(private client: OodsClient) {}

  async list(input: ObjectListInput = {}): Promise<ObjectListOutput> {
    return this.client.call<ObjectListOutput>('object', { action: 'list', ...(input as Record<string, unknown>) });
  }

  async show(input: ObjectShowInput): Promise<ObjectShowOutput> {
    return this.client.call<ObjectShowOutput>('object', { action: 'show', ...(input as Record<string, unknown>) });
  }
}

class MapsNamespace {
  constructor(private client: OodsClient) {}

  async create(input: MapCreateInput): Promise<MapCreateOutput> {
    return this.client.call<MapCreateOutput>('map', { action: 'create', ...(input as Record<string, unknown>) });
  }

  async list(input: MapListInput = {}): Promise<MapListOutput> {
    return this.client.call<MapListOutput>('map', { action: 'list', ...(input as Record<string, unknown>) });
  }

  async resolve(input: MapResolveInput): Promise<MapResolveOutput> {
    return this.client.call<MapResolveOutput>('map', { action: 'resolve', ...(input as Record<string, unknown>) });
  }

  async update(input: MapUpdateInput): Promise<MapUpdateOutput> {
    return this.client.call<MapUpdateOutput>('map', { action: 'update', ...(input as Record<string, unknown>) });
  }

  async delete(input: MapDeleteInput): Promise<MapDeleteOutput> {
    return this.client.call<MapDeleteOutput>('map', { action: 'delete', ...(input as Record<string, unknown>) });
  }
}
