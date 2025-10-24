/**
 * TenancyContext
 *
 * Core tenant isolation context. All data access must flow through
 * this context to ensure proper tenant scoping.
 *
 * @module services/tenancy/tenancy-context
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import {
  getTenancyConfig,
  loadTenantDatabaseRegistry,
  type TenancyConfig,
  type TenantDatabaseConfig,
} from '../../../configs/tenancy';
import type { ITenancyAdapter } from './database-adapters';
import {
  ExternalAdapter,
  SchemaPerTenantAdapter,
  SharedSchemaAdapter,
} from './database-adapters';

/**
 * Tenant reference with optional metadata
 */
export interface TenantRef {
  tenantId: string;
  displayName?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Tenant-scoped execution context
 */
export class TenancyContext {
  private static config: TenancyConfig;
  private static adapter: ITenancyAdapter;
  private static storage = new AsyncLocalStorage<TenantRef>();
  private static manualTenantRef: TenantRef | null = null;
  private static externalRegistry: TenantDatabaseConfig[] | undefined;

  /**
   * Initialize tenancy system with configuration
   */
  static initialize(config?: TenancyConfig): void {
    TenancyContext.config = config ?? getTenancyConfig();
    TenancyContext.manualTenantRef = null;

    switch (TenancyContext.config.mode) {
      case 'shared-schema':
        TenancyContext.externalRegistry = undefined;
        TenancyContext.adapter = new SharedSchemaAdapter(TenancyContext.config);
        break;
      case 'schema-per-tenant':
        TenancyContext.externalRegistry = undefined;
        TenancyContext.adapter = new SchemaPerTenantAdapter(TenancyContext.config);
        break;
      case 'external-adapter':
        TenancyContext.externalRegistry = loadTenantDatabaseRegistry(TenancyContext.config);
        TenancyContext.adapter = new ExternalAdapter(
          TenancyContext.config,
          TenancyContext.externalRegistry
        );
        break;
      default:
        throw new Error(`Unknown tenancy mode: ${TenancyContext.config.mode}`);
    }
  }

  /**
   * Create a new tenant context
   */
  static create(tenantId: string): TenancyContext {
    if (!TenancyContext.config) {
      TenancyContext.initialize();
    }
    return new TenancyContext(tenantId);
  }

  /**
   * Get current tenant reference
   */
  static getCurrentTenant(): TenantRef | null {
    return TenancyContext.getCurrentTenantRef();
  }

  /**
   * Get current tenant reference with metadata
   */
  static getCurrentTenantRef(): TenantRef | null {
    const store = TenancyContext.storage.getStore();
    if (store) {
      return store;
    }

    if (TenancyContext.manualTenantRef) {
      return TenancyContext.manualTenantRef;
    }

    if (
      TenancyContext.config?.strictIsolation === false &&
      TenancyContext.config?.fallbackTenantId
    ) {
      return {
        tenantId: TenancyContext.config.fallbackTenantId,
        metadata: { source: 'fallback' },
      };
    }

    return null;
  }

  /**
   * Convenience helper to read current tenant ID
   */
  static getCurrentTenantId(): string | null {
    return TenancyContext.getCurrentTenantRef()?.tenantId ?? null;
  }

  /**
   * Require current tenant (throws if not set)
   */
  static requireCurrentTenant(): TenantRef {
    const tenant = TenancyContext.getCurrentTenantRef();
    if (!tenant) {
      throw new Error(
        'No tenant context set. All data access must be tenant-scoped. ' +
          'Use TenancyContext.create(tenantId).withTenant(...) or setCurrentTenant().'
      );
    }
    return tenant;
  }

  /**
   * Require current tenant ID (throws if not set)
   */
  static requireCurrentTenantId(): string {
    return TenancyContext.requireCurrentTenant().tenantId;
  }

  /**
   * Set current tenant (for testing/admin operations only)
   * Prefer withTenant() for production code.
   */
  static setCurrentTenant(tenantId: string | null): void {
    if (!tenantId) {
      TenancyContext.manualTenantRef = null;
      return;
    }

    const ref: TenantRef = {
      tenantId,
      metadata: { source: 'manual' },
    };

    const registryMatch = TenancyContext.externalRegistry?.find(
      (tenant) => tenant.tenantId === tenantId
    );
    if (registryMatch) {
      ref.displayName = registryMatch.displayName;
      ref.metadata = {
        ...ref.metadata,
        region: registryMatch.region,
        residency: registryMatch.residency,
      };
    }

    TenancyContext.manualTenantRef = ref;
  }

  /**
   * Reset context (testing only)
   */
  static reset(): void {
    TenancyContext.manualTenantRef = null;
    TenancyContext.storage.disable();
    TenancyContext.storage = new AsyncLocalStorage<TenantRef>();
  }

  constructor(private readonly tenantId: string) {
    if (!tenantId || typeof tenantId !== 'string') {
      throw new Error('Invalid tenantId: must be non-empty string');
    }
  }

  /**
   * Execute function with tenant context
   */
  async withTenant<T>(fn: (adapter: ITenancyAdapter) => Promise<T>): Promise<T> {
    const tenantRef = this.getTenantRef();
    return TenancyContext.storage.run(tenantRef, async () => {
      return fn(TenancyContext.adapter);
    });
  }

  /**
   * Execute synchronous function with tenant context
   */
  withTenantSync<T>(fn: (adapter: ITenancyAdapter) => T): T {
    const tenantRef = this.getTenantRef();
    return TenancyContext.storage.run(tenantRef, () => fn(TenancyContext.adapter));
  }

  /**
   * Get tenant reference
   */
  getTenantRef(): TenantRef {
    const metadata: Record<string, unknown> = {
      mode: TenancyContext.config?.mode,
    };

    const registryMatch = TenancyContext.externalRegistry?.find(
      (tenant) => tenant.tenantId === this.tenantId
    );
    if (registryMatch) {
      if (registryMatch.region) {
        metadata.region = registryMatch.region;
      }
      if (registryMatch.residency) {
        metadata.residency = registryMatch.residency;
      }
      return {
        tenantId: this.tenantId,
        displayName: registryMatch.displayName,
        metadata,
      };
    }

    return {
      tenantId: this.tenantId,
      metadata,
    };
  }

  /**
   * Check if current execution is within this tenant's context
   */
  isActive(): boolean {
    return TenancyContext.getCurrentTenantId() === this.tenantId;
  }
}

/**
 * Helper function for tenant-scoped queries
 */
export async function withTenantContext<T>(
  tenantId: string,
  fn: (adapter: ITenancyAdapter) => Promise<T>
): Promise<T> {
  const context = TenancyContext.create(tenantId);
  return context.withTenant(fn);
}

/**
 * Decorator for tenant-aware service methods
 * Ensures tenant context is set before executing method
 */
export function RequiresTenant() {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: unknown[]) {
      TenancyContext.requireCurrentTenant();
      return originalMethod.apply(this, args);
    };
    return descriptor;
  };
}
