import { normalizeSlug } from '@/schemas/classification/utils.js';
import type { Tag } from '@/schemas/classification/tag.js';

export interface SynonymResolution {
  readonly canonicalTagId: string;
  readonly canonicalSlug: string;
  readonly matchedAlias: string | null;
}

export class SynonymMapper {
  private readonly canonical = new Map<string, SynonymResolution>();
  private readonly aliases = new Map<string, SynonymResolution>();

  constructor(initialTags?: readonly Tag[]) {
    if (initialTags) {
      for (const tag of initialTags) {
        this.registerCanonical(tag);
      }
    }
  }

  registerCanonical(tag: Tag): SynonymResolution {
    const canonicalSlug = normalizeSlug(tag.slug ?? tag.name);
    const baseResolution: SynonymResolution = {
      canonicalTagId: tag.id,
      canonicalSlug,
      matchedAlias: null,
    };
    this.canonical.set(tag.id, baseResolution);
    this.registerAlias(canonicalSlug, baseResolution, { allowExisting: true });

    for (const synonym of tag.synonyms ?? []) {
      this.registerAlias(normalizeSlug(synonym), baseResolution);
    }

    return baseResolution;
  }

  registerSynonym(tag: Tag, alias: string): SynonymResolution {
    if (!alias) {
      throw new Error('Synonym cannot be empty.');
    }
    const canonical = this.canonical.get(tag.id) ?? this.registerCanonical(tag);
    const normalized = normalizeSlug(alias);
    if (normalized === canonical.canonicalSlug) {
      return canonical;
    }
    const resolution = {
      canonicalTagId: tag.id,
      canonicalSlug: canonical.canonicalSlug,
      matchedAlias: normalized,
    };
    this.registerAlias(normalized, resolution);
    return resolution;
  }

  resolve(value: string | undefined | null): SynonymResolution | null {
    if (!value) {
      return null;
    }
    const normalized = normalizeSlug(value);
    return this.aliases.get(normalized) ?? null;
  }

  removeSynonym(alias: string): boolean {
    if (!alias) {
      return false;
    }
    const normalized = normalizeSlug(alias);
    const removed = this.aliases.delete(normalized);
    return removed;
  }

  exportMappings(): Record<string, SynonymResolution> {
    const snapshot: Record<string, SynonymResolution> = {};
    for (const [alias, resolution] of this.aliases.entries()) {
      snapshot[alias] = resolution;
    }
    return snapshot;
  }

  private registerAlias(alias: string, base: SynonymResolution, options: { allowExisting?: boolean } = {}): void {
    const existing = this.aliases.get(alias);
    if (existing && existing.canonicalTagId !== base.canonicalTagId && !options.allowExisting) {
      throw new Error(
        `Synonym "${alias}" is already assigned to canonical tag ${existing.canonicalTagId} (attempted ${base.canonicalTagId}).`
      );
    }
    const resolution: SynonymResolution = alias === base.canonicalSlug ? base : { ...base, matchedAlias: alias };
    this.aliases.set(alias, resolution);
  }
}
