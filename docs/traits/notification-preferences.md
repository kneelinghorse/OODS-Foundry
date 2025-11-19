# Notification Preferences Matrix

Sprint 27 expands the Preferenceable trait with a channel × event matrix so users can opt into specific delivery channels per notification type. The implementation pairs a normalized JSON schema with runtime helpers, routing utilities, and an interactive React editor so backend services, UI, and automated tests stay aligned.

## Matrix Schema & Storage

- `schemas/preferences/notification-preferences.schema.json` defines the nested `notifications.matrix[eventType][channel]` shape. Default events cover `new_comment`, `mention`, `new_follower`, and `billing_alert`; channel keys are extensible via regex guards.
- `src/traits/preferenceable/notification/notification-matrix.ts` exposes helpers for normalization and persistence:
  ```ts
  import {
    createNotificationMatrix,
    getNotificationMatrixFromPreferences,
    setNotificationMatrixInPreferences,
    applyChannelPreference,
  } from '@/traits/preferenceable/notification/notification-matrix.js';

  const matrix = createNotificationMatrix();
  const updated = applyChannelPreference(matrix, 'mention', 'sms', false);
  const prefs = setNotificationMatrixInPreferences(store.getPreferences(), updated);
  ```
- All helpers respect custom event/channel definitions and clone preference records to avoid accidental mutation of JSONB snapshots.

## Preference-as-Filter Service

`src/traits/preferenceable/notification/preference-filter.ts` implements the Preference-as-Filter architecture:

```ts
const filter = new NotificationPreferenceFilter(matrix, {
  fallbackChannels: ['email'],
});
const result = filter.apply({ type: 'new_comment', recipientId: 'user-42' });
result.enabledChannels; // -> ['email', 'in_app'] based on user preferences
```

- Unknown events fall back to the supplied channel list.
- `isChannelEnabled()` checks a specific channel without recalculating the matrix.
- Utility `filterChannelsForEvent()` is available for lightweight checks outside of class instances.

## Channel Router Integration

`src/traits/preferenceable/notification/channel-router.ts` consumes the filter result and fans out to channel handlers:

```ts
const router = new NotificationChannelRouter({
  matrix,
  handlers: {
    email: ({ event }) => queueEmail(event),
    in_app: ({ event }) => renderNotification(event.payload),
  },
});
await router.route({ type: 'billing_alert', recipientId: 'acct-9' });
```

- Route results list dispatched channels and any enabled channels without registered handlers (`missingHandlers`).
- Handlers can be registered or removed dynamically via `registerHandler` / `unregisterHandler`.
- Router instances reuse a shared `NotificationPreferenceFilter`, so downstream services do not need to duplicate filtering logic.

## NotificationMatrix React Component

`src/components/preferences/NotificationMatrix.tsx` renders the matrix editor with full accessibility support:

- Channel toggles use the reusable `ChannelToggle` button and emit `NotificationPreferenceMatrix` payloads through `onChange`.
- Bulk controls allow “Enable all”, “Disable all”, and per-channel toggles from the header row.
- The table consumes `DEFAULT_NOTIFICATION_EVENTS` / `DEFAULT_NOTIFICATION_CHANNELS`, but callers can supply their own definitions to match a specific product domain.

Tests in `tests/components/preferences/NotificationMatrix.test.tsx` verify per-cell toggles, global bulk controls, and column actions so regressions are caught automatically.

## Trait Tests & Example Usage

`tests/traits/preferenceable/notification-routing.test.ts` ensures matrix normalization, filter behavior, and channel routing work end-to-end. A runnable script in `examples/preferences/notification-matrix-example.ts` demonstrates how to store matrices in the PreferenceStore and route events through the new APIs.

Use this guide whenever a mission touches notification routing, to keep schema updates, UI, and backend consumers in sync across Sprint 27 workstreams.
