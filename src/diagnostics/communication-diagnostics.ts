import TimeService from '@/services/time/index.js';
import type { DeliveryStats } from '@/traits/communication/runtime-types.js';
import type { SLAMetrics, SLAMonitor } from '@/traits/communication/sla-monitor.js';
import type { ThrottlingDiagnostics, ThrottlingEnforcer } from '@/traits/communication/throttling-enforcer.js';

export interface SLAStats {
  readonly timeToSend: SLAMetrics;
  readonly successRate: SLAMetrics;
  readonly retryExhaustionRate: number;
}

export interface ThrottlingStats extends ThrottlingDiagnostics {}

export interface CommunicationDiagnosticsOptions {
  readonly throttlingEnforcer: ThrottlingEnforcer;
  readonly slaMonitor: SLAMonitor;
  readonly deliveryStatsProvider?: () => Promise<DeliveryStats> | DeliveryStats;
  readonly slaWindowHours?: number;
}

export class CommunicationDiagnostics {
  private readonly throttlingEnforcer: ThrottlingEnforcer;
  private readonly slaMonitor: SLAMonitor;
  private readonly deliveryStatsProvider?: () => Promise<DeliveryStats> | DeliveryStats;
  private readonly slaWindowHours: number;

  constructor(options: CommunicationDiagnosticsOptions) {
    this.throttlingEnforcer = options.throttlingEnforcer;
    this.slaMonitor = options.slaMonitor;
    this.deliveryStatsProvider = options.deliveryStatsProvider;
    this.slaWindowHours = Math.max(1, options.slaWindowHours ?? 24);
  }

  async collectThrottlingMetrics(): Promise<ThrottlingStats> {
    return this.throttlingEnforcer.getDiagnostics();
  }

  async collectSLAMetrics(): Promise<SLAStats> {
    const windowHours = this.slaWindowHours;
    const [timeToSend, successRate, retryExhaustionRate] = await Promise.all([
      this.slaMonitor.getTimeToSendMetrics(windowHours),
      this.slaMonitor.getSuccessRateMetrics(windowHours),
      this.slaMonitor.getRetryExhaustionRate(windowHours),
    ]);
    return { timeToSend, successRate, retryExhaustionRate } satisfies SLAStats;
  }

  async collectDeliveryStats(): Promise<DeliveryStats> {
    if (!this.deliveryStatsProvider) {
      return {
        messageId: 'n/a',
        queued: 0,
        blocked: 0,
        blockedReasons: {},
        startedAt: TimeService.nowSystem().toJSDate().toISOString(),
        completedAt: TimeService.nowSystem().toJSDate().toISOString(),
      } satisfies DeliveryStats;
    }
    const result = this.deliveryStatsProvider();
    return Promise.resolve(result);
  }
}
