import { beforeEach, describe, expect, it } from 'vitest';

import { normalizeTag, type Tag } from '@/schemas/classification/tag.js';
import {
  TagManager,
  type TagAuditLogEntry,
  type TagAuditLogger,
  type TagRepository,
} from '@/traits/classifiable/tag/tag-manager.js';
import { SpamDetector } from '@/traits/classifiable/tag/spam-detector.js';
import type { TagRelationshipRepository } from '@/traits/classifiable/tag/tag-merger.js';

class InMemoryTagRepository implements TagRepository {
  private readonly tags = new Map<string, Tag>();

  async list(): Promise<Tag[]> {
    return Array.from(this.tags.values());
  }

  async findById(tagId: string): Promise<Tag | null> {
    return this.tags.get(tagId) ?? null;
  }

  async findBySlug(slug: string): Promise<Tag | null> {
    for (const tag of this.tags.values()) {
      if (tag.slug === slug) {
        return tag;
      }
    }
    return null;
  }

  async save(tag: Tag): Promise<Tag> {
    this.tags.set(tag.id, tag);
    return tag;
  }

  async delete(tagId: string): Promise<void> {
    this.tags.delete(tagId);
  }
}

class InMemoryRelationshipRepository implements TagRelationshipRepository {
  readonly relationships = new Map<string, Set<string>>();

  add(tagId: string, objectId: string): void {
    const bucket = this.relationships.get(tagId) ?? new Set<string>();
    bucket.add(objectId);
    this.relationships.set(tagId, bucket);
  }

  async reassignTag(sourceTagId: string, targetTagId: string): Promise<number> {
    const sourceSet = this.relationships.get(sourceTagId);
    if (!sourceSet || sourceSet.size === 0) {
      return 0;
    }
    const targetSet = this.relationships.get(targetTagId) ?? new Set<string>();
    for (const objectId of sourceSet) {
      targetSet.add(objectId);
    }
    this.relationships.set(targetTagId, targetSet);
    this.relationships.delete(sourceTagId);
    return targetSet.size;
  }
}

class AuditLogger implements TagAuditLogger {
  readonly entries: TagAuditLogEntry[] = [];

  async log(entry: TagAuditLogEntry): Promise<void> {
    this.entries.push(entry);
  }
}

describe('TagManager governance workflows', () => {
  let repository: InMemoryTagRepository;
  let relationships: InMemoryRelationshipRepository;
  let audit: AuditLogger;
  let manager: TagManager;

  beforeEach(() => {
    repository = new InMemoryTagRepository();
    relationships = new InMemoryRelationshipRepository();
    audit = new AuditLogger();
    manager = new TagManager({
      repository,
      auditLogger: audit,
      spamDetector: new SpamDetector({ reputationThreshold: 0 }),
      relationshipRepository: relationships,
    });
  });

  it('creates canonical tags and records audit events', async () => {
    const result = await manager.create(
      { name: 'JavaScript', synonyms: ['js'] },
      {
        actor: 'admin',
        spamContext: {
          userId: 'admin',
          userReputation: 80,
          recentCreations: [],
        },
      }
    );

    expect(result.created).toBe(true);
    expect(result.tag.slug).toBe('javascript');
    expect(audit.entries).toHaveLength(1);
    expect(manager.resolve('js')?.canonicalTagId).toBe(result.tag.id);
  });

  it('blocks suspicious tags using spam heuristics', async () => {
    const outcome = await manager.create(
      { name: 'http://spammy', synonyms: [] },
      {
        actor: 'low-user',
        spamContext: {
          userId: 'low-user',
          userReputation: 5,
          recentCreations: [],
        },
      }
    );

    expect(outcome.created).toBe(false);
    expect(outcome.blocked).toBe(true);
    expect(outcome.spamFindings.some((finding) => finding.rule === 'suspicious_pattern')).toBe(true);
  });

  it('merges duplicate tags and reassigns relationships', async () => {
    const canonical = await repository.save(
      normalizeTag({ id: 'tag-1', name: 'JavaScript', synonyms: ['js'] })
    );
    const duplicate = await repository.save(
      normalizeTag({ id: 'tag-2', name: 'ECMAScript', synonyms: ['ecma'] })
    );
    relationships.add(duplicate.id, 'obj-1');
    relationships.add(duplicate.id, 'obj-2');

    const mergeResult = await manager.merge(duplicate.id, canonical.id, 'governor');

    expect(mergeResult.removedTagId).toBe(duplicate.id);
    expect(mergeResult.affectedRelationships).toBeGreaterThanOrEqual(2);
    const updated = await repository.findById(canonical.id);
    expect(updated?.synonyms).toContain('ecmascript');
    expect(manager.resolve('ecmascript')?.canonicalTagId).toBe(canonical.id);
  });
});
