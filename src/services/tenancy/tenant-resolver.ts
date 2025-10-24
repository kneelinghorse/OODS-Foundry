/**
 * Tenant Resolvers
 * 
 * Extract tenant ID from HTTP requests using different strategies:
 * - Subdomain (tenant-abc.oods.app)
 * - Header (X-Tenant-ID)
 * - JWT claim (tenantId in token)
 * 
 * @module services/tenancy/tenant-resolver
 */

/**
 * Tenant resolution result
 */
export interface TenantResolutionResult {
  tenantId: string | null;
  source: 'subdomain' | 'header' | 'jwt' | 'path' | 'default';
  metadata?: Record<string, unknown>;
}

/**
 * Tenant resolver interface
 */
export interface ITenantResolver {
  /**
   * Resolve tenant ID from request
   */
  resolve(request: RequestLike): TenantResolutionResult;
}

/**
 * Minimal request interface for tenant resolution
 */
export interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  hostname?: string;
  url?: string;
}

/**
 * Base resolver with common utilities
 */
abstract class BaseTenantResolver implements ITenantResolver {
  abstract resolve(request: RequestLike): TenantResolutionResult;

  protected getHeader(request: RequestLike, name: string): string | null {
    const value = request.headers?.[name.toLowerCase()];
    if (Array.isArray(value)) {
      return value[0] ?? null;
    }
    return value ?? null;
  }

  protected validateTenantId(tenantId: string | null): string | null {
    if (!tenantId || typeof tenantId !== 'string') {
      return null;
    }
    // Basic validation: alphanumeric, hyphens, underscores
    if (!/^[a-zA-Z0-9_-]+$/.test(tenantId)) {
      return null;
    }
    return tenantId;
  }
}

/**
 * Subdomain-based tenant resolver
 * 
 * @example
 * tenant-abc.oods.app → tenant-abc
 * alice.my-saas.com → alice
 */
export class SubdomainResolver extends BaseTenantResolver {
  constructor(
    private options: {
      /**
       * Base domain to strip (e.g., 'oods.app')
       */
      baseDomain?: string;
      /**
       * Tenant prefix to strip (e.g., 'tenant-')
       */
      tenantPrefix?: string;
    } = {}
  ) {
    super();
  }

  resolve(request: RequestLike): TenantResolutionResult {
    const hostname = request.hostname ?? this.getHeader(request, 'host') ?? '';
    
    // Strip base domain if configured
    let subdomain = hostname;
    if (this.options.baseDomain) {
      subdomain = hostname.replace(`.${this.options.baseDomain}`, '');
    }

    // Extract first segment (tenant-abc.staging.oods.app → tenant-abc)
    const [firstSegment] = subdomain.split('.');
    let tenantId: string | null = firstSegment ?? null;

    // Strip tenant prefix if configured
    if (tenantId && this.options.tenantPrefix) {
      tenantId = tenantId.replace(this.options.tenantPrefix, '');
    }

    tenantId = this.validateTenantId(tenantId);

    return {
      tenantId,
      source: 'subdomain',
      metadata: { hostname, subdomain },
    };
  }
}

/**
 * Header-based tenant resolver
 * 
 * @example
 * X-Tenant-ID: tenant-abc
 */
export class HeaderResolver extends BaseTenantResolver {
  constructor(
    private options: {
      /**
       * Header name to read (default: 'x-tenant-id')
       */
      headerName?: string;
    } = {}
  ) {
    super();
  }

  resolve(request: RequestLike): TenantResolutionResult {
    const headerName = this.options.headerName ?? 'x-tenant-id';
    const tenantId = this.validateTenantId(this.getHeader(request, headerName));

    return {
      tenantId,
      source: 'header',
      metadata: { headerName },
    };
  }
}

/**
 * JWT claim-based tenant resolver
 * 
 * @example
 * Authorization: Bearer eyJ... (with { tenantId: "tenant-abc" } claim)
 */
export class JWTResolver extends BaseTenantResolver {
  constructor(
    private options: {
      /**
       * JWT claim name (default: 'tenantId')
       */
      claimName?: string;
      /**
       * JWT verification function (optional)
       */
      verifyJWT?: (token: string) => Promise<Record<string, unknown>>;
    } = {}
  ) {
    super();
  }

  resolve(request: RequestLike): TenantResolutionResult {
    const authorization = this.getHeader(request, 'authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return { tenantId: null, source: 'jwt' };
    }

    const token = authorization.substring(7);
    
    // Simple base64 decode for demo (no verification)
    // In production, use proper JWT verification
    try {
      const payload = this.decodeJWT(token);
      const claimName = this.options.claimName ?? 'tenantId';
      const tenantId = this.validateTenantId(payload[claimName] as string);

      return {
        tenantId,
        source: 'jwt',
        metadata: { claimName },
      };
    } catch (error) {
      return { tenantId: null, source: 'jwt' };
    }
  }

  private decodeJWT(token: string): Record<string, unknown> {
    // Simple decode (no verification) for demo purposes
    // In production, use jose, jsonwebtoken, or similar
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    
    const payload = Buffer.from(parts[1] ?? '', 'base64').toString('utf-8');
    return JSON.parse(payload) as Record<string, unknown>;
  }
}

/**
 * Composite tenant resolver (chain of responsibility)
 * Tries multiple strategies in order until one succeeds
 */
export class TenantResolver implements ITenantResolver {
  private resolvers: ITenantResolver[];

  constructor(...resolvers: ITenantResolver[]) {
    this.resolvers = resolvers;
  }

  resolve(request: RequestLike): TenantResolutionResult {
    for (const resolver of this.resolvers) {
      const result = resolver.resolve(request);
      if (result.tenantId) {
        return result;
      }
    }

    return {
      tenantId: null,
      source: 'default',
    };
  }

  /**
   * Create default resolver based on environment
   */
  static createDefault(): TenantResolver {
    return new TenantResolver(
      new HeaderResolver(),
      new SubdomainResolver({ tenantPrefix: 'tenant-' }),
      new JWTResolver()
    );
  }
}
