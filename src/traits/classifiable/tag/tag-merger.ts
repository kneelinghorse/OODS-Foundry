import { normalizeSlug } from '@/schemas/classification/utils.js';
import { normalizeTag, type Tag } from '@/schemas/classification/tag.js';
import TimeService from '@/services/time/index.js';

import type { SynonymMapper } from './synonym-mapper.js';

export interface TagRepository {
  list(): Promise<Tag[]>;
  findById(tagId: string): Promise<Tag | null>;
  findBySlug(slug: string): Promise<Tag | null>;
  save(tag: Tag): Promise<Tag>;
  delete(tagId: string): Promise<void>;
}

export interface TagRelationshipRepository {
  reassignTag(sourceTagId: string, targetTagId: string): Promise<number>;
}

export interface TagAuditLogEntry {
  readonly type: 'create' | 'synonym_added' | 'merge' | 'spam_flagged';
  readonly tagId?: string;
  readonly actor: string;
  readonly summary: string;
  readonly timestamp: string;
  readonly payload?: Record<string, unknown>;
}

export interface TagAuditLogger {
  log(entry: TagAuditLogEntry): Promise<void> | void;
}

export interface MergeRequest {
  readonly sourceTagId: string;
  readonly targetTagId: string;
  readonly actor?: string;
}

export interface MergeResult {
  readonly canonicalTag: Tag;
  readonly removedTagId: string;
  readonly affectedRelationships: number;
  readonly promotedSynonyms: readonly string[];
}

export interface TagMergerOptions {
  readonly repository: TagRepository;
  readonly relationships?: TagRelationshipRepository;
  readonly auditLogger?: TagAuditLogger;
  readonly synonymMapper?: SynonymMapper;
  readonly now?: () => Date;
}

export class TagMerger {
  private readonly repo: TagRepository;
  private readonly relationships?: TagRelationshipRepository;
  private readonly auditLogger?: TagAuditLogger;
  private readonly synonymMapper?: SynonymMapper;
  private readonly now: () => Date;

  constructor(options: TagMergerOptions) {
    this.repo = options.repository;
    this.relationships = options.relationships;
    this.auditLogger = options.auditLogger;
    this.synonymMapper = options.synonymMapper;
    this.now = options.now ?? (() => TimeService.nowSystem().toJSDate());
  }

  async merge(request: MergeRequest): Promise<MergeResult> {
    if (request.sourceTagId === request.targetTagId) {
      throw new Error('Source and target tags must be different.');
    }

    const [source, target] = await Promise.all([
      this.repo.findById(request.sourceTagId),
      this.repo.findById(request.targetTagId),
    ]);

    if (!source) {
      throw new Error(`Source tag ${request.sourceTagId} not found.`);
    }
    if (!target) {
      throw new Error(`Target tag ${request.targetTagId} not found.`);
    }
    if (target.isCanonical === false) {
      throw new Error('Cannot merge into a non-canonical tag.');
    }

    const promotedSynonyms = this.buildPromotedSynonyms(source, target);
    const mergedTag = normalizeTag({
      ...target,
      usageCount: target.usageCount + source.usageCount,
      synonyms: promotedSynonyms,
    });

    await this.repo.save(mergedTag);
    const affectedRelationships = await this.relationships?.reassignTag(source.id, target.id).catch((error) => {
      throw new Error(`Failed to reassign tag relationships: ${(error as Error).message}`);
    });

    await this.repo.delete(source.id);
    this.synonymMapper?.registerCanonical(mergedTag);

    await this.auditLogger?.log({
      type: 'merge',
      actor: request.actor ?? 'tag-merger',
      summary: `Merged tag ${source.slug} into ${target.slug}`,
      tagId: mergedTag.id,
      timestamp: this.now().toISOString(),
      payload: {
        sourceTagId: source.id,
        targetTagId: target.id,
        affectedRelationships: affectedRelationships ?? 0,
        promotedSynonyms,
      },
    });

    return {
      canonicalTag: mergedTag,
      removedTagId: source.id,
      affectedRelationships: affectedRelationships ?? 0,
      promotedSynonyms,
    };
  }

  private buildPromotedSynonyms(source: Tag, target: Tag): string[] {
    const bucket = new Set<string>();
    for (const synonym of target.synonyms) {
      bucket.add(normalizeSlug(synonym));
    }

    const promoteList = [source.slug, ...source.synonyms];
    for (const entry of promoteList) {
      bucket.add(normalizeSlug(entry));
    }

    return Array.from(bucket);
  }
}
