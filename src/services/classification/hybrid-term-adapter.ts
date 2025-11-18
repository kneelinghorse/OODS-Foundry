import type {
  DatabaseDialect,
  QueryResult,
} from '@/services/classification/ltree-query-service.js';
import { normalizeTerm, TermSchema, type Term, type TermInput } from '@/schemas/classification/term.js';
import {
  normalizeTermTaxonomyEntry,
  TermTaxonomySchema,
  type TermTaxonomyEntry,
  type TermTaxonomyInput,
} from '@/schemas/classification/term-taxonomy.js';
import {
  normalizeTermRelationship,
  TermRelationshipSchema,
  type TermRelationship,
  type TermRelationshipInput,
} from '@/schemas/classification/term-relationship.js';
import type { TermTaxonomyType } from '@/schemas/classification/constants.js';
import TimeService from '@/services/time/index.js';

export interface HybridBridgeClient {
  query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<QueryResult<T>>;
}

export interface HybridTermAdapterOptions {
  readonly dialect?: DatabaseDialect;
  readonly termsTable?: string;
  readonly taxonomyTable?: string;
  readonly relationshipsTable?: string;
}

export interface HybridEntryOptions {
  readonly tenantId: string;
  readonly slug: string;
  readonly name: string;
  readonly taxonomy: TermTaxonomyType;
  readonly categoryId?: string;
  readonly tagId?: string;
  readonly parentTermTaxonomyId?: string | null;
  readonly hierarchyPath?: string | readonly string[] | null;
  readonly depth?: number;
  readonly description?: string;
  readonly language?: string;
  readonly termMetadata?: Record<string, unknown>;
  readonly taxonomyMetadata?: Record<string, unknown>;
}

export interface HybridEntryResult {
  readonly term: Term;
  readonly taxonomy: TermTaxonomyEntry;
}

interface QueryPayload {
  sql: string;
  params: unknown[];
}

export class HybridTermAdapter {
  private readonly dialect: DatabaseDialect;
  private readonly termsTable: string;
  private readonly taxonomyTable: string;
  private readonly relationshipsTable: string;

  constructor(
    private readonly client: HybridBridgeClient,
    options: HybridTermAdapterOptions = {}
  ) {
    this.dialect = options.dialect ?? 'postgres';
    this.termsTable = options.termsTable ?? 'classification.terms';
    this.taxonomyTable = options.taxonomyTable ?? 'classification.term_taxonomy';
    this.relationshipsTable = options.relationshipsTable ?? 'classification.term_relationships';
  }

  async ensureEntry(options: HybridEntryOptions): Promise<HybridEntryResult> {
    const term = await this.ensureTerm({
      tenantId: options.tenantId,
      slug: options.slug,
      name: options.name,
      description: options.description,
      language: options.language,
      metadata: options.termMetadata,
    });

    if (!term.id) {
      throw new Error('Term upsert did not return an identifier.');
    }

    const taxonomy = await this.upsertTaxonomy({
      tenantId: options.tenantId,
      termId: term.id,
      taxonomy: options.taxonomy,
      categoryId: options.categoryId,
      tagId: options.tagId,
      parentId: options.parentTermTaxonomyId ?? null,
      hierarchyPath: options.hierarchyPath ?? null,
      depth: options.depth,
      metadata: options.taxonomyMetadata,
    });

    return { term, taxonomy };
  }

