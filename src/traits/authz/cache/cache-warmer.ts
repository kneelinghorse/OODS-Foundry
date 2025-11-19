import type { PermissionDocument } from '@/schemas/authz/permission.schema.js';

import { PermissionCache } from './permission-cache.js';

export interface PermissionWarmLoader {
  resolve(userId: string, organizationId: string): Promise<readonly PermissionDocument[] | null>;
}

export interface PermissionWarmDetail {
  readonly userId: string;
  readonly organizationId: string;
  readonly status: 'warmed' | 'missing' | 'error' | 'skipped';
  readonly source: 'cache' | 'loader' | 'miss';
  readonly message?: string;
}

export interface PermissionCacheWarmResult {
  readonly attempted: number;
  readonly warmed: number;
  readonly missing: number;
  readonly skipped: number;
  readonly errors: number;
  readonly details: readonly PermissionWarmDetail[];
}

interface WarmPair {
  readonly userId: string;
  readonly organizationId: string;
}

export class PermissionCacheWarmer {
  constructor(private readonly cache: PermissionCache, private readonly loader: PermissionWarmLoader) {}

  async warmUserPermissions(userId: string, organizationIds: readonly string[]): Promise<PermissionCacheWarmResult> {
    const pairs = organizationIds.map((organizationId) => ({ userId, organizationId }));
    return this.warmPairs(pairs);
  }

  async warmOrgPermissions(organizationId: string, userIds: readonly string[]): Promise<PermissionCacheWarmResult> {
    const pairs = userIds.map((userId) => ({ userId, organizationId }));
    return this.warmPairs(pairs);
  }

  async warmPairs(pairs: readonly WarmPair[]): Promise<PermissionCacheWarmResult> {
    const uniquePairs = this.dedupePairs(pairs);
    const details: PermissionWarmDetail[] = [];
    let warmed = 0;
    let missing = 0;
    let errors = 0;

    for (const pair of uniquePairs) {
      try {
        const result = await this.cache.getPermissions(pair.userId, pair.organizationId, {
          loader: () => this.loader.resolve(pair.userId, pair.organizationId),
          forceRefresh: true,
          context: 'warm',
        });
        if (result.permissions) {
          warmed += 1;
          details.push({ ...pair, status: 'warmed', source: result.source });
        } else {
          missing += 1;
          details.push({ ...pair, status: 'missing', source: result.source });
        }
      } catch (error) {
        errors += 1;
        details.push({ ...pair, status: 'error', source: 'miss', message: (error as Error).message });
      }
    }

    const skipped = pairs.length - uniquePairs.length;
    return {
      attempted: pairs.length,
      warmed,
      missing,
      skipped,
      errors,
      details,
    } satisfies PermissionCacheWarmResult;
  }

  private dedupePairs(pairs: readonly WarmPair[]): WarmPair[] {
    const map = new Map<string, WarmPair>();
    for (const pair of pairs) {
      const key = `${pair.userId}:${pair.organizationId}`;
      if (!map.has(key)) {
        map.set(key, pair);
      }
    }
    return [...map.values()];
  }
}
