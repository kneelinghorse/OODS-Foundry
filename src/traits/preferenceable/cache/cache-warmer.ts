import type { PreferenceCacheKey, PreferenceCacheResult } from './preference-cache.js';
import { PreferenceCache } from './preference-cache.js';

import type { PreferenceQueryClient, QueryResultRow } from '../query/optimized-queries.js';

export interface PreferenceWarmCandidate extends PreferenceCacheKey {
  readonly score?: number;
  readonly reason?: string;
}

export interface PreferenceWarmSource {
  loadCandidates(limit: number): Promise<readonly PreferenceWarmCandidate[]>;
}

export interface PreferenceCacheWarmOptions {
  readonly limit?: number;
  readonly minScore?: number;
}

export interface PreferenceCacheWarmResult {
  readonly attempted: number;
  readonly warmed: number;
  readonly skipped: number;
  readonly details: readonly PreferenceWarmDetail[];
}

export interface PreferenceWarmDetail {
  readonly candidate: PreferenceWarmCandidate;
  readonly status: 'warmed' | 'missing' | 'skipped';
  readonly source: PreferenceCacheResult['source'];
}

export class PreferenceCacheWarmer {
  constructor(private readonly cache: PreferenceCache, private readonly source: PreferenceWarmSource) {}

  async warm(options: PreferenceCacheWarmOptions = {}): Promise<PreferenceCacheWarmResult> {
    const limit = Math.max(1, Math.min(options.limit ?? 100, 1000));
    const minScore = options.minScore ?? 0;
    const candidates = await this.source.loadCandidates(limit);
    const details: PreferenceWarmDetail[] = [];
    let warmed = 0;
    let skipped = 0;

    for (const candidate of candidates) {
      const candidateScore = candidate.score ?? 0;
      if (candidateScore < minScore) {
        skipped += 1;
        details.push({ candidate, status: 'skipped', source: 'miss' });
        continue;
      }

      const result = await this.cache.getDocument(
        { userId: candidate.userId, tenantId: candidate.tenantId },
        { forceRefresh: true }
      );
      if (!result.document) {
        details.push({ candidate, status: 'missing', source: result.source });
        continue;
      }
      warmed += 1;
      details.push({ candidate, status: 'warmed', source: result.source });
    }

    return {
      attempted: candidates.length,
      warmed,
      skipped,
      details,
    } satisfies PreferenceCacheWarmResult;
  }
}

export interface TrendingNotificationActivityRow extends QueryResultRow {
  tenant_id: string | null;
  user_id: string;
  read_volume_1h: number;
  cache_pressure_score: number;
}

export class TrendingNotificationWarmSource implements PreferenceWarmSource {
  private readonly viewName: string;

  constructor(private readonly client: PreferenceQueryClient, viewName?: string) {
    this.viewName = viewName ?? 'preferences.notification_activity_hourly';
  }

  async loadCandidates(limit: number): Promise<readonly PreferenceWarmCandidate[]> {
    const safeLimit = Math.max(1, Math.min(limit, 1000));
    const sql = `SELECT tenant_id, user_id, read_volume_1h, cache_pressure_score
                   FROM ${this.viewName}
               ORDER BY cache_pressure_score DESC
                  LIMIT $1`;
    const result = await this.client.query<TrendingNotificationActivityRow>(sql, [safeLimit]);
    return result.rows.map((row) => ({
      tenantId: row.tenant_id ?? undefined,
      userId: row.user_id,
      score: row.cache_pressure_score,
      reason: `reads-1h=${row.read_volume_1h}`,
    }));
  }
}

export class StaticWarmSource implements PreferenceWarmSource {
  constructor(private readonly candidates: readonly PreferenceWarmCandidate[]) {}

  async loadCandidates(limit: number): Promise<readonly PreferenceWarmCandidate[]> {
    return this.candidates.slice(0, limit);
  }
}
