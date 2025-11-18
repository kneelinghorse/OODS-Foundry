import { normalizeTag, type Tag, type TagInput } from '@/schemas/classification/tag.js';
import TimeService from '@/services/time/index.js';

import { SpamDetector, type SpamFinding, type TagCandidate, type TagCreationContext } from './spam-detector.js';
import { SynonymMapper, type SynonymResolution } from './synonym-mapper.js';
import {
  TagMerger,
  type MergeResult,
  type TagAuditLogEntry,
  type TagAuditLogger,
  type TagRelationshipRepository,
  type TagRepository,
} from './tag-merger.js';

export type {
  TagRepository,
  TagRelationshipRepository,
  TagAuditLogger,
  TagAuditLogEntry,
} from './tag-merger.js';

export interface CreateTagOptions {
  readonly actor: string;
  readonly skipSpamCheck?: boolean;
  readonly allowBlocked?: boolean;
  readonly spamContext?: TagCreationContext;
}

export interface TagCreationResult {
  readonly tag: Tag;
  readonly created: boolean;
  readonly blocked?: boolean;
  readonly spamFindings: readonly SpamFinding[];
}

export interface SynonymOptions {
  readonly actor: string;
}

export interface TagManagerOptions {
  readonly repository: TagRepository;
  readonly auditLogger?: TagAuditLogger;
  readonly spamDetector?: SpamDetector;
  readonly synonymMapper?: SynonymMapper;
  readonly merger?: TagMerger;
  readonly relationshipRepository?: TagRelationshipRepository;
  readonly now?: () => Date;
  readonly initialTags?: readonly Tag[];
}

const NOOP_LOGGER: TagAuditLogger = {
  log: async () => {},
};

export class TagManager {
  private readonly repo: TagRepository;
  private readonly audit: TagAuditLogger;
  private readonly spamDetector: SpamDetector;
  private readonly synonymMapper: SynonymMapper;
  private readonly merger: TagMerger;
  private readonly now: () => Date;

  constructor(options: TagManagerOptions) {
    this.repo = options.repository;
    this.audit = options.auditLogger ?? NOOP_LOGGER;
    this.spamDetector = options.spamDetector ?? new SpamDetector();
    this.synonymMapper = options.synonymMapper ?? new SynonymMapper(options.initialTags);
    this.now = options.now ?? (() => TimeService.nowSystem().toJSDate());

    this.merger =
      options.merger ??
      new TagMerger({
        repository: this.repo,
        relationships: options.relationshipRepository,
        auditLogger: this.audit,
        synonymMapper: this.synonymMapper,
        now: this.now,
      });

  }

  async create(input: TagInput, options: CreateTagOptions): Promise<TagCreationResult> {
    const normalized = normalizeTag(input);
    const existing = await this.repo.findBySlug(normalized.slug);
    if (existing) {
      return { tag: existing, created: false, spamFindings: [] };
    }

    const spamContext: TagCreationContext = options.spamContext ?? {
      userId: options.actor,
      userReputation: 0,
      recentCreations: [],
    };
    const candidate: TagCandidate = {
      name: normalized.name,
      slug: normalized.slug,
      usageCount: normalized.usageCount,
      synonyms: normalized.synonyms,
    };
    const spamFindings = options.skipSpamCheck ? [] : this.spamDetector.evaluate(candidate, spamContext);
    const blocked = spamFindings.some((finding) => finding.severity === 'block');
    if (blocked && !options.allowBlocked) {
      await this.audit.log({
        type: 'spam_flagged',
        actor: options.actor,
        summary: `Blocked tag "${normalized.slug}" pending moderation`,
        tagId: normalized.id,
        timestamp: this.now().toISOString(),
        payload: { findings: spamFindings },
      });
      return { tag: normalized, created: false, spamFindings, blocked: true };
    }

    const saved = await this.repo.save(normalized);
    this.synonymMapper.registerCanonical(saved);
    await this.audit.log(this.buildAuditEntry('create', saved, options.actor, { spamFindings }));

    return { tag: saved, created: true, spamFindings };
  }

  async addSynonym(tagId: string, synonym: string, options: SynonymOptions): Promise<Tag> {
    const tag = await this.repo.findById(tagId);
    if (!tag) {
      throw new Error(`Tag ${tagId} not found.`);
    }
    const updated = normalizeTag({
      ...tag,
      synonyms: [...tag.synonyms, synonym],
    });

    const saved = await this.repo.save(updated);
    this.synonymMapper.registerSynonym(saved, synonym);
    await this.audit.log(this.buildAuditEntry('synonym_added', saved, options.actor, { synonym }));
    return saved;
  }

  async merge(sourceTagId: string, targetTagId: string, actor: string): Promise<MergeResult> {
    return this.merger.merge({ sourceTagId, targetTagId, actor });
  }

  detectSpam(candidate: TagCandidate, context: TagCreationContext): SpamFinding[] {
    return this.spamDetector.evaluate(candidate, context);
  }

  resolve(tagOrAlias: string): SynonymResolution | null {
    return this.synonymMapper.resolve(tagOrAlias);
  }

  private buildAuditEntry(
    type: TagAuditLogEntry['type'],
    tag: Tag,
    actor: string,
    payload: Record<string, unknown>
  ): TagAuditLogEntry {
    return {
      type,
      actor,
      tagId: tag.id,
      summary: `${type} → ${tag.slug}`,
      timestamp: this.now().toISOString(),
      payload,
    };
  }
}
