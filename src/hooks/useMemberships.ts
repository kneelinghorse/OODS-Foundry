import { useCallback, useEffect, useRef, useState } from 'react';

import TimeService from '@/services/time/index.js';

const DEFAULT_REFRESH_INTERVAL_MS = 30_000;

type PendingKey = `${string}:${string}`;
export type PendingMembershipKey = PendingKey;

export type MembershipState = 'active' | 'pending' | 'suspended' | 'expired';

export interface MembershipRecord {
  readonly id: string;
  readonly userId: string;
  readonly organizationId: string;
  readonly roleId: string;
  readonly roleName?: string;
  readonly userName?: string;
  readonly state?: MembershipState;
  readonly assignedAt?: string;
}

export interface MembershipClient {
  listMemberships(organizationId: string): Promise<readonly MembershipRecord[]>;
  assignRole(userId: string, roleId: string, organizationId: string): Promise<MembershipRecord>;
  revokeRole(userId: string, roleId: string, organizationId: string): Promise<boolean | void>;
}

export interface SodViolationDescriptor {
  readonly policyId: string;
  readonly reason: string;
  readonly conflictingRoleId: string;
  readonly organizationId: string | null;
}

export interface SodValidationResult {
  readonly valid: boolean;
  readonly violations: readonly SodViolationDescriptor[];
}

export interface MembershipValidator {
  validateAssignment(userId: string, organizationId: string, roleId: string): Promise<SodValidationResult>;
}

export interface MembershipValidationState {
  readonly userId: string;
  readonly roleId: string;
  readonly organizationId: string;
  readonly valid: boolean;
  readonly checkedAt: string;
  readonly violations: readonly SodViolationDescriptor[];
}

export interface UseMembershipsOptions {
  readonly organizationId: string;
  readonly client: MembershipClient;
  readonly validator?: MembershipValidator;
  readonly autoRefreshIntervalMs?: number;
}

export interface UseMembershipsResult {
  readonly memberships: readonly MembershipRecord[];
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly pendingMembers: ReadonlySet<PendingKey>;
  readonly validationState: MembershipValidationState | null;
  readonly assignRole: (userId: string, roleId: string) => Promise<MembershipRecord | null>;
  readonly revokeRole: (userId: string, roleId: string) => Promise<boolean>;
  readonly validateAssignment: (userId: string, roleId: string) => Promise<MembershipValidationState | null>;
  readonly refetch: () => Promise<void>;
}

export function useMemberships(options: UseMembershipsOptions): UseMembershipsResult {
  const { organizationId, client, validator, autoRefreshIntervalMs } = options;
  const [memberships, setMemberships] = useState<MembershipRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [pendingMembers, setPendingMembers] = useState<Set<PendingKey>>(new Set());
  const [validationState, setValidationState] = useState<MembershipValidationState | null>(null);
  const refreshAbortRef = useRef<AbortController | null>(null);

  const fetchMemberships = useCallback(async () => {
    refreshAbortRef.current?.abort();
    const controller = new AbortController();
    refreshAbortRef.current = controller;
    setIsLoading(true);
    try {
      const list = await client.listMemberships(organizationId);
      if (!controller.signal.aborted) {
        setMemberships(list.map((entry) => ({ ...entry })));
        setError(null);
      }
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === 'AbortError')) {
        setError(caught as Error);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [client, organizationId]);

  useEffect(() => {
    void fetchMemberships();
    return () => refreshAbortRef.current?.abort();
  }, [fetchMemberships]);

  useEffect(() => {
    const intervalMs = autoRefreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS;
    if (intervalMs <= 0) {
      return undefined;
    }
    const interval = window.setInterval(() => {
      void fetchMemberships();
    }, intervalMs);
    return () => window.clearInterval(interval);
  }, [autoRefreshIntervalMs, fetchMemberships]);

  const validateAssignment = useCallback(
    async (userId: string, roleId: string) => {
      if (!validator) {
        return null;
      }
      const result = await validator.validateAssignment(userId, organizationId, roleId);
      const state: MembershipValidationState = {
        userId,
        roleId,
        organizationId,
        valid: result.valid,
        checkedAt: TimeService.toIsoString(TimeService.nowSystem()),
        violations: result.violations,
      };
      setValidationState(state);
      return state;
    },
    [organizationId, validator]
  );

  const addPending = useCallback((userId: string, roleId: string) => {
    const key: PendingKey = `${userId}:${roleId}`;
    setPendingMembers((prev) => new Set(prev).add(key));
    return key;
  }, []);

  const removePending = useCallback((key: PendingKey) => {
    setPendingMembers((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const assignRole = useCallback(
    async (userId: string, roleId: string) => {
      if (!userId || !roleId) {
        throw new Error('Both userId and roleId are required to assign a membership.');
      }
      const key = addPending(userId, roleId);
      try {
        if (validator) {
          const validation = await validateAssignment(userId, roleId);
          if (validation && !validation.valid) {
            throw new Error('Separation of Duty validation failed for the requested assignment.');
          }
        }
        const membership = await client.assignRole(userId, roleId, organizationId);
        setMemberships((prev) => upsertMembership(prev, membership));
        setError(null);
        return membership;
      } catch (caught) {
        setError(caught as Error);
        throw caught;
      } finally {
        removePending(key);
      }
    },
    [addPending, client, organizationId, removePending, validateAssignment, validator]
  );

  const revokeRole = useCallback(
    async (userId: string, roleId: string) => {
      if (!userId || !roleId) {
        throw new Error('Both userId and roleId are required to revoke a membership.');
      }
      const key = addPending(userId, roleId);
      try {
        const revoked = await client.revokeRole(userId, roleId, organizationId);
        setMemberships((prev) => prev.filter((entry) => !(entry.userId === userId && entry.roleId === roleId)));
        setError(null);
        return Boolean(revoked);
      } catch (caught) {
        setError(caught as Error);
        throw caught;
      } finally {
        removePending(key);
      }
    },
    [addPending, client, organizationId, removePending]
  );

  return {
    memberships,
    isLoading,
    error,
    pendingMembers,
    validationState,
    assignRole,
    revokeRole,
    validateAssignment,
    refetch: fetchMemberships,
  } satisfies UseMembershipsResult;
}

function upsertMembership(collection: readonly MembershipRecord[], membership: MembershipRecord): MembershipRecord[] {
  const existingIndex = collection.findIndex((entry) => entry.id === membership.id);
  if (existingIndex >= 0) {
    const copy = [...collection];
    copy[existingIndex] = { ...membership };
    return copy;
  }
  return [...collection, { ...membership }];
}
