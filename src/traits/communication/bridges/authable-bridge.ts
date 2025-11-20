import type { ChannelType } from '@/schemas/communication/common.js';
import TimeService from '@/services/time/index.js';
import type { EntitlementService } from '@/traits/authz/entitlement-service.js';

export interface AuthableBridgeOptions {
  readonly permissionNamespace?: string;
  readonly decisionTtlMs?: number;
  readonly permissionBuilder?: (direction: 'send' | 'receive', channelType: ChannelType, namespace: string) => string;
}

interface DecisionCacheEntry {
  readonly outcome: boolean;
  readonly expiresAt: number;
}

export class AuthableBridge {
  private readonly permissionNamespace: string;
  private readonly ttlMs: number;
  private readonly buildCustomPermission?: (direction: 'send' | 'receive', channelType: ChannelType, namespace: string) => string;
  private readonly cache = new Map<string, DecisionCacheEntry>();

  constructor(private readonly entitlementService: EntitlementService, options: AuthableBridgeOptions = {}) {
    this.permissionNamespace = options.permissionNamespace ?? 'messages';
    this.ttlMs = Math.max(1, options.decisionTtlMs ?? 500);
    this.buildCustomPermission = options.permissionBuilder;
  }

  validateSenderPermission(userId: string, organizationId: string, channelType: ChannelType): Promise<boolean> {
    return this.checkPermission('send', userId, organizationId, channelType);
  }

  validateRecipientPermission(userId: string, organizationId: string, channelType: ChannelType): Promise<boolean> {
    return this.checkPermission('receive', userId, organizationId, channelType);
  }

  private async checkPermission(
    direction: 'send' | 'receive',
    userId: string,
    organizationId: string,
    channelType: ChannelType
  ): Promise<boolean> {
    const key = this.cacheKey(direction, userId, organizationId, channelType);
    const cached = this.cache.get(key);
    const now = TimeService.nowSystem().toMillis();
    if (cached && cached.expiresAt > now) {
      return cached.outcome;
    }
    const permission = this.buildPermission(direction, channelType);
    const outcome = await this.entitlementService.hasPermission(userId, organizationId, permission);
    this.cache.set(key, { outcome, expiresAt: now + this.ttlMs });
    return outcome;
  }

  private buildPermission(direction: 'send' | 'receive', channelType: ChannelType): string {
    if (this.buildCustomPermission) {
      return this.buildCustomPermission(direction, channelType, this.permissionNamespace);
    }
    return `${this.permissionNamespace}:${direction}:${channelType}`;
  }

  private cacheKey(direction: 'send' | 'receive', userId: string, organizationId: string, channelType: ChannelType): string {
    return `${direction}:${organizationId}:${userId}:${channelType}`;
  }
}
