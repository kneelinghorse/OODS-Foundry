import { describe, expect, it, vi } from 'vitest';

import type { PreferenceRecord } from '../../../src/schemas/preferences/preference-document.js';
import {
  applyChannelPreference,
  createNotificationMatrix,
  getNotificationMatrixFromPreferences,
  setNotificationMatrixInPreferences,
} from '../../../src/traits/preferenceable/notification/notification-matrix.js';
import {
  NotificationPreferenceFilter,
  type NotificationEventPayload,
} from '../../../src/traits/preferenceable/notification/preference-filter.js';
import { NotificationChannelRouter } from '../../../src/traits/preferenceable/notification/channel-router.js';

describe('Notification preference matrix + routing', () => {
  it('normalizes preference matrices with defaults for missing channels', () => {
    const preferences: PreferenceRecord = {
      notifications: {
        matrix: {
          new_comment: { email: false },
        },
      },
    };

    const matrix = getNotificationMatrixFromPreferences(preferences);
    expect(matrix.new_comment.email).toBe(false);
    expect(matrix.new_comment.in_app).toBe(true);
    expect(matrix.mention.email).toBe(true);
  });

  it('round-trips matrices in and out of preference records', () => {
    const preferences: PreferenceRecord = {};
    const matrix = createNotificationMatrix();
    const updated = setNotificationMatrixInPreferences(preferences, matrix);

    expect(updated).not.toBe(preferences);
    expect(updated.notifications).toBeDefined();
    expect((updated.notifications as PreferenceRecord).matrix).toEqual(matrix);
  });

  it('filters enabled channels per event and respects fallbacks', () => {
    const matrix = createNotificationMatrix({
      seed: {
        mention: { email: true, push: false, sms: false, in_app: true },
      },
    });
    const filter = new NotificationPreferenceFilter(matrix, {
      fallbackChannels: ['email'],
    });

    expect(filter.getEnabledChannels('mention')).toEqual(['email', 'in_app']);
    expect(filter.getEnabledChannels('unknown-event')).toEqual(['email']);
    expect(filter.isChannelEnabled('mention', 'push')).toBe(false);
    expect(filter.isChannelEnabled('mention', 'email')).toBe(true);
  });

  it('routes enabled channels and reports missing handlers', async () => {
    const matrix = applyChannelPreference(
      createNotificationMatrix(),
      'billing_alert',
      'sms',
      true
    );
    const filter = new NotificationPreferenceFilter(matrix);

    const emailHandler = vi.fn();
    const inAppHandler = vi.fn();
    const router = new NotificationChannelRouter({
      filter,
      handlers: {
        email: emailHandler,
        in_app: inAppHandler,
      },
    });

    const event: NotificationEventPayload<{ amount: number }> = {
      type: 'billing_alert',
      recipientId: 'user-123',
      payload: { amount: 19.0 },
    };

    const result = await router.route(event);

    expect(result.enabledChannels).toEqual(['email', 'push', 'sms', 'in_app']);
    expect(result.dispatchedChannels).toEqual(['email', 'in_app']);
    expect(result.missingHandlers).toEqual(['push', 'sms']);
    expect(emailHandler).toHaveBeenCalledTimes(1);
    expect(inAppHandler).toHaveBeenCalledTimes(1);
    expect(emailHandler).toHaveBeenCalledWith({ channel: 'email', event });
  });
});
