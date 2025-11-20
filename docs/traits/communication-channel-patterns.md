# Communication Channel Configuration Patterns

This guide codifies the provider-specific configuration practices that underpin the Communicable trait. Every section references R20.1 §2.1 transport constraints and threads tokens + diagnostics back into the trait runtime.

## Email (SMTP / SaaS)

- **Providers** – `smtp`, `ses`, `sendgrid`, `mailgun`, `postmark`, or `custom`.
- **Authentication** – Always encrypt credentials in secrets storage; rotate every 90 days. When using SMTP, prefer STARTTLS on port 587 per R20.1 §2.1.
- **From / Reply-To** – Provide both display name + email, and ensure reply-to is explicitly defined for conversational flows.
- **Headers** – Use campaign IDs (`X-OODS-Campaign`) and message fingerprinting to support Classifiable tags.
- **Attachments** – Validate MIME types and size budgets (default 10 MB) before queueing messages.

```ts
const primaryEmailChannel = {
  id: 'primary-email',
  name: 'Primary Email',
  type: 'email',
  enabled: true,
  config: {
    provider: 'smtp',
    host: 'smtp.example.com',
    port: 587,
    secure: true,
    from: { name: 'OODS Notifications', email: 'notifications@example.com' },
  },
};
```

## SMS (Twilio / SNS / Others)

- **Sender IDs** – Use alphanumeric IDs where carriers allow, but fall back to E.164 numbers. Validate via regex `^\+[1-9]\d{1,14}$`.
- **Long code pool** – Keep pools balanced by throughput and rotate numbers flagged for deliverability issues (R20.1 §2.1).
- **Receipts** – Enable delivery receipts; register a webhook for DLR to feed MessageStatus entries.
- **Character limits** – Default to 320 characters (GSM-7) and degrade to concatenated segments when necessary.

## Push (FCM/APNS/WNS)

- **Credentials** – Provide key ID, key, and optional team/bundle IDs per provider. Secrets should remain outside SCM.
- **Silent notifications** – Use `supports_silent` to distinguish between background sync vs. alerting pushes (R20.6 §2.4).
- **Topics** – Use topic arrays to map Preferenceable scopes (e.g., `notifications.onboarding`).
- **Badges** – `badge_strategy` controls how unread counts roll forward; default `increment` keeps parity with iOS guidance.

## In-app (Notification Center)

- **Notification center** – Reference the center/stream IDs consumed by the View Engine timeline.
- **Retention** – Keep retention ≤ 90 days to avoid unbounded storage; mission default is 30 days.
- **Mark as seen** – Gate this feature if Authable roles differentiate between viewers/editors (R20.6 §3.3).
- **Metadata** – Use metadata map for customizing icons / intents consumed by the UI kit (B29.5).

## Webhook

- **URL + Method** – Accept POST/PUT only; include explicit `signature_header` + HMAC secret.
- **Retry** – Provide `max_attempts` ≤ 10 with `backoff_seconds` ≤ 3600. Enforce idempotency using delivery attempt IDs from MessageStatus.
- **Headers** – Store additional headers per integration; never embed credentials directly in URLs.
- **DLR parity** – Feed webhook failure retries back into MessageStatus entries for R20.1 §3.2 observability.

## Diagnostics & Guardrails

1. **Registry enforcement** – `validateCommunicationSchema(channel, 'channel')` ensures JSON Schema + Zod parity.
2. **Token usage** – Channel UI surfaces should reference `--sys-communication-accent` (active) and `--sys-communication-muted` (inactive) tokens.
3. **Preference checks** – Always evaluate the Preferenceable notification matrix before invoking runtime deliveries.
4. **Authable gates** – Sender + recipient permissions must be asserted to satisfy R20.6 §3.3.
5. **Telemetry** – Publish deliverability metrics to `telemetry/events` for Chromatic dashboards.