  async ensureTerm(input: TermInput): Promise<Term> {
    const normalized = normalizeTerm(input);
    const payload = this.buildTermUpsert(normalized);
    const result = await this.client.query<Record<string, unknown>>(payload.sql, payload.params);
    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to upsert canonical term.');
    }
    return this.parseTermRow(row);
  }

  async upsertTaxonomy(input: TermTaxonomyInput): Promise<TermTaxonomyEntry> {
    const normalized = normalizeTermTaxonomyEntry(input);
    const payload = this.buildTaxonomyUpsert(normalized);
    const result = await this.client.query<Record<string, unknown>>(payload.sql, payload.params);
    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to upsert term taxonomy entry.');
    }
    return this.parseTaxonomyRow(row);
  }

  async assignRelationship(input: TermRelationshipInput): Promise<TermRelationship> {
    const normalized = normalizeTermRelationship(input);
    const payload = this.buildRelationshipUpsert(normalized);
    const result = await this.client.query<Record<string, unknown>>(payload.sql, payload.params);
    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to save term relationship.');
    }
    return this.parseRelationshipRow(row);
  }

  private buildTermUpsert(term: Term): QueryPayload {
    const params: unknown[] = [];
    const tenantParam = this.pushParam(params, term.tenantId);
    const slugParam = this.pushParam(params, term.slug);
    const nameParam = this.pushParam(params, term.name);
    const descriptionParam = this.pushParam(params, term.description ?? null);
    const languageParam = this.pushParam(params, term.language ?? null);
    const metadataParam = this.pushParam(params, this.serializeMetadata(term.metadata));

    const sql = `
      INSERT INTO ${this.termsTable} (tenant_id, slug, name, description, language, metadata)
      VALUES (${tenantParam}, ${slugParam}, ${nameParam}, ${descriptionParam}, ${languageParam}, ${this.cast(
      metadataParam,
      'jsonb'
    )})
      ON CONFLICT (tenant_id, slug) DO UPDATE
        SET name = EXCLUDED.name,
            description = EXCLUDED.description,
            language = EXCLUDED.language,
            metadata = EXCLUDED.metadata
      RETURNING term_id, tenant_id, slug, name, description, language, metadata, created_at, updated_at;
    `;

    return { sql: this.minify(sql), params };
  }

  private buildTaxonomyUpsert(entry: TermTaxonomyEntry): QueryPayload {
    const params: unknown[] = [];
    const tenantParam = this.pushParam(params, entry.tenantId);
    const termParam = this.pushParam(params, entry.termId);
    const taxonomyParam = this.pushParam(params, entry.taxonomy);
    const categoryParam = this.pushParam(params, entry.categoryId ?? null);
    const tagParam = this.pushParam(params, entry.tagId ?? null);
    const parentParam = this.pushParam(params, entry.parentId ?? null);
    const depthParam = this.pushParam(params, entry.depth);
    const metadataParam = this.pushParam(params, this.serializeMetadata(entry.metadata));
    const hierarchyParam = entry.hierarchyPath ? this.pushParam(params, entry.hierarchyPath) : null;
    const hierarchyExpr = entry.hierarchyPath ? this.hierarchyExpression(hierarchyParam) : 'NULL';

    const sql = `
      INSERT INTO ${this.taxonomyTable}
        (tenant_id, term_id, taxonomy, category_id, tag_id, parent_term_taxonomy_id, hierarchy_path, depth, metadata)
      VALUES (
        ${tenantParam},
        ${termParam},
        ${taxonomyParam},
        ${categoryParam},
        ${tagParam},
        ${parentParam},
        ${hierarchyExpr},
        ${depthParam},
        ${this.cast(metadataParam, 'jsonb')}
      )
      ON CONFLICT (tenant_id, term_id, taxonomy) DO UPDATE SET
        category_id = EXCLUDED.category_id,
        tag_id = EXCLUDED.tag_id,
        parent_term_taxonomy_id = EXCLUDED.parent_term_taxonomy_id,
        hierarchy_path = EXCLUDED.hierarchy_path,
        depth = EXCLUDED.depth,
        metadata = EXCLUDED.metadata
      RETURNING term_taxonomy_id,
                tenant_id,
                term_id,
                taxonomy,
                category_id,
                tag_id,
                parent_term_taxonomy_id,
                hierarchy_path,
                depth,
                relationship_count,
                metadata,
                created_at,
                updated_at;
    `;

    return { sql: this.minify(sql), params };
  }

  private buildRelationshipUpsert(entry: TermRelationship): QueryPayload {
    const params: unknown[] = [];
    const tenantParam = this.pushParam(params, entry.tenantId);
    const typeParam = this.pushParam(params, entry.objectType);
    const objectParam = this.pushParam(params, entry.objectId);
    const taxonomyParam = this.pushParam(params, entry.termTaxonomyId);
    const fieldParam = this.pushParam(params, entry.field ?? null);

    const sql = `
      INSERT INTO ${this.relationshipsTable}
        (tenant_id, object_type, object_id, term_taxonomy_id, field)
      VALUES (${tenantParam}, ${typeParam}, ${objectParam}, ${taxonomyParam}, ${fieldParam})
      ON CONFLICT (tenant_id, object_type, object_id, term_taxonomy_id) DO UPDATE SET
        field = COALESCE(EXCLUDED.field, ${this.relationshipsTable}.field)
      RETURNING tenant_id,
                object_type,
                object_id,
                term_taxonomy_id,
                field,
                created_at;
    `;

    return { sql: this.minify(sql), params };
  }

  private parseTermRow(row: Record<string, unknown>): Term {
    return TermSchema.parse({
      id: (row.term_id as string | undefined) ?? (row.id as string | undefined),
      tenantId: row.tenant_id as string,
      slug: row.slug as string,
      name: row.name as string,
      description: this.coerceNullableString(row.description),
      language: this.coerceNullableString(row.language),
      metadata: this.parseMetadata(row.metadata),
      createdAt: this.coerceTimestamp((row.created_at as string | undefined) ?? (row.createdAt as string | undefined)),
      updatedAt: this.coerceTimestamp((row.updated_at as string | undefined) ?? (row.updatedAt as string | undefined)),
    });
  }

  private parseTaxonomyRow(row: Record<string, unknown>): TermTaxonomyEntry {
    return TermTaxonomySchema.parse({
      id: (row.term_taxonomy_id as string | undefined) ?? (row.id as string | undefined),
      tenantId: row.tenant_id as string,
      termId: row.term_id as string,
      taxonomy: row.taxonomy as TermTaxonomyType,
      categoryId: (row.category_id as string | null | undefined) ?? null,
      tagId: (row.tag_id as string | null | undefined) ?? null,
      parentId: (row.parent_term_taxonomy_id as string | null | undefined) ?? null,
      hierarchyPath: (row.hierarchy_path as string | null | undefined) ?? null,
      depth: this.coerceNumber(row.depth, 0),
      relationshipCount: this.coerceNumber(row.relationship_count, 0),
      metadata: this.parseMetadata(row.metadata),
      createdAt: this.coerceTimestamp((row.created_at as string | undefined) ?? undefined),
      updatedAt: this.coerceTimestamp((row.updated_at as string | undefined) ?? undefined),
    });
  }

  private parseRelationshipRow(row: Record<string, unknown>): TermRelationship {
    return TermRelationshipSchema.parse({
      tenantId: row.tenant_id as string,
      objectType: row.object_type as string,
      objectId: row.object_id as string,
      termTaxonomyId: row.term_taxonomy_id as string,
      field: (row.field as string | null | undefined) ?? undefined,
      createdAt: this.coerceTimestamp((row.created_at as string | undefined) ?? undefined),
    });
  }

  private pushParam(params: unknown[], value: unknown): string {
    params.push(value);
    if (this.dialect === 'postgres') {
      return `$${params.length}`;
    }
    return '?';
  }

  private cast(placeholder: string, type: string): string {
    return this.dialect === 'postgres' ? `${placeholder}::${type}` : placeholder;
  }

  private hierarchyExpression(placeholder: string | null): string {
    if (!placeholder) {
      return 'NULL';
    }
    return this.dialect === 'postgres' ? `text2ltree(${placeholder})` : placeholder;
  }

  private serializeMetadata(metadata?: Record<string, unknown>): string {
    if (!metadata || Object.keys(metadata).length === 0) {
      return '{}';
    }
    return JSON.stringify(metadata);
  }

  private parseMetadata(value: unknown): Record<string, unknown> | undefined {
    if (value === null || typeof value === 'undefined') {
      return undefined;
    }
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return undefined;
      }
    }
    if (typeof value === 'object') {
      return value as Record<string, unknown>;
    }
    return undefined;
  }

  private minify(sql: string): string {
    return sql.replace(/\s+/g, ' ').trim();
  }

  private coerceNullableString(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    return undefined;
  }

  private coerceTimestamp(value: string | undefined): string | undefined {
    if (!value) {
      return undefined;
    }
    if (value.includes('T')) {
      return value;
    }
    const candidate = `${value.replace(' ', 'T')}Z`;
    try {
      const normalized = TimeService.normalizeToUtc(candidate);
      const iso = normalized.toISO();
      return iso ?? undefined;
    } catch {
      return undefined;
    }
  }

  private coerceNumber(value: unknown, fallback: number): number {
    const numeric = typeof value === 'number' ? value : Number(value ?? NaN);
    return Number.isFinite(numeric) ? numeric : fallback;
  }
}
