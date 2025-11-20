# Communicable Trait

The Communicable trait packages the canonical messaging primitives described in R20.1 (Notification Model) and R20.6 (Messaging Systems) into a reusable extension for OODS objects. It coordinates multi-channel orchestration, template governance, delivery policy enforcement, and threaded conversations in a way that stays aligned with Preferenceable (routing), Authable (permissions), and Classifiable (categorization) capabilities.

## Research Foundations

- **Multi-channel orchestration** – Channel taxonomy, fallback ordering, and per-transport constraints come directly from R20.1 §2.1 (Channel Taxonomy) and §2.2 (Provider Profiles).
- **Template-driven personalization** – Subject/body + variable binding semantics follow R20.1 §2.3 and §4.1, ensuring placeholders map to declared fields and localization metadata remains BCP 47 compliant.
- **Delivery state machine** – Message + status schemas embed the `queued → sent → delivered → failed → retried → read` lifecycle from R20.1 §3.1 and §3.2, including retry semantics and quiet-hour enforcement hooks.
- **Conversation + acknowledgment patterns** – R20.6 §1.2, §2.4, and §3.3 drive the distinction between atomic messages and threaded conversations, including membership roles and read-receipt propagation.
- **Async queue architecture** – Delivery execution is modeled after the queue adapters in R20.6 §4.1 and §4.3, ensuring payloads remain transport-agnostic and side effects are deferred to delivery workers.
- **Authorization bridge** – Sender/recipient gating mirrors the membership junction described in R20.6 §3.3 and R20.1 §4.2, guaranteeing Authable hooks can deny attempts before the message enters the queue.
- **Preference routing** – Notification matrix lookups reference R20.1 §4.2 and R20.6 Appendix B for quiet-hour + opt-in auditing, feeding directly into Preferenceable state.

## Trait Anatomy

| Section | Details |
| --- | --- |
| **Parameters** | `channelTypes` (string[]) controls allowed transports; `supportConversations` toggles threaded conversations. |
| **Schema fields** | `channel_catalog`, `template_catalog`, `delivery_policies`, `messages`, `conversations`, `message_statuses`. |
| **Semantics** | Component hints point to `ChannelGrid`, `TemplateDrawer`, `DeliveryPolicyCapsule`, and `MessageTimeline` with `--sys-communication-*` token bindings per mission guardrails. |
| **Dependencies** | Preferenceable (routing), Authable (sender/recipient permissions), Classifiable (optional tagging). |

## Schema Reference

### Channel (R20.1 §2.1)

Represents a transport provider with strongly typed configuration per channel type.

- `id`, `name`, `type`, `enabled`, `tags`, `metadata`
- `config` discriminates across Email (SMTP/SaaS), SMS (Twilio/SNS), Push (FCM/APNS/WNS), In-app (notification center), and Webhook providers, plus a catch-all for custom transports.
- Guards: `channelTypeSchema`, provider-specific regex constraints, token-level semantics referencing `--sys-communication-accent`.

### Template (R20.1 §2.3)

Captures subject/body, locale, and declared variables. The validator enforces that every `{{variable}}` in the body appears in the `variables` array and vice versa, mirroring the substitution rules documented in §2.3. Locale validation follows the BCP 47 guidance from R20.1 §4.1.

### Delivery Policy (R20.1 §3.1)

Defines retry policy (attempts, backoff strategy, initial delay), throttling ceilings, quiet hours (timezone + days), and priority (`urgent|high|normal|low`). This mirrors the control plane spelled out in §3.1 and §3.2, ensuring every queued message references a well-defined SLA profile.

### Message (R20.6 §1.2)

Atomic payload including sender/recipient identifiers, template linkage, metadata, attachments, priority, and lifecycle timestamps. Validation verifies:

- Recipient list uniqueness (R20.6 §2.1 fairness contract)
- Chronological timestamps (queue → send → deliver → read) per §2.4 acknowledgment ordering
- Status history parity with the top-level `status` field

### Conversation (R20.6 §3.3)

Threaded container that records participants (owner/member/viewer), messages, status (`active|archived|deleted`), and metadata. Conversations ensure multi-party threads respect Authable memberships before exposing transcripts (R20.6 §3.3 Authorization Bridge).

### Message Status (R20.1 §3.2 & R20.6 §2.4)

Individual transition entries keyed by `message_id` with state, timestamp, and optional channel response/error codes. These records power the MessageTimeline view extension and allow downstream analytics to reason about retries vs. permanent failures.

## Integration Guide

### Authable Guardrails (R20.6 §3.3)

Before queueing a message, compute the sender’s membership via Authable:

```ts
const { success: authzOk } = authable.validateMembership({
  user_id: message.sender_id,
  organization_id: tenantId,
  role_id: 'communications-sender'
});
if (!authzOk) throw new Error('Sender lacks permission messages:send');
```

### Preferenceable Routing (R20.1 §4.2)

Use Preferenceable’s notification matrix to determine if a recipient has opted in to the combination of `eventType` and `channel_type`:

```ts
const matrix = preferenceable.resolveNotificationMatrix(recipientId, 'notifications');
if (!matrix[eventType]?.[message.channel_type]) {
  return { skipped: true, reason: 'recipient-opted-out' };
}
```

### Classifiable Augmentation (R20.6 Appendix B)

Tag high-volume campaigns or compliance-sensitive threads so downstream rule engines can filter or apply retention policies:

```ts
classifiable.assignTags('message', message.id, ['support', 'sla-4h']);
```

## Runtime Surface Example

```ts
import { createCommunicableTrait } from '@/traits/communication/communication-trait.js';

const trait = createCommunicableTrait({
  channels: [primaryEmailChannel],
  templates: [welcomeTemplate],
  deliveryPolicies: [standardDeliveryPolicy],
});

const result = trait.queueMessage({
  id: 'msg_01hf0v1',
  sender_id: 'user_admin',
  recipient_ids: ['user_new'],
  channel_type: 'email',
  template_id: 'welcome-email-v1',
  created_at: '2025-11-20T05:10:00Z',
});

if (!result.success) {
  console.error('Message failed validation', result.errors);
}
```

## Validation & Testing

1. **Schema coverage** – `pnpm test --run tests/traits/communication/schema-registry.test.ts`
2. **Zod DTOs + type guards** – `pnpm test --run tests/traits/communication/schema-validator.test.ts`
3. **Runtime API** – `pnpm test --run tests/traits/communication/communication-trait.test.ts`
4. **Type safety** – `pnpm typecheck`
5. **Docs lint** – `pnpm lint docs/traits/communicable-trait.md`

Each suite is aligned with R20.1 §3 validation gates and R20.6 §4 queue diagnostics to ensure ≥90% coverage and parity between JSON Schema + Zod DTOs.
