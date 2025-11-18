import { normalizeSlug } from '@/schemas/classification/utils.js';
import TimeService from '@/services/time/index.js';

export interface TagCandidate {
  readonly name: string;
  readonly slug?: string;
  readonly usageCount?: number;
  readonly synonyms?: readonly string[];
}

export interface TagCreationContext {
  readonly userId: string;
  readonly userReputation: number;
  readonly createdAt?: string;
  readonly recentCreations?: readonly CreationRecord[];
  readonly tagsOnItem?: number;
  readonly existingTagUsage?: number;
}

export interface CreationRecord {
  readonly createdAt: string;
  readonly tagId?: string;
  readonly actorId?: string;
}

export type SpamRule =
  | 'low_reputation_single_use'
  | 'suspicious_pattern'
  | 'velocity_exceeded'
  | 'tag_limit_exceeded';

export interface SpamFinding {
  readonly rule: SpamRule;
  readonly severity: 'warning' | 'block';
  readonly message: string;
  readonly metadata?: Record<string, unknown>;
}

export interface SpamDetectorOptions {
  readonly reputationThreshold?: number;
  readonly suspiciousPatterns?: readonly RegExp[];
  readonly blockedTerms?: readonly string[];
  readonly velocityWindowMinutes?: number;
  readonly velocityLimit?: number;
  readonly maxTagsPerItem?: number;
  readonly now?: () => Date;
}

const DEFAULT_PATTERNS = [/(?:https?:\/\/|www\.)/i, /[{}<>]/, /\b(?:xxx|porn|casino|viagra)\b/i];

export class SpamDetector {
  private readonly reputationThreshold: number;
  private readonly suspiciousPatterns: readonly RegExp[];
  private readonly blockedTerms: readonly string[];
  private readonly velocityWindowMs: number;
  private readonly velocityLimit: number;
  private readonly maxTagsPerItem: number;
  private readonly now: () => Date;

  constructor(options: SpamDetectorOptions = {}) {
    this.reputationThreshold = options.reputationThreshold ?? 25;
    this.suspiciousPatterns = options.suspiciousPatterns ?? DEFAULT_PATTERNS;
    this.blockedTerms = options.blockedTerms ?? [];
    this.velocityWindowMs = (options.velocityWindowMinutes ?? 10) * 60 * 1000;
    this.velocityLimit = options.velocityLimit ?? 5;
    this.maxTagsPerItem = options.maxTagsPerItem ?? 15;
    this.now = options.now ?? (() => TimeService.nowSystem().toJSDate());
  }

  evaluate(candidate: TagCandidate, context: TagCreationContext): SpamFinding[] {
    const findings: SpamFinding[] = [];
    const slug = this.safeSlug(candidate.slug ?? candidate.name);
    this.applySuspicionRules(findings, slug, candidate.name);
    this.applyBlockedTerms(findings, slug);
    this.applyReputationRule(findings, candidate, context);
    this.applyVelocityRule(findings, context);
    this.applyTagLimitRule(findings, context);
    return findings;
  }

  isSpam(candidate: TagCandidate, context: TagCreationContext): boolean {
    return this.evaluate(candidate, context).some((finding) => finding.severity === 'block');
  }

  private safeSlug(value: string): string {
    try {
      return normalizeSlug(value);
    } catch {
      return value.trim().toLowerCase();
    }
  }

  private applySuspicionRules(findings: SpamFinding[], slug: string, name: string): void {
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(name) || pattern.test(slug)) {
        findings.push({
          rule: 'suspicious_pattern',
          severity: 'block',
          message: `Tag matches blocked pattern (${pattern}).`,
          metadata: { pattern: pattern.toString(), slug, name },
        });
        break;
      }
    }
  }

  private applyBlockedTerms(findings: SpamFinding[], slug: string): void {
    for (const term of this.blockedTerms) {
      if (slug.includes(term)) {
        findings.push({
          rule: 'suspicious_pattern',
          severity: 'block',
          message: `Tag contains blocked term "${term}".`,
          metadata: { term, slug },
        });
        break;
      }
    }
  }

  private applyReputationRule(findings: SpamFinding[], candidate: TagCandidate, context: TagCreationContext): void {
    if (context.userReputation >= this.reputationThreshold) {
      return;
    }
    const usage = candidate.usageCount ?? context.existingTagUsage ?? 0;
    if (usage <= 1) {
      findings.push({
        rule: 'low_reputation_single_use',
        severity: 'block',
        message: 'Low-reputation users cannot create single-use tags without moderation.',
        metadata: {
          userReputation: context.userReputation,
          usage,
        },
      });
    }
  }

  private applyVelocityRule(findings: SpamFinding[], context: TagCreationContext): void {
    const recent = context.recentCreations ?? [];
    if (!context.userId || recent.length === 0) {
      return;
    }
    const cutoff = this.now().getTime() - this.velocityWindowMs;
    const count = recent.filter((record) => {
      if (!record) {
        return false;
      }
      if (record.actorId && record.actorId !== context.userId) {
        return false;
      }
      try {
        const createdTime = TimeService.normalizeToUtc(record.createdAt).toMillis();
        return createdTime >= cutoff;
      } catch {
        return false;
      }
    }).length;

    if (count >= this.velocityLimit) {
      findings.push({
        rule: 'velocity_exceeded',
        severity: 'block',
        message: `User exceeded tag creation limit (${count}/${this.velocityLimit}) within ${this.velocityWindowMs / 60000} minutes.`,
        metadata: { count, limit: this.velocityLimit },
      });
    }
  }

  private applyTagLimitRule(findings: SpamFinding[], context: TagCreationContext): void {
    const totalTags = context.tagsOnItem ?? 0;
    if (totalTags > this.maxTagsPerItem) {
      findings.push({
        rule: 'tag_limit_exceeded',
        severity: 'warning',
        message: `Items should not exceed ${this.maxTagsPerItem} tags (received ${totalTags}).`,
        metadata: { tagsOnItem: totalTags },
      });
    }
  }
}
