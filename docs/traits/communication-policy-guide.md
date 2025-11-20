# Communication Policy Guide

Communication delivery policies govern how messages are retried, throttled, and delayed during quiet hours. This guide summarizes the DSL exposed by `policy-builder.ts`, the throttling guardrails, and the SLA metrics produced by `sla-monitor.ts`.

## Policy Builder at a Glance

- **Builder API**: `createDeliveryPolicy()` returns a chainable builder with `setRetry`, `setThrottling`, `setQuietHours`, `setPriority`, and `setMetadata`.
- **Validation**: Policies are validated against `deliveryPolicySchema`; `max_attempts` must be greater than zero and throttling windows must be non-decreasing (minute ≤ hour ≤ day).
- **Presets**:
  - `standardPolicy()` — balanced defaults: 10/min, 120/hour, exponential retry ×3 (R20.1 Part 5.1).
  - `urgentPolicy()` — priority override with `burst_limit` for short bypasses (R20.1 Part 5.3 Priority Bypass).
  - `lowPriorityPolicy()` — conservative caps for bulk messaging.

```ts
import { createDeliveryPolicy, urgentPolicy } from '@/traits/communication/policy-builder.js';

// Custom policy
const policy = createDeliveryPolicy({ id: 'welcome', name: 'Welcome Policy' })
  .setRetry({ max_attempts: 4, backoff_strategy: 'exponential', initial_delay_seconds: 45 })
  .setThrottling({ max_per_minute: 5, max_per_hour: 50, max_per_day: 500 })
  .setQuietHours({ start_time: '22:00', end_time: '07:00', timezone: 'America/New_York', days_of_week: ['monday', 'tuesday'] })
  .build();

// Urgent preset (burst bypass)
const escalation = urgentPolicy();
```

## Throttling Limits

- **Sliding window enforcement** (R20.1 Part 5.1 PATTERN 2): per-minute, per-hour, and per-day windows enforced in `throttling-enforcer.ts` using sorted-set windows.
- **Per-channel keys**: keys are namespaced `throttle:<channel>:<user>` to isolate traffic sources.
- **Priority bypass**: `priority = 'urgent'` bypasses throttling until `metadata.burst_limit` is reached; retries then honor normal limits.
- **Quiet hours**: quiet-hour windows defer scheduling via `quiet-hours-checker.ts` (days of week + timezone aware).

## SLA Metrics

`sla-monitor.ts` records delivery outcomes and persists aggregated telemetry to `communication.sla_metrics` (migration 010).

- **Tracked metrics (R20.6 Part 5.1 / TABLE 3)**
  - `time_to_send`: queued → sent latency (p50/p95/p99)
  - `success_rate`: delivered/read ratio (%)
  - `retry_exhaustion_rate`: percentage of retries that reach exhaustion
- **Queries**

```ts
const timeMetrics = await slaMonitor.getTimeToSendMetrics(24); // last 24 hours
const success = await slaMonitor.getSuccessRateMetrics(24);
const exhaustion = await slaMonitor.getRetryExhaustionRate(24);
```

Metrics persist automatically via `communication.sla_metrics` with `idx_sla_metrics_type_window` for recent-window lookups.

## Guardrails

- No direct color literals or UI styling here; throttling and SLA remain headless services.
- Keep retry and throttling limits sane: minute ≤ hour ≤ day, and never set all three to zero.
- Align policies with engagement risk:
  - Urgent: safety-critical or abuse alerts (burst limited)
  - Standard: transactional receipts and confirmations
  - Low priority: newsletters, bulk announcements

## References

- R20.1 Part 5.1 PATTERN 2 — Sliding window rate limiting
- R20.1 Part 5.3 — Priority bypass for urgent messages
- R20.6 Part 5.1 TABLE 3 — Time-to-send SLO (p95 within 5 minutes)
- R20.6 Part 5.2 — Success rate ≥98%
- R20.6 Part 5.3 — Retry exhaustion <2%
