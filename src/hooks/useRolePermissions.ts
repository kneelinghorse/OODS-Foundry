import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import TimeService from '@/services/time/index.js';

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes mirrors B28.5 TTL

type AssignmentRecord = Record<string, readonly string[]>;

type CellKey = `${string}:${string}`;
export type RolePermissionCellKey = CellKey;

export interface RoleDescriptor {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface PermissionDescriptor {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly resource?: string;
  readonly action?: string;
  readonly category?: string;
}

export interface RolePermissionMatrixSnapshot {
  readonly roles: readonly RoleDescriptor[];
  readonly permissions: readonly PermissionDescriptor[];
  readonly assignments: AssignmentRecord;
  readonly organizationId?: string;
  readonly updatedAt: string;
}

export interface RolePermissionMatrixState {
  readonly roles: readonly RoleDescriptor[];
  readonly permissions: readonly PermissionDescriptor[];
  readonly assignments: ReadonlyMap<string, ReadonlySet<string>>;
  readonly organizationId?: string;
  readonly updatedAt: string;
}

export interface RolePermissionMutationContext {
  readonly organizationId?: string;
  readonly signal?: AbortSignal;
}

export interface RolePermissionClient {
  fetchMatrix(organizationId?: string): Promise<RolePermissionMatrixSnapshot>;
  assignPermission(
    roleId: string,
    permissionId: string,
    context: RolePermissionMutationContext
  ): Promise<RolePermissionMatrixSnapshot | void>;
  revokePermission(
    roleId: string,
    permissionId: string,
    context: RolePermissionMutationContext
  ): Promise<RolePermissionMatrixSnapshot | void>;
}

export interface RolePermissionMatrixCache {
  read(key: string): RolePermissionMatrixSnapshot | undefined;
  write(key: string, snapshot: RolePermissionMatrixSnapshot): void;
  invalidate(key?: string): void;
}

interface CacheEntry {
  readonly snapshot: RolePermissionMatrixSnapshot;
  readonly expiresAt: number;
}

export interface UseRolePermissionsOptions {
  readonly client: RolePermissionClient;
  readonly organizationId?: string;
  readonly cacheKey?: string;
  readonly cache?: RolePermissionMatrixCache;
  readonly cacheTtlMs?: number;
  readonly autoRefreshIntervalMs?: number;
}

export interface UseRolePermissionsResult {
  readonly matrix: RolePermissionMatrixState | null;
  readonly isLoading: boolean;
  readonly isRefreshing: boolean;
  readonly error: Error | null;
  readonly busyCells: ReadonlySet<CellKey>;
  readonly toggleAssignment: (roleId: string, permissionId: string, nextState?: boolean) => Promise<void>;
  readonly refetch: () => Promise<void>;
  readonly lastUpdated?: string;
}

export function createRolePermissionMatrixCache(options?: { ttlMs?: number }): RolePermissionMatrixCache {
  const ttlMs = Math.max(1000, Math.trunc(options?.ttlMs ?? DEFAULT_CACHE_TTL_MS));
  const entries = new Map<string, CacheEntry>();

  return {
    read(key) {
      const entry = entries.get(key);
      if (!entry) {
        return undefined;
      }
      if (entry.expiresAt < systemMillis()) {
        entries.delete(key);
        return undefined;
      }
      return cloneSnapshot(entry.snapshot);
    },
    write(key, snapshot) {
      entries.set(key, { snapshot: cloneSnapshot(snapshot), expiresAt: systemMillis() + ttlMs });
    },
    invalidate(key) {
      if (!key) {
        entries.clear();
        return;
      }
      entries.delete(key);
    },
  } satisfies RolePermissionMatrixCache;
}

const FALLBACK_CACHE = createRolePermissionMatrixCache();

export function useRolePermissions(options: UseRolePermissionsOptions): UseRolePermissionsResult {
  const {
    client,
    organizationId,
    cacheKey: explicitCacheKey,
    cache: providedCache,
    cacheTtlMs,
    autoRefreshIntervalMs,
  } = options;

  const fallbackCacheRef = useRef<RolePermissionMatrixCache | null>(null);
  if (providedCache) {
    fallbackCacheRef.current = providedCache;
  } else if (!fallbackCacheRef.current) {
    fallbackCacheRef.current = createRolePermissionMatrixCache({ ttlMs: cacheTtlMs });
  }

  const cache = providedCache ?? fallbackCacheRef.current ?? FALLBACK_CACHE;

  const cacheKey = useMemo(() => explicitCacheKey ?? buildCacheKey(organizationId), [explicitCacheKey, organizationId]);

  const [matrix, setMatrix] = useState<RolePermissionMatrixState | null>(null);
  const matrixRef = useRef<RolePermissionMatrixState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [busyCells, setBusyCells] = useState<Set<CellKey>>(new Set());
  const fetchAbortRef = useRef<AbortController | null>(null);

  const applySnapshot = useCallback(
    (snapshot: RolePermissionMatrixSnapshot) => {
      const normalized = normalizeSnapshot(snapshot);
      matrixRef.current = normalized;
      setMatrix(normalized);
      setError(null);
      cache.write(cacheKey, toSnapshot(normalized));
    },
    [cache, cacheKey]
  );

  const fetchMatrix = useCallback(async () => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    const hasData = matrixRef.current !== null;
    setIsLoading(!hasData);
    setIsRefreshing(hasData);

    try {
      const cached = cache.read(cacheKey);
      if (cached) {
        const normalized = normalizeSnapshot(cached);
        matrixRef.current = normalized;
        setMatrix(normalized);
      }
      const snapshot = await client.fetchMatrix(organizationId);
      if (!controller.signal.aborted) {
        applySnapshot(snapshot);
      }
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === 'AbortError')) {
        setError(caught as Error);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [applySnapshot, cache, cacheKey, client, organizationId]);

  useEffect(() => {
    void fetchMatrix();
    return () => {
      fetchAbortRef.current?.abort();
    };
  }, [fetchMatrix]);

  useEffect(() => {
    if (!autoRefreshIntervalMs || autoRefreshIntervalMs <= 0) {
      return undefined;
    }
    const interval = window.setInterval(() => {
      void fetchMatrix();
    }, autoRefreshIntervalMs);
    return () => window.clearInterval(interval);
  }, [autoRefreshIntervalMs, fetchMatrix]);

  const mutateAssignment = useCallback(
    async (roleId: string, permissionId: string, nextState?: boolean) => {
      const currentMatrix = matrixRef.current;
      if (!currentMatrix) {
        return;
      }
      const currentAssignments = ensureAssignmentMap(currentMatrix.assignments, roleId);
      const desiredState = nextState ?? !currentAssignments.has(permissionId);
      const previousSnapshot = toSnapshot(currentMatrix);
      const optimistic = applyAssignment(previousSnapshot, roleId, permissionId, desiredState);
      const normalizedOptimistic = normalizeSnapshot(optimistic);
      matrixRef.current = normalizedOptimistic;
      setMatrix(normalizedOptimistic);
      const cellKey: CellKey = `${roleId}:${permissionId}`;
      setBusyCells((prev) => new Set(prev).add(cellKey));

      const controller = new AbortController();
      try {
        const context: RolePermissionMutationContext = { organizationId, signal: controller.signal };
        const response = desiredState
          ? await client.assignPermission(roleId, permissionId, context)
          : await client.revokePermission(roleId, permissionId, context);

        if (response) {
          applySnapshot(response);
        } else {
          cache.write(cacheKey, optimistic);
        }
      } catch (caught) {
        const normalizedPrevious = normalizeSnapshot(previousSnapshot);
        matrixRef.current = normalizedPrevious;
        setMatrix(normalizedPrevious);
        setError(caught as Error);
        throw caught;
      } finally {
        setBusyCells((prev) => {
          const next = new Set(prev);
          next.delete(cellKey);
          return next;
        });
        controller.abort();
      }
    },
    [applySnapshot, cache, cacheKey, client, organizationId]
  );

  return {
    matrix,
    isLoading,
    isRefreshing,
    error,
    busyCells,
    toggleAssignment: mutateAssignment,
    refetch: fetchMatrix,
    lastUpdated: matrix?.updatedAt,
  } satisfies UseRolePermissionsResult;
}

function normalizeSnapshot(snapshot: RolePermissionMatrixSnapshot): RolePermissionMatrixState {
  const assignments = new Map<string, Set<string>>();
  for (const role of snapshot.roles) {
    assignments.set(role.id, new Set(snapshot.assignments?.[role.id] ?? []));
  }
  return {
    roles: snapshot.roles,
    permissions: snapshot.permissions,
    assignments,
    organizationId: snapshot.organizationId,
    updatedAt: snapshot.updatedAt,
  } satisfies RolePermissionMatrixState;
}

function toSnapshot(state: RolePermissionMatrixState): RolePermissionMatrixSnapshot {
  const assignments: AssignmentRecord = {};
  for (const [roleId, permissions] of state.assignments.entries()) {
    assignments[roleId] = Array.from(permissions);
  }
  return {
    roles: state.roles,
    permissions: state.permissions,
    assignments,
    organizationId: state.organizationId,
    updatedAt: state.updatedAt,
  } satisfies RolePermissionMatrixSnapshot;
}

function ensureAssignmentMap(map: ReadonlyMap<string, ReadonlySet<string>>, roleId: string): ReadonlySet<string> {
  return map.get(roleId) ?? new Set();
}

function applyAssignment(
  snapshot: RolePermissionMatrixSnapshot,
  roleId: string,
  permissionId: string,
  enabled: boolean
): RolePermissionMatrixSnapshot {
  const assignments: AssignmentRecord = { ...snapshot.assignments };
  const existing = new Set(assignments[roleId] ?? []);
  if (enabled) {
    existing.add(permissionId);
  } else {
    existing.delete(permissionId);
  }
  assignments[roleId] = Array.from(existing);
  return {
    ...snapshot,
    assignments,
    updatedAt: TimeService.toIsoString(TimeService.nowSystem()),
  } satisfies RolePermissionMatrixSnapshot;
}

function cloneSnapshot(snapshot: RolePermissionMatrixSnapshot): RolePermissionMatrixSnapshot {
  const assignments: AssignmentRecord = {};
  for (const [roleId, permissions] of Object.entries(snapshot.assignments ?? {})) {
    assignments[roleId] = [...permissions];
  }
  return {
    roles: snapshot.roles.map((role) => ({ ...role })),
    permissions: snapshot.permissions.map((permission) => ({ ...permission })),
    assignments,
    organizationId: snapshot.organizationId,
    updatedAt: snapshot.updatedAt,
  } satisfies RolePermissionMatrixSnapshot;
}

function buildCacheKey(organizationId?: string): string {
  return `role-permissions:${organizationId ?? 'global'}`;
}

function systemMillis(): number {
  return TimeService.nowSystem().toMillis();
}
