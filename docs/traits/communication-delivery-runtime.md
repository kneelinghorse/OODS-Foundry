# Communication Delivery Runtime

The delivery runtime coordinates permission-gated, preference-aware message dispatching. It connects Communication (message schemas), Authable (EntitlementService), and Preferenceable (PreferenceCache + notification matrices) traits while hiding queue mechanics behind an adapter contract.

## Architecture Overview

```
MessageDeliveryService
 ├─ ChannelResolver ── PreferenceableBridge ─ PreferenceCache
 ├─ AuthableBridge   ─ EntitlementService
 ├─ QuietHoursChecker
 ├─ RetryScheduler
 └─ QueueAdapter (InMemory | Redis)
```

1. **sendMessage** validates sender/recipient permissions (`messages:send:*`, `messages:receive:*`).
2. ChannelResolver prioritises user preferences → organization defaults → system defaults and falls back to any enabled channel.
3. Quiet hours enforcement defers queue scheduling until the next delivery window.
4. A queue adapter persists payloads to FIFO storage; workers later pop entries, apply retries, and emit delivery attempts.

## Permission Gating Flow

1. AuthableBridge composes permission names using the `messages:{direction}:{channelType}` convention and caches decisions for 500 ms to avoid double hits while EntitlementService leverages PermissionCache.
2. Sender permissions are validated before recipient checks to fail fast when system actors lack entitlements.
3. Recipient permission failures are reflected in `blockedRecipients[]` with `reason: 'recipient-permission'` so downstream analytics can cluster failures.

## Preference & Quiet Hours Enforcement

* PreferenceableBridge pulls documents through PreferenceCache and normalizes notification matrices plus quiet hours.
* ChannelResolver consumes that data to choose a channel that the user has opted into; explicit opt-outs always win.
* QuietHoursChecker converts HH:MM windows plus day-of-week filters into Luxon intervals and reports whether now is within a muted period. The next delivery window is computed deterministically and used for `QueueMessage.scheduledAt`.

## Retry Logic

RetryScheduler derives runtime policies from the delivery policy’s `retry` block and metadata overrides (`linear_increment_seconds`, `max_backoff_seconds`).

| Strategy     | Formula                                             | Notes                         |
|--------------|------------------------------------------------------|-------------------------------|
| `none`       | `initial_delay_ms`                                   | Single attempt (no retries)   |
| `linear`     | `initial_delay + (attempt-1) * increment`            | Increment defaults to 60 s    |
| `exponential`| `initial_delay * 2^(attempt-1)` (clamped to max)     | Matches R20.6 exponential spec|
| `custom`     | `customSchedule(attempt)`                            | For specialised policies      |

## Queue Adapters

| Adapter      | Storage                                    | Durability | Use cases         |
|--------------|--------------------------------------------|-----------|-------------------|
| InMemory     | Sorted array + in-flight map                | process   | unit tests, dev   |
| Redis        | Sorted set (`ZADD`), payload hash, inflight | redis     | production queues |

Both adapters implement the `QueueAdapter<T>` contract (`enqueue`, `dequeue`, `ack`, `nack`, `peek`, `stats`). The Redis adapter serializes payloads with ISO timestamps, tracks in-flight receipts, and requeues messages with incremental attempts.

## Validation Checklist

* **Unit tests**
  * `tests/traits/communication/delivery-service.test.ts`
  * `tests/traits/communication/channel-resolver.test.ts`
  * `tests/traits/communication/retry-scheduler.test.ts`
* **Integration tests**
  * `tests/integration/communication-authable-integration.test.ts`
  * `tests/integration/communication-preferenceable-integration.test.ts`
* **Performance benchmarks**
  * `tests/performance/delivery-service-benchmarks.test.ts`

## Operational Notes

* Queue throughput and latency metrics are exposed via `QueueStats`; the Redis adapter can be wired to Prometheus exporters.
* The service never marks missions complete until queue enqueue succeeds, ensuring telemetry can detect gaps between permission checks and scheduling.
* Future workers will use `retryPolicy` embedded inside the queue payload to request scheduled retries through `RetryScheduler.scheduleRetry()`.
